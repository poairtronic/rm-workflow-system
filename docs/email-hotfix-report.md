# V-SMART RM – Email Queue Hotfix Report (Production-Safe)

**Document Type:** Production Incident Remediation & Hotfix Engineering Report  
**Target Subsystem:** Email Delivery Worker, Queue Service, Gmail API Provider, and Observability Dashboard  
**Date:** 2026-11-18  
**Status:** Verification Passed | Ready for Production Deployment Review  

---

## 1. Executive Summary

During production operations, the Gmail API sender encountered HTTP 429 rate limits (`User-rate limit exceeded. Retry after <ISO> (Mail sending)`) following a burst of 263 sends in ~6 minutes. The previous worker retry logic incremented job attempt counts on every failure indiscriminately and scheduled retries with short exponential backoffs (30s, 60s, 120s) without parsing or respecting Google's `Retry-After` timestamp. As a consequence, retries fired while Google's rate limiter was still active, quickly exhausting the 3 maximum attempts and transitioning 11 jobs into permanent `FAILED` state while placing the provider into a false `DEGRADED` status.

This hotfix implements a production-safe, resilient email queue architecture that:
1. **Parses and respects Google's `Retry-After` ISO timestamp** (+5s buffer, 15m fallback).
2. **Preserves job retry attempts on HTTP 429 / rate limits** (attempts are not consumed toward `maxAttempts`; jobs are instead expired only by `EMAIL_MAX_JOB_AGE_HOURS`, defaulting to 24h).
3. **Pauses the worker globally on rate limit** (`pausedUntil`) and safely releases remaining batch-claimed jobs back to `PENDING` with `next_retry_at = pausedUntil` without consuming attempts.
4. **Enforces global per-worker pacing** (`EMAIL_SEND_INTERVAL_MS`, defaulting to 3000ms), restricting max throughput to 20 emails/minute and preventing burst rate limit triggers.
5. **Enforces a 24-hour daily budget guard** (`EMAIL_DAILY_LIMIT`, defaulting to 400), deferring queue execution until budget capacity frees up.
6. **Corrects observability metrics**, displaying `RATE_LIMITED (until <timestamp>)` instead of `DEGRADED`, exposing `pausedUntil` and `sentLast24h`, and computing `successRate = sent / (sent + failed) * 100` from server-side database counts (~86% on current production data) instead of slicing the first 20 audit log rows.
7. **Maintains complete transaction decoupling**: RM workflow state transactions never fail or roll back due to email enqueue or dispatch errors.

---

## 2. Files Modified & Exact Changes

### Backend Changes

| File | Changes |
| :--- | :--- |
| `backend/src/email/interfaces/email-provider.interface.ts` | Added optional `isRateLimited?: boolean;` and `retryAfterDate?: Date | null;` fields to `EmailDeliveryResult` to transport upstream rate-limit metadata. |
| `backend/src/email/providers/gmail-api.provider.ts` | Added rate-limit detection for HTTP status 429 and regex `/rate limit/i`. Added ISO timestamp parser `/Retry after (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/` with a 15-minute fallback. Attached `isRateLimited: true` and `retryAfterDate` to delivery failure results. |
| `backend/src/email/providers/test-email.provider.ts` | Added test hooks `shouldSimulateRateLimit` and `rateLimitRetryAfterDate` allowing mock testing of HTTP 429 scenarios without sending live emails. |
| `backend/src/email/email-queue.service.ts` | **`markFailed`**: Checks rate-limit status. If rate limited, un-increments `attempts` (`Math.max(0, attempts - 1)`) so 429s never exhaust retry attempts. Enforces max job age (`EMAIL_MAX_JOB_AGE_HOURS`, default 24h) before dead-lettering. Calculates `next_retry_at = Math.max(retryAfterDate.getTime() + 5000, existingBackoff)`.<br>**`releaseClaimBatchAfterRateLimit`**: Atomic PostgreSQL query resetting claimed jobs back to `PENDING`, clearing `locked_at` and `locked_by`, un-incrementing attempts, and setting `next_retry_at = pausedUntil`.<br>**`getSentCountLast24Hours` & `getEarliestSentInLast24Hours`**: Queries for rolling 24h sent count and the timestamp of the oldest sent job in that window. |
| `backend/src/email/email-worker.service.ts` | **Global Pause**: Added `pausedUntil` in-memory state. In `pollTick`, if `Date.now() < pausedUntil.getTime()`, polling immediately aborts without claiming any jobs.<br>**Batch Abort**: If a job encounters a rate limit during batch processing, `pausedUntil` is set to `retryAfterDate + 5s`, remaining batch jobs are atomically released back to `PENDING` with `next_retry_at = pausedUntil`, and the batch loop terminates.<br>**Pacing**: Added `sendIntervalMs` (`EMAIL_SEND_INTERVAL_MS`, default 3000ms). Worker delays sending each job by the interval since the previous send.<br>**Daily Budget Guard**: Added `dailyLimit` (`EMAIL_DAILY_LIMIT`, default 400). Worker checks 24h sent count before claiming; if reached, logs warning and defers polling until the earliest job in the window expires. |
| `backend/src/email/email-observability.service.ts` | Injected `EmailWorkerService` (with `forwardRef`). Added `pausedUntil`, `sentLast24h`, and `dailyLimit` to returned metrics. Computed server-side `successRate = sent / (sent + failed) * 100`. Set provider health status to `RATE_LIMITED (until <ISO>)` when paused. |
| `backend/src/email/email-observability.service.spec.ts` | Updated mock dependencies and added assertions for `successRate` and `sentLast24h`. |
| `backend/src/email/email-hotfix.spec.ts` | Comprehensive unit test suite with 9 tests covering Retry-After parsing, attempt preservation on 429, job age expiry, worker pause and batch release, pacing enforcement, daily budget deferral, and 274-job burst simulation. |

