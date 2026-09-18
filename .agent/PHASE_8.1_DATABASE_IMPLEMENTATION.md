# PHASE 8.1 — DATABASE SCHEMA IMPLEMENTATION & MIGRATION FOUNDATION

## 1. OBJECTIVE
Phase 8.1 converts the approved Phase 7 database design into actual PostgreSQL tables, foreign keys, unique constraints, check constraints, indexes, TypeORM entities, and migrations for:
1. Product Master (`ProductCategory` → `ProductFamily` → `Product`)
2. Physical Storage Hierarchy (`Warehouse` → `WarehouseLocation` → `Rack` → `Bin`)
3. Authoritative Inventory (`StockBalance` & `StockTransaction` for `Product + Bin`)
4. Legacy Compatibility (`InventoryItem` preserved and bridged)

---

## 2. REPOSITORY & PRE-IMPLEMENTATION AUDIT
- **Git Status**: Clean working tree on `main` branch.
- **Migration Identified**: `backend/src/database/migrations/1700000000004-Phase7MasterDataAndStorageHierarchy.ts`.
- **Entities Verified**:
  - `ProductCategory` (`product_categories`)
  - `ProductFamily` (`product_families`)
  - `Product` (`products`)
  - `Warehouse` (`warehouses`)
  - `WarehouseLocation` (`warehouse_locations`)
  - `Rack` (`racks`)
  - `Bin` (`bins`)
  - `StockBalance` (`stock_balances`)
  - `StockTransaction` (`stock_transactions`)
  - `InventoryItem` (`inventory_items` - legacy preserved)

---

## 3. PRODUCT MASTER IMPLEMENTATION
- Hierarchy: `ProductCategory` (1) → (N) `ProductFamily` (1) → (N) `Product`
- Derived Category rule: Category is accessed via `Product -> family -> category`. No duplicate direct foreign key on `Product`.
- Table `products`:
  - `id`: UUID (Primary Key)
  - `family_id`: UUID (FK to `product_families`, `ON DELETE RESTRICT`)
  - `name`: VARCHAR(255) (UNIQUE)
  - `minimum_inventory`: NUMERIC(12,3) (DEFAULT 0, CHECK `>= 0`)
  - `maximum_inventory`: NUMERIC(12,3) (NULLABLE, CHECK `maximum_inventory IS NULL OR maximum_inventory >= minimum_inventory`)
  - `is_active`: BOOLEAN (DEFAULT TRUE)
  - `created_at`, `updated_at`: TIMESTAMP

---

## 4. PHYSICAL STORAGE HIERARCHY
- Hierarchy: `Warehouse` (1) → (N) `WarehouseLocation` (1) → (N) `Rack` (1) → (N) `Bin`
- Tables:
  - `warehouses`: `id`, `code` (UNIQUE), `name` (UNIQUE), `is_active`
  - `warehouse_locations`: `id`, `warehouse_id` (FK), `code`, `name`, `is_active`, `UNIQUE("warehouse_id", "code")`
  - `racks`: `id`, `location_id` (FK), `code`, `name`, `is_active`, `UNIQUE("location_id", "code")`
  - `bins`: `id`, `rack_id` (FK), `code`, `name`, `is_active`, `UNIQUE("rack_id", "code")`
- A Bin supports multiple products; `product_id` is NOT placed on `Bin`.

---

## 5. AUTHORITATIVE INVENTORY MODEL
- Granularity: `Product + Bin`
- Table `stock_balances`:
  - `id`: UUID (PK)
  - `product_id`: UUID (FK to `products`, NULLABLE for legacy rows)
  - `bin_id`: UUID (FK to `bins`, NULLABLE for legacy rows)
  - `inventory_item_id`: UUID (FK to `inventory_items`, NULLABLE for target rows)
  - `current_quantity`: NUMERIC(12,3) (CHECK `>= 0`)
  - `opening_balance`: NUMERIC(12,3)
  - `last_transaction_id`: UUID (FK to `stock_transactions`)
  - Constraint: `UQ_stock_balances_product_bin` UNIQUE (`product_id`, `bin_id`) WHERE `product_id IS NOT NULL AND bin_id IS NOT NULL`.

---

## 6. LEGACY INVENTORYITEM COMPATIBILITY
- `InventoryItem` is preserved for backward compatibility.
- Transitional rows supported:
  1. Legacy row: `inventory_item_id` populated.
  2. Target row: `product_id + bin_id` populated.
  3. Bridged row: `inventory_item_id + product_id + bin_id` populated.
- No destructive column drops executed.

---

## 7. STOCK TRANSACTION LEDGER
- Supported Types: `STOCK_IN`, `STOCK_OUT`, `STORES_ISSUE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`.
- Columns: `id`, `product_id`, `inventory_item_id`, `source_bin_id`, `destination_bin_id`, `transaction_type`, `adjustment_direction`, `quantity` (CHECK `> 0`), `reference_type`, `reference_id`, `remarks`, `created_by_id`, `created_at`.
- Stock transactions are immutable.

---

## 8. INDEXES & FOREIGN KEYS
- All FKs use `ON DELETE RESTRICT` to prevent orphan records or historical data loss.
- Performance Indexes:
  - `IDX_products_family_id` on `products(family_id)`
  - `IDX_product_families_category_id` on `product_families(category_id)`
  - `IDX_warehouse_locations_warehouse_id` on `warehouse_locations(warehouse_id)`
  - `IDX_racks_location_id` on `racks(location_id)`
  - `IDX_bins_rack_id` on `bins(rack_id)`
  - `IDX_stock_balances_bin_id` on `stock_balances(bin_id)`
  - `IDX_stock_transactions_product_created` on `stock_transactions(product_id, created_at DESC)`
  - `IDX_stock_transactions_source_bin` on `stock_transactions(source_bin_id)`
  - `IDX_stock_transactions_destination_bin` on `stock_transactions(destination_bin_id)`
