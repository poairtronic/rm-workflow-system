# PHASE 15.4 — POSTGRESQL EMAIL WORKER IMPLEMENTATION REPORT

**Phase**: 15.4 — Email Worker Implementation  
**Status**: CONFIGURED, TESTED, BUILT & CERTIFIED (PASS)  
**Date**: September 23, 2026  
**System**: RMRIT (Raw Material Requirements, Inventory & Tracking System)

---

## 1. OBJECTIVE

Phase 15.4 implements the background Email Worker (`EmailWorkerService`) responsible for safely consuming email jobs from the durable PostgreSQL queue (`email_jobs`), resolving required email templates/content via `TemplateResolver`, executing delivery requests through the provider abstraction (`IEmailProvider`), recording results (SENT, RETRYING, FAILED), handling stale lock recovery, and supporting graceful application shutdown.

---

## 2. CORE ARCHITECTURE

The approved communication flow is:

```
                  NEON POSTGRESQL
                         │
                         ▼
                    email_jobs
                         │
                         ▼
               PostgreSQL Queue
            (EmailQueueService)
                         │
                         ▼
                    Email Worker
               (EmailWorkerService)
                         │
                         ▼
             Provider Abstraction
               (IEmailProvider)
                         │
                         ▼
                TestEmailProvider
          (Phase 15.5: GmailApiProvider)
```

### Key Architectural Boundaries
- **No Direct Gmail API HTTP Calls**: The worker depends strictly on the `IEmailProvider` interface abstraction.
- **No `googleapis` Direct Imports**: Gmail API HTTP transport and OAuth handling are isolated to Phase 15.5.
- **No Database Lock open during Provider Call**: Job claim and status updates execute in independent, committed PostgreSQL transactions. Provider delivery takes place outside database transactions.

---

## 3. PHASE 15.2 COMPATIBILITY

- Reused `EmailJob` entity (`backend/src/email/entities/email-job.entity.ts`).
- Reused database schema `email_jobs` (UUID primary key, status, priority, attempts, max_attempts, next_retry_at, locked_at, locked_by, sent_at, idempotency_key).
- Zero entity schema regressions or table rebuilds.

---

## 4. PHASE 15.3 COMPATIBILITY

- The worker claims jobs strictly using `EmailQueueService.claimJobs(...)`, which executes SQL `SELECT ... FOR UPDATE SKIP LOCKED` atomically.
- Lock updates (`status = 'PROCESSING'`, `locked_at = NOW()`, `locked_by = workerId`, `attempts = attempts + 1`) are committed before provider delivery.
- Job completion updates use `EmailQueueService.markSuccess(...)`, `EmailQueueService.markFailed(...)`, and `EmailQueueService.recoverStaleJobs(...)`.

---

## 5. WORKER LIFECYCLE

`EmailWorkerService` implements standard NestJS lifecycle interfaces:
- `OnModuleInit`: Initializes worker options and starts polling engine when enabled.
- `OnApplicationShutdown`: Initiates graceful shutdown by disabling new job claims, clearing active polling timers, awaiting in-flight job processing completion, and releasing resources.

---

## 6. WORKER STARTUP

- Controlled via `start(autoLoop?: boolean)`.
- When initialized by NestJS module bootstrap, starts background loop if `EMAIL_WORKER_ENABLED=true` (disabled automatically in test environment to prevent background races).

---

## 7. QUEUE POLLING

- Non-overlapping polling loop implemented with `setTimeout` recursion.
- Poll interval: Configurable (default `5000` ms).
- Busy loop prevention: When queue is empty, worker sleeps for poll interval.
- Overlap prevention: `isPolling` boolean flag prevents concurrent tick executions on the same worker instance.

---

## 8. JOB CLAIMING

- Batch size: Configurable (default `10` jobs).
- Order: Priority DESC, CreatedAt ASC, ID ASC.
- Concurrency control: Atomic SQL `SELECT ... FOR UPDATE SKIP LOCKED`.

