---
name: rmrit-development
description: Use this skill for ANY work on the RMRIT project (raw material workflow/traceability app) — backend, frontend, schema, API, UI, bug fixes, or new features. Encodes the requirement spec location, non-negotiable business rules, UI/UX bar, and performance bar the agent must hold itself to on every change.
---

# RMRIT Development Skill

## 0. Before touching any code

Read `.agent/OVERVIEW.md` and `.agent/docs/00-README.md` first, then whichever numbered doc matches the area you are changing. Never guess a business rule that is documented. If a rule is ambiguous, check `11-source-doc-corrections-and-open-issues.md`.

## 1. Non-negotiable business rules

1. **PO is a reference, SC is the workflow/completion unit.** Never model PO as needing to "complete" — only SCs close.
2. **Never overwrite a transaction row.** Issues, receipts, consumption, returns, exceptions are append-only.
3. **Never overwrite the original RM requirement.** Additional material is always an `Additional Requirement` entry.
4. **All authoritative math is server-side.** Pending, receipt-pending, unaccounted, extra, totals are computed on backend.
5. **Never silently infer a blank field.** Distinguish user-entered from calculated values.
6. **Server-side role guards on every endpoint** via `JwtAuthGuard` and `RolesGuard`.
7. **Two-step return confirmation.** Stores confirms physical receipt of returned material.
8. **Major RM revisions require a reason and audit record.**
9. **SC status is a rollup, not the source of truth.** Derived from item-level states.
10. **Ground truth is the transaction log.**

## 2. UI/UX Bar

- Design around the 10 UI skills in `.agent/skills/`.
- Clear information hierarchy: SC Number $\rightarrow$ Status $\rightarrow$ Action $\rightarrow$ Materials $\rightarrow$ History.
- Design real loading, empty, and error states.
- Ensure shop-floor touch usability.
- All screens must pass the **Real Employee Test**.

## 3. Performance Bar

- No N+1 queries.
- Paginate every unbounded list.
- Index query targets in PostgreSQL.
- Aggregate totals server-side in SQL.
- Fire-and-forget notification triggers without blocking primary transactions.
