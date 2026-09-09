# RMRIT --- MULTI-AGENT DEVELOPMENT GOVERNANCE

## Primary Development Authority & Shared Repository Rules
**Purpose:** Permanent coordination contract for every AI coding agent
working on this repository.

**Application:** RMRIT --- Inventory Management + Raw Material
Workflow + Material Issuance + Production Material Traceability System.

---

## 1. PRIMARY DEVELOPMENT AUTHORITY

### PRIMARY AGENT
**Antigravity IDE --- primary development agent**

The Antigravity session identified by the project owner as the **primary
account/agent** is the primary development and integration authority for
this repository.

The primary agent owns:

- overall implementation direction
- architectural decisions
- phase progression
- final integration decisions
- acceptance of phase completion
- reconciliation of changes made by supporting agents
- protection of the existing working architecture
Other AI agents are supporting agents unless the project owner
explicitly changes this arrangement.

The ability of another agent to edit the repository does **not** make that
agent the primary architect.

---

## 2. SUPPORTING AGENTS
The project owner may use multiple agents/accounts, including:

- Antigravity
- Gemini-based terminal/IDE agents
- Cursor
- VS Code + GitHub Copilot
- OpenCode in terminal
- other coding agents
Supporting agents may inspect, review, test, investigate, and implement
explicitly assigned tasks.

Supporting agents must NOT:

- redesign the application independently
- change the roadmap
- skip phases
- implement future phases
- replace architecture without justification
- delete another agent's work
- reset/revert repository changes without explicit authorization
- assume their implementation is the final accepted architecture

---

## 3. THE REPOSITORY IS SHARED STATE
All agents may be working on the same repository and working tree.

Before making changes, inspect:

```
git status
git diff
git log --oneline -10
```
Also inspect the relevant files directly.

Never assume the repository matches an older conversation or prompt.

The current repository state is authoritative for implementation.

---

## 4. REQUIRED PROJECT DOCUMENTS
Before implementing a substantial task, locate and read the relevant
project documentation.

Important documents include:

```
.agent/INVENTORY_MODULE_CONCEPT.md
.agent/PHASE_10.1_*.md
.agent/PHASE_10.2_*.md
.agent/PHASE_10.3_*.md
.agent/PHASE_10.4_*.md
.agent/PHASE_10.5_*.md
...
```
Exact filenames may differ.

Use the latest applicable accepted phase report.

Do not rely only on an old prompt.

---

## 5. CONTROLLED PHASE DEVELOPMENT
Current Inventory roadmap:

```
10.1  Inventory Domain Review
10.2  Inventory Master Data
10.3  Stock Movement Model
10.4  Stock In
10.5  Stock Out
10.6  Stock Adjustment
10.7  Ledger & Balance Reconciliation
10.8  Inventory Search / Filter / View
10.9  Transaction History
10.10 Inventory Audit & Security
10.11 Inventory Testing
10.12 Inventory Hardening
```
Later:

```
11  RM + Inventory + Stores Material Issue
12  Production Receipt + Consumption + Return
13  Additional Material Requests
14  Notifications + Low Stock Alerts
15  Material Relationships / Transformation
16  Analytics + Management
17  Integration + Hardening
```

### Absolute rule
If the assigned phase is 10.5, implement ONLY 10.5.

Do not implement 10.6, 10.7, Phase 11, Production, RM, Transformation,
Notifications, or Analytics unless explicitly instructed.

---

## 6. NEVER JUMP AHEAD
Do not implement future functionality merely because it appears useful.

Examples:

If implementing Stock Out, do NOT automatically add:

- Production Consumption
- RM Issue
- Material Return
- Additional Material Request
- Transformation
These are separate business workflows.

Build reusable foundations where appropriate, but do not activate future
business functionality prematurely.

---

## 7. NO SPECULATIVE BUSINESS RULES
If the repository or documentation does not define a business rule:

**DO NOT INVENT IT.**

Never invent:

- material families
- unit conversions
- cutting ratios
- yield
- wastage
- production rules
- RM rules
- PO rules
- SC rules
- approval rules
- notification rules
- transaction numbering
- supplier workflows
Use this process:

```
Existing documentation?
        ↓
Existing repository implementation?
        ↓
Existing database model?
        ↓
Existing phase report?
        ↓
Still unclear?
        ↓
STOP / ASK / DOCUMENT
```
Do not guess.

---

## 8. PRESERVE THE EXISTING ARCHITECTURE
Current technology:

- React
- Vite
- TypeScript
- NestJS
- PostgreSQL
- TypeORM
- JWT
- JwtAuthGuard
- RolesGuard
- @Roles
- Render
- GitHub
Reuse the existing architecture.

Do NOT introduce a new architecture merely because another architecture
is personally preferred.

Avoid unnecessary:

