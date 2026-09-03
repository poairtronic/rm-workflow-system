# RMRIT — Production Workflow & Material Accounting

## Production Capabilities (V1 full role)
Receive material · confirm receipt · partially receive · record consumed qty · record returned qty · record wastage · record damage · record manufacturing error · request additional material · complete production.

## Issue ≠ Receipt (critical distinction)
```
STORES → Issue 10 → ISSUE TRANSACTION
PRODUCTION → Receive 10 → RECEIPT TRANSACTION
```
"Issued" does **not** automatically mean "Received" — these are two separate transaction types.

### Partial Production Receipt
```
Issued = 10, Received = 6 → Receipt Pending = 4
(later) Received = 8 → Pending = 2
```
If 10 are issued but only 6 received, the remaining 4 must stay visible as pending.

## Consumption
Production **manually enters** actual consumed quantity — the system never guesses it.
```
Received = 500 KG, Consumed = 400 KG (user-entered)
```

## Return
```
Received = 500, Consumed = 400, Returned = 100
Unaccounted = Received - Consumed - Returned = 0
```

### Validation Rule (server-side, hard constraint)
```
Consumed + Returned <= Total Received   (else flag as INVALID)
e.g. Received=500, Consumed=450, Returned=100 → 550 > 500 → REJECT
```

### Do Not Auto-Assume Consumption
If Returned=100 is entered but Consumed is left blank, the system must **not** silently infer Consumed=400. It must show:
```
Received = 500, Returned = 100, Consumed = "Not Entered", Unaccounted = 400
```
Preserve the distinction between **actual user-entered values** and **calculated values** — essential for audit integrity.

## Return Confirmation Workflow (two-step, prevents unilateral claims)
```
Production: Enter Return → Submit Return
     ↓
Stores: Confirm Return → Return Confirmed
```
Production alone cannot claim material was returned — Stores must confirm.

## Exception Types (each is its own transaction record)
| Type | Meaning |
|---|---|
| Normal consumption | Material normally used in production |
| Wastage | Material lost during the process |
| Damage | Material physically damaged |
| Manufacturing error | Material lost/rejected due to a production mistake |
| Additional requirement | New material needed to continue production |

Each exceptional event records: type, quantity, reason, remarks, created by, date/time, SC, RM item.

## Complete Material Accounting Examples

### Simple case
```
Original Required = 500 KG
Issue #1 = 500 KG, Receipt #1 = 500 KG
Consumed = 400 KG, Returned = 100 KG
→ Unaccounted = 0 KG
```

### With additional material
```
Original Requirement       500 KG
Additional Requirement     100 KG
Total Requirement          600 KG

Total Issued               600 KG
Total Received              600 KG

Consumed                    480 KG
Returned                     70 KG
Wastage                      50 KG

Accounted                   600 KG
Unaccounted                    0 KG
```

## Quantity Architecture (per RM item, full chain)
```
Original Required Qty
  + Additional Requested Qty
  = Total Requirement
    → Total Issued
      → Total Received
        → Consumed / Returned / Wasted / Damaged / Error
          → Remaining / Unaccounted
```
Definitions:
- **Required** — what Design originally requested.
- **Additional Requested** — what Production subsequently requested.
- **Issued** — what Stores physically issued.
- **Received** — what Production confirmed receiving.
- **Consumed** — what Production actually consumed.
- **Returned** — what Production returned **and Stores confirmed**.
- **Wastage/Damage/Error** — exceptional material usage/loss.

## Production Completion & SC Reopening
```
Production clicks "Complete Production" →
  Production Status = COMPLETED
  Completed By = Production User
  Completed At = server timestamp
  Remarks = production remarks
  → Email notification generated
  → SC = CLOSED
```
If, **after** material was fulfilled, Production needs more material, the SC becomes ACTIVE again (Additional Request → Stores Issue → Production Receive → Continue → Complete → SC CLOSED). **SC closure only happens when Production explicitly clicks Complete.**
