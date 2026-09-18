# PHASE 7 — FINAL DATABASE DESIGN & SCHEMA RECONCILIATION SPECIFICATION

## 1. Objective
Establish the authoritative, finalized relational database schema for the RMRIT manufacturing system. This document reconciles the existing Phase 10 database structure with the approved Phase 1 and Phase 2 business domain designs (Product Master, Category & Family, Warehouse, Location/Rack/Bin, and Inventory Balance), specifying TypeORM entities, relational integrity constraints, foreign key rules, indexes, and migration strategies without destroying historical data.

---

## 2. Authoritative Sources & Hierarchy
Schema decisions follow this strict authority hierarchy:
1. **Current User Requirements** (`.agent/CURRENT_REQUIREMENTS_BASELINE.md`)
2. **Phase 1 Requirement Reconciliation** (`.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`, `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`, `.agent/PHASE_1_REPORT.md`)
3. **Phase 2.1 Inventory Domain & Storage Architecture** (`.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md`)
4. **Phase 2.2 Product Master Design** (`.agent/PHASE_2.2_PRODUCT_MASTER_DESIGN.md`)
5. **Phase 2.3 Category & Family Design** (`.agent/PHASE_2.3_CATEGORY_FAMILY_DESIGN.md`)
6. **Phase 2.4 Warehouse Design** (`.agent/PHASE_2.4_WAREHOUSE_DESIGN.md`)
7. **Phase 2.5 Location / Rack / Bin Design** (`.agent/PHASE_2.5_LOCATION_RACK_BIN_DESIGN.md`)
8. **Phase 2.6 Inventory Balance Design** (`.agent/PHASE_2.6_INVENTORY_BALANCE_DESIGN.md`)
9. **Actual Current Repository Implementation** (`backend/src/`)
10. **Historical Design Documents & Outdated Specs**

---

## 3. Current Database Inventory
Inspection of `backend/src/` reveals 23 existing domain entities:

| # | Entity Name | Table Name | Domain Module | Primary Key | Business Purpose |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `Role` | `roles` | `roles` | UUID `id` | System RBAC roles. |
| 2 | `User` | `users` | `users` | UUID `id` | System user accounts and authentication. |
| 3 | `Customer` | `customers` | `customers` | UUID `id` | Customer master data. |
| 4 | `PurchaseOrder` | `purchase_orders` | `po` | UUID `id` | External PO master reference. |
| 5 | `SalesOrderComponent` | `sales_order_components` | `sc` | UUID `id` | Independent SC workflow units under a PO. |
| 6 | `RmRequest` | `rm_requests` | `rm` | UUID `id` | RM requisition form (PO/SC level). |
| 7 | `RmItem` | `rm_items` | `rm` | UUID `id` | Line items requested on an RM form. |
| 8 | `RmFormSc` | `rm_form_scs` | `rm` | UUID `id` | Junction entity for PO-level RM form to SCs. |
| 9 | `RmItemSnapshot` | `rm_item_snapshots` | `rm` | UUID `id` | Immutable audit snapshot of RM edits. |
| 10 | `MaterialIssue` | `material_issues` | `material-issue` | UUID `id` | Stores material issue header. |
| 11 | `MaterialIssueItem` | `material_issue_items` | `material-issue` | UUID `id` | Line items issued by Stores. |
| 12 | `MaterialReceipt` | `material_receipts` | `production` | UUID `id` | Production material receipt header. |
| 13 | `MaterialReceiptItem` | `material_receipt_items` | `production` | UUID `id` | Line items received by Production. |
| 14 | `MaterialConsumption` | `material_consumptions` | `production` | UUID `id` | Material consumed in manufacturing. |
| 15 | `MaterialReturn` | `material_returns` | `production` | UUID `id` | Material returned to Stores. |
| 16 | `MaterialReturnItem` | `material_return_items` | `production` | UUID `id` | Line items returned to Stores. |
| 17 | `AdditionalMaterialRequest` | `additional_material_requests` | `additional-request` | UUID `id` | Production request for additional RM. |
| 18 | `AdditionalMaterialRequestItem` | `additional_material_request_items` | `additional-request` | UUID `id` | Line items for additional request. |
| 19 | `Notification` | `notifications` | `notifications` | UUID `id` | In-app user notifications. |
| 20 | `AuditLog` | `audit_logs` | `audit` | UUID `id` | System audit trail. |
| 21 | `InventoryItem` | `inventory_items` | `inventory` | UUID `id` | Legacy hybrid material item. |
| 22 | `StockBalance` | `stock_balances` | `inventory` | UUID `id` | Operational stock balance record. |
| 23 | `StockTransaction` | `stock_transactions` | `inventory` | UUID `id` | Immutable stock movement ledger. |

