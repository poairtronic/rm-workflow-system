# Phase 12.2 - Sales Contract (SC) Foundation

## 1. SC Purpose
SC represents an individual manufacturing work unit under a Purchase Order (PO). It defines what is being produced and targets an specific quantity (`targetQuantity`).

## 2. PO -> SC Relationship
- One PO strictly acts as a parent to many SCs (1 to N).
- One SC belongs to one PO, tied by `poId`.

## 3. SC Independence
SC workflows are completely independent. Advancing, completing, or closing one SC does NOT require any other SCs under the same PO to transition. There is no cross-SC blocking. The PO remains a flexible header rather than a restrictive lock.

## 4. SC Identity
The SC is identified globally by its UUID. The string identifier `scNumber` must be unique **per PO**, allowing standard repeated naming structures under different POs without artificial global collisions.

## 5. Target Quantity
The contract enforces `targetQuantity` via DTOs and database logic. We explicitly removed the stale/defunct `currentQuantity` from previous flawed definitions to reflect the verified Phase 12 boundary.

## 6. Product Relationship
`productName` is stored directly inside the `SalesOrderComponent` as a snapshot referencing the product intended to be produced. This preserves the established behavior of the DB layer.

## 7. SC Statuses & Lifecycle Transitions
Statuses align strictly with actual Enum values: `DRAFT`, `SUBMITTED`, `STORES_PENDING`, `PARTIALLY_ISSUED`, `ISSUED`, `IN_PRODUCTION`, `ADDITIONAL_REQUEST`, `COMPLETED`, and `CLOSED` (added this phase based on closure instructions).
Lifecycle enforces that DRAFT SCs cannot be arbitrarily closed without passing through appropriate state progression.

## 8. Validation & Constraints
Missing POs fail gracefully with 404 (NotFoundException), protecting the DB from Foreign Key Constraint errors (500). Mass assignment fields like `id` and `status` are stripped by DTO configurations. UUIDs are enforced using class-validators.

## 9. Inventory Isolation
Creating, completing, or closing an SC header does NOT automatically alter `StockBalance` or create `StockTransaction` ledgers. Any inventory effects are deferred to Phase 12.3 material-handling components.

## 10. RBAC and Attribution
Mutations (Create, Complete, Close) are restricted correctly to domain actors (e.g., ADMIN, PRODUCTION, STORES) while read visibility is extended to monitoring roles without granting them mutation permissions. `completedById` is attributed securely from the authenticated token.
