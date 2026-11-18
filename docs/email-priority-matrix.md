# V-SMART RM – Email Priority Classification Matrix

**Document Type:** Architecture & Priority Lane Specification  
**Status:** **APPROVED & APPLIED (PRODUCTION-READY)**  
**Classification Rules:**
- **Priority 1 (High-Priority Workflow & Auth):** User-triggered operational workflows (RM requisition, store issuance, DC dispatch, approvals, rejections, QC handoffs, password reset). Delivered immediately; immune to digest reserve hold line (`EMAIL_PRIORITY_RESERVE=100`).
- **Priority 5 (System / Administrative / Stock Transactions):** Admin test sends, system health diagnostics, real-time stock transaction MSL alerts, and runtime fallback. Manual dashboard Retry strictly preserves the job's existing priority (never reset to 5).
- **Priority 9 (Background Alerts & Sweeps):** Scheduled hourly SLA sweeps, overdue sweeps, scheduled MSL inventory sweeps, and consolidated alert digests. Throttled at the daily budget reserve line (held when `sentLast24h >= EMAIL_DAILY_LIMIT - EMAIL_PRIORITY_RESERVE = 300`).

---

## 1. Complete Event Code & Priority Matrix

| # | Event Code | Trigger Source & Action | Priority | Classification Reason |
| :--- | :--- | :--- | :---: | :--- |
| 1 | `RM_SUBMITTED` | Designer submits RM requisition in `RmService.submitRm` | **1** | Core transactional workflow; notifies Stores to issue material. |
| 2 | `MATERIAL_ISSUED` | Stores issues material in `MaterialIssueService.issueMaterials` | **1** | Core transactional workflow; notifies Production of material dispatch. |
| 3 | `ADDITIONAL_REQUEST` | Production creates additional material request | **1** | Core transactional workflow; notifies Stores/Designer. |
| 4 | `ADDITIONAL_MATERIAL_REQUESTED` | Alias for `ADDITIONAL_REQUEST` | **1** | Core transactional workflow (backward compatibility). |
| 5 | `MATERIAL_RECEIVED` | Production confirms receipt in `MaterialReceiptService.receive` | **1** | User-triggered receipt confirmation; confirms chain of custody. |
| 6 | `MATERIAL_RETURNED` | Production returns leftover material in `MaterialReturnService` | **1** | User-triggered return transaction; alerts Stores to verify return. |
| 7 | `RETURN_VERIFIED` | Stores verifies returned material | **1** | User-triggered verification transaction; closes custody return loop. |
| 8 | `EXTRA_MATERIAL_APPROVED` | Manager approves extra material request | **1** | User-triggered authorization; unlocks store issuance. |
| 9 | `EXTRA_MATERIAL_REJECTED` | Manager rejects extra material request | **1** | User-triggered authorization decision; alerts requester immediately. |
| 10 | `EXTRA_MATERIAL_ISSUED` | Stores issues approved extra material | **1** | Core transactional workflow; confirms extra material dispatch. |
| 11 | `SC_COMPLETED` | Production completes sub-component work | **1** | Core operational stage milestone; notifies Designer/Stores. |
| 12 | `DC_CREATED` | Stores creates Delivery Challan draft | **1** | Operational challan preparation. |
| 13 | `DC_DISPATCHED` | Stores dispatches goods to vendor on DC | **1** | Physical dispatch milestone; tracks external vendor liability. |
| 14 | `DC_PARTIALLY_RETURNED` | Vendor returns partial shipment | **1** | External vendor receipt transaction. |
| 15 | `DC_RETURNED` | Vendor returns complete shipment | **1** | External vendor return transaction. |
| 16 | `DC_CLOSED` | Stores completes DC lifecycle | **1** | Operational challan closure. |
| 17 | `PASSWORD_RESET` | User requests password reset via `AuthService.requestPasswordReset` | **1** | Interactive user authentication; user is waiting in browser. |
| 18 | `TEST_EMAIL` | Admin triggers test email via `/api/email/test-send` | **5** | Diagnostic tool for administrators. |
| 19 | `MANUAL_RETRY` | Admin retries job via `/api/email/jobs/:id/retry` | **Preserves existing (1 or 9)** | Manual dashboard Retry preserves the job's existing priority (never reset to 5). |
| 20 | `CONSUMABLE_RECEIPT_OVERDUE` | Scheduled sweep: Consumable unreceived > 24h | **9** | Automated background alert; eligible for digest consolidation. |
| 21 | `CONSUMABLE_PARTIALLY_ISSUED_OVERDUE` | Scheduled sweep: Consumable partially issued > 24h | **9** | Automated background alert; eligible for digest consolidation. |
| 22 | `MATERIAL_ISSUE_OVERDUE_24H` | Scheduled sweep: RM request unissued > 24h | **9** | Automated background alert; eligible for digest consolidation. |
| 23 | `DC_PENDING_2_DAYS` | Scheduled sweep: DC open > 2 days | **9** | Automated background alert; eligible for digest consolidation. |
| 24 | `CONSUMABLE_PENDING_2_DAYS` | Scheduled sweep: Consumable open > 2 days | **9** | Automated background alert; eligible for digest consolidation. |
| 25 | `DC_QC_PENDING_24H` | Scheduled sweep: Challan items waiting in QC > 24h | **9** | Automated background alert; eligible for digest consolidation. |
| 26 | `DC_APPROACHING_SLA` | Scheduled sweep: DC within 24h of return due date | **9** | Automated background alert; eligible for digest consolidation. |
| 27 | `DC_OVERDUE` | Scheduled sweep: DC return date exceeded | **9** | Automated background alert; eligible for digest consolidation. |
| 28 | `MSL_LOW_STOCK (Sweep)` | Scheduled hourly sweep (`MslTriggerService.runScheduledSweep`) | **9** | Automated background alert; throttled at budget line. |
| 29 | `MSL_LOW_STOCK (Tx)` | Real-time stock issuance / adjustment event | **5** | Immediate operational stock trigger from user consumption. |
| 30 | `MSL_OUT_OF_STOCK (Sweep)` | Scheduled hourly sweep (`MslTriggerService.runScheduledSweep`) | **9** | Automated background alert; throttled at budget line. |
| 31 | `MSL_OUT_OF_STOCK (Tx)` | Real-time stock issuance / adjustment event | **5** | Immediate operational stock trigger from user consumption. |
| 32 | `ALERT_DIGEST` | Digest engine consolidates items for a recipient | **9** | Consolidated digest alert email. |