- framework changes
- ORM changes
- authentication rewrites
- database rewrites
- frontend rewrites
- state-management replacements
- dependency additions
If a structural change is genuinely necessary:

1. explain why
2. identify affected modules
3. minimize the change
4. document it
5. do not silently redesign the application

---

## 9. INVENTORY ARCHITECTURE
The central inventory architecture is:

```
InventoryItem
   ├── StockBalance
   └── StockTransaction
```
Meaning:

```
InventoryItem
= WHAT material exists

StockBalance
= CURRENT operational quantity

StockTransaction
= IMMUTABLE historical movement
```
This distinction MUST remain intact.

### Critical invariant
`StockBalance` is the operational source of truth for current stock.

`StockTransaction` is historical evidence.

Do not create another current-stock source.

---

## 10. BACKEND AUTHORITY
The backend is authoritative.

Never trust the frontend for:

- authorization
- current balance
- transaction type
- authenticated user
- createdBy
- createdAt
- stock availability
- final balance
The frontend may display information and collect user input.

The backend validates and determines authoritative business state.

---

## 11. DATABASE SAFETY
Inventory stock changes must be safe under concurrency.

Avoid unsafe read-modify-write patterns such as:

```
READ balance
↓
calculate in JavaScript
↓
SAVE calculated balance
```
when concurrent requests can cause lost updates.

Prefer atomic database operations and proper database transactions where
required.

For Stock Out:

```
availability check
+
decrement
```
must be atomic.

Stock must never become negative.

---

## 12. TRANSACTION SAFETY
Where a stock movement changes both:

```
StockBalance
+
StockTransaction
```
they must succeed or fail together.

Never leave:

```
Balance changed
but transaction missing
```
or:

```
Transaction exists
but balance was not changed
```
Use the existing TypeORM transaction/QueryRunner architecture where
applicable.

---

## 13. IMMUTABLE HISTORY
`StockTransaction` represents historical business activity.

Do not casually add:

```
PATCH transaction
DELETE transaction
```
Historical correction should normally be represented through controlled
future movement/adjustment mechanisms rather than silently rewriting
history.

Do not implement correction workflows unless the current phase
explicitly requires them.

---

## 14. ROLES
The final active roles are:

```
DESIGNER
STORES
PRODUCTION
SENIOR_MANAGER
GENERAL_MANAGER
ADMIN
```

Senior Designer is removed from the active architecture.

An agent must NOT reintroduce:

```
SENIOR_DESIGNER
```
or equivalent variants.

Do not create new roles without explicit authorization.

---

## 15. ROLE PRINCIPLES
General role model:

```
ADMIN
= full administrative capability

STORES
= inventory operational management

DESIGNER
= inventory visibility where permitted

PRODUCTION
= production-related access when later phases activate it

SENIOR_MANAGER
= monitoring / analytics / visibility

GENERAL_MANAGER
= monitoring / analytics / visibility
```
Do not grant future permissions early.

Production must not receive generic Stock Out capability merely because
Production will eventually consume materials.

---

## 16. PO AND SC PRINCIPLES
The external system creates the PO.

RMRIT uses the PO number.

A PO can contain multiple SCs.

Each SC is an independent work/production unit and independent closure
unit.

Important:

```
SC closure does NOT depend on PO completion.
```
Do not introduce a PO-completion dependency.

Do not build PO creation unless explicitly requested.

---

## 17. RM / PRODUCTION BOUNDARIES
Future workflow:

```
Designer creates RM
        ↓
Stores checks material
        ↓
Stores issues material
        ↓
Production receives
        ↓
Production uses material
        ↓
Production returns balance
        ↓
Stores verifies return
        ↓
Production completes
        ↓
SC closes
```
This is future business functionality.

Do not implement parts of it outside the assigned phase.

---

## 18. MATERIAL TRANSFORMATION
The project may eventually contain relationships such as:

```
Long Bar 45 Dia
       ↓ cutting
Cut Piece 45 Dia
```
However:

DO NOT invent:

- conversion ratios
- output quantities
- wastage
- yield
- cutting rules
- transformation rules
until exact business rules are supplied.

---

## 19. MULTI-AGENT CONFLICT PREVENTION
Before editing a file:

1. Check git status.
2. Check whether the file has uncommitted changes.
3. Inspect the current content.
4. Determine whether changes belong to another task/agent.
5. Avoid overwriting unrelated work.
If unexpected modifications exist:

- inspect the diff
- preserve compatible changes
- report conflicts
- make the smallest required modification
Do not blindly replace files.

---

## 20. NEVER RESET THE WORKING TREE
Without explicit user authorization, NEVER run:

```
git reset --hard
git clean -fd
git checkout .
git restore .
```
Do not use destructive Git commands to clean the repository.

Another agent's uncommitted work may be present.

---

## 21. DO NOT DELETE ANOTHER AGENT'S WORK
If you find:

- new files
- modified files
- implementation from another agent
- tests added by another agent
- documentation added by another agent
do not delete them simply because another agent created them.

Determine relevance first.

If uncertain, preserve and report.

---

## 22. GIT COMMITS
The primary agent controls final integration.

Supporting agents should not create broad commits containing unrelated
work.

If explicitly asked to commit:

- commit only assigned changes
- use a clear commit message
- inspect `git diff` first
- do not include unrelated files
- never commit secrets

---

## 23. SECRETS AND ENVIRONMENT FILES
NEVER expose or commit:

```
.env
.env.*
API keys
JWT secrets
database passwords
private credentials
tokens
service-account credentials
```
Do not print secrets in reports.

If a secret is accidentally exposed:

STOP and report it.

---

## 24. TESTING REQUIREMENT
Every implementation phase must be verified.

Run the appropriate:

```
tests
type checking
build
lint
```
according to repository scripts.

Do not claim tests passed unless they were actually run.

Report exact results.

Example:

```
Backend tests: 61/61 passing
Frontend build: PASS
Backend build: PASS
TypeScript: PASS
Lint: PASS
```

---

## 25. DATABASE RUNTIME VERIFICATION
Do not claim database runtime verification unless the database was
actually accessed and tested.

If unavailable, explicitly state:

```
Database runtime verification was not available.
```

---

## 26. FAILURE HANDLING
If tests fail:

DO NOT:

- delete tests
- weaken assertions
- skip failing tests
- hide failures
- claim success
Instead:

1. identify failure
2. determine whether caused by current change
3. fix if within scope
4. otherwise document it
5. report exact result

---

## 27. PHASE COMPLETION
A phase is complete only after:

```
Implementation
+
Tests
+
Build verification
+
Regression verification
+
Scope verification
+
Final report
```
The final report must provide a verdict.

The primary agent/user decides whether to proceed.

---

## 28. REQUIRED AGENT WORKFLOW
When receiving a phase prompt:

### STEP 1 --- READ
Read:

- concept documents
- previous phase reports
- relevant code
- migrations
- tests

### STEP 2 --- INSPECT
Inspect:

```
git status
git diff
repository structure
relevant modules
```

### STEP 3 --- PLAN
Create a concise implementation plan.

### STEP 4 --- IMPLEMENT
Implement ONLY the assigned phase.

### STEP 5 --- TEST
Run relevant tests.

### STEP 6 --- BUILD
Run required builds/type checks.

### STEP 7 --- REVIEW
Inspect:

```
git diff
```
for accidental changes.

### STEP 8 --- REPORT
Provide a detailed implementation report.

### STEP 9 --- STOP
Do not automatically continue to the next phase.

---

## 29. PRIMARY AGENT HANDOFF PROTOCOL
When a supporting agent finishes work, it should provide:

```
1. What was changed
2. Files changed
3. Why each file changed
4. Tests run
5. Test results
6. Build results
7. Database changes
8. Known issues
9. Deferred items
10. Conflicts with existing work
11. Exact final verdict
```
The supporting agent must NOT assume its work is accepted into the final
architecture.

The primary agent performs final integration/acceptance.

---

## 30. WHEN AN AGENT MUST STOP
STOP and report if:

- requirements conflict
- existing code contradicts the phase prompt
- another agent has conflicting uncommitted work
- a required business rule is undefined
- a database migration could destroy data
- a requested feature belongs to a later phase
- authentication architecture would need to change
- a transformation rule is missing
- unit conversion is undefined
- a safe implementation cannot be determined
Do not solve uncertainty by inventing business logic.

---

## 31. CURRENT DEVELOPMENT PHILOSOPHY
The project intentionally uses:

```
SMALL PHASE
    ↓
IMPLEMENT
    ↓
VERIFY
    ↓
REPORT
    ↓
PRIMARY AGENT REVIEW
    ↓
NEXT PHASE
```
NOT:

```
Give agent whole project
    ↓
Agent redesigns everything
    ↓
Unknown changes
    ↓
Difficult debugging
```
The first approach is mandatory.

---

## 32. INVENTORY MASTER-DATA PRINCIPLES
Inventory identity currently includes:

```
material
materialType
grade
size
unit
minimumStockLevel
isActive
```
Identity:

```
(material, materialType, grade, size)
```

Master-data strings are normalized by trimming and uppercasing.

No duplicate current-stock source may be introduced.

---

## 33. CURRENT STOCK MOVEMENT PRINCIPLES
Active movement types currently include:

```
STOCK_IN
STOCK_OUT
ADJUSTMENT
```
But an agent must only implement the movement type assigned to its
current phase.

Future types such as:

```
ISSUE
RETURN
CONSUMPTION
TRANSFORMATION_IN
TRANSFORMATION_OUT
```
must not be activated prematurely.

