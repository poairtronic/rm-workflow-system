# Phase 13.5: Concurrency Hardening

## Overview
Phase 13.5 verifies and strengthens the data consistency safeguards implemented in Phase 13.4. It explicitly proves that simultaneous valid requests cannot corrupt shared database state (such as overlapping StockOuts, Material Issues, or Returns targeting the same Product and Bin).

## Objectives
1. **Stress Testing State Transitions:** Guarantee that concurrent operations (like material issues or returns) affecting the same product/bin correctly lock and serialize database transactions.
2. **Lock Ordering Deadlock Prevention:** Ensure that operations processing multiple items sort the items deterministically by database ID. This eliminates PostgreSQL `deadlock detected` errors that occur when concurrent transactions attempt to lock the same rows in different orders.
3. **Data Conservation under Concurrency:** Prove that the total successful outbound quantity never exceeds the available stock, even when bombarded with high-concurrency conflicting requests.

## Implementation Details

### Deadlock Prevention
- **`MaterialIssueService.createIssue`**: Now sorts incoming `RmItem` payload lines deterministically by ID before attempting to process stock issues and updates.
- **`ProductionService.recordReturn` & `verifyReturn`**: Now enforce strict ordering when interacting with stock balances and material return items to prevent overlapping operations from deadlocking on identical constraints.

### The Test Suite (`backend/test/phase-13-5-concurrency.spec.ts`)
A dedicated end-to-end (e2e) test suite was created to validate concurrency guarantees using `Promise.all` across multiple simultaneous requests:
- **`C_001`**: **Concurrent StockOuts** on the same Product + Bin. Issues 30 concurrent stock-out requests, each asking for 30 units from a bin with a starting balance of 100. Exactly 3 succeed (3 * 30 = 90 units issued) and 27 fail due to insufficient quantity or locks.
- **`C_002`**: **Concurrent Material Issues**. Issues concurrent full material issue POST requests against the same bins and products but in reverse payload order. Proves that PostgreSQL correctly serializes them without throwing `deadlock detected`.
- **`C_003`**: **Concurrent Return Verifications**. Issues concurrent verification POST requests for two separate Return Notes that restock identical parts back into identical bins. Proves that deadlocks do not happen and exact quantities are conserved.

## Results
All tests reliably pass, demonstrating zero data loss and robust lock handling under concurrent contention.