---

## 2. Trigger Inspection for MSL Alerts (`MSL_LOW_STOCK` & `MSL_OUT_OF_STOCK`)

Detailed code audit inspecting all call sites triggering MSL alert evaluations:

### A. Sweep-Driven Triggers -> **Priority 9**
- **Location:** `backend/src/inventory/msl-trigger.service.ts` (Line 86)
- **Method:** `runScheduledSweep()`
- **Invocation:** Executes `@Cron(process.env.MSL_ALERT_CRON_SCHEDULE || CronExpression.EVERY_HOUR)`.
- **Call Chain:**
  1. Calls `mslAlertService.evaluateAllAndAlert()`.
  2. In `backend/src/inventory/msl-alert.service.ts` (Line 207), `evaluateAllAndAlert()` iterates all products and calls `this.evaluateAndAlertProduct(product.id, true)` passing `isSweep = true`.
  3. In `msl-alert.service.ts` (Lines 107, 128), `metadata: { isSweep: true }` is passed into `sendLowStockAlert` and `sendOutOfStockAlert`.
  4. In `backend/src/notifications/communication.service.ts` (Lines 418, 440), `isSweep` is forwarded into the event payload.
  5. `resolveEventPriority('MSL_LOW_STOCK', payload)` detects `isSweep === true` and assigns **Priority 9**.

### B. Event-Driven Stock Transaction Triggers -> **Priority 5**
- **Trigger Call Sites:**
  1. `backend/src/material-issue/material-issue.service.ts` (Line 391): After material issue deducts stock -> calls `mslTriggerService.triggerProductEvaluation(productId)` (`isSweep` default `false`).
  2. `backend/src/general-issue/general-issue.service.ts` (Lines 200, 326): After general issue or scrap transaction -> calls `mslTriggerService.triggerProductEvaluation(productId)`.
  3. `backend/src/production/production.service.ts` (Line 691): After production completion consumption -> calls `mslTriggerService.triggerProductEvaluation(productId)`.
  4. `backend/src/inventory/inventory.service.ts` (Line 65): After manual stock adjustment -> calls `mslTriggerService.triggerProductEvaluation(productId)`.
- **Classification Result:** `isSweep` is falsy (`false` or `undefined`) -> `resolveEventPriority` assigns **Priority 5**.

---

## 3. Manual Dashboard Retry Behavior

- **Endpoint:** `POST /api/email/jobs/:id/retry` in `backend/src/email/email.controller.ts` (Lines 150–180).
- **Behavior:**
  ```typescript
  // Manual dashboard Retry preserves the job's existing priority (never reset to 5)
  job.priority = job.priority ?? 5;
  job.status = EmailJobStatus.PENDING;
  job.nextRetryAt = null;
  job.lockedAt = null;
  job.lockedBy = null;
  job.lastError = null;
  if (job.attempts >= job.maxAttempts) {
    job.attempts = Math.max(0, job.maxAttempts - 1);
  }
  ```
- **Rule Confirmed:** A Priority 1 workflow email (e.g., `RM_SUBMITTED`, `PASSWORD_RESET`) that failed and is retried by an admin remains **Priority 1**. It is never reset to 5. Only `TEST_EMAIL` explicitly defaults to Priority 5.

---

## 4. Runtime Fallback & Automated Test Enforcement

1. **Runtime Fallback:** Any unexpected or future event code with no entry in `EVENT_PRIORITY_MAP` defaults to **Priority 5** safely via `resolveEventPriority()`.
2. **Fail-Fast Automated Test:** Unit test in `backend/src/email/priority-classification.spec.ts` iterates `PERMITTED_EMAIL_EVENT_TYPES` and **FAILS** the test suite if any permitted event code is not explicitly registered in `EVENT_PRIORITY_MAP`.
