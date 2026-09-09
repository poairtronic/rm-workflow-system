# DOMAIN DATA OWNERSHIP & RELATIONSHIPS

**Status: FINAL PHASE 2.4 DESIGN**

## 1. Domain Ownership
The system is divided into strict domains. Each domain is exclusively responsible for its bounded data models. 

### Auth & System Domain
- `User`: Managed by Admin.
- `Role`: Managed by Admin.

### Core Business Domain (Schedule)
- `PO Reference`: Top-level grouping entity. Managed by Admin/Design.
- `SC (Sub-Contract)`: The core workflow unit. Managed by system lifecycle/Production.

### RM (Raw Material) Domain
- `RM Request`: Authored by Designer. Owned by Designer until submitted.
- `RM Item`: Individual material lines belonging to the RM Request.

### Inventory Domain
- `InventoryItem`: The master catalog of materials. Owned by Stores.
- `StockBalance`: The current aggregated stock. Owned strictly by Inventory Engine.
- `StockTransaction`: The immutable ledger of movements. Owned strictly by Inventory Engine.

### Stores / Material Issue Domain
- `Material Issue`: The transaction grouping for an issue event. Owned by Stores.
- `Material Issue Item`: The specific line-item quantities issued against an RM Item. Owned by Stores.

### Production Domain
- `Production Receipt`: Record of Production accepting issued material. Owned by Production.
- `Material Consumption`: Record of material consumed. Owned by Production.
- `Material Return`: Record of unused material returned. Initiated by Production, confirmed by Stores.
- `Additional Material Request`: Separate RM workflow initiated by Production. Owned by Production.
- `SC Completion`: Final status log for an SC. Owned by Production.

## 2. Entity Relationships

**Hierarchy (One-to-Many):**
- `PO Reference` **(1) — (N)** `SC`
- `SC` **(1) — (N)** `RM Request`
- `RM Request` **(1) — (N)** `RM Item`
- `SC` **(1) — (N)** `Additional Material Request`

**Material Traceability (One-to-Many):**
- `InventoryItem` **(1) — (N)** `RM Item` (Lookup reference)
- `RM Item` **(1) — (N)** `Material Issue Item` (Allows multiple partial issues against one requested item)
- `Material Issue Item` **(1) — (N)** `Production Receipt` (Allows partial receipts)
- `Production Receipt` **(1) — (N)** `Material Consumption` (Allows multiple daily consumption entries)
- `Production Receipt` **(1) — (N)** `Material Return`

## 3. Immutability Points
To enforce auditability and prevent historical tampering, entities become explicitly immutable at the following lifecycle events:

- **Upon Submission**: 
  - `RM Request` and `RM Item` records are locked. Designers cannot alter them.
- **Upon Issue Execution**: 
  - `Material Issue` and `Material Issue Item` records are permanently locked.
  - Linked `StockTransaction` records are inserted as immutable ledger entries.
- **Upon Receipt Confirmation**: 
  - `Production Receipt` records are locked to prevent retroactive denial of receipt.
- **Upon Entry**: 
  - `Material Consumption` and `Material Return` records are immutable from the moment they are recorded (subject to Stores confirmation for Returns). Any corrections must be done via a reversing entry, not an UPDATE.
- **Upon SC Closure**: 
  - The `SC` and all linked production activities are frozen. No further material issues or consumptions can be processed against that SC.

## 4. Traceability Chain
The architecture guarantees end-to-end traceability for every single physical material unit:

**The Path:**
`PO` -> `SC` -> `RM Request` -> `RM Item` -> `Material Issue Item` -> `Production Receipt` -> `Material Consumption / Return`

This ensures that if a manager asks *"Where did this specific issued material go?"*, the system can traverse down from the `Material Issue Item` directly to the `Production Receipt` and its associated `Consumption` records, without losing context.
