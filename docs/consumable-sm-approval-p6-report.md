# Phase P6 Verification Report: Migration-Only Truth Check, Clean Production Build, Automated E2E, and Rollout Package

**Date:** 2026-11-18  
**Phase:** P6 – Migration Verification, Clean Production Build, E2E & Rollout Package  
**Target Environment:** Local PostgreSQL Replica (`rm_workflow_db`), Node.js v24.21.0, NestJS 11, Vite 8 / React 19  
**Status:** PASS (100% Verification Complete)

---

## 1. Executive Summary

Phase P6 concludes the development and verification lifecycle for the **Consumables Senior Manager Approval Module** (Phases P1 through P6). The entire stack has been verified under strict production conditions:
1. **Migration-Only Truth Check:** All 4 additive migrations were reverted and re-applied against the local PostgreSQL replica with TypeORM `synchronize: false` strictly enforced. A live programmatic schema diff between compiled TypeORM entities and the database produced **0 pending queries (zero schema diff)**.
2. **Clean Production Build Simulation:** Executed in an isolated temporary directory with no `.env`, no `dist`, and clean build commands mirroring Render (`npm run build` and `start:prod`). The compiled server booted cleanly under `NODE_ENV=production` and served `GET /api/health` with HTTP 200 OK.
3. **Runtime Dependency Audit:** Confirmed all packages imported by the new code (`uuid`, `class-validator`, `class-transformer`, `@nestjs/*`, `typeorm`, `pg`) reside in `dependencies` rather than `devDependencies`.
4. **Automated End-to-End (E2E) Test Suite:** Created and executed `backend/test/consumables-sm-approval.e2e-spec.ts` under `CONSUMABLE_SM_APPROVAL_MODE=ON`, `CONSUMABLE_SM_APPROVAL_SCOPE=ALL`, and `EMAIL_PROVIDER_TYPE=test`. All 9 end-to-end integration tests passed (covering scenarios a through h, role 403 guards, action 400 guards, stock tally auto-switching, rejection reasons, deletion protection, Re-raise pre-filling, PR print, receive, issue, and receipt confirmation).
5. **Mode OFF Regression & Number Parity:** Re-verified baseline parity across the 43 grandfathered records (43 total, 26 open purchase, 15 ready to receive, 17 dispatched). Fully explained the difference between the P1 report (26 overdue, 4 ready for issue, 4 partially issued) and the P4 report (22, 0, 0).
6. **Flip Test (OFF -> ON -> OFF):** Proven that pending lines created under `MODE=ON` remain safely pending and visible to Senior Managers when the flag is flipped back to `OFF`, and never leak into store queues.
7. **Deploy Safety & Rollout Package:** Verified that email templates construct URLs using `FRONTEND_URL` (`https://v-smart-frontend.onrender.com`), confirmed frontend graceful failure on 404, documented the deploy sequence (backend first, then frontend), verified production migration execution mechanisms, and generated `docs/consumable-sm-approval-rollout-checklist.md`.
8. **Pre-Push Gate Passed:** Nest build (0 errors), production boot `/api/health` (200 OK), madge circular dependencies (54 baseline, 0 new), unit/integration tests (80/80 passed), E2E tests (9/9 passed), frontend build (`tsc -b && vite build` in 3.38s), oxlint (0 errors).

---

## 2. Step 1: Migration Truth Check & SQL Audit

### 2.1 The Four Additive Migrations

| Migration Timestamp & File | Key Schema Changes |
| :--- | :--- |
| **`1794300000000-AddConsumableSmApprovalFields.ts`** | Creates enum `consumable_approval_status_enum` (`'PENDING_SM_APPROVAL'`, `'APPROVED'`, `'REJECTED'`); adds 7 columns to `consumable_request_items` (`approval_status`, `approved_by_id`, `approved_at`, `rejected_by_id`, `rejected_at`, `rejection_reason`, `approval_batch_id`); adds FK constraints `FK_65232156438c5b94d99fe783558` and `FK_792d7fb504b7a60bde39d601314` -> `users(id)`; creates 3 indexes; grandfather backfill sets `approval_status = 'APPROVED'`, `approved_at = created_at`. |
| **`1794300001000-AddConsumableRequestCreatedByUserId.ts`** | Adds `created_by_user_id` (uuid) to `consumable_requests`; adds FK `FK_87035767e14fa7864d9c738c97a` -> `users(id)`; creates index `IDX_cr_created_by_user_id`. |
| **`1794300002000-SeedConsumablesApprovalSystemModule.ts`** | Inserts `'consumables_approval'` into `system_modules` and inserts permissions for `SENIOR_MANAGER` and `ADMIN` roles into `role_module_permissions`. |
| **`1794400000000-SeedConsumableApprovalEmailEvents.ts`** | Inserts `'CONSUMABLE_APPROVAL_REQUESTED'`, `'CONSUMABLE_APPROVED'`, `'CONSUMABLE_REJECTED'` into `notification_events` (Priority 1); seeds `role_email_settings` matrix with `GENERAL_MANAGER` explicitly set to `false`. |

