# RMRIT Non-Negotiable Workflow & Business Rules

All agents must preserve these non-negotiable rules across backend schemas, APIs, business logic, and UI forms:

## 1. PO vs. SC Separation
- **PO (Purchase Order)** is a commercial/grouping reference.
- **SC (Sales Order / Sub-Contract Item)** is the fundamental unit of work, approval, material allocation, and completion.
- POs never "complete" — only individual SCs close.

## 2. Immutable Transaction Logs
- All material movements (Issues, Receipts, Consumption, Returns, Scrap, Additional Requests) are **append-only**.
- Never perform destructive `UPDATE` or `DELETE` on past transaction records. Corrections are made via new audit events.

## 3. Original Requirement Protection
- The original design RM requirement quantity is immutable once verified.
- Any subsequent material needs are recorded as `Additional Material Requests` with an explicit reason code.

## 4. Server-Side Authoritative Math
- Totals, shortages, pending amounts, scrap balances, and unaccounted quantities must be computed authoritatively on the backend.
- The frontend renders computed values and never devises independent accounting math.

## 5. Explicit Two-Step Reconciliations
- **Material Issue**: Stores issues material $\longrightarrow$ Production confirms receipt.
- **Material Return**: Production logs return $\longrightarrow$ Stores confirms physical return.

## 6. End-to-End Role Authorization
- Every API endpoint is guarded by server-side role checks (`JwtAuthGuard`, `RolesGuard`).
- Never rely solely on hiding buttons on the client.
