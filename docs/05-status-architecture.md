# RMRIT — SC Status & Item Status Architecture

## SC Completion Model
SC is the completion unit, independent per SC within a PO:
```
PO-001
  SC-001 → COMPLETED ✓
  SC-003 → IN PRODUCTION
  SC-005 → PENDING
```
No PO-level "production completion" concept exists (or is needed) in V1.

## Recommended SC Status State Machine
```
DRAFT
 → SUBMITTED
 → PENDING_SENIOR_REVIEW
     ├── REJECTED → REVISION_REQUIRED → SUBMITTED
     └── APPROVED
 → STORES_PENDING
 → PARTIALLY_ISSUED
 → FULLY_ISSUED
 → PRODUCTION_RECEIPT_PENDING
 → PRODUCTION_IN_PROGRESS
     └── ADDITIONAL_MATERIAL_REQUESTED → STORES_PENDING → ISSUED → PRODUCTION_IN_PROGRESS
 → PRODUCTION_COMPLETED
 → CLOSED
```

## Do NOT Rely on a Single Status Field
The SC-level status is a rollup; **item-level status must be calculated and tracked separately**, because items within one SC can be in different states simultaneously:
```
SC-001
  Material A → Fully issued
  Material B → Pending
  Material C → Fully issued
  Material D → Partial
→ SC itself shows PARTIALLY_ISSUED, but each RM item carries its own state.
```
This matches the original design's item-level granularity principle.

## Recommended Item-Level Statuses
```
PENDING
PARTIALLY_ISSUED
FULLY_ISSUED
PARTIALLY_RECEIVED
FULLY_RECEIVED
CONSUMPTION_PENDING
RETURN_PENDING
COMPLETED
```
These should be **calculated from transaction data wherever possible**, not manually selected by a user — this keeps status trustworthy and consistent with the server-side calculation rule (see `04-production-workflow-and-accounting.md`).
