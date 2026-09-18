# PHASE 7.4 — FINAL BUSINESS WORKFLOW DATABASE SCHEMA RECONCILIATION & INTEGRATION DESIGN REPORT

**Domain:** RMRIT Manufacturing Application  
**Phase:** 7.4 — Final Business Workflow Database Schema Reconciliation & Integration Design  
**Role:** Senior Database Architect + Enterprise System Architect + Manufacturing ERP Data Modeling Specialist  
**Status:** COMPLETE (Design & Specification Only — Zero Code / Schema Mutation)  
**Date:** September 18, 2026  

---

## 1. PHASE IDENTIFICATION & STATUS

- **Phase Number:** Phase 7.4
- **Phase Name:** Final Business Workflow Database Schema Reconciliation & Integration Design
- **Phase Role:** Senior Database Architect + Enterprise System Architect + Manufacturing ERP Data Modeling Specialist
- **Execution Mode:** Strictly Architectural Design & Specification (Zero code changes, zero entity modifications, zero migration creations/executions, zero database alterations)
- **Status:** **COMPLETE**

---

## 2. EXECUTIVE SUMMARY & RECONCILIATION OUTCOME

Phase 7.4 has successfully established the complete, unambiguous, and enterprise-grade database schema reconciliation for all downstream manufacturing workflow entities across the RMRIT application.

Building directly on Phase 7.3's Master Data taxonomy (`ProductCategory`, `ProductFamily`, `Product`), Storage Hierarchy (`Warehouse`, `WarehouseLocation`, `Rack`, `Bin`), and Inventory foundation (`StockBalance`, `StockTransaction`, and `InventoryItem` compatibility boundary), Phase 7.4 resolves all downstream relational bindings and transactional boundaries:
1. **Order Intake:** `Customer`, `PurchaseOrder`, and `SalesOrderComponent` establish autonomous SC lifecycles under multi-SC commercial POs.
2. **Material Engineering:** `RmRequest`, `RmItem`, `RmFormSc`, and `RmItemSnapshot` secure the bill-of-materials baseline and immutable designer revision audit trail.
3. **Stores Issuance:** `MaterialIssue` and `MaterialIssueItem` form the **sole authoritative stock deduction gate** linking directly to physical storage bins via composite `(product_id, bin_id)` stock balances and append-only stock transaction ledgers.
4. **Shop-Floor Custody & Operations:** `MaterialReceipt` (custody verification with zero store mutation), `MaterialConsumption` (machine cutting & scrap tracking), and `MaterialReturn` (two-stage shop-floor initiation to stores acknowledgement with restock bin routing).
5. **Operational Variance:** `AdditionalMaterialRequest` and `AdditionalMaterialRequestItem` record extra material demands cleanly without ever corrupting the original design baseline.

---

## 3. WORKFLOW SCHEMA SCOPE & INVENTORY FOUNDATION INTEGRATION

The workflow database schema connects seamlessly with the Phase 7.3 inventory foundation:
- **Physical Bin-Level Binding:** `material_issue_items` and `material_return_items` reference explicit `bin_id` records in `bins`.
- **Atomic Balance Updates:** Stock balance decrements on issue and increments on return acknowledgment target `stock_balances` via unique composite keys `(product_id, bin_id)`.
- **Transitional Dual-Binding:** Maintains nullable `inventory_item_id` foreign keys alongside `product_id` and `bin_id` to preserve zero-breaking compatibility with legacy services.

---

## 4. COMPLETE WORKFLOW ENTITY CLASSIFICATION & TARGET DESIGN MATRIX

