# Phase 13 Final Certification Matrix

| PHASE | REQUIREMENT | IMPLEMENTATION | TEST | DB PROOF | HTTP | RESULT |
|---|---|---|---|---|---|---|
| 13.1 | STATE MACHINE | StateMachineValidator, Enums | 418 passed, 52 skipped | Valid current states | HTTP phase tests passed available cases | CONDITIONALLY CERTIFIED |
| 13.1.1 | SC COMPLETION CONCURRENCY | sc.service.ts QueryRunner | state-machine-concurrency passed | Current SC rows isolated | Live HTTP-backed tests passed | CONDITIONALLY CERTIFIED |
| 13.2 | QUANTITY CONSERVATION | WIP = received - consumed - returned | quantity-conservation-phase13-2.spec.ts passed | Conservation matches | Live HTTP tests passed | CONDITIONALLY CERTIFIED |
| 13.3 | INVENTORY CONSERVATION | StockBalance immutable ledger | inventory-conservation-phase13-3.spec.ts passed | No negative stock orphans | HTTP tests passed | CONDITIONALLY CERTIFIED |
| 13.4 | DUPLICATE PREVENTION | Unique indexes, idempotency key | duplicate-prevention suite passed | Valid row counts | HTTP duplicate contracts verified | CONDITIONALLY CERTIFIED |
| 13.5 | CONCURRENCY | Pessimistic locks in operations | Concurrency suite passed | No deadlocks | Overlapping HTTP requests passed | CONDITIONALLY CERTIFIED |
| 13.6 | SC ISOLATION | SC ID context checks | sc-isolation-phase13-6.spec.ts passed | SCs remain independent | Cross-SC HTTP tests passed | CONDITIONALLY CERTIFIED |
| 13.7 | RM BASELINE | RM items locked post-submit | rm-baseline-protection-phase13-7.spec.ts passed | Baseline remains immutable | HTTP assertions passed | CONDITIONALLY CERTIFIED |
| 13.8 | ROLLBACK | Pessimistic QueryRunner rollbacks | transaction-rollback-phase13-8.spec.ts **FAILED in setup** | **Missing** | **Missing** | **BLOCKED** |

## Missing Evidence / Test Defects
1. `test/transaction-rollback-phase13-8.spec.ts` crashes in `beforeAll` because it references obsolete `service_cards` table instead of `sales_order_components`.
2. `test/rm-http-phase12-3.spec.ts` and `test/sc-http-phase12-2.spec.ts` crash in `beforeAll` due to hardcoded user ID inserts causing `duplicate key value violates unique constraint` on `users` table.

## Status Rule
Because Phase 13.8 failure-injected tests could not run due to broken test fixtures, the final certification is **BLOCKED**.