---

## 4. Current Entity Assessment & Reconciliation

| Entity | Current Schema Status | Target Phase 7 Action | Rationale & Data Safety Plan |
| :--- | :--- | :--- | :--- |
| `Role` | Complete | **KEEP** | Standard 6 roles; no changes needed. |
| `User` | Complete | **KEEP** | User accounts and JWT auth; no changes needed. |
| `Customer` | Complete | **KEEP** | Operational; no changes needed. |
| `PurchaseOrder` | Complete | **KEEP** | Core workflow; no changes needed. |
| `SalesOrderComponent` | Complete | **KEEP** | Core workflow; no changes needed. |
| `RmRequest` | Complete | **KEEP** | Requisition form; no changes needed. |
| `RmItem` | Complete | **KEEP** | Line items; no changes needed. |
| `RmFormSc` | Complete | **KEEP** | Junction entity; no changes needed. |
| `RmItemSnapshot` | Complete | **KEEP** | Audit snapshot; no changes needed. |
| `MaterialIssue` | Complete | **KEEP** | Issue header; no changes needed. |
| `MaterialIssueItem` | Complete | **KEEP** | Issue items; no changes needed. |
| `MaterialReceipt` | Complete | **KEEP** | Receipt header; no changes needed. |
| `MaterialReceiptItem` | Complete | **KEEP** | Receipt items; no changes needed. |
| `MaterialConsumption` | Complete | **KEEP** | Consumption; no changes needed. |
| `MaterialReturn` | Complete | **KEEP** | Return header; no changes needed. |
| `MaterialReturnItem` | Complete | **KEEP** | Return items; no changes needed. |
| `AdditionalMaterialRequest` | Complete | **KEEP** | Additional request; no changes needed. |
| `AdditionalMaterialRequestItem` | Complete | **KEEP** | Additional request items; no changes needed. |
| `Notification` | Complete | **KEEP** | Notifications; no changes needed. |
| `AuditLog` | Complete | **KEEP** | Audit logging; no changes needed. |
| `InventoryItem` | Phase 10 structure | **RETAIN (HISTORICAL / RM COMPATIBILITY)** | Retained without data loss per `DEC-PROD-014`. |
| `ProductCategory` | Missing | **NEW** | Added for product classification taxonomy. |
| `ProductFamily` | Missing | **NEW** | Added for mid-level product grouping. |
| `Product` | Missing | **NEW** | Authoritative Master Item (`name`, `min`, `max`). |
| `Warehouse` | Missing | **NEW** | Top-level storage building/zone. |
| `WarehouseLocation` | Missing | **NEW** | Physical location within warehouse. |
| `Rack` | Missing | **NEW** | Shelving rack structure within location. |
| `Bin` | Missing | **NEW** | Atomic storage compartment within rack. |
| `StockBalance` | 1:1 with `InventoryItem` | **EXTEND / MODIFY** | Add `productId`, `binId`, composite unique index. |
| `StockTransaction` | Global item ledger | **EXTEND / MODIFY** | Add `productId`, `sourceBinId`, `destinationBinId`. |

---

## 5. Primary Database Architecture

```
PRODUCT MASTER TAXONOMY:
ProductCategory (1) ──> (N) ProductFamily (1) ──> (N) Product

PHYSICAL STORAGE HIERARCHY:
Warehouse (1) ──> (N) WarehouseLocation (1) ──> (N) Rack (1) ──> (N) Bin

AUTHORITATIVE STOCK BALANCE (PRODUCT + BIN):
Product (1) ──> (N) StockBalance (N) <── (1) Bin

IMMUTABLE LEDGER:
StockBalance (1) ──> (N) StockTransaction (with sourceBinId & destinationBinId)
```