---

## 9. PROCESSING FLOW

1. **Claim**: `EmailQueueService.claimJobs(batchSize, workerId)` returns claimed rows in `PROCESSING` state.
2. **Content Resolution**: `TemplateResolver.resolveContent(job)` resolves subject and text/HTML bodies from direct job fields or template key definitions.
3. **Delivery**: Invokes `emailProvider.send(deliveryMessage)` (outside DB transaction).
4. **Result Recording**:
   - Success: `EmailQueueService.markSuccess(job.id, workerId, providerMessageId)` -> `SENT`.
   - Failure: `EmailQueueService.markFailed(job.id, workerId, errorMessage, retryBackoffSeconds, isTerminal)` -> `RETRYING` or `FAILED`.

---

## 10. TEMPLATE / CONTENT HANDLING

- Handled by `@Injectable()` `TemplateResolver` (`backend/src/email/resolvers/template.resolver.ts`).
- Uses direct `subject`, `bodyText`, and `bodyHtml` when present on `EmailJob`.
- Resolves known template keys (`AUTH_PASSWORD_RESET`, `WORKFLOW_RM_SUBMITTED`, `WORKFLOW_MATERIAL_ISSUED`, `WORKFLOW_ADDITIONAL_REQUEST`, `WORKFLOW_SC_COMPLETED`).
- Rejects missing content or unknown template keys cleanly by throwing `MalformedJobException` (processed as terminal non-retryable failure).

---

## 11. PROVIDER ABSTRACTION

- Defined in `backend/src/email/interfaces/email-provider.interface.ts`:
  - `EmailDeliveryMessage`: `{ to, recipientName, subject, bodyText, bodyHtml, eventType, templateKey, jobId, idempotencyKey }`
  - `EmailDeliveryResult`: `{ success, providerMessageId, error, retryable }`
  - `IEmailProvider`: `send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult>`
  - Injection token: `EMAIL_PROVIDER` (`'EMAIL_PROVIDER'`).

---

## 12. SUCCESS HANDLING

- Status updated to `EmailJobStatus.SENT`.
- `sent_at` timestamp set to current time.
- `provider_message_id` stored when returned by provider.
- Lock cleared: `locked_at = NULL`, `locked_by = NULL`.

---

## 13. RETRY HANDLING

- Temporary/retryable errors (e.g., 503 Service Unavailable, network timeout) transition job to `RETRYING`.
- `next_retry_at` set to `NOW() + retryBackoffSeconds` (default 60s).
- `last_error` populated with sanitized error string.
- Lock cleared so job becomes eligible for retry after backoff expires.

---

## 14. FAILURE HANDLING

- Terminal failures (attempts >= max_attempts OR non-retryable provider error OR malformed job) transition status to `FAILED`.
- `next_retry_at` cleared to `NULL`.
- `last_error` populated with sanitized error details.
- Lock cleared.

---

## 15. STALE RECOVERY

- Worker automatically executes `EmailQueueService.recoverStaleJobs(staleThresholdSeconds)` at the start of poll cycles.
- Stranded `PROCESSING` jobs locked longer than threshold (default 300s) are reset to `RETRYING` (or `FAILED` if max attempts reached) with `locked_at = NULL` and `locked_by = NULL`.

---

## 16. GRACEFUL SHUTDOWN

- Implements `OnApplicationShutdown`.
- Disables new job claims (`isRunning = false`).
- Clears pending polling timers.
- Awaits active in-flight batch execution up to `shutdownTimeoutMs` (default 10,000 ms).

---

## 17. WORKER IDENTITY

- Unique logical instance ID generated per worker: `worker-${hostname}-${pid}-${randomHex}` or configured via `EMAIL_WORKER_ID`.
- Prevents worker instance claim collisions and validates lock ownership.

---

## 18. CONFIGURATION

