# PHASE 13.1 — STATE MACHINE HARDENING

## Overview

Phase 13.1 hardens all business entity state machines against illegal, backward, duplicate, cross-state, concurrent, and mass-assigned status transitions. It builds on top of the Phase 12 functional baseline without redesigning the workflow, inventing new states, approvers, or roles.

---

## State Machines Hardened

### SalesOrderComponent (SC)

```
DRAFT → IN_PRODUCTION → [ADDITIONAL_REQUEST] → COMPLETED → CLOSED
```

- `completeSc`: Now wrapped in a `queryRunner` transaction with `pessimistic_write` row lock on the SC entity.
- `closeSc`: Now wrapped in a `queryRunner` transaction with `pessimistic_write` row lock on the SC entity.
- Terminal state `CLOSED`: Cannot be re-opened or re-closed (400 returned).
- SC independence preserved: Sibling SCs are untouched.

### RM Request

```
DRAFT → SUBMITTED → REVIEWED
```

- `submit`: Validated that RM is in DRAFT before submission.
- `review`: Validated that RM is in SUBMITTED before review.
- Terminal state `REVIEWED` cannot be rolled back.

### Material Issue

- Created atomically inside a `queryRunner` transaction.
- SC row is locked with `pessimistic_write` to prevent concurrent double-issues against the same SC.

### Material Return (Production Service)

```
[Created] → PENDING_STORE_ACK → ACKNOWLEDGED / REJECTED
```

- `acknowledgeReturn`: SC row + return row locked with `pessimistic_write` before stock balance mutation.
- Double-ACK of the same return safely returns 400.

### Additional Material Request

```
[Created] → REQUESTED → [AUTHORITY UNRESOLVED]
```

- Authority decision remains unresolved per Phase 12 business rules.
- No approve/reject endpoints added.
- `REQUESTED` is the stable terminal state until authority is decided.

---

## Concurrency Protection

All critical state transitions now use TypeORM `queryRunner` with `pessimistic_write` locking:

```typescript
const entity = await queryRunner.manager.findOne(Entity, {
  where: { id },
  lock: { mode: 'pessimistic_write' },
});
```

This prevents race conditions where two simultaneous requests could both read a valid pre-transition state and both succeed, resulting in a corrupted final state.

Tested via `backend/test/state-machine-concurrency-phase13-1-1.spec.ts`:
- CONCUR_01: Dual SC complete → 1 success, 1 safe 400
- CONCUR_02: Dual SC close → 1 success, 1 safe 400

---

## Mass Assignment Protection

All state-controlling fields (`status`, `completedById`, `closedById`, `approvedById`, `quantityApproved`, etc.) are server-controlled and excluded from client DTOs. The global `ValidationPipe` with `forbidNonWhitelisted: true` ensures that sending these fields in request bodies results in a 400 Bad Request.

---

## AMR Authority Gate

Additional Material Request authority remains unresolved. No new approve/reject endpoints were created. `quantityApproved` is `null` on creation. The state machine gate ensures SC cannot be completed if an active AMR is in `REQUESTED` status.

---

## SENIOR_DESIGNER

Not reintroduced in any enum, guard, transition rule, seed data, test user, or documentation.

---

## Test Coverage Added

| File | Tests |
|---|---|
| `backend/test/state-machine-concurrency-phase13-1-1.spec.ts` | 2 new E2E concurrency tests |
| `backend/src/common/utils/state-machine-validator.spec.ts` | State machine validator unit tests |

---

## Phase 12 Regression

**407 tests PASS, 5 SKIPPED (legacy) — Phase 12 certification maintained.**
