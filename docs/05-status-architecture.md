# RMRIT — SC Status & Item Status Architecture

## SC Completion Model

SC is the completion unit, independent per SC within a PO:

```text
PO-001
  SC-001 → COMPLETED ✓
  SC-003 → IN PRODUCTION
  SC-005 → STORES_PENDING
```

No PO-level "production completion" concept exists in RMRIT.

## Streamlined SC Status State Machine

```text
DRAFT
 → SUBMITTED / STORES_PENDING
 → PARTIALLY_ISSUED
 → ISSUED
 → RECEIVED (PRODUCTION_RECEIPT_PENDING)
 → IN_PRODUCTION
     └── ADDITIONAL_REQUEST → STORES_PENDING → ISSUED → IN_PRODUCTION
 → COMPLETED
```

## Do NOT Rely on a Single Status Field

The SC-level status is a rollup; **item-level status must be calculated and tracked separately**, because items within one SC can be in different states simultaneously:

```text
SC-001
  Material A → Fully issued
  Material B → Pending Shortage
  Material C → Fully issued
  Material D → Partial
→ SC itself shows PARTIALLY_ISSUED, but each RM item carries its own granular ledger state.
```