The worker reads standard configuration settings via NestJS `ConfigService` or environment variables:
- `EMAIL_WORKER_ENABLED`: Boolean (default `true`, `false` in test environment).
- `EMAIL_WORKER_POLL_INTERVAL_MS`: Integer ms (default `5000`).
- `EMAIL_WORKER_BATCH_SIZE`: Integer count (default `10`).
- `EMAIL_WORKER_STALE_THRESHOLD_SECONDS`: Integer seconds (default `300`).
- `EMAIL_WORKER_RETRY_BACKOFF_SECONDS`: Integer seconds (default `60`).
- `EMAIL_WORKER_SHUTDOWN_TIMEOUT_MS`: Integer ms (default `10000`).
- `EMAIL_WORKER_ID`: Custom string worker identifier.

---

## 19. SECURITY

- `EmailWorkerService.sanitizeLog(msg)` redacts sensitive auth patterns from log output:
  - `GMAIL_CLIENT_SECRET=[REDACTED]`
  - `GMAIL_REFRESH_TOKEN=[REDACTED]`
  - `access_token=[REDACTED]`
  - `Bearer [REDACTED]`
  - `password=[REDACTED]`
- Verified via regression test W022.

---

## 20. CONCURRENCY TESTING

- Real PostgreSQL database concurrency executed via `SELECT ... FOR UPDATE SKIP LOCKED`.
- Multi-worker tests W011 and W012 run parallel worker instances (`workerA`, `workerB`) against live Neon PostgreSQL database.
- Executed with `--no-file-parallelism` to preserve database transaction isolation.

---

## 21. PROVIDER TEST STRATEGY

- Implemented `TestEmailProvider` (`backend/src/email/providers/test-email.provider.ts`).
- Records sent messages in memory.
- Allows deterministic simulation of success, retryable failures, non-retryable failures, custom message IDs, and provider unavailability.
- Zero outbound network or Gmail API calls during testing.

---

## 22. TEST MATRIX & RESULTS (W001–W022)

Executed test file: `backend/test/phase-15-4-email-worker.spec.ts`

| Test ID | Description | Result |
| :--- | :--- | :---: |
| **W001** | Worker starts safely on empty queue | **PASS** |
| **W002** | Empty queue polling returns 0 without spinning | **PASS** |
| **W003** | Pending job processing via provider | **PASS** |
| **W004** | Successful delivery sets status SENT, sent_at, clears lock | **PASS** |
| **W005** | Provider message ID persistence | **PASS** |
| **W006** | Retryable provider failure sets RETRYING, next_retry_at, last_error | **PASS** |
| **W007** | Non-retryable failure sets FAILED, last_error, clears lock | **PASS** |
| **W008** | Max attempts ceiling moves job to FAILED | **PASS** |
| **W009** | Future retry timestamp excluded from claim | **PASS** |
| **W010** | Due retry timestamp becomes eligible for claim | **PASS** |
| **W011** | Concurrent workers single job claim (SKIP LOCKED) | **PASS** |
| **W012** | Multiple workers parallel distribution without double claim | **PASS** |
| **W013** | Stale processing job recovery (> threshold) | **PASS** |
| **W014** | Active non-stale processing job protected | **PASS** |
| **W015** | CANCELLED job excluded from delivery | **PASS** |
| **W016** | SENT job excluded from re-delivery | **PASS** |
| **W017** | FAILED job excluded from re-delivery | **PASS** |
| **W018** | Idempotency key uniqueness enforced | **PASS** |
| **W019** | Graceful shutdown stops new claims & releases resources | **PASS** |
| **W020** | Provider unavailable handled safely without lost jobs | **PASS** |
| **W021** | Malformed job handled safely without crashing worker | **PASS** |
| **W022** | Secret logging regression check (token/secret redaction) | **PASS** |

**Phase 15.4 Test Summary**: 22 passed, 0 failed (22/22 PASS)

---

## 23. REGRESSION TESTING SUMMARY

