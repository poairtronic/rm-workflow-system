# RMRIT Backend Domain Architecture & Module Map

This document connects every backend domain module in `backend/src/` directly to the core manufacturing business requirements and workflow invariants.

---

## 1. Context & Hierarchy Modules

### `customers`

- **Business Domain**: Client & Industrial Partner Master Data.
- **Role**: Maps `Customer -> Product -> PO/SC`.

### `po` (Purchase Order)

- **Business Rule**: POs originate from external ERP / commercial systems. RMRIT does not necessarily create POs from scratch; instead, entering a PO number opens the digital workflow context (e.g. `PO-100`).
- **Inviolable Principle**: A PO is purely a grouping reference, not the completion unit.

### `sc` (Sales Order Component)

- **Core Workflow Unit**: The SC is the fundamental operational and completion unit in RMRIT.
- **Independent Closure Rule**:
  ```text
  PO-100
   ├── SC-001 → Completed ✓  (closes independently)
   ├── SC-002 → In Production
   └── SC-003 → Stores Pending
  ```
  The system **never** marks a PO closed just because one SC completes.

### `rm` (Raw Material Requirements)

- **Business Domain**: Technical dimensional definitions for raw materials.
- **Attributes**: `Grade`, `Material Type`, `Size / Profile`, `Required Qty`, and profile-specific optional dimensions (`Diameter Ø`, `Length`, `Width`, `Thickness`, `Unit Weight`).
- **Immutability Rule**: The original design RM requirement quantity is immutable once approved.

---

## 2. Core Operational Workflow Modules

### `verification` (Senior Design Review)

- **Business Flow**: Design submits RM list $\longrightarrow$ Senior Manager verifies.
- **Permitted Actions**:
  - `Approve`: Advances SC to `STORES_PENDING`.
  - `Edit & Approve`: Records major revision log with reasons before advancing.
  - `Reject / Send Back`: Returns SC to Designer with rejection notes.

### `stores` vs. `material-issue` (Role vs. Transaction)

- **`stores` (Role & Department)**: Handles inventory availability checks, viewing pending requests across all active SCs, and queue prioritization.
- **`material-issue` (Transaction Engine)**: Handles the append-only material movement transaction (recording issued quantities, heat/batch numbers, full/partial issue flags, and issuing user).

### `production`

- **Responsibilities**:
  1. Confirm receipt of issued material.
  2. Log material consumption.
  3. Log physical material return to Stores.
  4. Initiate additional material requests if shortage occurs.
  5. Mark SC production complete.

### `material-movement` (The Accounting Ledger)

- **Core Formula**:
  $$\text{Initial Issue} + \text{Additional Issue} - \text{Returned} = \text{Consumed}$$
- **Entry Flexibility Rule**: Operators can enter consumed quantity directly and/or enter returned quantity directly. The backend computes and validates unaccounted scrap/shortage balances authoritatively.

### `additional-request`

- **Workflow**: Production initiates request with reason code $\longrightarrow$ Stores issues material $\longrightarrow$ Production receives $\longrightarrow$ Senior Manager receives an immediate notification.

---

## 3. Governance & System Modules

### `notifications`

- **Centralized Event-Driven Triggers**:
  - Design submitted $\longrightarrow$ Stores notified.
  - Stores issued $\longrightarrow$ Production notified.
  - Partial issue occurred $\longrightarrow$ Senior Manager notified.
  - Additional request created $\longrightarrow$ Stores & Senior Manager notified.

### `audit` (Immutable Timeline & Compliance)

- **Purpose**: Fully replaces manual paper forms with an immutable digital chain of custody answering: **Who did what, when?**
- **Example Trace**:
  ```text
  SC-003 Audit Trail
  09:15  Design submitted RM list      User: Design01
  10:05  Senior verified               User: Senior01
  11:20  Stores issued material        User: Store01
  12:00  Production received           User: Production02
  16:30  Production consumed material  User: Production02
  17:00  Production returned material  User: Production02
  17:10  SC completed                  User: Production02
  ```

### `analytics`

- **Scope**: Aggregates SC cycle times, material yield efficiency, scrap percentages, and delay bottlenecks across departments without altering operational data.
