# Phase P4 Report: Queue Integration, KPIs, Requester View, and SLA Sweeps

**Date:** 2026-11-18  
**Phase:** P4 – Queue Integration, KPIs, Requester View, Sweeps  
**Status:** PASS (All pre-push gates verified; STOPPED for user approval)

---

## 1. Executive Summary

Phase P4 completes the end-to-end integration of the Consumables Senior Manager Approval workflow into V-SMART's daily operational interfaces. With P4 in place:
1. **Downstream Queues Protected:** The In-Stock Store Queue and Non-Stock Purchase Queue (`ConsumablePurchaseStoreWorkspace.tsx`) display exclusively approved lines (`approvalStatus` is `NULL` or `'APPROVED'`). Pending and rejected lines cannot be selected for Print Slip, Mark Received, or Issue.
2. **KPI Parity Guaranteed:** All KPIs on both workspaces are computed strictly over approved lines. With existing data (or `CONSUMABLE_SM_APPROVAL_MODE=OFF`), KPI counts match the exact baseline (`43 / 0 / 43 / 15` on Requests Workspace; `26 open purchase / 17 dispatched` on Stores/Purchase Workspace).
3. **Requester Visibility & Re-raise:** Requesters on `ConsumableRequestsWorkspace.tsx` can track individual line approval statuses (Pending, Approved, Rejected with tooltip details), view derived request-level status badges, filter by Pending or Rejected, and re-raise rejected lines in one click via a pre-filled Request Builder.
4. **SLA Sweeps Synchronized:** Automated sweeps (`CONSUMABLE_RECEIPT_OVERDUE`, `CONSUMABLE_PENDING_2_DAYS`, first-run digest SQL, and sweep preview queries) exclude unapproved items and calculate aging from `COALESCE(approved_at, created_at)`, preventing premature alerts on items pending approval.

All pre-push gates passed: `nest build` passed, compiled production backend boots with 200 OK on `/api/health`, 57/57 backend tests passed, `madge` circular dependencies remained flat at baseline 54 (0 new cycles), and `tsc -b && vite build` and `oxlint` passed with 0 errors.

---

## 2. Queue Integration & Action Guards

### 2.1 Backend Query Filtering
- **DTO:** Added `approvedOnly?: boolean` and `approvalStatus?: ConsumableApprovalStatus` to `QueryConsumableItemsDto`.
- **Query Builder (`findAllLineItems`):** When `approvedOnly: true` is passed, the query enforces:
  ```sql
  (item.approval_status IS NULL OR item.approval_status = 'APPROVED')
  ```
  Legacy items with `NULL` continue to be treated as `APPROVED`. When `approvalStatus` is passed explicitly, it filters by the exact status enum.

### 2.2 Frontend Downstream Workspace (`ConsumablePurchaseStoreWorkspace.tsx`)
- Updated `loadData()` to call `consumablesApi.getLineItems({ approvedOnly: true })`.
- Added client-side safety guard in row rendering and processing pipelines:
  ```typescript
  const isApproved = !item.approvalStatus || item.approvalStatus === 'APPROVED';
  ```
- **Action Buttons Guarded:**
  - `handleSelectAllVisible`: Excludes non-approved items from multi-select.
  - `handleToggleSelect`: Prevents selecting any non-approved line.
  - `handlePrintSingleItem`: Throws toast error if attempting to generate a PR slip for an unapproved item.
  - `handleOpenReceiveModal`: Guards against receiving unapproved purchase lines.
  - `handleOpenIssueModal`: Guards against issuing unapproved stock lines.
- **Export Hardening:** The Excel / CSV export dropdown uses `approvedOnly: true` data and includes an explicit `Approval Status` column, ensuring unapproved lines are never exported to external procurement sheets.

---

## 3. KPI Recomputation & Baseline Parity Verification

### 3.1 Mathematical Rule
Every operational KPI on both workspaces is computed over approved lines only:
- Lines with `approvalStatus = 'PENDING_SM_APPROVAL'` or `'REJECTED'` are completely omitted from store queue totals and active SLA calculations.
- Two dedicated informational cards (`Pending Approval` and `Rejected`) were added to `ConsumableRequestsWorkspace.tsx` to provide requesters complete visibility into items awaiting decision.

### 3.2 Before & After Baseline Comparison Table (Local Database Copy)

