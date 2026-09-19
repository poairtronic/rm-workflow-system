# Phase 12.1 - Customer & Purchase Order (PO) Foundation

## 1. Customer Purpose
The Customer master represents the entity procuring goods from the manufacturing facility. It exists specifically so that a PO can be correctly associated with a destination/client.

## 2. PO Purpose
RMRIT is a manufacturing management application, not a primary commercial ERP. The PO entity records an externally-created Purchase Order reference to track the origin of manufacturing workflows. 

## 3. External PO Ownership
PO generation, quoting, billing, taxation, and supplier negotiations are NOT handled by RMRIT. RMRIT simply maps manufacturing tracking via the PO Number.

## 4. Customer -> PO Relationship
- One Customer can have multiple POs (1 to N).
- One PO strictly belongs to one Customer.

## 5. PO Number Rules
- The PO Number is an external string identifier.
- Must be uniquely identified within RMRIT to prevent double-entry.
- Validated for length and emptiness (normalized).

## 6. Customer Lifecycle
Customers can be created, updated, and marked active/inactive. Hard deletion is omitted to preserve historical PO integrity and relational constraints.

## 7. PO Lifecycle / Status
PO is currently a foundation entity. A complete status tracking system for individual Sales Order Components (SCs) will be mapped under the PO in later phases. RMRIT tracks the PO as a reference entity.

## 8. RBAC 
- Creation/Mutation: Restricted to `ADMIN` and `STORES`.
- Visibility/Read-only: Extended to monitoring roles like `PRODUCTION`, `DESIGNER`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.

## 9. API Contracts
- Standard RESTful routes under `/api/customers` and `/api/po`.
- Full HTTP real-world testing validates correct parameter parsing (UUIDs).
- Unintended properties are stripped by NestJS `ValidationPipe`.

## 10. Database Relationships
The database utilizes a strict Foreign Key (`customer_id`) from `purchase_orders` mapping to `customers.id`, utilizing `ON DELETE RESTRICT` to ensure relational integrity.

## 11. Validation
Validation is stringently performed through DTO classes `CreateCustomerDto`, `CreatePoDto`, guarding length boundaries and types.

## 12. Duplicate Handling
Both Customer Code and PO Number enforce `unique` indexing in the PostgreSQL database, elegantly mapped to 409 Conflict Exceptions in the services.

## 13. Foreign Key Behavior
Sending an invalid or nonexistent Customer ID to the PO creation endpoint is validated first by the service, and backed by a strict Postgres FK. This safely yields a 404 Not Found before DB corruption occurs.

## 14. Transaction Safety
Entities are saved sequentially with application-level validation preceding database constraints to prevent orphaned states.

## 15. Relationship to Future SC
The Sales Order Component (SC) functionality will rely entirely on this structure, linking individual SC items to a single PO.

## 16. Inventory Isolation
Customer and PO Creation intentionally do not mutate `StockBalance`, `InventoryItem`, or create `StockTransaction` ledgers.
