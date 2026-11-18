# V-SMART RM — Consumables SM Approval Plan Changelog

**Document Version:** 1.0.0  
**Date:** November 18, 2026  
**Target Documents Updated:**  
- [consumable-sm-approval-design.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/consumable-sm-approval-design.md)  
- [consumable-sm-approval-phase-plan.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/consumable-sm-approval-phase-plan.md)  

---

## Summary of Changes Implemented

This changelog records the complete set of updates applied to the architecture design and phase implementation plan to reflect the final executive decisions.

| # | Item / Change Requirement | Changes Applied to `docs/consumable-sm-approval-design.md` | Changes Applied to `docs/consumable-sm-approval-phase-plan.md` |
| :--- | :--- | :--- | :--- |
| **1** | **Backfill Rule** | Updated Section 2.3 SQL backfill to explicitly set `approved_at = created_at` (removed `COALESCE("printed_at", ...)`). | Updated Phase P1 migration SQL outline and verification checks to assert `approved_at = created_at`. |
| **2** | **Sweep Predicates** | Updated Section 7.1 to use `COALESCE(cri.approved_at, cri.created_at) <= NOW() - INTERVAL '24 hours'` and explicitly treat `NULL` `approval_status` as `APPROVED` via `(cri.approval_status IS NULL OR cri.approval_status = 'APPROVED')`. | Updated Phase P4 sweep specifications and test assertions to require `COALESCE(cri.approved_at, cri.created_at)` and `NULL = APPROVED`. |
| **3** | **Phase Evolution of `createRequest`** | Added Section 3.2 detailing that in P2 `createRequest` will set `approval_status` by flag (`PENDING_SM_APPROVAL` if ON, `APPROVED` if OFF), and that prior to P2, `NULL` is treated as `APPROVED`. | Added `createRequest` runtime logic to Phase P2 deliverables with explicit specification that `NULL` = `APPROVED` until P2. |
| **4** | **Bulk Endpoints Capped at 200 IDs & Roles Hardening** | In Section 6.1, added `@ArrayMaxSize(200)` to DTOs, restricted `@Roles` strictly to `SENIOR_MANAGER` and `ADMIN` (removed `GENERAL_MANAGER`), and enforced mandatory rejection reason (`@MinLength(5)`). | In Phase P2, specified 200 ID cap, role restrictions (`SENIOR_MANAGER` & `ADMIN` only), and mandatory rejection reason. |
| **5** | **Live Stock Re-Check at Approval** | Added Section 6.2 detailing dynamic track switching: when approving a `STOCK_ITEM`, if live stock is insufficient, track dynamically switches to `NON_STOCK_OR_NEW`, status becomes `OPEN`, and an audit log is recorded. | Added stock re-check logic and unit tests to Phase P2 scope. |
| **6** | **`deleteLineItem` Refuses Rejected Lines** | Added Section 6.3 specifying that `deleteLineItem()` and `bulkDeleteLineItems()` throw `BadRequestException` when attempting to delete `REJECTED` items, preserving audit history. | Added deletion guard for rejected items to Phase P2 scope and unit tests. |
| **7** | **Pending Count Endpoint for Sidebar Badge** | Added Section 6.1 specification for `GET /api/consumables/approvals/pending-count` returning `{ count: number }`. | Added `pending-count` endpoint to Phase P2 and wired to Phase P3 UI sidebar badge. |
| **8** | **Alert Digest Preview SQL Update** | In Section 7.1, updated raw SQL in `AlertDigestService.previewCurrentOpenItemsFirstRun()` for `CONSUMABLE_RECEIPT_OVERDUE` and `CONSUMABLE_PENDING_2_DAYS` to match live sweeps. | Added update of `AlertDigestService` raw SQL to Phase P4 scope and test criteria. |
| **9** | **Seed Migration & Matrix Tests** | In Section 8.2, specified additive seed migration for `notification_event_roles` and configured `CONSUMABLE_APPROVED` to target `STORES` + requisition requester. | In Phase P5, added additive seed migration `1794400000000-SeedConsumableApprovalEmailEvents.ts` and updates to `priority-classification.spec.ts` and `seed-check.spec.ts`. |
| **10** | **Phase 0 Pre-Checks & Gate Ordering** | Specified in Section 3.1 that flag `ON` can only be set in production after both P4 and P5 approval gates have passed. | In Phase P6, added Phase 0 pre-checks (Phase 162 tables exist, Render migration path, dev-token & Swagger disabled) and enforced gate dependency before flag `ON`. |
| **11** | **Decide Later Section** | Added Section 10 ("Decide Later") covering: (1) Pending approval reminder alert (>24h/48h digest), and (2) SM/Admin skip-queue option. | Added Section 3 ("Decide Later") in Phase Plan covering the same two deferred items. |
| **12** | **Universal Standing Rules** | Reinforced core principles in Section 1 (flag default OFF, additive migrations, local DB copy, test emails, compiled production boot, approval gates). | Added Section 1 ("Universal Standing Rules") to Phase Plan and embedded them into every individual phase (P0–P6). |