---

## 34. STOCK MOVEMENT INVARIANTS
These invariants must always be protected.

### Invariant 1

```
StockBalance >= 0
```

### Invariant 2
StockTransaction quantity is positive.

### Invariant 3
Transaction type determines movement direction.

### Invariant 4
StockBalance is current operational truth.

### Invariant 5
StockTransaction is historical truth.

### Invariant 6
Stock changes are atomic.

### Invariant 7
Authenticated user is backend-controlled.

### Invariant 8
Transaction timestamp is backend/database-controlled.

### Invariant 9
Frontend cannot submit authoritative balance.

### Invariant 10
Historical transactions are not arbitrarily edited/deleted.

---

## 35. KNOWN SEED DATA LIMITATION
The inventory seed has a known historical limitation:

```
Opening balances may exist without corresponding historical StockTransaction records.
```
Do NOT fabricate:

- fake users
- fake dates
- fake suppliers
- fake business references
to make history look complete.

If a later phase establishes a proper Opening Stock workflow, address
the issue there.

Until then, document rather than fabricate.

---

## 36. FRONTEND PRINCIPLES
Frontend is a user interface, not the authority for business state.

Frontend may:

- validate obvious input
- display current stock
- display role-specific controls
- submit requests
- show server results/errors
Frontend must NOT decide:

- whether stock is available
- final balance
- authorization
- actor identity
- server timestamp

---

## 37. API PRINCIPLES
Prefer dedicated business endpoints over unrestricted generic mutation
endpoints.

Examples:

```
POST /api/inventory/:id/stock-in
POST /api/inventory/:id/stock-out
```
rather than exposing one unrestricted endpoint where clients choose
arbitrary transaction types.

Future business workflows should use controlled domain operations.

---

## 38. DO NOT DUPLICATE BUSINESS LOGIC
Do not implement the same inventory mutation logic separately in:

- controller
- frontend
- multiple services
- multiple endpoints
Prefer one authoritative backend domain operation.

Controllers should remain thin.

Frontend should not reproduce backend stock calculations.

---

## 39. CORRECTNESS FIRST
Do not optimize prematurely.

For inventory:

```
correctness
>
traceability
>
concurrency safety
>
security
>
maintainability
>
performance optimization
```
Do not sacrifice inventory integrity for a micro-optimization.

---

## 40. FINAL AUTHORITY RULE
When agents disagree, priority is:

```
1. Explicit project owner instruction
2. Current approved architecture
3. Latest accepted phase report
4. Project concept/documentation
5. Existing repository implementation
6. Individual agent suggestion
```

An individual AI agent's preference is NOT authoritative.

---

## 41. PRIMARY AGENT IDENTIFICATION
For the current development workflow:

```
PRIMARY:
Antigravity IDE — primary development account/session

SUPPORTING:
Gemini-based terminal/IDE agents
Cursor
VS Code + GitHub Copilot
OpenCode
Other agents explicitly used by the project owner
```
If the project owner changes the primary agent, update this section.

---

## 42. MESSAGE TO EVERY AI AGENT
Before touching this repository, understand:

> You are contributing to an existing production-oriented application
> being developed incrementally by multiple AI agents.

> You are NOT starting a new project.

> Preserve existing work.

> Respect the current phase.

> Do not invent business rules.

> Do not jump ahead.

> Do not overwrite another agent's work.

> Verify your changes.

> Report exactly what you changed.

> Antigravity is currently the primary development/integration authority
> unless the project owner explicitly changes that arrangement.

---

## 43. AGENT STARTUP CHECKLIST
Before coding:

```
[ ] I know which phase I am implementing.
[ ] I read the relevant concept document.
[ ] I read the previous phase report.
[ ] I inspected the current repository.
[ ] I checked git status.
[ ] I checked git diff.
[ ] I understand another agent may have modified the repository.
[ ] I will preserve unrelated changes.
[ ] I will not invent business rules.
[ ] I will not implement future phases.
[ ] I will not change authentication unnecessarily.
[ ] I will not reintroduce Senior Designer.
[ ] I will test my changes.
[ ] I will report failures honestly.
[ ] I will stop after my assigned phase.
```

---

## 44. FINAL RULE

### DO NOT TURN THIS PROJECT INTO A MULTI-AGENT FREE-FOR-ALL.
All agents are contributors.

**Antigravity is the current primary development/integration
authority.**

Every agent must work from the existing repository and accepted project
documentation.

The objective is not for every agent to independently build what it
thinks the application should be.

The objective is:

```
ONE APPLICATION
+
ONE ARCHITECTURE
+
ONE ROADMAP
+
MULTIPLE CONTROLLED CONTRIBUTORS
+
PRIMARY INTEGRATION AUTHORITY
```
This document is intended to be a permanent repository-level instruction
for all future AI coding sessions.