$$\textbf{Authoritative Stock Balance Granularity} = \textbf{Product} + \textbf{Bin}$$

---

## 6. Entity-by-Entity Design

### 1. `ProductCategory` (`product_categories`)
- `id`: UUID (PK, generated)
- `name`: VARCHAR(100), NOT NULL, UNIQUE (case-insensitive normalized)
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()

### 2. `ProductFamily` (`product_families`)
- `id`: UUID (PK, generated)
- `category_id`: UUID, NOT NULL (FK -> `product_categories.id`, `onDelete: RESTRICT`)
- `name`: VARCHAR(100), NOT NULL
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `UNIQUE(category_id, name)`

### 3. `Product` (`products`)
- `id`: UUID (PK, generated)
- `family_id`: UUID, NOT NULL (FK -> `product_families.id`, `onDelete: RESTRICT`)
- `name`: VARCHAR(255), NOT NULL, UNIQUE (case-insensitive normalized)
- `minimum_inventory`: NUMERIC(12,3), NOT NULL, DEFAULT 0.000
- `maximum_inventory`: NUMERIC(12,3), NULLABLE
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `CHECK (minimum_inventory >= 0)`
- **Constraint**: `CHECK (maximum_inventory IS NULL OR maximum_inventory >= minimum_inventory)`

### 4. `Warehouse` (`warehouses`)
- `id`: UUID (PK, generated)
- `code`: VARCHAR(50), NOT NULL, UNIQUE (uppercase normalized)
- `name`: VARCHAR(100), NOT NULL, UNIQUE
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()

### 5. `WarehouseLocation` (`warehouse_locations`)
- `id`: UUID (PK, generated)
- `warehouse_id`: UUID, NOT NULL (FK -> `warehouses.id`, `onDelete: RESTRICT`)
- `code`: VARCHAR(50), NOT NULL (uppercase normalized)
- `name`: VARCHAR(100), NOT NULL
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `UNIQUE(warehouse_id, code)`

### 6. `Rack` (`racks`)
- `id`: UUID (PK, generated)
- `location_id`: UUID, NOT NULL (FK -> `warehouse_locations.id`, `onDelete: RESTRICT`)
- `code`: VARCHAR(50), NOT NULL (uppercase normalized)
- `name`: VARCHAR(100), NOT NULL
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `UNIQUE(location_id, code)`

### 7. `Bin` (`bins`)
- `id`: UUID (PK, generated)
- `rack_id`: UUID, NOT NULL (FK -> `racks.id`, `onDelete: RESTRICT`)
- `code`: VARCHAR(50), NOT NULL (uppercase normalized)
- `name`: VARCHAR(100), NOT NULL
- `is_active`: BOOLEAN, NOT NULL, DEFAULT true
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `UNIQUE(rack_id, code)`