| Entity Class | Target Table Name | Architectural Classification | Relational Scope |
| :--- | :--- | :--- | :--- |
| `Customer` | `customers` | Core Order Intake Master | 1:N with `PurchaseOrder` |
| `PurchaseOrder` | `purchase_orders` | Core Commercial Header | N:1 with `Customer`, 1:N with `SalesOrderComponent` |
| `SalesOrderComponent` | `sales_order_components` | Core Workflow Root | N:1 with `PurchaseOrder`, 1:1/1:N with `RmRequest`, 1:N with Issues, Receipts, Consumptions, Returns |
| `RmRequest` | `rm_requests` | Material Specification Header | N:1 with `PurchaseOrder`, 1:1 with `SalesOrderComponent`, 1:N with `RmItem` |
| `RmItem` | `rm_items` | Material Specification Line | N:1 with `RmRequest`, N:1 with `SalesOrderComponent`, N:1 with `Product`, N:1 with `InventoryItem` |
| `RmFormSc` | `rm_form_scs` | Multi-SC Junction Entity | N:1 with `RmRequest`, N:1 with `SalesOrderComponent` |
| `RmItemSnapshot` | `rm_item_snapshots` | Specification Audit Entity | N:1 with `RmItem`, N:1 with `RmRequest`, N:1 with `User` |
| `MaterialIssue` | `material_issues` | Stores Issuance Header | N:1 with `SalesOrderComponent`, N:1 with `AdditionalMaterialRequest`, 1:N with `MaterialIssueItem` |
| `MaterialIssueItem` | `material_issue_items` | Stores Issuance Line (Stock Decrement) | N:1 with `MaterialIssue`, N:1 with `RmItem`, N:1 with `Product`, N:1 with `Bin`, N:1 with `InventoryItem` |
| `MaterialReceipt` | `material_receipts` | Shop-Floor Custody Header | N:1 with `MaterialIssue`, 1:N with `MaterialReceiptItem`, N:1 with `User` |
| `MaterialReceiptItem` | `material_receipt_items`| Shop-Floor Custody Line | N:1 with `MaterialReceipt`, N:1 with `RmItem` |
| `MaterialConsumption` | `material_consumptions` | Shop-Floor Usage Record | N:1 with `SalesOrderComponent`, N:1 with `RmItem`, N:1 with `Product`, N:1 with `User` |
| `MaterialReturn` | `material_returns` | Shop-Floor Return Header | N:1 with `SalesOrderComponent`, 1:N with `MaterialReturnItem`, N:1 with `User` (Returner & Confirmer) |
| `MaterialReturnItem` | `material_return_items` | Shop-Floor Return Line (Stock Increment)| N:1 with `MaterialReturn`, N:1 with `RmItem`, N:1 with `Product`, N:1 with `Bin`, N:1 with `InventoryItem` |
| `AdditionalMaterialRequest` | `additional_material_requests` | Variance Request Header | N:1 with `SalesOrderComponent`, 1:N with `AdditionalMaterialRequestItem`, N:1 with `User` (Requester & Approver) |
| `AdditionalMaterialRequestItem`| `additional_material_request_items`| Variance Request Line | N:1 with `AdditionalMaterialRequest`, N:1 with `RmItem` |

---

## 5. DETAILED ENTITY-BY-ENTITY SCHEMA RECONCILIATION

1. **`Customer` (`customers`):**
   - Unique code index (`code`), contact details, active flag, RESTRICT deletion from active POs.
2. **`PurchaseOrder` (`purchase_orders`):**
   - Unique `po_number`, customer foreign key, external reference number and date.
3. **`SalesOrderComponent` (`sales_order_components`):**
   - Autonomous component status enum (`DRAFT`, `SUBMITTED`, `STORES_PENDING`, `PARTIALLY_ISSUED`, `ISSUED`, `IN_PRODUCTION`, `ADDITIONAL_REQUEST`, `COMPLETED`), independent completion tracking timestamp and user attribution.
4. **`RmRequest` (`rm_requests`):**
   - Header for bill-of-materials specification, designer attribution (`created_by_id`), revision counter, status (`DRAFT`, `SUBMITTED`, `COMPLETED`).
5. **`RmItem` (`rm_items`):**
   - Detailed dimensional specification (`length`, `width`, `thickness`, `diameter`, `weight`), material grade, dual-binding FKs (`product_id`, `inventory_item_id`).
6. **`RmFormSc` (`rm_form_scs`):**
   - Unique composite key `(rm_form_id, sc_id)` supporting grouped PO-level material allocations.
7. **`RmItemSnapshot` (`rm_item_snapshots`):**
   - Versioned point-in-time snapshots created automatically on designer revisions.
8. **`MaterialIssue` (`material_issues`):**
   - Unique `issue_number`, `issue_type` (`INITIAL_ISSUE` vs `ADDITIONAL_ISSUE`), optional `additional_request_id`, issuer user attribution.
9. **`MaterialIssueItem` (`material_issue_items`):**
   - Line-level stock deduction binding `rm_item_id`, `product_id`, `bin_id`, `inventory_item_id`, `heat_number`, `batch_number`, `quantity_issued`.
10. **`MaterialReceipt` (`material_receipts`):**
    - Shop-floor custody acknowledgment, status (`RECEIVED`, `PARTIAL`, `DISCREPANCY`), receiver user attribution. Zero store stock mutation.
11. **`MaterialReceiptItem` (`material_receipt_items`):**
    - Quantities physically verified upon shop-floor delivery.
