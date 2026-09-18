# PHASE 10.5 — INVENTORY OPENING BALANCE RECONCILIATION

## 1. Objective
Establish the initial `opening_balance` for legacy inventory identities safely mapped to the finalized Product + Bin architecture. Provide a deterministic `manualMapAndReconcile` service method for handling missing data without inventing stock or faking transactions.

## 2. Legacy Preservation
The legacy `InventoryItem` remains the compatibility layer. The actual authority for stock is shifted internally within the `StockBalance` row, sharing identity with the newly assigned `productId` and `binId`.

## 3. Opening Balance
Opening balances represent the reconciliation baseline. When a legacy item is explicitly mapped, its `opening_balance` can be provided or derived safely in the `manualMapAndReconcile` engine.

## 4. Conflict Cases Managed
- **CASE A (No Target StockBalance Exists)**: Safe `UPDATE` to the legacy row. Establishes the `product_id`, `bin_id`, and `opening_balance` without duplicating rows.
- **CASE B (Target StockBalance Exists with Matching Quantity)**: Safe merge. The legacy row is deleted, and its `inventory_item_id` identity is moved to the matching target row to consolidate identity safely.
- **CASE C (Target StockBalance Exists with Mismatched Quantity)**: The engine halts the mapping and returns `QUANTITY_CONFLICT`. Safe-guarded by transactions.

## 5. Unmapped Records
- **Missing Product**: Engine rejects with "Target Product not found".
- **Missing Bin**: Engine rejects with "Target Bin not found".
- No arbitrary location or product assignment happens.

## 6. Multiple Products in a Bin
Permitted. Uniqueness constraints restrict `productId` + `binId`, meaning multiple products can share the same bin ID natively within `StockBalance`.

## 7. Multiple Warehouses
The Product identity remains constant. The Bin identity distinguishes the Warehouse natively through the Bin -> Rack -> WarehouseLocation -> Warehouse storage hierarchy.

## 8. Idempotency & Concurrency
The engine operates inside a TypeORM transaction with commit/rollback logic ensuring no partial mutations. Subsequent calls to map an already reconciled item will fail fast if attempting to overwrite with a conflicting identity, or succeed as a no-op if identical.

## 9. Historical Transactions
Preserved immutably. `manualMapAndReconcile` does NOT insert fake `STOCK_IN` or `ADJUSTMENT` rows just to achieve balance. It simply updates the master identity of the row.

## 10. Result
Phase 10.5 tools are fully implemented and verified via Vitest. 167 tests are passing. The database runtime verification is blocked due to local postgres authentication failures, so no live rows were actually mutated.
