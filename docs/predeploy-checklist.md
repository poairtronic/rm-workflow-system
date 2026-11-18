# V-SMART RM – Pre-Deploy Verification Checklist & Go / No-Go Gate

**Release Version:** Alert Digest & Priority Lane (Phase 16.2 + Hotfix)  
**Target Environment:** Render Production Web Service & Neon PostgreSQL  
**Verification Date:** 2026-11-18  
**Overall Deployment Verdict:** **GO FOR PRODUCTION RELEASE**

---

## 1. Task-by-Task Go / No-Go Decision Matrix

| Task | Domain | Verification Performed | Verdict | Detailed Report Link |
| :--- | :--- | :--- | :---: | :--- |
| **Task 1** | **Migration Safety** | Multi-cycle UP -> DOWN -> UP verified on isolated replica with 1,200 rows. Additive tables (`alert_notification_state`, `digest_shadow_log`), metadata-only column modifications (< 20ms lock), partial index scan verified via `EXPLAIN ANALYZE` (0.063 ms, 0 quicksorts), mixed NULL/1/5/9 ordering verified. | **GO** | [phase162-migration-verification.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/phase162-migration-verification.md) |
| **Task 2** | **Priority Tagging** | Approved Priority Matrix applied. Core workflows & password reset set to P1; admin test send & real-time stock triggers set to P5; sweeps & digests set to P9. Manual dashboard retry strictly preserves existing priority (P1 stays P1). Unit test in `priority-classification.spec.ts` verifies 100% classification coverage. | **GO** | [email-priority-matrix.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/email-priority-matrix.md) |
| **Task 3** | **Dev/Prod Quota Isolation & Safety** | Implemented startup guard in `EmailWorkerService`: blocks worker start in non-production when `GMAIL-API` is selected without explicit `ALLOW_REAL_EMAIL_IN_DEV=true`. Added `NODE_ENV` and provider label logging at startup. In production with test provider, triggers critical log error and red dashboard alert banner. Verified by unit tests. | **GO** | [email-env-isolation.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/email-env-isolation.md) |
| **Task 4** | **First-Run Surge Preview & Discrepancy Reconciliation** | Reconciled 43 vs 82 discrepancy: updated `previewCurrentOpenItemsFirstRun()` to exact live predicates. Reconciled all 82 incident items across 3 modules: generates exactly **10 digest jobs** ($\le 15$), max table rows = 32 ($\le 50$), total dispatch duration = 30 seconds at 3s pacing, consuming only 2.5% daily quota. | **GO** | [digest-first-run-preview.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/digest-first-run-preview.md) |
| **Task 5** | **Production Startup & ESM Cycle Resolution** | Compiled production boot verification (`npm run build && NODE_ENV=production EMAIL_PROVIDER_TYPE=test node dist/main.js`). Verified zero ESM Temporal Dead Zone / circular dependency crashes (`ReferenceError: Cannot access 'AuthModule' before initialization` resolved via `forwardRef`). Verified `GET /health` and authenticated `GET /api/email/observability` return 200 OK under both `ALERT_DIGEST_MODE=OFF` and `ALERT_DIGEST_MODE=SHADOW`. | **GO** | [startup-crash-fix.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/startup-crash-fix.md) |

---

## 2. Render Production Environment Configuration

The following exact environment variables should be configured on Render for `v-smart-backend`:

```ini
# Production Environment Flag (Verified explicitly present in render.yaml line 18)
NODE_ENV=production

# Email Worker Pacing & Capacity
EMAIL_PROVIDER_TYPE=gmail
EMAIL_WORKER_ENABLED=true
EMAIL_SEND_INTERVAL_MS=3000
EMAIL_DAILY_LIMIT=400
EMAIL_PRIORITY_RESERVE=100
EMAIL_MAX_JOB_AGE_HOURS=24

# Alert Digest & Cooldown Governance
ALERT_REALERT_COOLDOWN_HOURS=24

# Deployment Safety Switch (Initial Deploy Default: OFF)
ALERT_DIGEST_MODE=OFF
```

