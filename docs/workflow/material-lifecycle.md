# Material Accounting Lifecycle & Sequence of Transactions

## 1. PO vs. SC Structural Independence

A single Purchase Order context (e.g. `PO-100`) contains multiple independent Sales Order Components (SCs). Each SC owns its own RM specification and completes on its own timeline:

```text
                     PO-100 (Commercial Reference)
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
     SC-001          SC-002          SC-003
        │               │               │
        ↓               ↓               ↓
     RM List         RM List         RM List
        │               │               │
        ↓               ↓               ↓
    COMPLETED      IN PROGRESS    STORES_PENDING
```

---

## 2. Material Movement as an Append-Only Transaction Sequence

Material control is **not a single mutable number**. It is an append-only sequence of immutable transactions preserving the entire shop-floor history:

```text
[ RM Required & Submitted by Designer: 500 kg ]
          ↓
[ Stores Initial Issue: 500 kg ] (Batch #HT-4482)
          ↓
[ Production Confirmed Receipt: 500 kg ]
          ↓
[ Production Consumed: 400 kg ]
          ↓
[ Production Returned: 100 kg ] (Awaiting Store Ack)
          ↓
[ Additional Request: 50 kg ] (Reason: Tool Defect / Scrap)
          ↓
[ Stores Additional Issue: 50 kg ] (Batch #HT-4490)
          ↓
[ Production Receipt & Machining Complete ]
          ↓
[ SC Closed with Full Material Ledger ]
```

---

## 3. Core Accounting Reconciliation Formulas

$$\text{Total Available Issue} = \text{Initial Issued Qty} + \text{Additional Issued Qty}$$

$$\text{Net Material Consumed} = \text{Total Available Issue} - \text{Returned Qty}$$

$$\text{Unaccounted Scrap Balance} = \text{Total Available Issue} - (\text{Reported Consumed} + \text{Reported Returned})$$

$$\text{Pending Store Shortage} = \text{Design Required Qty} - \text{Cumulative Issued Qty}$$
