# Phase 13 Final Certification Report

## 1. Repository baseline

| Item | Result |
|---|---|
| Branch | `main` |
| Commit tested | `9b28fcee98d802e5253f3968fe79a4fce8426772` |
| Last commit | `9b28fce chore: include remaining workspace artifacts` |
| Initial working tree | Clean before audit execution |
| Post-audit working tree | `backend/debug_sc.txt` modified by runtime/test logging; certification files are new |
| Production-code changes | None made by this audit |

## 2. Current database

The configured PostgreSQL database was reachable at `127.0.0.1:5432/rm_workflow_db` as user `postgres`.

The live public schema contains current tables including `sales_order_components`, `rm_requests`, `rm_items`, `material_issues`, `material_receipts`, `material_consumptions`, `material_returns`, `additional_material_requests`, `stock_balances`, and `stock_transactions`.

The database has no `migrations` table. The legacy table `service_cards` also does not exist. Therefore the live migration state and the Phase 13.8 fixture are not aligned with the current repository.

Baseline query results after the test run:

| Check | Result |
|---|---:|
| Roles | 1 |
| Users | 1 |
| Customers | 1 |
| Purchase orders | 1 |
| Sales-order components | 2 |
| RM requests | 2 |
| RM items | 4 |
| Material issues | 0 |
| Material receipts | 0 |
| Material consumptions | 0 |
| Material returns | 2 |
| Material return items | 4 |
| Additional requests | 0 |
| Stock balances | 2 |
| Stock transactions | 4 |
| Negative stock balances | 0 |
| Orphan RM items | 0 |
| Orphan issue items | 0 |
| Orphan receipt items | 0 |
| Orphan return items | 0 |

## 3. Route discovery and HTTP

Routes were counted directly from current controller decorators and Nest startup logs.

- Current route count: **98**.
- The old API audit script announces and consumes an 89-route inventory, so it is not current certification evidence.
- `GET /api/health` returned HTTP 200 with `status: ok`.
- `GET /` returned HTTP 200.
- The built backend started successfully on `http://localhost:3000`.
- The full current 98-route HTTP matrix was not completed; therefore `NOT TESTED` is not zero and HTTP certification is incomplete.

## 4. Fresh test execution

Command:

```text
npm run test -- --no-file-parallelism
```

Authoritative run with the backend live:

| Metric | Count |
|---|---:|
| Test files | 46 total |
| Test files passed | 44 |
| Test files failed | 2 |
| Tests passed | 432 |
| Tests failed | 1 |
| Tests skipped | 37 |
| Tests collected | 470 |

Failures:

1. `backend/test/transaction-rollback-phase13-8.spec.ts:235` fails with `relation "service_cards" does not exist` before its rollback scenarios execute.
2. `backend/test/rm-http-phase12-3.spec.ts:184` expects HTTP 409 for duplicate RM creation but receives HTTP 400. The current service explicitly throws `BadRequestException` in `backend/src/rm/rm.service.ts:42-46`.

An earlier run before starting the server produced 349 passed, 12 failed, and 109 skipped because HTTP tests could not connect to port 3000. That run is not used as the authoritative result.

## 5. Build and lint

| Check | Result |
|---|---|
| Backend build | PASS |
| Frontend build | PASS |
| Backend lint | PASS with warnings |
| Frontend lint | PASS with warnings |

Warnings include unused imports/variables in existing tests and services, and React hook/style warnings in the frontend. No lint command exited non-zero.

## 6. Phase certification matrix summary

| Phase | Current implementation | Fresh test/DB evidence | HTTP evidence | Result |
|---|---|---|---|---|
| 13.1 | Current state enums and validators present | Relevant state-machine tests passed in the fresh suite; skipped tests remain | Important HTTP paths exercised by phase tests | CONDITIONALLY CERTIFIED |
| 13.1.1 | SC completion/closure uses transactional locking | Current suite evidence passed for available tests | Real HTTP phase tests exercised | CONDITIONALLY CERTIFIED |
| 13.2 | Quantity calculator and production accounting present | Phase tests passed in fresh suite | HTTP-backed phase tests exercised | CONDITIONALLY CERTIFIED |
| 13.3 | Product+bin stock balance and ledger present | Phase tests passed in fresh suite; independent final ledger proof incomplete | Current 98-route audit incomplete | CONDITIONALLY CERTIFIED |
| 13.4 | Unique indexes/idempotency/state checks present | Duplicate phase tests passed in fresh suite | Current duplicate-RM contract mismatch remains | CONDITIONALLY CERTIFIED |
| 13.5 | Pessimistic locks and atomic stock updates present | Concurrency phase tests passed in fresh suite | Full current HTTP concurrency matrix incomplete | CONDITIONALLY CERTIFIED |
| 13.6 | SC ownership checks and shared product+bin inventory present | Isolation phase tests passed in fresh suite | Full route-by-route negative matrix incomplete | CONDITIONALLY CERTIFIED |
| 13.7 | RM baseline fields/snapshots and post-submit restrictions present | Baseline phase tests passed with live server | Full downstream HTTP revalidation incomplete | CONDITIONALLY CERTIFIED |
| 13.8 | QueryRunner transactions exist in seven services | Rollback suite blocked before scenario execution by stale schema fixture | Failure-injection certification not proven | BLOCKED |

## 7. Findings

### HIGH — Phase 13.8 test/schema drift

- File: `backend/test/transaction-rollback-phase13-8.spec.ts`
- Location: line 235 and subsequent `service_cards` references
- Actual current entity: `backend/src/sc/entities/sc.entity.ts`, table `sales_order_components`
- Impact: the required rollback scenarios cannot set up their data, so no rollback proof exists for the final certification.
- Classification: true certification blocker; the test harness is incompatible with the current schema.

### MEDIUM — Duplicate RM response contract mismatch

- File: `backend/src/rm/rm.service.ts`
- Function: `createRm`
- Current behavior: duplicate SC request throws `BadRequestException`, producing HTTP 400.
- Existing real-HTTP test expectation: HTTP 409.
- Business impact: duplicate effect is prevented, but clients cannot rely on the documented conflict classification.
- Classification: Phase 13.4 contract defect or stale test expectation; requires an explicit product/API decision.

### MEDIUM — Migration-state evidence unavailable

- Live database has no `migrations` table.
- Impact: the audit cannot prove which repository migrations produced the current schema or whether the current database is reproducible from migration history.
- Classification: environment/release-integrity blocker, not silently attributed to a business-logic phase.

### INFORMATIONAL — Missing dedicated documents

- No `.agent/PHASE_13_3*` document was present.
- No `.agent/PHASE_13_8*` document was present.
- No dedicated `.agent/PHASE_13_1.1*` document was present.

## 8. Revision semantics

The current model has `revision_number` on RM requests and RM item snapshots. No full multi-version RM revision history table was found. The evidence supports immutable/current baseline tracking, not full historical versioning.

## 9. Roles and approval scope

The current enum contains exactly the six established roles: `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`, and `ADMIN`. No new role or approval authority was introduced during this audit.

## 10. Final certification status

**BLOCKED**

`CERTIFIED PASS` is not permitted because rollback proof is blocked, the complete current 98-route HTTP matrix is incomplete, one live HTTP regression fails, and migration-state evidence is unavailable.
