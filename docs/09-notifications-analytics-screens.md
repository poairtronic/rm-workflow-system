# RMRIT — Notifications, Analytics, Dashboards & Screens

## Notification Architecture (event-driven)

```
Workflow Event → NestJS Event Handler → Notification DB (permanent record) + Gmail API
                                              ↓                    ↓
                                        In-App Inbox            Email
```

Trigger map:

- RM submitted → Senior Designer notified
- Senior approves → Stores + Junior notified
- Stores issues → Production + Senior Manager notified
- Production receives → Senior Manager + relevant users notified
- Additional request → Stores + Senior Manager notified
- Production completion → Email to Senior Manager + relevant Design/Stores users

## Analytics Architecture

Never manually entered — always **calculated from transaction records**, at two levels:

- **SC level** (e.g. PO-001/SC-001 complete material history)
- **PO grouping level** (e.g. PO-001 → SC-001 ✓, SC-003 🔄, SC-005 ⏳) — useful for management view; SC remains the actual workflow unit.

Per-SC analytics fields:

- RM: item count, original qty, additional qty, total requirement
- Stores: total issued, pending, partial issues, extra issues, issue count
- Production: total received, consumed, returned, wastage, damage, manufacturing error, unaccounted
- Timing: RM created, submitted, approved, stores started, first issue, last issue, production first receipt, production completion

### Timing Formulas

```
Senior Review Time        = Approved At - Submitted At
Stores Processing Time    = First Issue At - Approved At
Production Receipt Time   = First Receipt At - First Issue At
Production Duration       = Completed At - First Production Start
```

(Exact business interpretation to be refined later; built on `StatusHistory`.)

## Dashboards

### Senior Manager Dashboard

Total Active SCs · Awaiting Senior Review · Awaiting Stores · Partially Issued · Production · Additional Material · Material Discrepancies · Production Completed.

### Stores Dashboard

Approved RM · Stock Check Required · Partial Issue · Pending Material · Production Receipt Pending · Return Confirmation.

### Junior Designer Dashboard

My RM Requests broken down by: Draft / Senior Review / Rejected / Approved / Stores Pending / Partially Issued / Production / Completed.

### Production Dashboard

Material to Receive · Partially Received · In Production · Additional Request · Return Pending · Ready to Complete.

## Screens (V1)

1. **Login** — email, password.
2. **Junior Dashboard** — My RM Requests (Draft/Pending/Rejected/Approved/Production/Completed), New RM button.
3. **New RM flow** —
   - Step 1: PO Number, Customer, RM Type (Individual SC / Entire PO)
   - Step 2: SC Number(s)
   - Step 3: Material table
4. **RM Table UI** — columns: S.No, Material, Size, Qty, Length, Width, ... ; buttons: `+ Add Material`, `+ Add SC`, `Save Draft`, `Submit`.
5. **Senior Review Screen** — Original RM → Editable RM → Change History; buttons: Approve, Reject, Save Changes (reason required for major changes).
6. **Stores Screen** — per material: Required/Issued/Pending + `[Issue]` button; extra issues flagged (⚠).
7. **Production Screen** — table of Material/Issued/Received/Consumed/Returned; actions: Receive, Enter Consumption, Enter Return, Report Exception, Request Additional Material, Complete Production.
8. **Senior Manager Analytics** — PO, SC, Customer, RM Status, Stores Status, Production Status, Pending Qty, Extra Qty, Returned Qty, Wastage, Additional Material, Processing Time, with drill-down.

## Digital Audit Trail — What Every Action Must Answer

`WHO? · WHAT? · WHEN? · WHICH SC? · WHICH MATERIAL? · OLD VALUE? (if modified) · NEW VALUE? (if modified) · WHY? (reason/remarks where required)`

Example full-day audit trail for one SC:

```
09:10 Junior created RM
09:25 Junior submitted RM
10:05 Senior modified Qty 10 → 12
10:07 Senior approved
10:15 Stores checked stock
10:20 Stores issued 8
10:21 Production notified
11:00 Production received 8
14:00 Stores issued remaining 4
14:20 Production received 4
15:00 Production consumed 10
15:10 Production returned 2
16:30 Production completed → SC-001 CLOSED
```

## Future Extensibility (post-V1, architecture should allow but not implement)

```
SC CLOSED → Accounts Verification → Cost Verification → Production Time
          → Quality Inspection → Finished Product → Dispatch → Customer Delivery
```

V1 deliberately stops at `PRODUCTION COMPLETED → SC CLOSED` — workflow first, not a full ERP.
