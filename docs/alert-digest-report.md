# V-SMART RM – Alert Digest, Priority Lane & Re-Alert Cooldown Technical Report

**Document Version:** 1.0.0  
**Phase:** 16.2 Production Email Hardening  
**Target Architecture:** Google Cloud / Render Managed PostgreSQL + Gmail API Provider  
**Safety Classification:** PRODUCTION-SAFE (Additive-Only, Default-OFF Feature Flag, Zero Workflow Disruption)  
**Date:** 2026-11-18  

---

## 1. Executive Summary

Following the implementation of the production Gmail rate-limit hotfix (3s pacing, Retry-After adherence, 400-email daily quota), an audit of system sweeps revealed that scheduled hourly checks generate individual emails per item per recipient (e.g., 30 overdue consumable items $\times$ 5 recipients = 150 email jobs; up to 274 jobs per sweep burst). Furthermore, cross-day string resets (`todayStr = now.toISOString().split('T')[0]`) caused unchanged items to be re-alerted every 24 hours to all recipients, exhausting daily email limits and queuing behind transactional workflow notifications.

This implementation introduces **Alert Digest Consolidation**, **Re-Alert Cooldown Tracking**, **Priority Delivery Lanes**, and **Daily Budget Reservation**.

### Key Outcomes
1. **Dramatic Volume Reduction:** A 30-item consumable SLA sweep across 5 recipients now produces **5 digest emails** instead of 150 individual alerts (**96.7% volume reduction**). A multi-sweep burst of 82 items across all modules produces $\le 10$ digest emails.
2. **Re-Alert Cooldown (24h Window):** Re-running the same sweep within the cooldown period produces **0 duplicate emails**.
3. **Workflow Priority Lane (P1 vs P9):** Real-time workflow notifications (`RM_SUBMITTED`, `MATERIAL_ISSUED`, `DC_DISPATCHED`, etc.) are assigned **Priority 1** and are claimed before sweep alert digests (**Priority 9**).
4. **Budget Reserve Guard:** Digest alerts (Priority 9) automatically hold at the budget reserve line (`dailyLimit - priorityReserve` = 300/400), preserving a guaranteed reserve for transactional business workflows.
5. **Zero Risk Rollout:** Controlled via `ALERT_DIGEST_MODE=OFF|SHADOW|ON` (defaults to **`OFF`** in production). Existing behavior is 100% preserved until explicitly toggled.

---

## 2. Configuration & Environment Variables

All new behaviors are controlled by environment variables with non-breaking production defaults:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ALERT_DIGEST_MODE` | Enum (`OFF` \| `SHADOW` \| `ON`) | `OFF` | **`OFF`**: Current behavior (discrete per-item emails).<br>**`SHADOW`**: Sends discrete emails as today + writes what digests would send to `digest_shadow_log` (zero digest emails sent).<br>**`ON`**: Sends grouped digest emails only; per-item alert emails suppressed. |
| `ALERT_REALERT_COOLDOWN_HOURS` | Number (Hours) | `24` | Cooldown period before an unchanged overdue entity can be re-alerted to the same recipient. Supports per-event override in code. |
| `EMAIL_PRIORITY_RESERVE` | Number (Jobs) | `100` | Number of daily emails reserved strictly for high-priority workflow operations (Priority $\le 8$). When `sentLast24h >= dailyLimit - priorityReserve`, Priority 9 jobs are held. |

---

## 3. Database Schema Changes (Additive Only)

### Migration File
- Path: `backend/src/database/migrations/1794200000000-Phase162AlertDigestCooldownPriority.ts`

### 1. `alert_notification_state` Table
Tracks when an entity was last alerted to a specific recipient for a given event:
```sql
CREATE TABLE "alert_notification_state" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "event_code" character varying(64) NOT NULL,
  "entity_type" character varying(64) NOT NULL,
  "entity_id" character varying(128) NOT NULL,
  "recipient_user_id" character varying(128) NOT NULL,
  "last_alerted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "alert_count" integer NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_alert_notification_state" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_alert_notification_state_unique" UNIQUE ("event_code", "entity_type", "entity_id", "recipient_user_id")
);

