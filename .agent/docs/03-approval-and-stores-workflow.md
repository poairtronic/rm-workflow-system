# RMRIT — Senior Designer Approval & Stores Workflow

## Senior Designer Workflow
The Senior Designer has significant authority over a submitted RM. They can:
view full RM · edit quantity · edit material grade/type · edit size · add materials · remove materials · change other RM info · approve · reject (with reason).

### Revision Tracking (mandatory for major changes)
Every major change must retain: **original value, new value, changed by, changed date/time, reason.** The original information must never simply disappear.

```
Original: EN31 Ø50×25 Qty=10
Senior changes to: EN31 Ø50×30 Qty=12
→ Both versions retained, tagged with who/when/why.
```
This is consistent with a `StatusHistory` / `ApprovalLog` style audit model.

## Stores Workflow
**RMRIT is not the company's inventory system.** Stores manually determines availability using their existing external stock process — RMRIT only records the workflow decision. No stock balance is maintained by RMRIT in V1.

```
For each RM item:
Required = 10
  ├── YES available → Issue
  └── NO  available → Pending
```

### Multiple Issues (append-only, never overwrite)
Stores can issue material across several transactions; all must be retained individually.
```
Required = 100
Issue #1 = 50
Issue #2 = 30
Issue #3 = 20
Total Issued = 100   (Issue #1 must never be overwritten by #2, etc.)
```

### Partial Issue
```
Required = 100, Available = 60
Issued = 60, Pending = 40
Pending = Required - Total Issued   (server-calculated)
```

### Extra Issue
Stores can issue more than requested; the system must calculate and highlight the excess for management visibility.
```
Required = 100, Issued = 105 → Extra = 5 (flagged)
```

### New / Unlisted Material from Production
If Production needs a material that was never on the original RM (e.g. original had EN31/OHNS, Production now needs MS Ø100×20), this is always an **Additional Material Request**, never an edit to the original RM.

### Stores Pending State
```
Required = 50, Available = 0 → Status = PENDING
```
V1 does **not** manage procurement — the original design's `ProcurementOrder` concept is intentionally out of the active V1 workflow (may return in V3+).

## Additional Material Workflow (no Senior Manager approval step — alert only)
```
PRODUCTION → Additional Material Request → STORES → Issue → PRODUCTION → Receive → CONTINUE PRODUCTION
```
Senior Manager receives an alert/notification but does **not** need to approve this request.
