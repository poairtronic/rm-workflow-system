# PHASE 13 — BUSINESS LOGIC, QUANTITY CONTROL & INVENTORY INTEGRITY DOCUMENTATION

## 1. OBJECTIVE
Phase 13 hardens the core manufacturing business workflow implemented in Phase 12 by enforcing strict business quantity limits, centralizing state machine assertions, protecting inventory integrity, preventing double deductions or over-returns, and providing read-only reconciliation auditing.

---

## 2. AUTHORITATIVE SOURCES & BUSINESS RULES
1. **Authoritative Inventory Model**: `Product + Bin = StockBalance`. Current quantity is the single source of truth for physical inventory. Immutable `StockTransaction` records preserve ledger movement history.
2. **Centralized Accounting Formula**: `UNACCOUNTED = RECEIVED - CONSUMED - RETURNED`.
3. **Quantity Invariants**:
   - `REQUIRED >= 0`
   - `RECEIVED >= 0`
   - `CONSUMED >= 0`
   - `RETURNED >= 0`
   - `UNACCOUNTED >= 0`
   - `CONSUMED + RETURNED <= RECEIVED`
4. **Decimal Safety**:
   - `QuantityCalculator.roundDecimal(val)` rounds all numbers safely to 3 decimal places (`Math.round(val * 1000) / 1000`) to prevent floating-point rounding errors.
5. **State Transition Enforcement**:
   - Centralized `StateMachineValidator` asserts allowed state transitions and blocks illegal operations (e.g. operations on closed SCs, submitting empty RMs, re-verifying acknowledged returns).

---

## 3. BUSINESS QUANTITY & ACCOUNTING MATRIX

| METRIC | FORMULA / RULE | INVARIANT | FAILURE BEHAVIOR |
|---|---|---|---|
| Unaccounted Qty | `RECEIVED - CONSUMED - RETURNED` | `UNACCOUNTED >= 0` | Floored at 0, no negative display |
| Store Issue Qty | `0 < QUANTITY_ISSUED <= AVAILABLE_STOCK` | `binId` balance sufficiency | Transaction rolled back with 400 error |
| Consumption Qty | `CONSUMED <= REMAINING_RECEIVED` | `CONSUMED + RETURNED <= RECEIVED` | Rejected with 400 error |
| Return Qty | `RETURNED <= UNACCOUNTED` | `RETURNED <= RECEIVED - CONSUMED - ALREADY_RETURNED` | Rejected with 400 error |
| Verified Return Stock | `destBin.currentQuantity += Qty` | `destBin.isActive === true` | Transaction rolled back with 400 error |

---

## 4. CENTRALIZED UTILITIES IMPLEMENTED
1. **`QuantityCalculator`** (`backend/src/common/utils/quantity-calculator.ts`):
   - `roundDecimal(value)`: 3-decimal precision safety.
   - `calculateUnaccounted(received, consumed, returned)`: Centralized accounting calculation.
   - `assertPositive(qty, field)`: Enforces `qty > 0`.
   - `assertNonNegative(qty, field)`: Enforces `qty >= 0`.
   - `assertWithinLimit(requested, limit, msg)`: Prevents over-issuance, over-consumption, and over-return.

2. **`StateMachineValidator`** (`backend/src/common/utils/state-machine-validator.ts`):
   - `assertScActive(status, action)`: Blocks write actions on closed/completed SCs.
   - `assertRmDraft(status, action)`: Blocks item addition or re-submission on submitted RMs.
   - `assertReturnPending(status)`: Blocks duplicate verification of acknowledged returns.
   - `assertAdditionalRequestPending(status)`: Blocks re-issuance of completed additional requests.

3. **Workflow Reconciliation Service** (`backend/src/inventory/inventory.service.ts`):
   - `getWorkflowReconciliation()`: Read-only audit comparing `StockBalance` per `Product + Bin` against sum of `StockTransaction` movements (`STOCK_IN`, `STOCK_OUT`, `STORES_ISSUE`, `RETURN`).

---

## 5. OPEN DECISIONS REGISTER
- `DEC-PROD-010`, `DEC-PROD-011`, `DEC-PROD-012`, `DEC-PROD-013`, `DEC-PROD-014` remain documented as OPEN in Phase 2 requirement logs.
- `DEC-WH-006`, `DEC-WH-008`, `DEC-005` remain documented as OPEN.
- No open decisions were silently closed during Phase 13.