CREATE INDEX "IDX_alert_notif_lookup" ON "alert_notification_state" ("event_code", "entity_type", "entity_id", "recipient_user_id");
CREATE INDEX "IDX_alert_notif_last_alerted" ON "alert_notification_state" ("last_alerted_at");
```

### 2. `digest_shadow_log` Table
Stores simulated digest payloads during `SHADOW` mode for verification without sending real emails:
```sql
CREATE TABLE "digest_shadow_log" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "event_code" character varying(64) NOT NULL,
  "recipient_user_id" character varying(128) NOT NULL,
  "recipient_email" character varying(255) NOT NULL,
  "item_count" integer NOT NULL,
  "subject" character varying(255) NOT NULL,
  "payload_summary" jsonb NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_digest_shadow_log" PRIMARY KEY ("id")
);

CREATE INDEX "IDX_digest_shadow_event_created" ON "digest_shadow_log" ("event_code", "created_at");
```

### 3. `email_jobs` Priority Column & Index
Adds nullable priority column with safe default `5`:
```sql
ALTER TABLE "email_jobs" ADD COLUMN IF NOT EXISTS "priority" smallint DEFAULT 5;
UPDATE "email_jobs" SET "priority" = 5 WHERE "priority" IS NULL OR "priority" = 100;

CREATE INDEX IF NOT EXISTS "IDX_email_jobs_priority_claim" 
  ON "email_jobs" ("status", "priority", "created_at") 
  WHERE "status" = 'PENDING';
```

---

## 4. Code Architecture & Service Implementation

### 1. `AlertDigestService` (`backend/src/email/alert-digest.service.ts`)
- **Recipient Pre-Filtering:** Resolves recipient preferences (`EMAIL_PREFS_V2`) *before* grouping. If a recipient has the event disabled, they are excluded from the digest and a `PREF_OFF` reason row is recorded in `email_skip_log`.
- **Cooldown Filter:** Queries `alert_notification_state`. Filters out items where `now - last_alerted_at < cooldownHours`.
- **Grouping:** Consolidates filtered items by `(recipientUserId, eventCode)`.
- **HTML Table Generator:** Plain, clean HTML table styled consistently with existing templates. Capped at 50 rows, adding `+ M more, open V-SMART to view all` when exceeded.
- **Idempotency Key:** `digest:${eventCode}:${recipientUserId}:${now.toISOString().slice(0, 13)}` (hourly bucket).
- **Shadow Logging:** When in `SHADOW` mode, writes to `digest_shadow_log` and returns empty array (zero digest emails enqueued).

### 2. Priority Lane & Worker Allocation (`email-queue.service.ts` & `email-worker.service.ts`)
- **Priority Values:**
  - `Priority 1`: Transactional workflow operations (`RM_SUBMITTED`, `MATERIAL_ISSUED`, `DC_DISPATCHED`, `CONSUMABLE_RECEIVED`, etc.) via `CommunicationService.dispatch()`.
  - `Priority 5`: Default system communications.
  - `Priority 9`: Background alert digests (`buildDigests`).
- **Claim Ordering:** `ORDER BY COALESCE("priority", 5) ASC, "created_at" ASC`.
- **Reserve Line Throttling:** When `sentLast24h >= dailyLimit - priorityReserve` (e.g. $320 \ge 400 - 100$), worker queries queue with `maxPriority: 8`. Priority 9 digest jobs are automatically held until budget clears.

### 3. Sweeps Integration
All automated sweep services have been updated to check `alertDigestService.getMode()`:
- `ConsumablesService.checkAndAlertConsumableSlas()` (`backend/src/consumables/consumables.service.ts`)
- `DeliveryChallanService.checkAndAlertExpectedReturnDates()` (`backend/src/delivery-challan/delivery-challan.service.ts`)
- `AlertSweepsService.sweepMaterialIssueOverdue()` (`backend/src/alert-sweeps/alert-sweeps.service.ts`)
- `AlertSweepsService.sweepDcPending()` (`backend/src/alert-sweeps/alert-sweeps.service.ts`)
- `AlertSweepsService.sweepConsumablePending()` (`backend/src/alert-sweeps/alert-sweeps.service.ts`)
- `AlertSweepsService.sweepDcQcPending()` (`backend/src/alert-sweeps/alert-sweeps.service.ts`)

---

## 5. UI Observability Updates

`EmailCommunicationWorkspace.tsx` and `emailObservability.service.ts` were expanded with a dedicated **Priority Lanes & Alert Digest Governance** dashboard panel:
- **Priority Queue Breakdown:** Live counts of pending jobs by Priority (P1 Workflow, P5 System, P9 Digest Alerts).
- **Daily Budget & Reserve Meter:** Shows current 24-hour usage, total quota (400), reserved quota (100), and reserve limit line (300).
- **Digest Governance Status:** Displays active mode (`OFF`, `SHADOW`, `ON`), digests dispatched in last 24h, and total notifications suppressed by the cooldown engine.

---

## 6. Verification Matrix & Test Evidence

All unit test suites were executed with `EMAIL_PROVIDER_TYPE=test` to guarantee no external network requests or real emails were sent.

### Test Results (`vitest run src/email/`)
```text
 ✓ src/email/email-observability.service.spec.ts (2 tests) 325ms
 ✓ src/email/alert-digest.spec.ts (9 tests) 36ms
 ✓ src/email/email-hotfix.spec.ts (9 tests) 239ms

 Test Files  3 passed (3)
      Tests  20 passed (20)
   Duration  4.57s
