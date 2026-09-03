# Stores Workflow & Material Issuance

## 1. Availability Inspection

Stores Manager views submitted RM requests (`STORES_PENDING`) and determines stock availability manually from physical stores.

## 2. Issuance Actions

- **Full Issue**: All required items issued $\longrightarrow$ Status becomes `ISSUED`.
- **Partial Issue**: Only available items issued $\longrightarrow$ Status becomes `PARTIALLY_ISSUED`, pending items remain flagged with `⚠ Pending`, and an automated shortage alert is dispatched to Management.
- **Batch Tracking**: Stores attaches Heat Numbers / Batch IDs to issued line items.
- **Return Acknowledgment**: When Production returns surplus or scrap material, Stores inspects physical items and records acknowledgment on the return slip.
