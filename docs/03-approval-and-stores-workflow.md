# RMRIT — Direct Design to Stores Workflow

## Design & Direct Handover Workflow

The Designer authors and submits the Raw Material (RM) requirements for each SC directly to Stores:

- **Direct Submission**: Designer submits RM specifications (`material`, `type`, `grade`, `size`, `quantity`, `weight`).
- **Status Transition**: Moves from `DRAFT` $\to$ `SUBMITTED` / `STORES_PENDING`.
- **No Approval Gate**: There is **no intermediate Senior Designer review, revision, approval, or rejection step**.
- **Revision History**: If a designer revises dimensional requirements after initial draft, snapshots are recorded in `rm_item_snapshots` retaining original vs revised values for full traceability.

## Stores Workflow

Stores checks physical stock availability and records issues:

```text
For each RM item:
Required = 10
  ├── YES available → Issue (Status: ISSUED)
  └── NO  available → Shortage (Status: PARTIALLY_ISSUED / Pending)
```

### Multiple Issues (append-only, never overwrite)

Stores can issue material across several transactions; all are retained individually in `material_issues` and `material_issue_items`:

```text
Required = 100
Issue #1 = 50
Issue #2 = 30
Issue #3 = 20
Total Issued = 100   (Issue #1 is never overwritten by #2, etc.)
```

## Additional Material Workflow (Alert-Driven, No Approval Gate)

When Production discovers material defects, tool damage, or scrap on the shop floor:

1. Production creates an `Additional Material Request` specifying requested quantity and reason (`DAMAGE`, `WASTAGE`, `MANUFACTURING_ERROR`, `ADDITIONAL_REQUIREMENT`, `OTHER`).
2. Stores reviews the additional request and issues extra material as an `ADDITIONAL_ISSUE` transaction.
3. Senior Manager & General Manager receive instant telemetry alerts for scrap oversight without blocking dispatch.