```

### Success Criteria Verification

| Criterion | Target Behavior | Test Verification | Status |
| :--- | :--- | :--- | :--- |
| **Criterion 1: Digest Consolidation** | 30 consumable items $\times$ 5 recipients $\to$ 5 digest jobs | `alert-digest.spec.ts`: Consolidated 30 items into exactly 5 jobs; full 82-item multi-sweep produced 8 jobs ($\le 10$). | **PASSED** |
| **Criterion 2: Cooldown Re-alert** | Same sweep re-run within 24h $\to$ 0 duplicate jobs | `alert-digest.spec.ts`: Re-run with active cooldown created 0 jobs. | **PASSED** |
| **Criterion 3: State Change Drop-off** | Completed/received item drops out of next digest | `alert-digest.spec.ts`: Changing status to `DISPATCHED_CLOSED` removed item from subsequent digest payload. | **PASSED** |
| **Criterion 4: User Preference Pre-filter** | User with event OFF excluded; skip log written | `alert-digest.spec.ts`: User with event OFF skipped before grouping; `PREF_OFF` logged to `email_skip_log`. | **PASSED** |
| **Criterion 5: Priority Lane Dispatch** | P1 workflow jobs dispatched before P9 digest alerts | `alert-digest.spec.ts`: Claim query ordered by `COALESCE("priority", 5) ASC`; P1 claimed and sent first. | **PASSED** |
| **Criterion 6: Budget Reserve Line** | P9 jobs held when usage exceeds $300/400$; P1 still sends | `alert-digest.spec.ts`: At 320/400 usage, worker held P9 jobs and processed all 5 P1 jobs. | **PASSED** |
| **Criterion 7: Default OFF Mode** | `ALERT_DIGEST_MODE=OFF` $\to$ identical to previous behavior | `alert-digest.spec.ts`: In OFF mode, digest enqueueing is 0; discrete event dispatch path active. | **PASSED** |
| **Criterion 8: SHADOW Mode** | Discrete emails sent + digest payload logged to `digest_shadow_log` | `alert-digest.spec.ts`: Recorded to `digest_shadow_log`; 0 digest email jobs enqueued. | **PASSED** |

---

## 7. Rollout & Rollback Runbook

### Rollout Procedure (Phased Zero-Risk Release)
1. **Deploy Code & Additive Migration:**
   - Execute migration `1794200000000-Phase162AlertDigestCooldownPriority.ts`.
   - Default environment has `ALERT_DIGEST_MODE=OFF`. The system runs existing behavior with zero disruptions.
2. **Phase 1: Shadow Validation (Optional / Recommended 24–48h):**
   - Set `ALERT_DIGEST_MODE=SHADOW` in Render environment settings.
   - Discrete emails continue to send as normal.
   - Inspect `digest_shadow_log` to confirm digest grouping and recipient matching accurately mirror requirements.
3. **Phase 2: Full Activation:**
   - Set `ALERT_DIGEST_MODE=ON`.
   - Sweeps now send consolidated digests only (Priority 9).
   - High-priority workflow operations (Priority 1) continue uninterrupted through the reserved lane.

### Rollback Procedure
If any unexpected behavior occurs:
1. Set `ALERT_DIGEST_MODE=OFF` in environment variables and restart the backend service.
2. The application immediately resumes discrete alerting.
3. No database rollback or data cleanup is required (all schema additions are nullable and additive).
