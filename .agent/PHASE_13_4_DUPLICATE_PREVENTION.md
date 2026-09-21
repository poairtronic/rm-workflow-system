# Phase 13.4 Duplicate Prevention

This phase hardens the business services to prevent the duplicate execution of identical business operations, ensuring exactly-once semantics even during concurrency, network retries, and double clicks.

## Changes Implemented

### 1. Material Issue Idempotency
- **Mechanism**: Added a partial unique index `idx_material_issue_initial` on `material_issues(sc_id)` where `issue_type = 'INITIAL_ISSUE'`.
- **Effect**: Prevents multiple "Initial Issues" from being created for the same Sales Order Component. Handled gracefully in `MaterialIssueService` via a `ConflictException`.

### 2. Production Receipt Idempotency
- **Mechanism**: Added an optional `idempotencyKey` to the `CreateProductionReceiptDto` and a unique index on `material_receipts`.
- **Effect**: Since multiple distinct legitimate receipts can share the same quantities, the client can now provide an idempotency key to prevent network retries from creating duplicate receipts. Natively handled in `ProductionService` via `ConflictException`.

### 3. Additional Material Request Idempotency
- **Mechanism**: Added a partial unique index `idx_single_active_request` on `additional_material_requests(sc_id)` where `status IN ('REQUESTED', 'APPROVED')`.
- **Effect**: Prevents concurrent duplicate requests or double-clicks from creating multiple active additional material requests for the same SC. Handled in `AdditionalRequestService` via `ConflictException`.

### 4. Concurrency Verification for State Transitions
- **Return Acknowledgement**: Validated that `assertReturnPending` and pessimistic locking on `material_returns` prevent duplicate return stock effects.
- **SC Completion**: Validated that `sc.status === ScStatus.COMPLETED` checks and pessimistic locking on `sales_order_components` prevent duplicate completion effects.

## Test Suite
- Test file: `backend/test/duplicate-prevention-phase13-4.spec.ts`
- Verified DB counts for material issues, stock transactions, returns, and SC completion state.
