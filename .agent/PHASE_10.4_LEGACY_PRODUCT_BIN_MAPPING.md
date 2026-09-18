# PHASE 10.4 — LEGACY INVENTORY → PRODUCT + BIN MAPPING & BRIDGE IMPLEMENTATION

## 1. Current Legacy Architecture
`InventoryItem` continues to be the active identity for historical and some active frontend operations. Currently, APIs process transactions exclusively using `inventory_item_id`.

## 2. Target Architecture
`Product` + `Bin` -> `StockBalance` -> `StockTransaction`. 
This is the ultimate authority for stock state. It is currently structurally enforced with database uniqueness constraints but had no mutative pipeline.

## 3. Mapping Strategy
Created an `InventoryReconciliationService` acting as the dry-run and migration engine. The engine loops over all `InventoryItem` records, checks for explicit evidence of `Product` and `Bin` mapping, and bridges the records without creating duplicate rows.

## 4. Product Mapping Rules
Products are mapped by finding an exact match of either `code` or `name` in the master data `Product` table.

## 5. Bin Mapping Rules
Given the legacy dataset, Bin mappings require explicit master data rules. In the engine, absent a direct `WarehouseLocation` legacy pointer, items fall back to `UNMAPPED_BIN` safely to require manual deterministic instruction in 10.5.

## 6. Mapping Classifications
- `READY_FOR_TARGET_RECONCILIATION`
- `UNMAPPED_PRODUCT`
- `UNMAPPED_BIN`
- `QUANTITY_CONFLICT`

## 7. StockBalance Transition
Rather than copying `InventoryItem.quantity` into a parallel `StockBalance` row which would cause duplication, the migration identifies the *existing* `StockBalance` keyed by `inventory_item_id` and *adds* `product_id` and `bin_id` to that exact row.

## 8. Stock Duplication Prevention
By re-keying the existing `StockBalance` instead of inserting a new one, the `current_quantity` physically remains the single source of truth for both the legacy ID and target IDs simultaneously during the transition.

## 9. Legacy API Bridge
APIs continue to accept `inventoryItemId`. The Service layer dynamically queries the `StockBalance` to determine if a target mapping exists before executing.

## 10. Stock IN Bridge
Updated `InventoryService.stockIn()` and `addStockTransaction()` to extract `productId` and `destinationBinId` from the corresponding `StockBalance` mapping (if present) and write them directly into the immutable `StockTransaction`.

## 11. Stock OUT Bridge
Updated `InventoryService.stockOut()` to extract `productId` and `sourceBinId` and write them to the `StockTransaction`.

## 12. Adjustment Bridge
Updated `InventoryService.stockAdjustment()` to map either `destinationBinId` (for INCREASE) or `sourceBinId` (for DECREASE).

## 13. Material Issue Bridge
Inherits the `stockOut` / `addStockTransaction` logic naturally since it acts via the InventoryService.

## 14. Return Bridge
Inherits the `stockIn` logic naturally.

## 15. Historical Transaction Policy
Historical `StockTransaction`s are appended. We did NOT retroactively mutate legacy transaction histories to fabricate `product_id` missing data.

## 16. Idempotency
The engine checks if `StockBalance` already possesses the target mapping or matches quantities. It will not duplicate stock on subsequent runs.

## 17. Transaction Safety
Wrapped within `queryRunner.startTransaction()` allowing atomic `UPDATE` and `INSERT` combinations. Rollback guaranteed on failure.

## 18. Concurrency
Safe. The bridge updates the same rows being locked by active `InventoryItem` operations.

## 19. Dry-run Behavior
`dryRunMapping()` scans and returns a JSON payload detailing counts without executing any `queryRunner.manager.update`.

## 20. Actual Reconciliation Behavior
Loops over `dryRunMapping()` output and executes `UPDATE stock_balances SET product_id = X, bin_id = Y WHERE inventory_item_id = Z`.

## 21. Unresolved Mappings
Items without explicit Product or Bin targets remain classified as `UNMAPPED` and left entirely alone for manual Phase 10.5 intervention.

## 22. Rollback Strategy
`queryRunner.rollbackTransaction()` catches SQL-level mismatches or uniqueness constraint violations.

## 23. Phase 10.5 Input
Phase 10.5 is clear to execute Opening Balance Reconciliation and manual mappings now that the bridge logic safely propagates target identities alongside legacy identities.
