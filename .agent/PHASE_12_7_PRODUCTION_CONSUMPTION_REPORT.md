# Phase 12.7 — Production Consumption

## Objective
Implement Production Consumption tracking strictly decoupled from Stores Inventory, ensuring:
- `StockBalance` and `StockTransaction` are completely untouched during this phase.
- Cumulative consumption is strictly bounded by the `quantityReceived` on actual `MaterialReceiptItems`.
- Concurrency prevents duplicate/over-consumption.

## Technical Implementation

### `ProductionService.recordConsumption()`
- **Atomicity & Locking**: Completely rewrote the function to use TypeORM `queryRunner` with a `pessimistic_write` lock (`FOR UPDATE`) on the `SalesOrderComponent`. This creates a serialization boundary that guarantees concurrent consumption requests are evaluated sequentially.
- **Accurate Receipt Aggregation**: The system now dynamically aggregates actual `MaterialReceiptItem` records linked to the SC (rather than falling back to `issued = received`).
- **Accounting Validation**: Computes `availableForConsumption = SUM(quantityReceived) - SUM(quantityConsumed)` and enforces strict `quantityConsumed <= availableForConsumption`.
- **Zero-Mutation Invariant**: Verified that `stock_balances` and `stock_transactions` remain strictly untampered with. Material consumption is purely a production tracking event.

### `ProductionService.getAccounting()`
- Previously, this method incorrectly hardcoded `received = issued`, ignoring actual partial material receipts.
- Rewrote the logic to dynamically fetch `MaterialReceiptItem` records via `QueryBuilder` filtering by `scId`, properly aggregating `received` quantities.
- This ensures `unaccounted = received - consumed - returned` reflects accurate production-floor material states.

### Unit & E2E Testing
- **Unit Tests**: Updated `production.service.spec.ts` mocking to accommodate `QueryBuilder`, transaction runners, and the `setLock` requirement.
- **E2E Tests**: Introduced `test/production-consumption-phase12-7.spec.ts` demonstrating the exact business invariants:
  - `CONSUME_01`: Reject negative values.
  - `CONSUME_02`: Safely consume without stock mutation (strictly verifies `stock_balances.current_quantity` and `stock_transactions` row count remain unchanged).
  - `CONSUME_03`: Reject over-consumption dynamically.
  - `CONSUME_04`: Reflect accurate accounting.
  - `CONSUME_05`: Ensure pessimistic concurrency protection works under simulated multi-request scenarios.
- **Result**: `npm run test` passed with all 378 unit and E2E tests validating correctly (with 0 failures).

## Next Steps
The Stores Inventory and Production Consumption modules are fully operational and verified, completing Phase 12.7. The next logical boundary is Production Scrap or Final Product Assembly (Phase 12.8 / 13).
