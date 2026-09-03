# Stores Workflow & Material Issuance

## 1. Availability Inspection

Stores Manager views pending verified requests and determines stock availability manually from physical stores.

## 2. Issuance Actions

- **Full Issue**: All required items issued $\longrightarrow$ Status becomes `ISSUED`.
- **Partial Issue**: Only available items issued $\longrightarrow$ Status becomes `PARTIALLY_ISSUED`, pending items remain flagged with `⚠ Pending`, and an alert is sent to Senior Management.
- **Batch Tracking**: Stores attaches Heat Numbers / Batch IDs to issued line items.
