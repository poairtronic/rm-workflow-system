# Workflow-First Architecture Principle

## The Core Invariant

> **"The application is a workflow system first. The page is only the presentation of the workflow; the workflow itself is the core."**

---

## What This Means in Practice

### Anti-Pattern: Page-Centric Design (DO NOT DO THIS)

```text
pages/
├── dashboard/        # Bloated with direct state, API calls, and calculations
├── stores/
├── production/
├── rm-form/
└── report/
```

**Why this fails**: In a manufacturing execution system, state transitions (e.g. `STORES_PENDING -> ISSUED -> RECEIVED -> IN_PRODUCTION`) span multiple roles, widgets, dialogs, and notifications. Bundling capabilities into pages creates monolithic files, duplicated calculations, and brittle routing.

---

### Correct Pattern: Capability-Centric Feature Modules (DO THIS)

```text
frontend/src/features/
├── rm/                    # RM specification, dimensional validations, list creation
├── verification/          # Senior review, approval, and rejection
├── stores/                # Inventory availability inspection
├── material-issue/        # Issuance transaction & batch allocation
├── production/            # Physical receipt, consumption, and return handshakes
├── material-movement/     # Authoritative accounting ledger
├── additional-request/    # Defect/shortage extra material workflow
└── admin/                 # User governance

frontend/src/pages/        # Thin shell wrappers that compose features
├── DashboardPage.tsx      # Mounts <WorkflowSummaryWidget>, <ActiveScQueue>, etc.
└── NotFoundPage.tsx
```

---

## Architectural Rules for Agents

1. **Pages Are Thin Compositions**:
   A `Page` component under `src/pages/` or `src/features/<feature>/pages/` should contain minimal code (typically 20–50 lines). Its sole responsibility is layout placement and delegating props to feature components and hooks.
2. **Domain Boundaries Dictate Code Placement**:
   - Logic relating to raw material dimensions belongs in `features/rm/`.
   - Logic relating to issuing material belongs in `features/stores/` or `features/material-issue/`.
   - Logic relating to consumption/scrap calculations belongs in `features/material-movement/` and `features/production/`.
3. **Reusable Across Touchpoints**:
   Because capability logic lives in `features/<feature>/hooks` and `services`, the same material issue modal or status badge can be embedded in a mobile shop-floor tablet view, an executive dashboard drawer, or an audit timeline without rewriting logic.