### Frontend Changes

| File | Changes |
| :--- | :--- |
| `frontend/src/services/emailObservability.service.ts` | Updated TypeScript interface `EmailQueueObservabilitySummary` to include `sentLast24h`, `dailyLimit`, `successRate`, `pausedUntil`, and `providerStatus`. |
| `frontend/src/pages/EmailCommunicationWorkspace.tsx` | Replaced incorrect client-side calculation (`logs.slice(0, 20)`) with server-provided `metrics?.successRate ?? (sent / (sent + failed))`. Added `RATE LIMITED` health badge and timestamp display when the provider is rate-limited. |

---

## 3. Environment Variables Added

All new behaviors are controlled by environment variables with production-safe defaults:

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `EMAIL_SEND_INTERVAL_MS` | `3000` | Minimum delay in milliseconds between consecutive email transmissions per worker instance. Enforces a maximum rate of 20 emails/minute. |
| `EMAIL_DAILY_LIMIT` | `400` | Maximum number of emails permitted to be sent in any rolling 24-hour window. Deferrals pause processing without failing jobs. |
| `EMAIL_MAX_JOB_AGE_HOURS` | `24` | Maximum allowable age for an email job in the queue before rate-limited retries transition to `FAILED`. |

---

## 4. Decoupling Verification: RM Transactions vs Email Delivery

An exhaustive architectural audit of all transactional workflows was conducted:
1. **Raw Material Requests & Issues** (`rm.service.ts`, `material-issue.service.ts`):
   - All email notifications are invoked outside of the TypeORM database transaction boundary (`queryRunner.commitTransaction()`).
   - All notification calls are wrapped in defensive `try/catch` blocks or asynchronous `.catch()` error handlers.
2. **Consumables Management** (`consumables.service.ts`):
   - Out-of-stock PR creations, purchases, and fulfillment notifications trigger asynchronously post-commit.
3. **Delivery Challans & Dispatches** (`delivery-challan.service.ts`):
   - Challan dispatch actions complete and write audit logs before triggering dispatch notifications.

**Result:** A failure in the email queue, worker, or Gmail API **never** fails or rolls back an RM transaction.

---

## 5. Verification & Test Evidence

### Unit & Integration Test Suite (`backend/src/email/email-hotfix.spec.ts`)
```
✓ src/email/email-hotfix.spec.ts (9 tests) 262ms
  ✓ GmailApiProvider - Rate-limit detection and Retry-After parsing (2 tests)
  ✓ EmailQueueService - Rate-limit failure handling without attempt consumption (2 tests)
  ✓ EmailWorkerService - Global pause and batch release (1 test)
  ✓ EmailWorkerService - Pacing between sends (1 test)
  ✓ EmailWorkerService - Daily budget guard (1 test)
  ✓ EmailObservabilityService - Rate-limit status and metrics (1 test)
  ✓ Production Simulation - 274-job burst under rate-limiting (1 test)

Test Files  1 passed (1)
     Tests  9 passed (9)
```

### Key Verification Criteria Met:
1. **Simulated 274-job Burst:**
   - 274 jobs processed with 3000ms pacing.
   - Zero jobs reached `FAILED` status due to 429 rate limits.
   - Max sending throughput capped at 20 emails/minute.
2. **Simulated 429 with Retry-After +15 min:**
   - `pausedUntil` was set to `timestamp + 5s`.
   - Remaining claimed jobs released to `PENDING` with `next_retry_at = pausedUntil` and attempt count untouched.
   - No send attempts executed prior to `pausedUntil`. All jobs successfully dispatched after pause expiration.
3. **Dashboard Success Rate Alignment:**
   - Based on existing production DB ledger (579 Completed, 92 Failed):
     $$\text{Success Rate} = \frac{579}{579 + 92} \times 100 \approx 86.29\%$$
   - The UI displays ~86% accurately reflecting the database state instead of the false 0% artifact caused by checking only the 20 most recent failed logs.
4. **Existing Failed Jobs Preserved:**
   - The 92 historical `FAILED` jobs remain completely untouched in the database.
5. **Compilation & Linting:**
   - `nest build` passed with exit code 0.
   - `tsc -b && vite build` passed with exit code 0.
   - `oxlint src/ test/` passed with 0 errors.

---

## 6. Rollback Steps

If unexpected operational behavior occurs upon deployment, the hotfix can be rolled back without database schema intervention (no database migrations were introduced):

### Option A: Configuration Rollback (Instant, Zero Downtime)
Set the following environment variables in Render to deactivate pacing and limit guards:
```env
EMAIL_SEND_INTERVAL_MS=0
EMAIL_DAILY_LIMIT=100000
EMAIL_MAX_JOB_AGE_HOURS=168
```
The worker will revert to un-throttled batch processing without code redeployment.

### Option B: Code Rollback
1. Revert the hotfix commit on `main`:
   ```bash
   git revert HEAD
   git push origin main
   ```
2. Render will automatically rebuild and deploy the prior commit. No database down-migrations are required.
