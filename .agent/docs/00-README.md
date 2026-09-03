# RMRIT — Requirement & Architecture Docs (Split for Agent Consumption)

This is the RMRIT (Raw Material workflow/traceability app) requirement set, split from one long analysis document into focused files so a coding agent can load only what's relevant per task.

| File | Contents |
|---|---|
| `01-overview.md` | Business problem, core lifecycle, PO-vs-SC principle, V1 scope boundary |
| `02-business-hierarchy-and-rm-structure.md` | Customer/PO/SC hierarchy, RM request types, material row fields, immutable-original-RM rule |
| `03-approval-and-stores-workflow.md` | Senior Designer approval + revision tracking, Stores issue workflow (partial/extra/multiple issue) |
| `04-production-workflow-and-accounting.md` | Issue-vs-receipt distinction, consumption/return/exceptions, full material accounting math |
| `05-status-architecture.md` | SC status state machine + separate item-level status model |
| `06-roles-and-permissions.md` | 6 roles, capabilities, permission matrix, security requirements |
| `07-data-model-entities.md` | All entities/fields, transaction tables, integrity formulas, indexes |
| `08-tech-stack-and-infrastructure.md` | Full free-tier stack (React/NestJS/Neon/Supabase/Render/Gmail API), why Redis/microservices/SMTP are excluded |
| `09-notifications-analytics-screens.md` | Notification triggers, analytics formulas, all dashboards, screen-by-screen UI spec, audit trail example |
| `10-dev-phases-and-testing.md` | 10 build phases, testing strategy, performance do/don't list |
| `11-source-doc-corrections-and-open-issues.md` | **Read this before schema design** — inconsistencies, gaps and undecided points found in the original doc, with an action-item table by phase |

## Suggested reading order for an agent starting fresh
1. `01-overview.md` → `02-business-hierarchy-and-rm-structure.md` (understand the domain)
2. `07-data-model-entities.md` + `11-source-doc-corrections-and-open-issues.md` (before touching the schema)
3. `03` and `04` (the two core workflows)
4. `05`, `06` (status machine + who can do what)
5. `08` (infra) when scaffolding the repo
6. `09`, `10` when building UI/tests

## Not yet done
Repo scaffolding, Prisma schema file, and NestJS module skeletons are the next step — these docs are the spec to build from, not code yet.
