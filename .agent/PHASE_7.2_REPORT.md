# PHASE 7.2 REPORT — EXISTING ENTITY CLASSIFICATION & DATABASE ARCHITECTURE RECONCILIATION

**Phase:** 7.2 — Existing Entity Classification & Database Architecture Reconciliation  
**Status:** **`COMPLETE`**  
**Database Runtime Status:** **`DATABASE RUNTIME VALIDATION BLOCKED`** (Truthfully recorded: local PostgreSQL connection failed authentication; full code inspection and test contracts verified)  
**Date:** September 18, 2026  

---

## 1. OBJECTIVE

To classify all 30 existing database entities in the current RMRIT repository, determine how each entity relates to the approved Phase 1/Phase 2 final system design, evaluate architectural dependencies, and establish concrete treatment decisions (Keep, Modify, Replace, Merge, Deprecate, Legacy) before proceeding to Phase 7.3 Master Data Schema Design.

---

## 2. FILES REVIEWED

- `.agent/PHASE_7.1_REPOSITORY_DATABASE_AUDIT.md` & `.agent/PHASE_7.1_REPORT.md`
- `CURRENT_REQUIREMENTS_BASELINE.md` & `REQUIREMENT_CHANGE_RECONCILIATION.md`
- `.agent/PHASE_1_REPORT.md` & `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
- `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md` through `.agent/PHASE_2.6_INVENTORY_BALANCE_DESIGN.md`
- `.agent/PHASE_7_DATABASE_DESIGN.md`
- All 30 entity files in `backend/src/**/entities/*.entity.ts`
- All 5 migration files in `database/migrations/` and `backend/src/database/migrations/`
- All test suites in `backend/src/` and `backend/test/`

---

## 3. CURRENT ENTITY COUNT

- **Verified Entity Count:** **30 Entities**
- **Registered in DataSource:** All 30 registered in `ALL_ENTITIES` in [`backend/src/config/data-source.ts`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/config/data-source.ts).

---

## 4. ENTITY CLASSIFICATION SUMMARY

- **Core Active Domain & Workflow Entities (15):** `PurchaseOrder`, `SalesOrderComponent`, `RmRequest`, `RmItem`, `RmFormSc`, `MaterialIssue`, `MaterialIssueItem`, `MaterialReceipt`, `MaterialReceiptItem`, `MaterialConsumption`, `MaterialReturn`, `MaterialReturnItem`, `AdditionalMaterialRequest`, `AdditionalMaterialRequestItem`, `Customer`.
- **Master Data Entities (3):** `ProductCategory`, `ProductFamily`, `Product`.
- **Storage Hierarchy Entities (4):** `Warehouse`, `WarehouseLocation`, `Rack`, `Bin`.
- **Inventory Balance & Ledger Entities (2):** `StockBalance`, `StockTransaction`.
- **Security & Identity Entities (2):** `Role`, `User`.
- **Audit & Notification Entities (2):** `AuditLog`, `RmItemSnapshot`, `Notification`.
- **Legacy Compatibility Entity (1):** `InventoryItem`.

---

## 5. KEEP ENTITIES (27 ENTITIES)

`Role`, `User`, `Customer`, `PurchaseOrder`, `SalesOrderComponent`, `RmRequest`, `RmItem`, `RmFormSc`, `RmItemSnapshot`, `MaterialIssue`, `MaterialIssueItem`, `MaterialReceipt`, `MaterialReceiptItem`, `MaterialConsumption`, `MaterialReturn`, `MaterialReturnItem`, `AdditionalMaterialRequest`, `AdditionalMaterialRequestItem`, `Notification`, `AuditLog`, `ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, `Bin`.

---

## 6. MODIFY ENTITIES (2 ENTITIES)

- `StockBalance`: Dual-bound entity. Currently supports legacy `inventory_item_id` and target composite `(productId, binId)`. In Phase 11, service layer queries will transition from `inventoryItemId` to `(productId, binId)`.
- `StockTransaction`: Transitional ledger entity. Supports `product_id`, `source_bin_id`, and `destination_bin_id` alongside `inventory_item_id`. Service layer movement methods will activate bin routing in Phase 11.

---

## 7. REPLACE ENTITIES (0 ENTITIES)

No entity is marked for immediate replacement.

---

## 8. MERGE CANDIDATES (0 ENTITIES)

No active entities are merged in Phase 7.2.

---

## 9. DEPRECATION CANDIDATES (0 ENTITIES)

No active entities are deprecated in Phase 7.2.

---

## 10. LEGACY ENTITIES (1 ENTITY)

- `InventoryItem`: Retained as **`LEGACY / COMPATIBILITY ENTITY`** to ensure existing inventory services, controllers, DTOs, and test fixtures remain operational without breaking changes (`DEC-PROD-014`).

---

## 11. `INVENTORYITEM` FINDINGS

- Flat material specification entity (`material`, `material_type`, `grade`, `size`, `unit`, `minimum_stock_level`).
- Used across active `InventoryService` methods and 27 unit tests.
- Preserved non-destructively alongside `Product`.

---

## 12. `PRODUCT` FINDINGS

- Master catalog item belonging to `ProductFamily` and `ProductCategory`.
- Contains `minimum_inventory` and optional `maximum_inventory`.
- Does **not** directly store stock; stock is tracked through `Product + Bin ──> StockBalance`.

---

## 13. `STOCKBALANCE` FINDINGS

- Physical on-hand stock balance with non-negative constraint (`current_quantity >= 0`).
- Dual-bound in schema (`inventory_item_id` and composite `(product_id, bin_id)` unique index).

---

## 14. `STOCKTRANSACTION` FINDINGS

- Immutable ledger recording movement history (`quantity > 0`, actor `created_by_id`, `source_bin_id`, `destination_bin_id`, `product_id`).
- Supports 6 transaction types: `STOCK_IN`, `STOCK_OUT`, `STORES_ISSUE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`.

---

## 15. BUSINESS WORKFLOW FINDINGS

- `SalesOrderComponent` represents the core manufacturing unit that closes independently.
- `MaterialIssue` is the authoritative stock decrement event.
- `MaterialReceipt` and `MaterialConsumption` are production-side tracking records that do not alter Store stock.
- `MaterialReturn` is a Stores-verified stock increment event.
- `AdditionalMaterialRequest` non-destructively logs variances without overwriting the original RM baseline.

---

## 16. MASTER DATA FINDINGS

- 3-tier hierarchy: `ProductCategory ──(1:N)──> ProductFamily ──(1:N)──> Product`.
- Foreign keys enforce `onDelete: 'RESTRICT'`.

---

## 17. STORAGE FINDINGS

- 4-tier hierarchy: `Warehouse ──(1:N)──> WarehouseLocation ──(1:N)──> Rack ──(1:N)──> Bin`.
- No storage hierarchy entity redundantly stores stock quantities.

---

## 18. SECURITY FINDINGS

- 6 active system roles: `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.
- `SENIOR_DESIGNER` is **NOT PRESENT** in active code.
- All actor references are foreign keys to `users.id` with `onDelete: 'RESTRICT'`.

---

## 19. DUPLICATE CONCEPT FINDINGS

- `InventoryItem` vs `Product` are reconciled as complementary (metallurgical specification vs catalog master).
- `StockOut` is the ledger effect of `MaterialIssue`.
- `StockIn` is the ledger effect of verified `MaterialReturn`.

---

## 20. STOCK SOURCE FINDINGS

- **No multiple runtime stock sources exist.** `StockBalance.currentQuantity` is the sole live balance field.

---

## 21. DATA PRESERVATION RISKS

- Non-destructive coexistence of `InventoryItem` avoids data loss.
- Immutable ledger rows in `stock_transactions` and `rm_item_snapshots` are strictly preserved.
- `onDelete: 'RESTRICT'` prevents accidental cascade deletion of historical records.

---

## 22. OPEN DECISIONS REVIEW

- `DEC-005`: Return Destination Policy (source Bin vs quarantine Bin) — open for business policy.
- `DEC-PROD-010`: Max Inventory Warning vs Block — open for business policy.
- `DEC-PROD-011` / `DEC-WH-006`: Master Creation Authority — restricted to `ADMIN` and `STORES`.
- `DEC-PROD-012`: Multi-Product Bin Policy — supported in schema.
- `DEC-PROD-014`: Dual-binding coexistence — implemented.
- `DEC-WH-008`: Inter-Warehouse Transfer — supported via `TRANSFER` transaction type.

---

## 23. PHASE 7.3 INPUTS

- Master data taxonomy and storage hierarchy schemas are validated.
- Composite uniqueness on `(productId, binId)` for `StockBalance` is verified.
- Foreign key `RESTRICT` rules and check constraints are established.

---

## 24. FILES CREATED

- `.agent/PHASE_7.2_ENTITY_CLASSIFICATION.md`
- `.agent/PHASE_7.2_REPORT.md`

---

## 25. FILES MODIFIED

- **None** (Strict audit rule observed: 0 code files, 0 migrations, 0 entities modified).

---

## 26. VERIFICATION STATUS

- **Linter (`oxlint`):** 0 errors, 0 warnings across 152 files.
- **Build (`nest build`):** Success (exit code 0).
- **Tests (`vitest run`):** 119/119 tests passing across 7 test suites.
- **Phase 7.2 Status:** **`COMPLETE`**

---

## 27. FINAL CLASSIFICATION SUMMARY TABLE

| Entity | Classification | Final Treatment | Reason | Next Phase |
| :--- | :--- | :--- | :--- | :--- |
| `Role` | Security / Identity | **KEEP** | Core RBAC (6 roles) | Phase 8 / 11 |
| `User` | Security / Identity | **KEEP** | User identity & actor FK | Phase 8 / 11 |
| `Customer` | Master Data | **KEEP** | Client organization master | Phase 8 / 11 |
| `PurchaseOrder` | Workflow Document | **KEEP** | External order container | Phase 8 / 11 |
| `SalesOrderComponent` | Workflow Document | **KEEP** | Core independent work order | Phase 8 / 11 |
| `RmRequest` | Workflow Document | **KEEP** | Engineering RM header | Phase 8 / 11 |
| `RmItem` | Workflow Line-Item | **KEEP** | Material specification item | Phase 8 / 11 |
| `RmFormSc` | Junction / Assoc | **KEEP** | PO-form to SC junction | Phase 8 / 11 |
| `RmItemSnapshot` | Audit / Traceability| **KEEP** | Revision snapshot history | Phase 8 / 11 |
| `MaterialIssue` | Workflow Document | **KEEP** | Stores issue note (Stock Out) | Phase 10 / 12 |
| `MaterialIssueItem` | Workflow Line-Item | **KEEP** | Issue item with heat/batch | Phase 10 / 12 |
| `MaterialReceipt` | Workflow Document | **KEEP** | Production receipt confirmation | Phase 10 / 12 |
| `MaterialReceiptItem`| Workflow Line-Item | **KEEP** | Received quantity item | Phase 10 / 12 |
| `MaterialConsumption`| Workflow Line-Item | **KEEP** | Shop-floor consumption log | Phase 10 / 12 |
| `MaterialReturn` | Workflow Document | **KEEP** | Store return note (Stock In) | Phase 10 / 12 |
| `MaterialReturnItem` | Workflow Line-Item | **KEEP** | Return quantity item | Phase 10 / 12 |
| `AdditionalMaterialRequest` | Workflow Document | **KEEP** | Variance request header | Phase 10 / 12 |
| `AdditionalMaterialRequestItem` | Workflow Line-Item | **KEEP** | Variance quantity item | Phase 10 / 12 |
| `Notification` | Notification | **KEEP** | In-app user notifications | Phase 8 / 11 |
| `AuditLog` | Audit / Traceability| **KEEP** | JSON diff audit trail | Phase 8 / 11 |
| `InventoryItem` | Legacy / Compatibility| **LEGACY** | Legacy specification; bridge per `DEC-PROD-014` | Phase 11 |
| `ProductCategory` | Master Data | **KEEP** | Tier 1 product taxonomy | Phase 7.3 / 11 |
| `ProductFamily` | Master Data | **KEEP** | Tier 2 product taxonomy | Phase 7.3 / 11 |
| `Product` | Master Data | **KEEP** | Tier 3 product master | Phase 7.3 / 11 |
| `Warehouse` | Storage Hierarchy | **KEEP** | Tier 1 storage facility | Phase 7.3 / 11 |
| `WarehouseLocation` | Storage Hierarchy | **KEEP** | Tier 2 warehouse location | Phase 7.3 / 11 |
| `Rack` | Storage Hierarchy | **KEEP** | Tier 3 storage rack | Phase 7.3 / 11 |
| `Bin` | Storage Hierarchy | **KEEP** | Tier 4 storage bin | Phase 7.3 / 11 |
| `StockBalance` | Inventory Balance | **MODIFY** | Dual-bound on-hand balance | Phase 7.3 / 11 |
| `StockTransaction` | Inventory Ledger | **MODIFY** | Immutable movement audit ledger | Phase 7.3 / 11 |

---

## 28. REQUIRED FINAL QUESTIONS & ANSWERS

1. **HOW MANY CURRENT ENTITIES EXIST?**  
   **30 Entities**.
2. **HOW MANY ARE ACTIVE CORE DOMAIN ENTITIES?**  
   **15 Entities** (PO, SC, RM, RM Items, FormSc, Issues, Issue Items, Receipts, Receipt Items, Consumption, Returns, Return Items, Additional Requests, Additional Request Items, Customer).
3. **HOW MANY ARE MASTER DATA ENTITIES?**  
   **3 Entities** (`ProductCategory`, `ProductFamily`, `Product`) + `Customer`.
4. **HOW MANY ARE STORAGE ENTITIES?**  
   **4 Entities** (`Warehouse`, `WarehouseLocation`, `Rack`, `Bin`).
5. **HOW MANY ARE INVENTORY ENTITIES?**  
   **3 Entities** (`StockBalance`, `StockTransaction`, and legacy `InventoryItem`).
6. **HOW MANY ARE WORKFLOW DOCUMENT ENTITIES?**  
   **7 Entities** (`PurchaseOrder`, `SalesOrderComponent`, `RmRequest`, `MaterialIssue`, `MaterialReceipt`, `MaterialReturn`, `AdditionalMaterialRequest`).
7. **HOW MANY ARE LINE-ITEM / JUNCTION ENTITIES?**  
   **8 Entities** (`RmItem`, `RmFormSc`, `MaterialIssueItem`, `MaterialReceiptItem`, `MaterialConsumption`, `MaterialReturnItem`, `AdditionalMaterialRequestItem`, `RmItemSnapshot`).
8. **HOW MANY ARE SECURITY / AUDIT / NOTIFICATION ENTITIES?**  
   **4 Entities** (`Role`, `User`, `AuditLog`, `Notification`).
9. **WHICH ENTITIES ARE LEGACY?**  
   **`InventoryItem`** (retained for backward compatibility per `DEC-PROD-014`).
10. **WHICH ENTITIES ARE TRANSITIONAL?**  
    **`StockBalance`** and **`StockTransaction`** (currently support dual binding for legacy `inventory_item_id` and target `productId + binId`).
11. **WHICH ENTITIES HAVE OVERLAPPING CONCEPTS?**  
    `InventoryItem` vs `Product` (reconciled: metallurgical spec vs catalog item).
12. **WHAT EXACTLY MUST HAPPEN TO `InventoryItem`?**  
    Retain as `LEGACY / COMPATIBILITY ENTITY`. Do not drop the table. In Phase 11, create dual-binding adapters to `Product`.
13. **WHAT EXACTLY MUST HAPPEN TO `StockBalance`?**  
    Maintain composite uniqueness on `(productId, binId)` as authoritative identity while preserving nullable `inventory_item_id`.
14. **WHAT EXACTLY MUST HAPPEN TO `StockTransaction`?**  
    Preserve immutability and activate `sourceBinId`, `destinationBinId`, and `productId` fields during Phase 11 movement implementation.
15. **DOES `Product + Bin` REMAIN THE AUTHORITATIVE FINAL STOCK IDENTITY?**  
    **Yes**. `Product + Bin = One StockBalance` is authoritative.
16. **WHAT ENTITIES ARE SAFE TO KEEP WITHOUT STRUCTURAL CHANGE?**  
    27 entities: `Role`, `User`, `Customer`, `PurchaseOrder`, `SalesOrderComponent`, `RmRequest`, `RmItem`, `RmFormSc`, `RmItemSnapshot`, `MaterialIssue`, `MaterialIssueItem`, `MaterialReceipt`, `MaterialReceiptItem`, `MaterialConsumption`, `MaterialReturn`, `MaterialReturnItem`, `AdditionalMaterialRequest`, `AdditionalMaterialRequestItem`, `Notification`, `AuditLog`, `ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, `Bin`.
17. **WHAT ENTITIES REQUIRE DESIGN REVIEW IN 7.3+?**  
    `StockBalance` and `StockTransaction` (for service layer query alignment).
18. **WHICH OPEN BUSINESS DECISIONS BLOCK DATABASE DESIGN?**  
    **None block Phase 7.3**. Open decisions (`DEC-005`, `DEC-PROD-010`, `DEC-PROD-011`) are operational/workflow policies that can be configured in Phase 11.