### 2.2 Comparison with TypeORM Entities
- **Enum Values:** The database enum `consumable_approval_status_enum` contains exactly `PENDING_SM_APPROVAL`, `APPROVED`, `REJECTED`. This exactly matches the TypeScript `ConsumableApprovalStatus` enum in `consumable-request-item.entity.ts`.
- **Columns in `consumable_request_items`:**
  - `approval_status`: enum `consumable_approval_status_enum`, nullable, default null
  - `approved_by_id`: uuid, nullable, FK to `users(id)`
  - `approved_at`: timestamptz, nullable
  - `rejected_by_id`: uuid, nullable, FK to `users(id)`
  - `rejected_at`: timestamptz, nullable
  - `rejection_reason`: text, nullable
  - `approval_batch_id`: uuid, nullable
- **Columns in `consumable_requests`:**
  - `created_by_user_id`: uuid, nullable, FK to `users(id)`
- **Explanation of `approval_notes`:** In Phase P1's initial exploratory draft, a generic `approval_notes` field was contemplated. In the finalized design (v2.0.0) adopted in Phases P2–P5, approvals are atomic batch authorizations grouped by `approval_batch_id`, while rejections require a mandatory justification stored in `rejection_reason`. To keep the schema lean, prevent redundant columns, and avoid confusion, `approval_notes` was deliberately omitted from both migrations and entities.

### 2.3 Revert (`down`) & Re-Apply (`up`) Lifecycle Proof
The four migrations were tested via programmatic query runner:
1. **DOWN:** Reverted `1794400000000`, `1794300002000`, `1794300001000`, `1794300000000`.
   - Inspection query confirmed: 0 residual columns in `consumable_request_items` or `consumable_requests`, 0 residual FK constraints, 0 residual indexes, enum `consumable_approval_status_enum` was dropped, module `consumables_approval` and all 3 notification events were cleanly deleted.
2. **UP:** Re-applied all 4 migrations.
   - All columns, indexes, FKs, and matrix entries were recreated idempotently.

### 2.4 Synchronize OFF & Live TypeORM Schema Diff
- Confirmed `synchronize` was forced to `false` (`TYPEORM_SYNC=false`).
- Executed `backend/scripts/verify-nest-schema-diff.mjs` against compiled NestJS entities:
  ```
  Total Up Queries: 0
  Total Down Queries: 0
  Consumables-Specific Schema Diff Count: 0
  RESULT: Live Schema Diff is ZERO!
  ```
- **Finding:** Exactly **ZERO** objects existed solely due to TypeORM synchronization.

---

## 3. Step 2: Clean Production Build Exactly as Render Does

### 3.1 Clean Temp Build Simulation
To ensure absolute fidelity to Render's deployment environment:
1. Created an isolated temporary directory (`C:\Users\Admin\AppData\Local\Temp\vsmart-render-build-...`).
2. Copied backend source files excluding `node_modules`, `dist`, and `.env`.
3. Executed Render build command: `npm run build` (`nest build`). TypeScript compiled with 0 errors.
4. Booted compiled application via `node dist/main.js` with `NODE_ENV=production` and `EMAIL_PROVIDER_TYPE=test` on port 3015.
5. Hit health check endpoint `http://localhost:3015/api/health`.
   - **Result:** HTTP 200 OK: `{"status":"ok","service":"v-smart-backend","timestamp":"2026-11-18T12:50:26.835Z"}`.
   - Cleaned up temp build directory.

### 3.2 Runtime Dependency Check
Verified all packages imported by the newly authored code are in `backend/package.json` under `dependencies` (not `devDependencies`):

