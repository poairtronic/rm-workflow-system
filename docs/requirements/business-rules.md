# RMRIT Authoritative Business Rules (Single Source of Truth)

This document is the authoritative **Single Source of Truth (SSOT)** for all business logic, workflow constraints, data invariants, and permissions in the RMRIT application.

---

## 1. PO & SC Hierarchy Rules

### `RULE-001`: PO Origin

The Purchase Order (PO) already exists in an external commercial or ERP system. RMRIT does not create PO financial contracts from scratch.

### `RULE-002`: PO Input

RMRIT accepts the external PO Number as input to open the operational manufacturing workflow context.

### `RULE-003`: One-to-Many PO $\rightarrow$ SC Relation

One Purchase Order (PO) can contain multiple Sales Order Components (SCs), each representing a distinct component or assembly drawing.

### `RULE-004`: Single SC RM List Entry

Raw Material (RM) requirements can be created and submitted for a single individual SC.

### `RULE-005`: Entire PO RM List Entry

Raw Material (RM) requirements can also be created and submitted in bulk for an entire PO.

### `RULE-006`: Multi-SC Bulk Submissions

An entire PO RM submission may contain multiple SCs, each with its own independent material lines.

### `RULE-007`: Independent SC Completion

SC completion is completely independent. Each SC progresses through Design $\rightarrow$ Stores $\rightarrow$ Production $\rightarrow$ Completion on its own timeline.

### `RULE-008`: No PO-Level Completion Gate

A PO does **not** need to be completed for an individual SC to be completed and closed. The system must never block an SC from closing because sibling SCs under the same PO are still in progress.

---

## 2. Stores & Material Allocation Rules

### `RULE-009`: Unavailable Material Becomes Pending

Any material requested in an approved RM list that is physically unavailable in Stores automatically becomes `Pending` with a `⚠ Shortage / Pending` marker.

### `RULE-010`: Partial & Full Issuance

Stores can issue available materials immediately without waiting for unavailable materials to arrive. Available line items advance to `Issued`, while unavailable items remain `Pending`.

---

## 3. Production & Accounting Rules

### `RULE-011`: Production Receipt Confirmation

Production must explicitly confirm physical receipt of issued raw materials before machining begins (Status: `RECEIVED` $\rightarrow$ `IN_PRODUCTION`).

### `RULE-012`: Direct Consumed Quantity Entry

Production operators can enter actual consumed material quantities directly.

### `RULE-013`: Direct Returned Quantity Entry

Production operators can enter physical returned unused material quantities directly.

### `RULE-014`: Open Lifecycle for Additional Requests

Any Additional Material Request initiated by Production due to defect, error, or tool breakage remains active and open until fulfilled by Stores and confirmed received by Production.

---

## 4. Notifications, Audit & System Invariants

### `RULE-015`: Senior Management Alerts

The Senior Design Manager receives immediate workflow notifications on shortages, rejections, partial store issues, and additional material requests.

### `RULE-016`: Traceable Material Movement Ledger

Every material movement (initial issue, extra issue, receipt, consumption, return, scrap) must be recorded in an immutable append-only ledger answering **Who, What, and When**.

### `RULE-017`: SC Completion Timestamp

SC completion permanently captures the exact server timestamp and closing operator identity upon sign-off.

### `RULE-018`: SC Completion Remarks

SC completion captures mandatory operator remarks and final material reconciliation notes.

---

## Summary Matrix

| Rule ID      | Category    | Summary                                              |
| :----------- | :---------- | :--------------------------------------------------- |
| **RULE-001** | Hierarchy   | PO exists in external ERP system.                    |
| **RULE-002** | Hierarchy   | RMRIT accepts PO number as input context.            |
| **RULE-003** | Hierarchy   | One PO contains multiple SC components.              |
| **RULE-004** | RM Creation | RM can be entered for a single SC.                   |
| **RULE-005** | RM Creation | RM can be entered for an entire PO.                  |
| **RULE-006** | RM Creation | Bulk PO submission supports multiple SC item groups. |
| **RULE-007** | Lifecycle   | SC completion is strictly independent.               |
| **RULE-008** | Lifecycle   | PO does not gate SC completion.                      |
| **RULE-009** | Stores      | Unavailable stock automatically marked as Pending.   |
| **RULE-010** | Stores      | Stores issues available materials immediately.       |
| **RULE-011** | Production  | Production confirms receipt before machining.        |
| **RULE-012** | Accounting  | Production can enter consumed quantity directly.     |
| **RULE-013** | Accounting  | Production can enter returned quantity directly.     |
| **RULE-014** | Exceptions  | Additional requests remain open until fulfilled.     |
| **RULE-015** | Governance  | Senior Manager receives event-driven alerts.         |
| **RULE-016** | Compliance  | Material movement is immutable and traceable.        |
| **RULE-017** | Closure     | SC completion captures closing date/time.            |
| **RULE-018** | Closure     | SC completion captures final closing remarks.        |