| Metric | Pre-P4 Baseline (Existing Data) | Post-P4 (All Approved / Mode OFF) | Post-P4 With Pending/Rejected Items | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Requests: Total Lines** | 43 | **43** | Approved Count Only | IDENTICAL |
| **Requests: In-Stock Track** | 0 | **0** | Approved Count Only | IDENTICAL |
| **Requests: Purchase Track** | 43 | **43** | Approved Count Only | IDENTICAL |
| **Requests: Ready to Receive** | 15 | **15** | Approved Count Only | IDENTICAL |
| **Requests: Pending Approval** | N/A (new) | **0** | Count of Pending Lines | VERIFIED |
| **Requests: Rejected** | N/A (new) | **0** | Count of Rejected Lines | VERIFIED |
| **Store: Ready for Issue** | 0 | **0** | Approved Count Only | IDENTICAL |
| **Store: Open Purchase** | 26 | **26** | Approved Count Only | IDENTICAL |
| **Store: Partially Issued** | 0 | **0** | Approved Count Only | IDENTICAL |
| **Store: Dispatched** | 17 | **17** | Approved Count Only | IDENTICAL |

*Proof executed via `verify-p4.js` against the local PostgreSQL database containing 43 grandfathered consumable request items: all 43 lines match 100% of baseline figures.*

---

## 4. Requester View & Re-raise Workflow (`ConsumableRequestsWorkspace.tsx`)

### 4.1 Filter Tabs
The status filter tabs were expanded from 3 to 5 options:
1. `All Items`
2. `Open` (Strictly excludes `PENDING_SM_APPROVAL` and `REJECTED`)
3. `Pending Approval` (Shows only items awaiting Senior Manager review)
4. `Rejected` (Shows only rejected items with reasons and Re-raise option)
5. `Ready to Receive` (Unchanged handover verification queue)

### 4.2 Derived Request-Level Header Status Badges (Section 2.4)
Each request accordion header now displays a derived status badge calculated across its constituent line items:
- `PENDING_SM_APPROVAL`: All lines in the request are pending approval.
- `PARTIALLY_APPROVED`: Some lines are approved while others remain pending or rejected.
- `FULLY_APPROVED`: All lines in the request are approved.
- `REJECTED`: All lines in the request were rejected.
- `PROCESSED_WITH_REJECTIONS`: Operational lines processed, but some lines were rejected.

### 4.3 Per-Line Approval Status Badges & Tooltip
- **Pending:** Amber badge (`Clock` icon) labeled "Pending SM".
- **Approved:** Emerald badge (`CheckCircle2` icon) labeled "Approved".
- **Rejected:** Rose badge (`XCircle` icon) labeled "Rejected". Tooltip displays the rejection reason along with the timestamp: `"{reason}" (at DD/MM/YYYY, HH:MM)`.

### 4.4 One-Click "Re-raise" Action
When a line item has status `REJECTED`:
- An indigo **"Re-raise"** button (`RotateCcw` icon) appears in the Action column.
- Clicking "Re-raise" opens the Request Builder pre-filled with:
  - Product Description, Qty, and UOM
  - Selected or custom Vendor information
  - End User in Velan and Requested By
  - Remarks automatically prepended with: `"Re-raised from <requestCode>"`
- Re-raising is purely an operational shortcut and creates a fresh requisition without modifying any existing schema.

---

## 5. SLA Sweeps & Alert Digest Synchronization

### 5.1 Sweeps Updated

| Sweep / Event Code | Location | Predicate Applied | Aging Clock Anchor |
| :--- | :--- | :--- | :--- |
| `CONSUMABLE_RECEIPT_OVERDUE` | `consumables.service.ts` | `(approval_status IS NULL OR approval_status = 'APPROVED')` | `COALESCE(approved_at, created_at)` |
| `CONSUMABLE_PENDING_2_DAYS` | `alert-sweeps.service.ts` | `(item.approval_status IS NULL OR item.approval_status = 'APPROVED')` | `COALESCE(item.approved_at, req.created_at)` |
| Digest First-Run SQL | `alert-digest.service.ts` | `(cri.approval_status IS NULL OR cri.approval_status = 'APPROVED')` | `COALESCE(cri.approved_at, cri.created_at)` |
| Sweep Preview Endpoint | `alert-sweeps.service.ts` | `(item.approval_status IS NULL OR item.approval_status = 'APPROVED')` | `COALESCE(item.approved_at, req.created_at)` |
| `CONSUMABLE_PARTIALLY_ISSUED_OVERDUE` | `consumables.service.ts` | Unchanged (`real_received_qty > 0`, already in stores) | `item.purchaseReceivedAt` |

### 5.2 Row-ID Verification Proof on Database