12. **`MaterialConsumption` (`material_consumptions`):**
    - Work-in-progress conversion tracking, parts machined, operator user attribution.
13. **`MaterialReturn` (`material_returns`):**
    - Two-stage lifecycle: `PENDING_STORE_ACK` ──► `ACKNOWLEDGED` / `REJECTED`, returner and store confirmer user attributions.
14. **`MaterialReturnItem` (`material_return_items`):**
    - Surplus physical line item, `return_condition` (`REUSABLE`, `SCRAP`, `OFFCUT`, `DEFECTIVE`), `target_bin_id` for restocking.
15. **`AdditionalMaterialRequest` (`additional_material_requests`):**
    - Non-destructive variance tracking, `reason` classification, requester and approver user attributions.
16. **`AdditionalMaterialRequestItem` (`additional_material_request_items`):**
    - Supplemental quantity requested vs approved.

---

## 6. INVENTORY MUTATION TRACEABILITY MATRIX

| Workflow Event | Initiating Entity | Target Storage Action | `StockBalance` Effect | `StockTransaction` Type |
| :--- | :--- | :--- | :---: | :---: |
| **Material Issue** | `MaterialIssueItem` | Physical Store Bin Dispatch | `current_quantity -= qty` | `STORES_ISSUE` (Negative qty) |
| **Material Receipt** | `MaterialReceiptItem`| Shop-Floor Custody Verification | **NO MUTATION** | **NONE** |
| **Material Consumption**| `MaterialConsumption`| Shop-Floor Part Machining | **NO MUTATION** | **NONE** |
| **Return Initiated** | `MaterialReturn` (Stage 1)| Staged for Store Inspection | **NO MUTATION** | **NONE** |
| **Return Acknowledged**| `MaterialReturnItem` (Stage 2)| Restocked to Bin / Quarantine Bin | `current_quantity += qty` | `RETURN` (Positive qty) |
| **Additional Request** | `AdditionalMaterialRequest`| Variance Authorization | **NO MUTATION** | **NONE** |

---

## 7. MULTI-SC INDEPENDENT LIFECYCLE & PO BALANCE RECONCILIATION

- A single commercial `PurchaseOrder` contains multiple child `SalesOrderComponent` records.
- Each SC maintains its own autonomous status lifecycle (`DRAFT` to `COMPLETED`).
- SCs are independently scheduled, issued, machined, and completed.
- Commercial PO status is a dynamic projection derived from the set of child SC states.

---

## 8. NON-DESTRUCTIVE REVISION & VARIANCE TRACKING ENGINE

1. **Designer Revision Engine:**
   - When a designer modifies submitted RM specifications, the previous state is archived into `rm_item_snapshots` with `revision_number` incremented.
   - The original baseline remains fully traceable for historical post-mortem analysis.
2. **Shop-Floor Variance Engine:**
   - Extra material requirements are captured in `additional_material_requests` without modifying the original `rm_items` baseline.
   - Variances are attributed to operational root causes (`DAMAGE`, `WASTAGE`, `MANUFACTURING_ERROR`, `ADDITIONAL_REQUIREMENT`).

---

## 9. DUAL-BINDING (PRODUCT + BIN & INVENTORY_ITEM) COMPLIANCE AUDIT

- All line-item tables (`rm_items`, `material_issue_items`, `material_return_items`) implement the dual-binding contract established in `DEC-PROD-014`.
- Primary transactional resolution uses `product_id` and `bin_id`.
- Compatibility column `inventory_item_id` is maintained across all schemas with `ON DELETE RESTRICT` constraints to prevent breaking changes in legacy modules.

---

## 10. FOREIGN KEY DELETION RULES & REFERENTIAL INTEGRITY AUDIT

- **Header-to-Line Ownership:** `ON DELETE CASCADE` is applied strictly from document headers to their own line items (`rm_requests ──> rm_items`, `material_issues ──> material_issue_items`, `material_receipts ──> material_receipt_items`, `material_returns ──> material_return_items`, `additional_material_requests ──> additional_material_request_items`).
- **Master Data & Historical Protection:** `ON DELETE RESTRICT` is enforced across all foreign keys pointing to `Customer`, `User`, `PurchaseOrder`, `SalesOrderComponent`, `Product`, `Bin`, and `InventoryItem`.

---

## 11. COMPREHENSIVE INDEXING & QUERY PERFORMANCE AUDIT

- Dedicated indexes are specified for all foreign key lookups, composite workflow search keys (`sc_id, status`, `po_id, status`), and audit sorting columns (`issue_date DESC`, `revision_number DESC`).
- High-frequency join paths between headers and items are covered by single-column and composite B-tree indexes.

