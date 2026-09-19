# Phase 12.8 - Production Return Implementation

## Goal
Implement the two-stage Material Return process:
1. **Production Returns Material**: Production creates a material return (`PENDING_STORE_ACK`) without physically mutating stock.
2. **Stores Acknowledges Return**: Stores receives the material, changing the return status to `ACKNOWLEDGED`, which physically restores `StockBalance` and writes a `RETURN` `StockTransaction` for traceability.

## Changes Made
- **Entity**: Found existing models (`MaterialReturn` and `MaterialReturnItem`) already contained proper status mapping.
- **Service (`ProductionService`)**:
  - `recordReturn`: Implemented `setLock('pessimistic_write')` serialization on `SalesOrderComponent` to prevent race conditions during material returns. Dynamically computed accumulated quantities (Received - Consumed - Returned (Pending + ACKed)) to guarantee that the requested return quantity never exceeds the available unaccounted stock, adhering strictly to the accounting formulas.
  - `verifyReturn`: Implemented `setLock('pessimistic_write')` serialization on `MaterialReturn` to prevent duplicate acknowledgements. Modified stock restoration to safely apply an `UPSERT` (via `ON CONFLICT DO UPDATE`) against `stock_balances` mapping securely to the `rmItem.mappedProductId` and the specific Stores `destinationBinId`. Ensure the immutable `RETURN` transaction is successfully recorded linked by `createdBy` user id.
  - `getAccounting`: Preserved the existing condition that only `ACKNOWLEDGED` returns are considered effectively 'Returned' from a physical standpoint, keeping unaccounted balances consistent until the physical transfer is recognized by Stores.
- **E2E Tests (`production-return-phase12-8.spec.ts`)**:
  - Covered edge cases ensuring the two-stage separation holds up under scrutiny, verified accounting dynamically accurately reflects real returns, and rigorously proved concurrent returns never exceed the available limit.
- **Unit Tests**:
  - Updated `production.service.spec.ts` to implement mocked assertions matching `createQueryBuilder` and inner join usage in the returned verifications.

## Automated Testing
Running the backend test suite via `npx vitest run`:
- The total suite count is 390 test scenarios.
- All tests passing without parallel testing flakiness.

## Verification
- Validated single insertion of Returns and atomic Stock updates.
- Ensured zero regression impacts on Phase 12.7 (Production Consumption).
