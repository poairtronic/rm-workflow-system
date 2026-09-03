# Architectural Invariants: PO vs SC & Transactional Material Lifecycle

## 1. PO vs. SC Hierarchy (SC Independence)

### Inviolable Structural Model

A Purchase Order (PO) is an external commercial envelope containing one or more Sales Order Components (SCs). Every SC owns its own independent RM List and advances through the manufacturing lifecycle at its own pace.

```text
                     PO-100 (Commercial Reference)
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
     SC-001          SC-002          SC-003
  (Spindle Part)   (Shaft Bush)    (End Flange)
        │               │               │
        ↓               ↓               ↓
     RM List         RM List         RM List
   (EN31 Ø110)     (MS Plate 25)   (OHNS Ø75)
        │               │               │
        ↓               ↓               ↓
    COMPLETED      IN PROGRESS       PENDING
```

### Prohibited Anti-Pattern

```text
❌ INCORRECT:
PO-100  ──► One Combined RM List ──► One Global Completion
```

_Why this is prohibited_: In real shop-floor operations, components have different machining times, distinct raw materials, and separate delivery batches. Merging them into a single PO-level completion breaks operational reality.

---

## 2. Material Lifecycle as an Append-Only Transaction Sequence

Material control is **not a mutable scalar counter** (e.g., `balance = 500`). It is an immutable, append-only **sequence of domain events and physical handshakes**.

### Example Transaction Sequence for SC-001

$$ \begin{matrix}
\textbf{Step} & \textbf{Event / Transaction} & \textbf{Quantity} & \textbf{Cumulative Issued} & \textbf{Net Balance / State} \\
\hline
\text{1.} & \text{RM Requirement Approved} & 500\text{ kg} & - & \text{Required: } 500\text{ kg} \\
\text{2.} & \text{Stores Initial Issue} & 500\text{ kg} & 500\text{ kg} & \text{Issued to Shop Floor} \\
\text{3.} & \text{Production Physical Receipt} & 500\text{ kg} & 500\text{ kg} & \text{Acknowledged at Machine} \\
\text{4.} & \text{Machining Consumption} & 400\text{ kg} & 500\text{ kg} & \text{Consumed in Production} \\
\text{5.} & \text{Physical Material Return} & 100\text{ kg} & 500\text{ kg} & \text{Returned to Stores} \\
\text{6.} & \text{Additional Request (Tool Breakage)} & 50\text{ kg} & 500\text{ kg} & \text{Pending Stores Allocation} \\
\text{7.} & \text{Stores Additional Issue} & 50\text{ kg} & 550\text{ kg} & \text{Issued to Shop Floor} \\
\text{8.} & \text{Production Receipt & Consumption} & 50\text{ kg} & 550\text{ kg} & \text{Total Consumed: } 450\text{ kg} \\
\text{9.} & \text{SC Production Complete} & - & 550\text{ kg} & \textbf{SC Closed with Full Trace}
\end{matrix}$$

---

## 3. Database & API Implementation Rules

1. **SC Foreign Key Attachment**: All material requirements (`rm_requirements`), issues (`material_issues`), receipts (`production_receipts`), and returns (`material_returns`) MUST point to `sc_id`.
2. **Never Overwrite Historical Records**: When an additional 50 kg is issued, insert a new `MaterialIssue` row linked to the `AdditionalMaterialRequest` rather than updating the initial 500 kg row.
3. **Traceability Ledger**: Every transaction captures:
   - `actor_id` (User ID of Designer, Stores Manager, or Operator)
   - `timestamp` (Server-generated UTC ISO timestamp)
   - `transaction_type` (`INITIAL_ISSUE`, `ADDITIONAL_ISSUE`, `RECEIPT`, `CONSUMPTION`, `RETURN`)
   - `batch_or_heat_number` (Physical traceability tag)
   - `remarks` (Reason codes, condition notes)
$$
