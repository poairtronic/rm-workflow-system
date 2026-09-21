# Phase 13 Final Certification Matrix

| Phase | Requirement | Implementation evidence | Test evidence | DB proof | HTTP | Result |
|---|---|---|---|---|---|---|
| 13.1 | Legal/illegal state transitions and terminal-state protection | `StateMachineValidator`, SC/RM/return/additional-request enums | Fresh suite passed available state tests; 37 tests remain skipped overall | Current rows show valid current states and no orphan child rows | Phase HTTP tests exercised transition paths | Conditional |
| 13.1.1 | Concurrent SC completion/closure | `sc.service.ts` QueryRunner and pessimistic locks | `state-machine-concurrency-phase13-1-1.spec.ts` included in passing files | Current SC rows remain queryable | Live HTTP-backed tests passed available cases | Conditional |
| 13.2 | WIP = received - consumed - returned | Production accounting utilities and validators | `quantity-conservation-phase13-2.spec.ts` passed in fresh suite | Final independent conservation reconstruction not completed | HTTP-backed phase tests passed available cases | Conditional |
| 13.3 | Product+bin inventory conservation | `StockBalance` unique `(productId, binId)` and immutable `StockTransaction` ledger | `inventory-conservation-phase13-3.spec.ts` passed in fresh suite | Negative-stock/orphan checks passed; full ledger reconstruction not completed | Current 98-route matrix incomplete | Conditional |
| 13.4 | Duplicate issue/receipt/return/completion/additional effects | Unique indexes, idempotency key, state guards, and locks | Duplicate-prevention suite passed in fresh run | Current duplicate counts not fully re-run for every operation | Duplicate RM HTTP contract fails 400 vs 409 | Conditional |
| 13.5 | Real overlapping transaction safety | Pessimistic writes and atomic SQL updates | Concurrency suite passed in fresh run | No negative balances in final snapshot | Full current HTTP concurrency matrix incomplete | Conditional |
| 13.6 | Cross-SC ownership and shared inventory contention | SC ID checks; inventory remains product+bin, not per-SC | Isolation suite passed in fresh run | Orphan checks passed; final cross-SC snapshot matrix incomplete | Important negative paths exercised | Conditional |
| 13.7 | RM baseline immutability/traceability | RM item fields, snapshot entity, post-submit restrictions | RM baseline suite passed with live server | Current RM/RM-item rows trace without orphans; full downstream snapshot not re-run | Baseline HTTP suite available; exhaustive current matrix incomplete | Conditional |
| 13.8 | Failure after real write must fully rollback | QueryRunner blocks exist in seven services | Rollback suite cannot start: `service_cards` missing | No rollback DB proof | No rollback HTTP certification | Blocked |

## Required missing evidence

1. Current-schema Phase 13.8 fixture and full failure-injection run.
2. Current 98-route HTTP matrix with zero `NOT TESTED` and zero `BLOCKED` testable routes.
3. Explicit resolution of the duplicate RM 400/409 contract.
4. Reproducible migration history for the live schema.
5. Final ledger reconstruction queries for all inventory and production movements.

## Status rule

Because required evidence is missing and the rollback suite is blocked, the final matrix status is **BLOCKED**, not `CERTIFIED PASS`.