| Package | Import Location | `dependencies` Status |
| :--- | :--- | :---: |
| `uuid` | `consumables.service.ts` | **CONFIRMED** (`^11.1.0`) |
| `class-validator` | `consumable-approval.dto.ts` | **CONFIRMED** (`^0.14.1`) |
| `class-transformer` | `consumable-approval.dto.ts` | **CONFIRMED** (`^0.5.1`) |
| `@nestjs/common` | Modules, Controllers, Services | **CONFIRMED** (`^11.0.1`) |
| `@nestjs/typeorm` | Modules, Entities | **CONFIRMED** (`^11.0.0`) |
| `@nestjs/swagger` | DTOs, Controllers | **CONFIRMED** (`^11.0.6`) |
| `typeorm` | Repositories, Migrations | **CONFIRMED** (`^0.3.20`) |
| `pg` | Database Driver | **CONFIRMED** (`^8.13.3`) |

*Note: Express `Response` in `consumables.controller.ts` is imported as `import type { Response } from 'express'`, eliminating any runtime dependency on Express types.*

### 3.3 Quality Gates & Static Analysis
- **Circular Dependencies (`madge`):** Exactly 54 baseline cycles; **0 new circular dependencies** introduced.
- **Frontend Build (`tsc -b && vite build`):** Built 2809 modules in 3.38s with 0 errors.
- **Frontend Linter (`oxlint`):** Finished on 318 files with **0 errors** (183 stylistic warnings).
- **Unit & Integration Tests:** 80 / 80 tests passed across consumables, entity, notification, and priority suites.

---

## 4. Step 3: Automated End-to-End Test Suite (`consumables-sm-approval.e2e-spec.ts`)

Executed via `npm --prefix backend run test:e2e -- test/consumables-sm-approval.e2e-spec.ts` under `CONSUMABLE_SM_APPROVAL_MODE=ON`, `CONSUMABLE_SM_APPROVAL_SCOPE=ALL`, `EMAIL_PROVIDER_TYPE=test`:

```
 ✓ test/consumables-sm-approval.e2e-spec.ts (9 tests) 3545ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

### Scenario Breakdown & Verification Evidence

| Scenario | Description | Result / Verification Proof |
| :--- | :--- | :--- |
| **a & b** | **5-Line Requisition Creation** | PRODUCTION user creates request with 3 stock items (available, depleted, spare) and 2 purchase items. All 5 lines created with `approval_status = 'PENDING_SM_APPROVAL'`. All 5 lines confirmed absent from store queues (`/api/consumables/line-items?approvedOnly=true`). Exactly 1 notification email per approver queued in `email_jobs` (Priority 1). |
| **g** | **Role Guards (403)** | Calls to `/api/consumables/approvals/bulk-approve` by `GENERAL_MANAGER`, `STORES`, and `PRODUCTION` return HTTP 403 Forbidden. Only `SENIOR_MANAGER` and `ADMIN` are authorized. |
| **f** | **Action Guards (400)** | Direct calls to `/api/consumables/purchase/print-pr`, `/receive`, or `/issue-to-production` targeting pending or rejected lines return HTTP 400 Bad Request (`"cannot be processed until authorized"`). |
| **c** | **Managerial Decision & Auto-Switch** | Senior Manager approves 3 lines (lines 1, 2, 4). Line 2 had its stock depleted after requisition creation; the in-batch stock validation detected 0 available stock and auto-switched Line 2 to `NON_STOCK_OR_NEW` (Purchase track). Senior Manager rejects 2 lines (lines 3, 5) with justification `"Specification review needed: quantity exceeds current machine cycle requirements."`. |
| **d** | **Queue Distribution & Re-raise** | Approved lines (1, 2, 4) appear in store queues. Rejected lines (3, 5) remain absent. Requester views rejection reason in `/api/consumables/requests/:id`. Deletion of rejected line is refused (HTTP 400). Re-raise endpoint pre-fills requisition and submits cleanly. |
| **e** | **Downstream Fulfillment** | Stores prints PR for Lines 2 & 4 -> status moves to `PURCHASE_REQUESTED`. Stores receives Line 2 with `autoIssue: true` -> status `ISSUED_TO_PRODUCTION`. Stores receives Line 4 with `autoIssue: false` -> status `PURCHASE_RECEIVED`, then issues -> `ISSUED_TO_PRODUCTION`. Production confirms receipt -> `RECEIVED_BY_PRODUCTION`. |
| **h** | **Email Priority & SLA Sweeps** | All email jobs verified with `priority = 1`. Automated SLA sweep (`checkAndAlertConsumableSlas`) runs cleanly and strictly excludes pending and rejected lines. |

---

## 5. Step 4: Mode OFF Regression on Real Mix & Numbers Explanation

### 5.1 Baseline Metric Parity (43 Grandfathered Line Items)
Under `CONSUMABLE_SM_APPROVAL_MODE=OFF`, the system was evaluated against the 43 grandfathered items in `rm_workflow_db`:

| Queue / Metric | Baseline Count | Mode OFF Verification | Parity Status |
| :--- | :---: | :---: | :---: |
| **Total Consumable Line Items** | 43 | 43 | **100% MATCH** |
| **Open Purchase Items (`NON_STOCK_OR_NEW`)** | 26 | 26 | **100% MATCH** |
| **Ready for Issue Store Queue** | 4 | 4 | **100% MATCH** |
| **Partially Issued Store Queue** | 4 | 4 | **100% MATCH** |
| **Dispatched (Closed) Lines** | 17 | 17 | **100% MATCH** |
| **Ready to Receive (Production Floor)** | 15 | 15 | **100% MATCH** |

### 5.2 Deep Technical Explanation: P1 Report vs P4 Report Discrepancy

The user specifically requested an explanation for the difference between the P1 report (overdue receipt 26, ready for issue 4, partially issued 4) and the P4 report (22, 0, 0):

#### 1. Overdue Receipt Sweep Count: 26 (P1) vs 22 (P4)
- **Root Cause: Different Definitions (Loose Metric vs Exact Sweep Predicate).**
- In P1 report Section 4, the author loosely equated the count of *all unclosed purchase items* (10 `OPEN` + 12 `PURCHASE_REQUESTED` + 4 `PARTIALLY_ISSUED` = 26) with the overdue receipt sweep.
- In P4, the actual backend sweep predicate in `consumables.service.ts` was executed:
  ```typescript
  const isNotReceived =
    !item.purchaseReceivedAt &&
    (item.status === ConsumableItemStatus.OPEN ||
      item.status === ConsumableItemStatus.PURCHASE_REQUESTED ||
      (Number(item.realReceivedQty || 0) === 0 && item.itemCategoryTrack === ConsumableItemTrack.NON_STOCK_OR_NEW));
  ```
- The 4 `PARTIALLY_ISSUED` items have `real_received_qty = 10.000` (they have physically arrived in stores and 4 units have already been issued to production). Therefore, they are **not** unreceived (`realReceivedQty > 0`), and the receipt overdue check correctly evaluates to `false` for them.
- Thus, the exact count of items genuinely overdue for receipt is $26 - 4 =$ **22**.
- The 4 partially issued items are alerted by the dedicated second sweep: `CONSUMABLE_PARTIALLY_ISSUED_OVERDUE` (>48h).

#### 2. Ready for Issue & Partially Issued Store Queues: 4 & 4 (P1) vs 0 & 0 (P4)
- **Root Cause: Verification Script Filter Inaccuracy in P4 Report.**
- In `frontend/src/pages/ConsumablePurchaseStoreWorkspace.tsx`:
  - `readyForIssueCount` counts approved items where `itemCategoryTrack === 'STOCK_ITEM' || status === 'PARTIALLY_ISSUED' || status === 'READY_FOR_ISSUE'`.
  - `partiallyIssuedCount` counts approved items where `status === 'PARTIALLY_ISSUED'`.
  - In the database, exactly 4 items have `status = 'PARTIALLY_ISSUED'`. Therefore, both KPI cards correctly display **4** and **4**.
- In the P4 report Section 3.2, a standalone script tested `itemCategoryTrack === 'STOCK_ITEM'` across the board. Because all 43 baseline records were initially created under the non-stock purchase track (`NON_STOCK_OR_NEW`), that script evaluated `STOCK_ITEM` to 0.
- **Resolution:** Evaluating using the actual frontend and database formulas confirms the true baseline counts are **4 (Ready for Issue)** and **4 (Partially Issued)**. There is zero regression in the application code.

---

## 6. Step 5: Flip Test (OFF -> ON -> OFF)

The flip lifecycle was executed and verified:
1. **Step A: `CONSUMABLE_SM_APPROVAL_MODE=OFF`**
   - Production creates a request.
   - Line items are assigned `approval_status = 'APPROVED'` and `approved_at = NOW()` immediately.
   - Items immediately appear in store queues without managerial approval.
2. **Step B: `CONSUMABLE_SM_APPROVAL_MODE=ON`**
   - Production creates a request.
   - Line items are assigned `approval_status = 'PENDING_SM_APPROVAL'` and `approved_at = NULL`.
   - Items are withheld from store queues.
3. **Step C: Flip back to `CONSUMABLE_SM_APPROVAL_MODE=OFF` with pending lines present**
   - **Behavior Definition & Empirical Proof:**
     - The pending items **stay** `PENDING_SM_APPROVAL` in the database. No automatic transition occurs.
     - In downstream queues (`approvedOnly=true`), the pending items remain **strictly excluded**.
     - In the Senior Manager Approvals workspace (`/consumables/approvals`), the pending items remain **visible and actionable**. Senior Managers can still authorize or reject them.
     - New requests created while the flag is OFF bypass approval, but previously created pending items never leak into store queues unapproved.

---

## 7. Step 6: Deploy-Safety Verification

### 7.1 Email Link Base URL
- Verified `backend/src/notifications/template.service.ts`:
  - Resolves `const frontendUrl = process.env.FRONTEND_URL || 'https://v-smart-frontend.onrender.com'`.
  - All direct action links (`/consumables/approvals`, `/consumables/purchase-store`, `/consumables/requests`) use this variable.
  - Render configuration variable: **`FRONTEND_URL`** (already set in `render.yaml`). Never falls back to `localhost`.

### 7.2 Frontend Graceful Degradation on 404
- If the frontend SPA is deployed before backend routes are registered:
  - **Sidebar Badge:** `Sidebar.tsx` query sets `retry: false`. On HTTP 404, `consumableApprovalCountData` is undefined; badge count cleanly defaults to `0`. No crash occurs.
  - **Approvals Workspace:** `ConsumableApprovalsWorkspace.tsx` catches the 404 error and displays an inline retry error card (`<ShieldAlert className="text-rose-500" />`) with a "Retry" button. No React rendering exception or unhandled promise rejection is thrown.

### 7.3 Deploy Sequence
- **Order:** **Backend first, then Frontend.**
  1. Neon Database Snapshot.
  2. Apply migrations (`npm --prefix backend run migration:run`).
  3. Deploy Backend service (`v-smart-backend`).
  4. Verify `/api/health` 200 OK.
  5. Deploy Frontend static site (`v-smart-frontend`).

### 7.4 Production Migration Runner Mechanism
- In `backend/src/app.module.ts`, `migrationsRun` is **not** enabled by default in production.
- In `render.yaml`, `startCommand` is `npm run start:prod` (`node dist/main.js`).
- Therefore, migrations are **not** run automatically on boot. They must be executed explicitly via Render Shell or by chaining `npm run migration:run && npm run start:prod` during release. This is documented prominently in `docs/consumable-sm-approval-rollout-checklist.md`.

---

## 8. Pre-Push Gate Summary

| Check | Command | Result | Status |
| :--- | :--- | :--- | :---: |
| **Backend Build** | `npm --prefix backend run build` | NestJS build compiled with 0 errors | **PASS** |
| **Production Boot** | `NODE_ENV=production node dist/main.js` | Booted and served `/api/health` with HTTP 200 OK | **PASS** |
| **Madge Circularity** | `npx madge --circular --extensions ts backend/src/` | 54 baseline circular dependencies (0 new) | **PASS** |
| **Unit & Integration Tests** | `npm --prefix backend test -- src/consumables/` | 80/80 passed | **PASS** |
| **Automated E2E Suite** | `npm --prefix backend run test:e2e -- test/consumables-sm-approval.e2e-spec.ts` | 9/9 passed | **PASS** |
| **Frontend Build** | `npm --prefix frontend run build` | `tsc -b && vite build` built in 3.38s | **PASS** |
| **Frontend Lint** | `npm --prefix frontend run lint` | 0 errors (183 stylistic warnings) | **PASS** |

---

## 9. Conclusion

Phase P6 is **COMPLETE**. The Consumables Senior Manager Approval module has passed all migration truth checks, clean production build checks, automated E2E testing, regression analysis, and deploy-safety evaluations. The rollout checklist is available at `docs/consumable-sm-approval-rollout-checklist.md`.

Per instructions: **No code has been committed, pushed, or deployed.** Awaiting user review and authorization.
