# PHASE 13.1 — STATE MACHINE HARDENING REPORT

## 1. Repository Baseline

- Branch: `main`
- Pre-phase baseline: 401 PASS, 5 SKIPPED (Phase 12 certified)
- Starting commit: `f8b9994`

---

## 2. Files Inspected

- `backend/src/sc/sc.service.ts`
- `backend/src/production/production.service.ts`
- `backend/src/rm/rm.service.ts`
- `backend/src/material-issue/material-issue.service.ts`
- `backend/src/additional-request/additional-request.service.ts`
- `backend/src/common/utils/state-machine-validator.ts`
- `backend/src/common/utils/quantity-calculator.ts`
- All relevant E2E test files in `backend/test/`
- All relevant unit test files in `backend/src/`

---

## 3. Files Modified

- `backend/src/sc/sc.service.ts` — Added `pessimistic_write` locking via `queryRunner` for `completeSc` and `closeSc`.
- `backend/src/production/production.service.ts` — Added `pessimistic_write` locking for `receiveProduction`, `recordConsumption`, `recordReturn`, and `acknowledgeReturn`.
- `backend/src/material-issue/material-issue.service.ts` — Added `pessimistic_write` locking on the SC row during issue creation.
- `backend/src/additional-request/additional-request.service.ts` — Added transaction safety for additional request creation.
- `backend/src/rm/rm.service.ts` — Added safe transition guards.
- `backend/src/common/utils/quantity-calculator.ts` — Minor supporting changes.
- `backend/test/state-machine-concurrency-phase13-1-1.spec.ts` — **NEW**: Concurrency hardening E2E tests.
- `backend/test/quantity-conservation-phase13-2.spec.ts` — **NEW**: Quantity conservation E2E tests.
- `backend/src/common/utils/state-machine-validator.spec.ts` — State machine validator unit tests.
- `backend/src/additional-request/additional-request.service.spec.ts` — Updated unit test.
- `backend/src/material-issue/material-issue.service.spec.ts` — Updated unit test.
- `backend/src/rm/rm.service.spec.ts` — Updated unit test.
- `backend/src/sc/sc.service.spec.ts` — Updated unit test.
- `backend/src/production/production.service.spec.ts` — Updated unit test.

---

## 4. Actual State Machines Discovered

| Entity | States | Terminal State(s) |
|---|---|---|
| SalesOrderComponent (SC) | DRAFT → IN_PRODUCTION → ADDITIONAL_REQUEST → COMPLETED → CLOSED | CLOSED |
| RmRequest | DRAFT → SUBMITTED → REVIEWED | REVIEWED |
| MaterialIssue | Created atomically (no state machine) | — |
| MaterialReturn | PENDING_STORE_ACK → ACKNOWLEDGED / REJECTED | ACKNOWLEDGED, REJECTED |
| AdditionalMaterialRequest | REQUESTED → (authority unresolved) | — |

---

## 5. Legal Transitions Verified

| Entity | From | Action | To | Result |
|---|---|---|---|---|
| SC | IN_PRODUCTION | complete | COMPLETED | ✅ PASS |
| SC | ADDITIONAL_REQUEST | complete | COMPLETED | ✅ PASS |
| SC | COMPLETED | close | CLOSED | ✅ PASS |
| RM | DRAFT | submit | SUBMITTED | ✅ PASS |
| RM | SUBMITTED | review | REVIEWED | ✅ PASS |
| MaterialReturn | PENDING_STORE_ACK | acknowledge | ACKNOWLEDGED | ✅ PASS |

---

## 6. Illegal Transitions Tested

| Entity | From | Action | Expected | Result |
|---|---|---|---|---|
| SC | DRAFT | complete | 400 Bad Request | ✅ PASS |
| SC | CLOSED | complete | 400 Bad Request | ✅ PASS |
| SC | CLOSED | close | 400 Bad Request | ✅ PASS |
| SC | IN_PRODUCTION | close (skip complete) | 400 Bad Request | ✅ PASS |
| SC | IN_PRODUCTION (unaccounted>0) | complete | 400 Bad Request | ✅ PASS |
| SC | IN_PRODUCTION (pending return) | complete | 400 Bad Request | ✅ PASS |
| SC | IN_PRODUCTION (active AMR) | complete | 400 Bad Request | ✅ PASS |

---

## 7. Terminal State Tests

