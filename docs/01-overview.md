# RMRIT — Overview & Business Objective

> Status: V1 System Definition
> App name: RMRIT

## What RMRIT Is

RMRIT is a **workflow and material traceability application**, NOT an inventory-management application. It coordinates raw-material workflow from Design through Stores and Production.

## Core Problem

Current Raw Material (RM) process is 100% paper-based:
Design prepares RM list → Stores checks stock & issues → Production receives, consumes/returns/wastes, may request more → Production completion.

## Core Lifecycle

```text
Customer → PO Context → SC Component → RM List Creation
→ Direct Stores Handover → Availability Check → Material Issue → Production Receipt
→ Production Consumption / Return → Additional Material Request (if needed)
→ Production Completion → SC CLOSED
```

## Most Important Design Principle

**PO is the external commercial reference grouping. SC is the actual workflow and completion unit.**

```text
PO-001
 ├── SC-001 → Completed   (closes independently)
 ├── SC-003 → In Production
 └── SC-005 → Stores Pending
```

There is **no requirement to close the entire PO** — SC closure is strictly independent.

## Primary Objective

Eliminate unnecessary physical paper movement between Design, Stores, Production, and Management — replace with an immutable digital workflow.
