# PHASE 10.3 — EXISTING INVENTORY RECONCILIATION

## 1. Current Inventory Architecture
The inventory architecture consists of a hybrid schema. The actual mutative execution path runs entirely through the legacy `InventoryItem` structure, despite the existence of the Phase 8 `Product`, `Bin`, and relational target schema. 

## 2. Legacy InventoryItem Architecture
`InventoryItem` dictates the live state. Operations in `InventoryService` (`stockIn`, `stockOut`, `stockAdjustment`) exclusively accept `inventoryItemId` as their primary argument and perform atomic updates against `StockBalance` where `inventory_item_id = $X`.

## 3. Target Product + Bin Architecture
The schema accurately represents the target:
- `StockBalance` supports `product_id` and `bin_id`.
- `StockBalance` contains `@Unique(['productId', 'binId'])`.
- `StockTransaction` supports `product_id`, `source_bin_id`, and `destination_bin_id`.
- However, NO mutative logic currently writes to `product_id` or `bin_id`.

## 4. StockBalance Audit
`StockBalance` contains `inventory_item_id` with a `unique: true` constraint alongside a separate `@Unique` composite constraint for `productId` and `binId`. This successfully enforces that a given row cannot represent multiple conflicting authoritative sources, but it does allow parallel rows. 

## 5. StockTransaction Audit
`StockTransaction` is fully equipped to trace both legacy and target movements. It is strictly append-only, and its mutative methods correctly enforce valid reference propagation.

## 6. Product Mapping
Since DB connection was blocked (`password authentication failed`), explicit row mapping counts are unavailable. Structurally, product mapping logic must map `inventory_item_id -> product_id` manually via Phase 10.4.

## 7. Bin Mapping
Structurally, mapping must be applied in Phase 10.4. The schema supports strict `Warehouse -> WarehouseLocation -> Rack -> Bin` hierarchies.

## 8. Duplicate Analysis
Code level analysis prevents DB-level duplication through TypeORM `@Unique` constraints.

## 9. Orphan Analysis
TypeORM `RESTRICT` deletion rules prevent orphan `StockBalance` or `StockTransaction` records relative to `InventoryItem`, `Product`, or `Bin`.

## 10. Stock Duplication Risk
CRITICAL RISK: A `StockBalance` linked to `inventory_item_id` and a newly created `StockBalance` linked to `product_id + bin_id` could represent the same physical stock twice if naive copying occurs. Reconciliation must atomically transfer `current_quantity` and re-key the balance row rather than duplicate it.

## 11. Legacy API Dependencies
`InventoryController`, `MaterialIssueController`, `ProductionController`, `RmController`, `ScController` all rely heavily on `inventoryItemId`. The entire existing API surface is legacy-dependent. 

## 12. Service Dependencies
`InventoryService` directly manipulates `inventoryItemId`. A transitional adapter or strict cutover strategy is required in Phase 10.4.

## 13. Data Mutation Assessment
NONE. No production data was mutated.

## 14. Unresolved Records
Unable to quantify at runtime due to DB blockage, but structurally ALL `InventoryItem` records remain unresolved mapped targets until Phase 10.4 executes.

## 15. Recommended Next Action
Proceed to Phase 10.4. Phase 10.4 must introduce a deterministic mapping mechanism (adapter or migration table) to safely convert `inventory_item_id` keys into `product_id + bin_id` keys on `StockBalance`.

## 16. Phase 10.4 Input
Phase 10.4 is cleared to begin the explicit Legacy → Target mapping implementation.