- `CLOSED` SC cannot be completed: ✅ PASS
- `CLOSED` SC cannot be closed again: ✅ PASS (safe `400`)
- `REVIEWED` RM cannot be re-submitted: ✅ PASS
- `ACKNOWLEDGED` return cannot be re-acknowledged: ✅ PASS

---

## 8. Mass Assignment Tests

- Sending `{ "status": "CLOSED" }` in create/update payload is rejected by `ValidationPipe` (`forbidNonWhitelisted: true`): ✅ PASS (400)
- Sending `{ "approvedById": "..." }` rejected on protected endpoints: ✅ PASS
- Server controls all state transitions via dedicated endpoints, not via status fields: ✅ CONFIRMED

---

## 9. Cross-SC Tests

- SC001 operations cannot affect SC002 state: ✅ PASS (ownership checks validate `sc.id === params.scId`)
- SC independence confirmed: completing SC001 leaves sibling SCs untouched: ✅ PASS

---

## 10. Concurrency Tests (`state-machine-concurrency-phase13-1-1.spec.ts`)

| Test | Description | Result |
|---|---|---|
| CONCUR_01 | Two simultaneous `complete` requests on same SC | 1 PASS (201), 1 REJECTED (400 "already COMPLETED") ✅ |
| CONCUR_02 | Two simultaneous `close` requests on same SC | 1 PASS (201), 1 REJECTED (400 "already CLOSED") ✅ |

Mechanism: `pessimistic_write` row lock via `queryRunner.manager.findOne(..., { lock: { mode: 'pessimistic_write' } })` prevents race conditions at the database level.

---

## 11. Transaction Tests

- `completeSc`: All precondition checks inside `queryRunner` transaction. On failure → `rollbackTransaction()`. ✅
- `closeSc`: Wrapped in `queryRunner` transaction with pessimistic lock. ✅
- `acknowledgeReturn` (production service): Wrapped in transaction — stock balance update + transaction record creation is atomic. ✅
- `createMaterialIssue`: SC row locked with `pessimistic_write` before deducting stock. ✅

---

## 12. RBAC Tests

- Unauthorized role attempting SC complete → 403: ✅ PASS
- Stores cannot complete SC (SC complete restricted to DESIGNER/ADMIN roles): ✅ PASS
- Production cannot close SC: ✅ PASS
- DESIGNER cannot issue material (Stores-only action): ✅ PASS

---

## 13. Real HTTP Test Results

New E2E test file: `backend/test/state-machine-concurrency-phase13-1-1.spec.ts`
- 2 tests: ✅ PASS

All Phase 12 E2E suites continue to pass.

---

## 14. Phase 12 Regression Results

```
Test Files  40 passed (40)
Tests       407 passed | 5 skipped (412)
```

Phase 12 certification baseline: **MAINTAINED** ✅

---

## 15. Build Result

- Backend build: ✅ PASS
- Frontend build: ✅ PASS

---

## 16. Lint Result

- Backend lint: ✅ PASS (LF → CRLF warnings only, not errors)
- Frontend lint: ✅ PASS

---

## 17. Test Counts

| Category | Count |
|---|---|
| Test Files | 40 |
| Tests PASS | 407 |
| Tests SKIPPED | 5 (legacy inventory.service.spec.ts — inherited from Phase 11) |
| Tests FAIL | 0 |

---

## 18. Skipped Tests

5 legacy tests in `src/inventory/inventory.service.spec.ts` — inherited from Phase 11. Not introduced by Phase 13.1. Documented as pre-existing technical debt.

---

## 19. Remaining Defects

None introduced by Phase 13.1.

Pre-existing:
- 5 skipped legacy tests in `inventory.service.spec.ts` (Phase 11 technical debt — outside Phase 13.1 scope).

---

## 20. Final Status

| Category | Result |
|---|---|
| State Machine Hardening | ✅ PASS |
| Pessimistic Write Locking | ✅ IMPLEMENTED |
| Terminal State Protection | ✅ PASS |
| Mass Assignment Protection | ✅ PASS |
| Cross-SC Isolation | ✅ PASS |
| Concurrency Tests | ✅ PASS |
| Transaction Safety | ✅ PASS |
| RBAC Tests | ✅ PASS |
| Real HTTP Tests | ✅ PASS |
| Phase 12 Regression | ✅ PASS (407 pass, 5 skipped) |
| Build | ✅ PASS |
| Lint | ✅ PASS |
| Documentation | ✅ COMPLETE |
| **PHASE 13.1 FINAL STATUS** | ✅ **PASS** |
