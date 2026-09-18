# PHASE 10 — EXISTING INVENTORY RECONCILIATION DOCUMENT

## 1. CURRENT INVENTORY ARCHITECTURE
The existing inventory module (`backend/src/inventory`) consists of:
- `InventoryItem`: Legacy item representation (material, grade, size, unit, minimumStockLevel).
- `StockBalance`: Operational stock balance table storing `currentQuantity` per item.
- `StockTransaction`: Immutable movement ledger logging `STOCK_IN`, `STOCK_OUT`, and `ADJUSTMENT` transactions.
- `InventoryService`: Handles atomic stock transactions via TypeORM `QueryRunner`.
- `InventoryController`: REST endpoints for stock queries, movements, and reconciliation.

---

## 2. FINAL INVENTORY ARCHITECTURE
The authoritative inventory architecture established across Phases 2.1–2.6, 7, 8, and 9 is:
```
Product Category ──> Product Family ──> Product

Warehouse ──> WarehouseLocation ──> Rack ──> Bin

Product (1) ──> (N) StockBalance (N) <── (1) Bin

StockTransaction ── (Immutable Movement Ledger with sourceBinId & destinationBinId)
```

---

## 3. InventoryItem RECONCILIATION
- **Current Role**: `InventoryItem` exists in the codebase as the Phase 10 implementation model.
- **Future Alignment (`DEC-PROD-014`)**: `DEC-PROD-014` (*InventoryItem vs Product Reconciliation*) remains an **OPEN BUSINESS DECISION**.
- **Reconciliation Strategy**: `InventoryItem` is preserved alongside the new `Product` master entity. `InventoryItem` is NOT deleted or dropped. The physical storage architecture (`Bin ──> Rack ──> Location ──> Warehouse`) remains completely compatible whether `StockBalance` points to `productId` or `inventoryItemId`.

---

## 4. Product RECONCILIATION
- `Product` entity (Phase 7/8 schema: `name`, `familyId`, `minimumInventory`, `maximumInventory`, `isActive`) represents abstract inventory master items.
- Global stock for a Product is dynamically aggregated via SQL: `SUM(StockBalance.currentQuantity)` for all Bins housing that Product.

---

## 5. StockBalance RECONCILIATION
- **Authoritative Balance Identity**: `Product + Bin` composite key `(product_id, bin_id)`.
- **Constraint**: `Check("current_quantity" >= 0)` enforces non-negative stock balances natively inside PostgreSQL.
- **Zero Quantity Retention**: Rows with `currentQuantity = 0.000` are retained to preserve row locking integrity and historical traceability.

---

## 6. StockTransaction RECONCILIATION
- **Immutability**: `StockTransaction` records are strictly append-only. No `PATCH`, `PUT`, or `DELETE` endpoints exist.
- **Traceability**: Every transaction records `createdById` (actor), `timestamp`, `quantity` (`CHECK > 0`), `transactionType`, `sourceBinId`, and `destinationBinId`.

---

## 7. PRODUCT + BIN MODEL
```
ONE PRODUCT + ONE BIN = ONE AUTHORITATIVE STOCK BALANCE ROW
```
- A single Product can exist across multiple Bins simultaneously.
- Summing `StockBalance.currentQuantity` across all Bins for a given Product yields the global Product Total Stock.

---

## 8. STOCK IN RECONCILIATION
- **Workflow**: Stores identifies target `Bin` and `Product` (or `InventoryItem`), enters positive quantity.
- **Execution**:
  1. Verify target Bin and ancestor storage entities are `isActive = true`.
  2. Perform atomic SQL increment (`current_quantity = current_quantity + $1`).
  3. Log immutable `StockTransaction` with `destinationBinId`.

---

## 9. STOCK OUT RECONCILIATION
- **Workflow**: Stores identifies source `Bin` and `Product`, enters issue quantity.
- **Execution**:
  1. Validate `StockBalance.currentQuantity >= issueQuantity`.
  2. Perform atomic SQL decrement (`UPDATE stock_balances SET current_quantity = current_quantity - $1 WHERE current_quantity >= $1`).
  3. Log immutable `StockTransaction` with `sourceBinId`.

---

## 10. ADJUSTMENT RECONCILIATION
- Supports stock count corrections (`ADJUSTMENT_INCREASE` / `ADJUSTMENT_DECREASE`).
- Requires `STORES` or `ADMIN` authority.
- Logs full actor traceability and remarks in `StockTransaction`.

---

## 11. RECONCILIATION WORKFLOW
- Physical count verification operates at specific `Bin` targets.
- Discrepancies generate an `ADJUSTMENT` type transaction without overwriting transaction history.

---

## 12. TRANSACTION HISTORY RECONCILIATION
- Read-only paginated endpoint (`GET /api/inventory/transactions`).
- Provides filtering by product, bin, transaction type, and date range.

---

## 13. INVENTORY FILTERING RECONCILIATION
- Query parameters support filtering by `search` (name/material), `stockStatus` (`OUT_OF_STOCK`, `LOW_STOCK`, `NORMAL`, `EXCESS`), `isActive`, `page`, and `pageSize`.

---

## 14. RBAC RECONCILIATION
- **Read / View**: All 6 active roles.
- **Stock IN / Stock OUT / Adjustment / Reconciliation**: Restricted to `STORES` and `ADMIN`.
- **Approval Workflows**: None. Senior Designer is completely absent.

---

## 15. API COMPATIBILITY
Existing inventory API routes (`/api/inventory`, `/api/inventory/:id`, `/api/inventory/reconciliation`) remain backward-compatible while supporting Phase 11 master data integration.

---

## 16. FRONTEND COMPATIBILITY
Existing frontend pages (`InventoryPage`, Stock In modal, Stock Out modal, Transaction History) remain fully compatible with current backend response DTOs.

---

## 17. DATA MIGRATION IMPACT
Legacy inventory items lacking physical bin assignments will map to a default `MAIN WAREHOUSE / DEFAULT LOCATION / DEFAULT RACK / DEFAULT BIN` container during Phase 11/12 migration.

---

## 18. TESTING & REGRESSION
- **Suite**: 89 backend tests executed via Vitest.
- **Pass Rate**: 100% PASS.
- All stock movements, non-negative constraints, actor traceability, and DTO validations tested and verified.

---

## 19. OPEN DECISIONS (PRESERVED)
- **DEC-PROD-010**: Maximum Inventory Enforcement.
- **DEC-PROD-012**: Multi-Product Bin Policy.
- **DEC-PROD-014**: InventoryItem vs Product Reconciliation.
- **DEC-005**: Material Return Destination Storage Rule.

---

## 20. PHASE 11 IMPACT
Inventory domain reconciliation is complete. Phase 11 can proceed to implement Master Data CRUD endpoints for Category, Family, Product, Warehouse, Location, Rack, and Bin without breaking existing inventory features.
