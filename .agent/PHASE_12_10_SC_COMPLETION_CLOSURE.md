# Phase 12.10 - SC Completion & Closure (Concept Document)

## Business Requirements Addressed
1. **SC Independence:** SC Completion and Closure are independent state transitions scoped to a single Sales Order Component. Closing one SC does not affect sibling SCs under the same PO.
2. **Strict Completion Preconditions:**
   - **Status:** SC must be `IN_PRODUCTION` or `ADDITIONAL_REQUEST`.
   - **Accounting:** All material issued to production must be strictly accounted for (`received - consumed - returned = 0`). Any `unaccounted > 0` blocks completion.
   - **Returns:** All material returns must be verified/acknowledged by Stores. Any return in `PENDING_STORE_ACK` blocks completion.
   - **Additional Requests:** All additional requests must be fully processed (e.g., `ISSUED`, `REJECTED`, or `CANCELLED`). Any request in `REQUESTED` or `APPROVED` blocks completion.
3. **Closure Preconditions:**
   - SC can only be CLOSED if it has first been COMPLETED.
4. **Inventory Isolation:**
   - Completion and Closure are strictly workflow lifecycle transitions.
   - They **MUST NOT** mutate physical inventory (e.g., `StockBalance` or `StockTransaction`).

## Architectural Decisions
- Used existing endpoint routes: `/api/sc/:id/complete` and `/api/sc/:id/close`.
- Used `ProductionService.getAccounting()` to accurately calculate unaccounted material before allowing completion.
- Injected `ProductionService` and `AdditionalRequestService` into `ScService` to avoid duplicating domain logic.
- Avoided any database inventory side-effects in SC controllers.