Verification query executed comparing legacy queries against new queries with `approval_status` and `approved_at` predicates on the local database:

```json
{
  "overdueReceipts": {
    "legacyCount": 22,
    "newCount": 22,
    "idsMatch": true,
    "count": 22
  },
  "pending2Days": {
    "legacyCount": 1,
    "newCount": 1,
    "idsMatch": true,
    "count": 1,
    "ids": [
      "24713871-d279-4a86-b616-738a34ea3d0f"
    ]
  }
}
```
- **Overdue Receipts:** 22/22 row IDs match 100%.
- **Pending 2 Days:** 1/1 row ID match 100% (`24713871-d279-4a86-b616-738a34ea3d0f`).
- **Live vs Preview Parity:** The live sweep query and preview query return the identical candidate set.

---

## 6. Reports, Exports & Dashboards Audit

A full codebase search was conducted across all files querying or displaying consumables:

| Area | File Path | Impact in P4 |
| :--- | :--- | :--- |
| **Stores Export** | `frontend/src/pages/ConsumablePurchaseStoreWorkspace.tsx` | Export dropdown receives `approvedOnly: true` dataset; added `Approval Status` column to Excel/CSV export. |
| **PDF Requisition** | `backend/src/reports/pdf/pdf-generator.service.ts` | `generateConsumablePrPdf` operates strictly on printed PR lines, which are guarded against unapproved items. |
| **Reports / Analytics** | `backend/src/dashboards/`, `backend/src/reports/`, `backend/src/analytics/` | Confirmed zero existing direct SQL queries on `consumable_request_items` (RM and PO only). |
| **Email Preferences** | `frontend/src/components/emailPreferences/RoleRulesPanel.tsx` | Consumable event labels and switches render correctly. |

---

## 7. Automated Test Suite

Added comprehensive test cases in `backend/src/consumables/consumables-approval.spec.ts`:
1. **`findAllLineItems` Filtering:**
   - `approvedOnly: true` correctly attaches `(item.approvalStatus IS NULL OR item.approvalStatus = :approvedStatus)` with status `APPROVED`.
   - `approvalStatus: REJECTED` filters exactly for rejected items.
2. **SLA Sweep Aging & Filtering:**
   - 72-hour-old item with `PENDING_SM_APPROVAL` status is **skipped** (not alerted).
   - 72-hour-old item with `REJECTED` status is **skipped** (not alerted).
   - 72-hour-old item approved 1 hour ago (`approvedAt = NOW() - 1h`) is **not alerted** (1h < 24h threshold).
   - Item approved 25 hours ago (`approvedAt = NOW() - 25h`) is **alerted** as overdue.
   - Legacy item (`approvalStatus = null`) created 25 hours ago is **alerted** as overdue (falls back to `createdAt`).

Test execution result:
```text
Test Files  3 passed (3)
Tests       57 passed (57) [consumables-entity: 6, consumables.service: 29, consumables-approval: 22]
Time        6.91s
```

---

## 8. Pre-Push Verification Gate Results

| Gate Check | Command | Result | Details |
| :--- | :--- | :---: | :--- |
| **Backend Build** | `npm --prefix backend run build` | **PASS** | `nest build` completed with code 0. |
| **Production Boot** | `NODE_ENV=production EMAIL_PROVIDER_TYPE=test node backend/dist/main.js` | **PASS** | Booted cleanly; `/api/health` returned `{"status":"ok","service":"rm-workflow-backend"}` (200 OK). |
| **Circular Deps** | `npx madge --circular --extensions ts src/` (in backend) | **PASS** | 54 circular dependencies (exact baseline; 0 new cycles). |
| **Backend Unit Tests**| `npm --prefix backend test -- src/consumables/ src/alert-sweeps/` | **PASS** | 68/68 passed (57 consumables, 11 alert sweeps). |
| **Frontend Build** | `npm --prefix frontend run build` | **PASS** | `tsc -b && vite build` built 2,809 modules with exit code 0. |
| **Frontend Lint** | `npm --prefix frontend run lint` | **PASS** | `oxlint` 0 errors on 318 files. |

---

## 9. Deliverable Summary & Hard Stop

Phase P4 is complete and fully verified.
- **Git State:** Uncommitted changes are present locally across backend and frontend files.
- **Hard Rule Enforced:** No commits, no git pushes, and no deployments have been performed.
- **Next Step:** Waiting for user review and approval of Phase P4 before proceeding to Phase P5 (End-to-End Walkthrough, Smoke Tests & Handover).
