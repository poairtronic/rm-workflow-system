# PHASE 13.6 - SC ISOLATION HARDENING

## 1. Overview
The objective of this phase is to ensure that operations on one Sales Order Component (SC) strictly cannot accidentally affect another SC. The system must enforce SC isolation to prevent a user from maliciously or accidentally interacting with RM Items, Material Issues, Receipts, Returns, and Consumptions belonging to an unrelated SC.

## 2. Core Rule
`SC001` actions must not accidentally affect `SC002`.
- Valid cross-SC shared resources are isolated strictly at the database row level (e.g., competing for the same Physical Inventory `StockBalance`).
- But operations belonging to a specific SC workflow (e.g., consuming materials against `SC001`) must not be allowed to use an `RmItem` belonging to `SC002`.

## 3. Implementation Details

### A. Ownership Validation in Endpoints
Strict Ownership checks were introduced in core services to guarantee cross-SC boundaries are respected:
1. **Material Issue (`createIssue`)**: Ensured `rmItem.scId === dto.scId`.
2. **Production Receipt (`receiveMaterial`)**: Ensured `materialIssue.scId === dto.scId`.
3. **Production Consumption (`recordConsumption`)**: Ensured `rmItem.scId === dto.scId`.
4. **Production Return (`recordReturn`)**: Ensured `rmItem.scId === dto.scId`.

### B. Secure RmItem Creation
In `RmService.addRmItem`, `scId` is now explicitly sourced from the verified parent `RmRequest` (which transitively belongs to a `SalesOrderComponent`). This prevents Orphan RM Items or cross-SC poisoning from the client payload during RM Baseline definition.

### C. Testing and Verification
A massive test suite `backend/test/sc-isolation-phase13-6.spec.ts` was implemented to verify exactly the Isolation edge cases required:
- `SCISO_001`: Two Independent SCs
- `SCISO_002` to `SCISO_008`: Attempted operations on `SC001` using `SC002`'s `RmItem` / `MaterialIssue` / `Return` entities, all resulting in `400 Bad Request`.
- Verification that SC Completions and Closures do not aggregate or couple unrelated SCs.

## 4. Constraint Preservation
- Did not mutate or bypass the physical `StockBalance` constraints (inventory contention).
- Did not create SC-specific pseudo-ledgers or stock balances.
- Did not change the pessimistic locking approach introduced in Phase 13.1.1 or 13.5.

## 5. Summary
The Phase 13.6 constraints are completely proven with full unit, E2E, and concurrency regression tests passing across all suites (`npx vitest run --fileParallelism=false` ensures reliable validation).