### 8. `StockBalance` (`stock_balances`)
- `id`: UUID (PK, generated)
- `product_id`: UUID, NULLABLE (FK -> `products.id`, `onDelete: RESTRICT`)
- `bin_id`: UUID, NULLABLE (FK -> `bins.id`, `onDelete: RESTRICT`)
- `inventory_item_id`: UUID, NULLABLE (FK -> `inventory_items.id`, `onDelete: RESTRICT`, legacy compatibility)
- `current_quantity`: NUMERIC(12,3), NOT NULL, DEFAULT 0.000
- `opening_balance`: NUMERIC(12,3), NULLABLE
- `last_transaction_id`: UUID, NULLABLE (FK -> `stock_transactions.id`, `onDelete: SET NULL`)
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- `updated_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `CHECK (current_quantity >= 0)`
- **Constraint**: `UNIQUE(product_id, bin_id)` (where `product_id IS NOT NULL AND bin_id IS NOT NULL`)

### 9. `StockTransaction` (`stock_transactions`)
- `id`: UUID (PK, generated)
- `product_id`: UUID, NULLABLE (FK -> `products.id`, `onDelete: RESTRICT`)
- `inventory_item_id`: UUID, NULLABLE (FK -> `inventory_items.id`, `onDelete: RESTRICT`)
- `source_bin_id`: UUID, NULLABLE (FK -> `bins.id`, `onDelete: RESTRICT`)
- `destination_bin_id`: UUID, NULLABLE (FK -> `bins.id`, `onDelete: RESTRICT`)
- `transaction_type`: VARCHAR(50) / ENUM (`STOCK_IN`, `STOCK_OUT`, `STORES_ISSUE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`), NOT NULL
- `adjustment_direction`: VARCHAR(20) / ENUM (`INCREASE`, `DECREASE`), NULLABLE
- `quantity`: NUMERIC(12,3), NOT NULL
- `reference_type`: VARCHAR(50), NOT NULL
- `reference_id`: VARCHAR(100), NULLABLE
- `remarks`: TEXT, NULLABLE
- `created_by_id`: UUID, NOT NULL (FK -> `users.id`, `onDelete: RESTRICT`)
- `created_at`: TIMESTAMP, NOT NULL, DEFAULT NOW()
- **Constraint**: `CHECK (quantity > 0)`

---

## 7. Foreign Key & Relational Delete Protection Matrix

| Parent Table | Child Table | Foreign Key Column | Nullable | On Delete Rule | On Update Rule | Protection Rationale |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `product_categories` | `product_families` | `category_id` | No | `RESTRICT` | `CASCADE` | Prevents deleting category with child families. |
| `product_families` | `products` | `family_id` | No | `RESTRICT` | `CASCADE` | Prevents deleting family with active products. |
| `warehouses` | `warehouse_locations`| `warehouse_id` | No | `RESTRICT` | `CASCADE` | Prevents deleting warehouse with active locations. |
| `warehouse_locations`| `racks` | `location_id` | No | `RESTRICT` | `CASCADE` | Prevents deleting location with active racks. |
| `racks` | `bins` | `rack_id` | No | `RESTRICT` | `CASCADE` | Prevents deleting rack with active bins. |
| `products` | `stock_balances` | `product_id` | Yes (legacy)| `RESTRICT`| `CASCADE` | Prevents deleting product with active stock. |
| `bins` | `stock_balances` | `bin_id` | Yes (legacy)| `RESTRICT`| `CASCADE` | Prevents deleting bin with active stock. |
| `products` | `stock_transactions` | `product_id` | Yes (legacy)| `RESTRICT`| `CASCADE` | Preserves immutable transaction ledger. |
| `bins` | `stock_transactions` | `source_bin_id` | Yes | `RESTRICT` | `CASCADE` | Preserves historical movement origin. |
| `bins` | `stock_transactions` | `destination_bin_id` | Yes | `RESTRICT` | `CASCADE` | Preserves historical movement destination. |
| `users` | `stock_transactions` | `created_by_id` | No | `RESTRICT` | `CASCADE` | Preserves actor identity for auditability. |
| `stock_transactions` | `stock_balances` | `last_transaction_id`| Yes | `SET NULL`| `CASCADE` | Prevents circular delete deadlock. |

> **CRITICAL RULE**: `CASCADE DELETE` is strictly forbidden on any inventory balance or transaction relationship.

---

## 8. Database Index Design

| Table | Index Name | Column(s) | Type | Query Pattern / Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `product_categories` | `uq_product_categories_name` | `LOWER(TRIM(name))` | UNIQUE | Case-insensitive category uniqueness. |
| `product_families` | `uq_product_families_cat_name` | `category_id, LOWER(TRIM(name))` | UNIQUE | Unique family name within category. |
| `product_families` | `idx_product_families_cat_id` | `category_id` | BTREE | Cascading category dropdown lookups. |
| `products` | `uq_products_name` | `LOWER(TRIM(name))` | UNIQUE | Global unique product name. |
| `products` | `idx_products_family_id` | `family_id` | BTREE | Filtering products by family. |
| `warehouses` | `uq_warehouses_code` | `code` | UNIQUE | Uppercase unique warehouse code. |
| `warehouses` | `uq_warehouses_name` | `LOWER(TRIM(name))` | UNIQUE | Case-insensitive warehouse name uniqueness. |
| `warehouse_locations`| `uq_warehouse_locations_wh_code`| `warehouse_id, code` | UNIQUE | Unique location code within warehouse. |
| `warehouse_locations`| `idx_warehouse_locations_wh_id` | `warehouse_id` | BTREE | Cascading location lookup by warehouse. |
| `racks` | `uq_racks_loc_code` | `location_id, code` | UNIQUE | Unique rack code within location. |
| `racks` | `idx_racks_loc_id` | `location_id` | BTREE | Cascading rack lookup by location. |
| `bins` | `uq_bins_rack_code` | `rack_id, code` | UNIQUE | Unique bin code within rack. |
| `bins` | `idx_bins_rack_id` | `rack_id` | BTREE | Cascading bin lookup by rack. |
| `stock_balances` | `uq_stock_balance_prod_bin` | `product_id, bin_id` | UNIQUE | Composite stock balance identity. |
| `stock_balances` | `idx_stock_balance_bin_id` | `bin_id` | BTREE | Fast storage aggregation rollups. |
| `stock_transactions` | `idx_stock_tx_prod_created` | `product_id, created_at DESC` | BTREE | Product transaction history queries. |
| `stock_transactions` | `idx_stock_tx_src_bin` | `source_bin_id` | BTREE | Origin bin reconciliation. |
| `stock_transactions` | `idx_stock_tx_dest_bin` | `destination_bin_id` | BTREE | Destination bin reconciliation. |
| `stock_transactions` | `idx_stock_tx_ref` | `reference_type, reference_id`| BTREE | SC and PO movement tracing. |

---

## 9. Quantity & Precision Model
1. **Column Definition**: `NUMERIC(12,3)` across all balance and transaction tables.
2. **Precision Scope**: Up to 999,999,999.999 units (milligram / millimeter fractional precision).
3. **Database Check Constraints**:
   - `stock_balances.current_quantity >= 0`
   - `stock_transactions.quantity > 0`
   - `products.minimum_inventory >= 0`

---

## 10. Concurrency & Row-Level Locking Strategy
1. **Atomic Conditional SQL**:
   ```sql
   UPDATE stock_balances
   SET current_quantity = current_quantity - :qty,
       updated_at = NOW()
   WHERE product_id = :productId 
     AND bin_id = :binId 
     AND current_quantity >= :qty;
   ```
2. **Isolation Guarantee**: Row-level locking on `stock_balances` ensures concurrent Stores issues from the same bin are strictly serialized. If stock is insufficient, affected row count is 0, triggering immediate transaction rollback.

---

## 11. Migration Strategy & Data Safety
1. **Reversible Migration**: New TypeORM migration `1700000000004-Phase7MasterDataAndStorageHierarchy.ts` contains ordered `up()` and `down()` methods.
2. **Zero Destruction**:
   - `inventory_items` table is untouched.
   - Existing columns on `stock_balances` (`inventory_item_id`) and `stock_transactions` (`inventory_item_id`) are preserved.
   - New columns (`product_id`, `bin_id`, `source_bin_id`, `destination_bin_id`) are added as nullable to accommodate existing legacy rows without failing constraints.
3. **Default Migration Pathway (Phase 11/12 execution)**:
   - Creates `WH-01 (DEFAULT WAREHOUSE)` ──> `LOC-DEF` ──> `RACK-DEF` ──> `BIN-DEF`.
   - Maps legacy `stock_balances` rows to default storage without breaking historical ledgers.

---

## 12. Open Decisions Status
All open business decisions are formally documented and preserved:
- **`DEC-PROD-010`**: Maximum Inventory Enforcement (Warning vs Hard Block) — Schema allows NULL or numeric value; enforcement logic deferred to Phase 12/19.
- **`DEC-PROD-011` / `DEC-WH-006`**: Master Creation Authority (`ADMIN` vs `STORES`) — Database agnostic.
- **`DEC-PROD-012`**: Multi-Product Bin Policy — Database unique constraint `(product_id, bin_id)` accommodates multi-product bins; single-product rule can be enforced at service level if decided.
- **`DEC-PROD-014`**: Existing `InventoryItem` vs `Product` Master Reconciliation — Both entities co-exist safely in Phase 7.
- **`DEC-005`**: Return Destination Storage Policy — Schema supports any valid destination `bin_id`.
- **`DEC-WH-008`**: Inter-Warehouse Transfer — Schema supports `source_bin_id` and `destination_bin_id` across different warehouses.

---

## 13. Final Schema Status

$$\textbf{PHASE 7 DATABASE DESIGN IS FROZEN AND READY FOR IMPLEMENTATION.}$$