---

## 3. Post-Deployment Phased Rollout Schedule & Verification Steps

```mermaid
flowchart LR
    Step1["Step 1: Deploy with ALERT_DIGEST_MODE=OFF<br/>(Verify migrations & health)"] --> Step2["Step 2: Switch to ALERT_DIGEST_MODE=SHADOW<br/>(Inspect digest_shadow_log for 24h)"]
    Step2 --> Step3["Step 3: Switch to ALERT_DIGEST_MODE=ON<br/>(Full consolidation active)"]
```

### Stage 1: Initial Deployment (`ALERT_DIGEST_MODE=OFF`)
1. **Deploy Code:** Deploy git commit containing Phase 16.2 and Hotfix.
2. **Startup Verification:**
   - Check Render logs for:
     `EmailWorkerService startup [Provider: GMAIL-API, Identity: posuppportairtronic@gmail.com, NODE_ENV: production]`
   - Verify zero error logs regarding test provider in production.
3. **Database Migration Verification:**
   - Verify `alert_notification_state` and `digest_shadow_log` tables exist.
   - Verify partial index `"IDX_email_jobs_priority_claim"` exists.
4. **Dashboard Verification:**
   - Open `/communication` dashboard:
     - Verify "SYSTEM HEALTH: HEALTHY (operational)".
     - Verify Sent Today, Sent Last 24h, and Priority Queue breakdown render without red warning banner.
5. **Operational Verification:**
   - Existing workflows (RM, DC, Consumables) continue dispatching discrete emails with zero regression.
   - Existing 92 historical FAILED jobs remain completely untouched.

### Stage 2: Shadow Validation (`ALERT_DIGEST_MODE=SHADOW`)
1. **Update Render Environment:**
   Set `ALERT_DIGEST_MODE=SHADOW`.
2. **Execution:**
   - Keep active for **24 hours**.
   - Discrete alert emails continue to dispatch as today.
   - Sweep cycles automatically simulate digest construction and write rows to `digest_shadow_log`.
3. **Audit Verification:**
   - Query `digest_shadow_log`:
     ```sql
     SELECT event_code, recipient_email, item_count, created_at 
     FROM digest_shadow_log 
     ORDER BY created_at DESC LIMIT 20;
     ```
   - Confirm item counts and recipients match expected notification rules.

### Stage 3: Full Activation (`ALERT_DIGEST_MODE=ON`)
1. **Update Render Environment:**
   Set `ALERT_DIGEST_MODE=ON`.
2. **Execution:**
   - Discrete background sweep emails are silenced.
   - Consolidated digest emails are dispatched per recipient per event code (Priority 9).
   - Re-alert cooldown suppresses unchanged items for 24 hours.
   - Priority 1 operational workflows (RM, DC, Password Reset) process immediately without queue contention.
3. **Observability Verification:**
   - Daily email count drops by >90% (from ~274 jobs/sweep to ~10 jobs/sweep).
   - Rate limit errors remain at **0**.

---

## 4. Mandatory Pre-Push Verification Gate (Local Production Boot Smoke Test)

Before pushing any commit to `origin/main` or deploying to Render, execute this compiled production boot check against a local database:

```bash
cd backend
npm run build
NODE_ENV=production EMAIL_PROVIDER_TYPE=test EMAIL_WORKER_ENABLED=true DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rm_workflow_db node dist/main.js
```

### Verification Criteria
1. **Zero ReferenceErrors:** No `Cannot access 'XModule' before initialization` or ESM TDZ errors.
2. **Clean Initialization:** Logs `Nest application successfully started`.
3. **Worker Identity Line:** Logs `[EmailWorkerService] EmailWorkerService startup [Provider: TEST, Identity: mock-in-memory, NODE_ENV: production]`.
4. **Health Endpoint:** `curl -s http://localhost:3000/health` returns HTTP 200 `{"status":"ok",...}`.
5. **Observability Endpoint:** Authenticated `GET /api/email/observability` returns HTTP 200 with test provider warning banner active.
