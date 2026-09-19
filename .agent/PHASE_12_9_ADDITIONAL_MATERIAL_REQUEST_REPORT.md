# Phase 12.9 — Additional Material Request

## Implementation Summary
Phase 12.9 successfully establishes the "Additional Material Request" boundary within the Production lifecycle. The workflow handles production shortages by allowing additional material to be requested without mutating stock balances or resolving the pending organizational authority for approvals.

### Core Objectives Met
1. **Unresolved Authority Encapsulation:**
   - Designed the `createRequest` logic to deliberately skip automatic approvals (`quantityApproved: null`).
   - Requests remain locked in the `REQUESTED` state.
   - `quantityApproved` will not be mutated until the business resolves who holds approval authority (Senior Manager, General Manager, or Stores).
   - Removed any fuzzy inputs (`material`, `grade`, `size`); replaced with explicit, deterministic `rmItemId` mapping to link back to the exact physical specification requested by the Designer in Phase 12.3.

2. **Inventory Immutability:**
   - Submitting an Additional Request creates **no `StockTransaction`** and mutates **no `StockBalance`**.
   - Preserves Atomic operations and Stock correctness.
   - The boundary between "Requested" and "Issued" remains perfectly intact. 

3. **Strict Workflow Isolation (SC/PO Boundaries):**
   - Implemented validation ensuring that the `rmItemId` belongs explicitly to the `scId` triggering the additional request.
   - Cross-contamination between different SCs, even under the same PO, is blocked.

### Testing & Validation
Added a comprehensive E2E test suite (`backend/test/additional-request-phase12-9.spec.ts`) validating:
- `ADDL_01`: Safely rejects zero and negative quantities.
- `ADDL_02`: Enforces UUID structures for SC and RM Items.
- `ADDL_03`: Safely rejects when the requested `rmItemId` does not belong to the contextual SC context.
- `ADDL_04`: Prevents mass-assignment exploitation (`status`, `quantityApproved`, `approvedById`) using the `ValidationPipe` whitelist.
- `ADDL_05`: Creates valid Additional Requests and stringently enforces inventory immutability and accounting (`quantityApproved` stays `null`, Stock Balance/Transactions unaffected).
- `ADDL_06`: Safely isolates multiple additional requests on the same SC.
- `ADDL_07`: Completely isolates requests between different SCs.
- `ADDL_08`: Enforces RBAC; Stores personnel cannot raise an Additional Request.

The backend fully compiled and all 398 automated regression tests passed.