- **Phase 15.2 Test Suite**: `backend/test/phase-15-2-email-job-model.spec.ts` (22/22 PASS)
- **Phase 15.3 Test Suite**: `backend/test/phase-15-3-postgresql-email-queue.spec.ts` (22/22 PASS)
- **Phase 15.4 Test Suite**: `backend/test/phase-15-4-email-worker.spec.ts` (22/22 PASS)
- **Total Phase 15 Suite**: 66 passed, 0 failed (66/66 PASS)

---

## 24. BUILD & LINT VERIFICATION

- `npm run build`: **PASS** (NestJS TypeScript build completed with exit code 0)
- `npm run lint`: **PASS** (0 errors across 258 files)

---

## 25. METRIC COMPLIANCE MATRIX

| Metric | Target | Actual | Status |
| :--- | :---: | :---: | :---: |
| **API Endpoints Added** | 0 | 0 | **PASS** |
| **Frontend UI Changes** | 0 | 0 | **PASS** |
| **Business Workflow Changes** | 0 | 0 | **PASS** |
| **MERC Credential Reuse** | 0 | 0 | **PASS** |
| **Real Gmail API Calls (in 15.4)** | 0 | 0 | **PASS** |

---

## 26. DEFERRED WORK (PHASE 15.5+)

- Phase 15.5 will implement `GmailApiProvider` using official `googleapis` OAuth client transport.
- Phase 15.6 will implement advanced retry policies, dead-letter strategy, and provider failure classification.
- Phase 15.7 will integrate delivery audit logging.
- Phase 15.8 will perform final end-to-end security audit and certification.

---

## 27. FILES CHANGED / CREATED

1. `backend/src/email/interfaces/email-provider.interface.ts` [NEW]
2. `backend/src/email/providers/test-email.provider.ts` [NEW]
3. `backend/src/email/resolvers/template.resolver.ts` [NEW]
4. `backend/src/email/email-worker.service.ts` [NEW]
5. `backend/src/email/email-queue.service.ts` [MODIFY - added `isTerminal` flag to `markFailed` and fixed `lockedBy` ownership check]
6. `backend/src/email/email.module.ts` [MODIFY - registered and exported `TemplateResolver`, `TestEmailProvider`, `EMAIL_PROVIDER`, `EmailWorkerService`]
7. `backend/test/phase-15-4-email-worker.spec.ts` [NEW - 22 specification tests]
8. `.agent/PHASE_15_4_EMAIL_WORKER_REPORT.md` [NEW - phase report]

---

## 28. FINAL CERTIFICATION MATRIX

```
============================================================
PHASE 15.4 CERTIFICATION MATRIX
============================================================

WORKER STARTUP:                   PASS
POSTGRESQL QUEUE CONSUMPTION:      PASS
SAFE CLAIMING (SKIP LOCKED):      PASS
CONCURRENT WORKERS:               PASS
NO DOUBLE CLAIM:                  PASS
SUCCESS → SENT:                   PASS
RETRY HANDLING (RETRYING):        PASS
FAILURE HANDLING (FAILED):        PASS
STALE JOB RECOVERY:               PASS
RETRY SCHEDULE RESPECT:           PASS
GRACEFUL SHUTDOWN:                PASS
SECRET PROTECTION (REDACTED):     PASS
PROVIDER ABSTRACTION:             PASS
REAL CONCURRENCY TESTS:           PASS (22/22 PASS)
REGRESSION TESTS (15.2 & 15.3):   PASS (44/44 PASS)
BACKEND BUILD:                    PASS
BACKEND LINT:                     PASS

API CHANGES:                      0
FRONTEND CHANGES:                 0
BUSINESS WORKFLOW CHANGES:        0
MERC CREDENTIAL REUSE:            0
REAL GMAIL API CALLS:             0 (Deferred to 15.5)

FINAL DECISION:                   PASS
============================================================
```
