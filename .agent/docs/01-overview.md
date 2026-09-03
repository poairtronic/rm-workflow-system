# RMRIT — Overview & Business Objective

> Status: V1 System Definition
> App name: RMRIT (temporary — must be configurable/rebrandable later)

## What RMRIT Is

RMRIT is a **workflow and material traceability application**, NOT an inventory-management application. It does not track stock balances — Stores determines physical availability manually using their existing external process.

## Core Problem

Current Raw Material (RM) process is 100% paper-based:
Design prepares RM list → Senior Design verifies → Stores checks stock & issues → Production receives, consumes/returns/wastes, may request more → Production completion.

## Core Lifecycle

```
Customer → PO/Job → SC/Component → RM List Creation → Senior Designer Verification
→ Stores Availability Check → Material Issue → Production Receipt
→ Production Consumption / Return → Additional Material Request (if needed)
→ Production Completion → SC CLOSED
```

## Most Important Design Principle

**PO is the parent/reference grouping. SC is the actual workflow and completion unit.**

```
PO-001
 ├── SC-001 → Completed   (closes independently)
 ├── SC-003 → In Production
 └── SC-005 → Pending
```

There is **no requirement to close the entire PO** — SC closure is independent.

## Primary Objective

Eliminate unnecessary physical paper movement between Design, Senior Design, Stores, Production, and Management — replace with a controlled digital workflow.

## Secondary Objectives

- Complete RM traceability
- Elimination of manual paper RM lists
- Clear responsibility at every workflow stage
- Near-real-time status visibility (polling-based, not literally real-time)
- Automatic notifications (email + in-app)
- Automatic quantity calculations (server-side, authoritative)
- Complete transaction history (append-only, never overwritten)
- Production material accountability
- Identification of pending / extra / wasted / damaged / errored material
- SC-level production completion
- Management analytics
- Complete audit history
- Architecture that can support future workflows (procurement, accounts, costing, dispatch)

## Final Business Vision (in one sentence)

> Create a complete digital chain of custody for raw materials from Design requirement to production completion.

For any SC, the system must be able to answer: what was requested, who created/approved it, what changed and why, what Stores issued, what Production received/consumed/returned, what was lost (and why), whether more material was needed (and why), when production completed, and who performed every single action.

## V1 Scope Boundary — Explicitly Excluded

Do NOT build in V1 (architecture should allow adding later):

- Full inventory management / automatic stock deduction
- Procurement management (a `ProcurementOrder` concept existed in the original design — **removed from active V1 workflow**)
- Accounts, costing, finance approval
- Quality workflow, machine management, production scheduling/planning
- Finished goods management, dispatch, customer delivery
- ERP integration

See `10-source-doc-corrections.md` for inconsistencies found in the original requirement text and how they were resolved.