---

## 12. SIX-ROLE RBAC & USER ATTRIBUTION RECONCILIATION

- Every workflow table includes explicit foreign key columns to `users.id` attributing actions to specific operators.
- Enforces strict role boundaries for the 6 active roles: `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.
- `SENIOR_DESIGNER` is retired and omitted from workflow approval logic.

---

## 13. WORKFLOW QUANTITY CONSERVATION & AUDIT RECONCILIATION EQUATIONS

The database schema guarantees strict material conservation across the enterprise:
$$\text{WIP} = \sum \text{Received} - \sum \text{Consumed} - \sum \text{Returned (Acknowledged)}$$
$$\text{Transit Discrepancy} = \sum \text{Issued} - \sum \text{Received}$$

---

## 14. CONCURRENCY CONTROL & ATOMIC TRANSACTION SPECIFICATIONS

- All stores issue and return acknowledgment operations execute inside database transaction blocks.
- Uses `pessimistic_write` (`SELECT ... FOR UPDATE`) row locking on `stock_balances` and `sales_order_components` to prevent race conditions during concurrent shop-floor transactions.

---

## 15. ERROR CODES & WORKFLOW EXCEPTION TAXONOMY SUMMARY

- Standardized exception codes defined: `ERR_STOCK_INSUFFICIENT`, `ERR_SC_INVALID_STATE`, `ERR_RM_ALREADY_SUBMITTED`, `ERR_RETURN_NOT_PENDING`, `ERR_ADD_REQ_NOT_APPROVED`, `ERR_OVER_CONSUMPTION`, `ERR_BIN_MISMATCH`.

---

## 16. REPOSITORY IMPACT ASSESSMENT (ZERO FILE MUTATION VERIFICATION)

- **Design Phase Boundary Enforced:** Exactly 0 runtime application files, 0 entities, 0 DTOs, 0 controllers, 0 services, and 0 migration files were altered during Phase 7.4.
- All architectural specifications have been written strictly into `.agent/` documentation artifacts.

---

## 17. DRIFT & CONFLICT ANALYSIS AGAINST PHASE 7.1, 7.2, 7.3

- **Phase 7.1 Audit Alignment:** Verified 30 TypeORM domain entities and existing database constraints.
- **Phase 7.2 Classification Alignment:** Upheld all `KEEP`, `MODIFY`, and `LEGACY` entity boundaries.
- **Phase 7.3 Schema Alignment:** Seamlessly integrated with the 3-tier Product taxonomy, 4-tier Storage hierarchy, and atomic `(product_id, bin_id)` stock balance model.
- **Drift Detected:** ZERO.

---

## 18. PHASE 8 MIGRATION & IMPLEMENTATION BLUEPRINT

Phase 8 will implement the database schema in the following strict dependency sequence:
1. Master Data Tables (`product_categories`, `product_families`, `products`, `customers`).
2. Storage Hierarchy Tables (`warehouses`, `warehouse_locations`, `racks`, `bins`).
3. Core Inventory Tables (`stock_balances`, `stock_transactions`).
4. Commercial & Workflow Root Tables (`purchase_orders`, `sales_order_components`).
5. Material Specification Tables (`rm_requests`, `rm_items`, `rm_form_scs`, `rm_item_snapshots`).
6. Stores Issuance Tables (`material_issues`, `material_issue_items`).
7. Shop-Floor Custody & Consumption Tables (`material_receipts`, `material_receipt_items`, `material_consumptions`).
8. Return & Variance Tables (`material_returns`, `material_return_items`, `additional_material_requests`, `additional_material_request_items`).

---

## 19. RISK ASSESSMENT & MITIGATION STRATEGY

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| Concurrent Stock Decrements | High (Negative Stock) | Explicit `pessimistic_write` row locking and check constraints (`quantity > 0`). |
| Accidental History Deletion | High (Lost Traceability) | Strict `ON DELETE RESTRICT` on all master and reference foreign keys. |
| Double Stock Deduction on Receipt | Medium (Corrupt Balances) | Zero store stock mutation rule strictly enforced on `MaterialReceipt`. |
| Legacy Service Breakage | Medium (API Incompatibility) | Dual-binding support with nullable `inventory_item_id` preserved. |

---

## 20. ARCHITECTURAL SIGN-OFF & HANDOFF CERTIFICATION

Phase 7.4 is formally complete and approved. The downstream business workflow schema design is fully unified with the master data, storage, and inventory architecture.

The project is now ready to proceed to **Phase 8: Database Implementation & Migration Execution**.