---

## Executive Policy Adjustments
- **Scope Confirmed:** `CONSUMABLE_SM_APPROVAL_SCOPE=ALL` (both in-stock and purchase items require approval).
- **Approver Roles Confirmed:** `SENIOR_MANAGER` and `ADMIN` only. `GENERAL_MANAGER` has been removed from all approval routes and documentation.
- **Creator Equality Confirmed:** Requisitions created by Senior Managers or Admins must also pass through the approval queue.
- **Auto-Issue Preserved:** The store inward receipt `autoIssue` feature remains active for approved purchase deliveries.
- **Batch Email Consolidation Confirmed:** Bulk approvals dispatch at most 1 email per recipient per batch at Priority 1.

---

## Phase P1 Architectural Refinements (Task A Updates)

The following 4 precision refinements were added during Phase P1 initialization:

| # | Item | Architectural Specification Update |
| :--- | :--- | :--- |
| **13** | **Entity Enum Name** | Explicitly specified `enumName: 'consumable_approval_status_enum'` on `ConsumableRequestItem.approvalStatus` so TypeORM's schema comparator matches the PostgreSQL enum type created in the migration without generating phantom schema diffs. |
| **14** | **P2 Per-Product Running Tally** | In Phase P2 live stock re-check, specified a running tally (`productAllocatedTally`) per `productId` within a single approval batch to prevent multiple lines for the same product in one batch from claiming the same available stock. |
| **15** | **P4 KPI Counters & Report Hardening** | In Phase P4, added explicit requirements for synchronizing KPI counters (`Ready for issue`, `Open purchase`, `Partially issued`, `Dispatched`), the production Receipt Queue `"Open"` filter, and every report/export routine to strictly filter by `approval_status = 'APPROVED'`. |
| **16** | **P6 Pre-Check Refinement** | In Phase P6, dropped the Phase 162 database table pre-check (confirmed already live in production Neon DB), keeping the Render migration path verification and production security posture checks. |

---

## File Verification
- `docs/consumable-sm-approval-design.md`: Version 2.0.0 (Updated)
- `docs/consumable-sm-approval-phase-plan.md`: Version 2.0.0 (Updated)
- `docs/consumable-sm-approval-changelog.md`: Version 1.0.0 (Created)
- **Source Code, Migrations, and Git Working Tree:** Untouched and intact.

---

## Phase P4 Implementation Log (November 18, 2026)

- **Phase P4 Completed:** Queue Integration, KPIs, Requester View, and SLA Sweeps.
- **Backend Updates:**
  - `QueryConsumableItemsDto`: Added `approvedOnly` and `approvalStatus` filters.
  - `findAllLineItems`: Hardened query builder to apply `(item.approvalStatus IS NULL OR item.approvalStatus = 'APPROVED')` when `approvedOnly: true` is provided.
  - `ConsumablesService.checkAndAlertConsumableSlas()`: Excludes non-approved lines (`approvalStatus !== 'APPROVED'`); calculates receipt overdue age from `COALESCE(item.approvedAt, item.createdAt)`.
  - `AlertSweepsService.sweepConsumablePending()` and preview: Synchronized query to filter `(item.approval_status IS NULL OR item.approval_status = 'APPROVED')` and measure age from `COALESCE(item.approved_at, req.created_at)`.
  - `AlertDigestService.previewCurrentOpenItemsFirstRun()`: Synchronized raw SQL for `CONSUMABLE_RECEIPT_OVERDUE` and `CONSUMABLE_PENDING_2_DAYS`.
  - Unit Tests: Added 3 new test suites in `consumables-approval.spec.ts` (total 22 tests) validating query filtering and SLA sweep age measurement.
- **Frontend Updates:**
  - `ConsumablePurchaseStoreWorkspace.tsx`: Calls `getLineItems({ approvedOnly: true })`; guards multi-select, print, receive, and issue actions; recomputes all 4 KPI cards over approved lines only; adds Approval Status to Excel/CSV exports.
  - `ConsumableRequestsWorkspace.tsx`: Added Pending Approval and Rejected filter tabs; added Pending Approval and Rejected KPI cards; added derived request header status badges; added per-line approval badges with rejection reason tooltips; added one-click "Re-raise" action for rejected items.
- **Verification & Baseline Parity:**
  - Requests Workspace KPIs on baseline: `43 / 0 / 43 / 15` (100% baseline match).
  - Stores Workspace KPIs on baseline: `26 open purchase / 17 dispatched` (100% baseline match).
  - Sweeps parity on local database: `CONSUMABLE_RECEIPT_OVERDUE` (22/22 row IDs match), `CONSUMABLE_PENDING_2_DAYS` (1/1 row ID match).
- **Report Created:** [consumable-sm-approval-p4-report.md](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/docs/consumable-sm-approval-p4-report.md).

