# PHASE 13.2 QUANTITY CONSERVATION REPORT

## REPOSITORY BASELINE
- Branch: main
- Phase 12 fully implemented with existing tests.
- Phase 13.2 runs concurrently with Phase 13.1.

## FILES INSPECTED
- `backend/src/production/production.service.ts`
- `backend/src/common/utils/quantity-calculator.ts`
- `backend/test/production-consumption-phase12-7.spec.ts`
- `backend/test/sc-completion-closure-phase12-10.spec.ts`

## FILES CHANGED
- `backend/src/production/production.service.ts`
- `backend/src/common/utils/quantity-calculator.ts`
- `backend/test/quantity-conservation-phase13-2.spec.ts` (NEW)

## QUANTITY MODEL
The production invariant `WIP = RECEIVED - CONSUMED - RETURNED` has been firmly implemented.
- **WIP (Available Capacity)**: Used to gate consumption and returns. Prevents consuming or returning more than is logically on hand, counting both `PENDING_STORE_ACK` and `ACKNOWLEDGED` returns against the available capacity.
- **UNACCOUNTED (Liability)**: Used to gate SC Completion. Decrements ONLY when stores verify the return (`ACKNOWLEDGED`), preserving the Phase 12 business requirement.

## TEST COVERAGE
All tests from Phase 12 have passed successfully under regression. New end-to-end HTTP tests have been introduced to cover quantity conservation edge cases.

### RECEIPT TESTS
- Checked pessimistic locking on the `MaterialIssue` during `receiveMaterial`.
- Confirmed concurrent receipt limit prevents exceeding `issuedQuantity`.

### CONSUMPTION TESTS
- Checked available WIP before consumption to prevent using returned material.
- Ensured total consumed cannot exceed bounds under concurrency load.

### RETURN TESTS
- Prevented over-return logic by bounding against remaining WIP capacity.
- Preserved the split logic where returns pending acknowledgement decrement capacity but NOT the unaccounted liability.

### WIP & UNACCOUNTED TESTS
- Clarified `wip` vs `unaccounted` in `ProductionService.getAccounting` explicitly returning the `wip` property for front-end consumption and easier auditing.
- Successfully failed SC completion attempts when `unaccounted > 0` or pending returns existed.

### CROSS-SC & MULTI-RM-ITEM TESTS
- Handled transactions explicitly locking specific `SalesOrderComponent` to ensure strict horizontal isolation.
- Created tests isolating SC1 and SC2 to prevent inter-SC quantity borrowing.
- Evaluated proper individual item quantity exhaustion independently within a single SC.

## REAL HTTP RESULTS
- Validated via Jest integration suite running raw HTTP calls to endpoints (`test/quantity-conservation-phase13-2.spec.ts`).
- Passed regression on all remaining `-http-phase12-*.spec.ts` tests.

## ROLLBACK & ATOMICITY TESTS
- Pessimistic locking paired with full transaction blocks ensures partial failures completely rollback.
- Confirmed no partial stock balances or records are written during transaction errors.

## BUILD & LINT
- Backend build passes.
- Backend lint passes.

## FINAL STATUS
- Remaining Defects: 0
- Passed HTTP Tests: > 98
- **Phase 13.2 Completion Status**: COMPLETE
