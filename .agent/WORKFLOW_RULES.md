# RMRIT Non-Negotiable Workflow & Business Rules

All agents must preserve these non-negotiable rules across backend schemas, APIs, business logic, and UI forms:

## 1. PO vs. SC Separation

- **PO (Purchase Order)** is an external commercial reference and grouping container.
- **SC (Sales Order Component)** is the fundamental unit of work, material allocation, shop-floor tracking, and completion.
- POs never "complete" in RMRIT — only individual SCs close.

## 2. Direct Designer to Stores Flow (No Approval Gate)

- **Designer** creates and authors the RM requirement list for each SC.
- Submitting the RM list transitions status directly to `STORES_PENDING` (or `SUBMITTED`) and notifies Stores.
- There are **no Senior Designer approval, review, revision, or rejection gates**.
- **Senior Manager** and **General Manager** act exclusively as real-time monitoring, alert, and analytics observers.

## 3. Immutable Transaction Logs

- All material movements (Issues, Receipts, Consumption, Returns, Scrap, Additional Requests) are **append-only**.
- Never perform destructive `UPDATE` or `DELETE` on past transaction records. Corrections are made via new audit events.

## 4. Original Requirement Protection

- The original design RM requirement quantity is immutable once submitted to Stores.
- Any subsequent material needs discovered during production are recorded as `Additional Material Requests` with an explicit reason code (`ADDITIONAL_REQUIREMENT`, `DAMAGE`, `WASTAGE`, `MANUFACTURING_ERROR`, `OTHER`).

## 5. Server-Side Authoritative Math

- Totals, shortages, pending amounts, scrap balances, and unaccounted quantities must be computed authoritatively on the backend.
- The frontend renders computed values and never devises independent accounting math.

## 6. Explicit Two-Step Reconciliations

- **Material Issue**: Stores issues material $\longrightarrow$ Production confirms receipt.
- **Material Return**: Production logs return $\longrightarrow$ Stores confirms physical return.

## 7. End-to-End Role Authorization

- Every API endpoint is guarded by server-side role checks (`JwtAuthGuard`, `RolesGuard`).
- The 6 system roles are `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`, and `ADMIN`.

## 8. Inventory Core Architecture

- **Inventory must be trustworthy and traceable.**
- For all inventory-related behavior and architecture invariants, refer to `docs/requirements/INVENTORY_MODULE_CONCEPT.md` which is the ultimate source of truth.
