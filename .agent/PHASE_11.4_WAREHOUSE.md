# Phase 11.4 - Warehouse Master Data Details

## Data Model Details
The `Warehouse` model implementation is verified and meets specifications.

Fields:
- `id`: UUID (Primary Key)
- `code`: String, max length 50, unique, converted to uppercase, trimmed.
- `name`: String, max length 100, unique, case-insensitive check, trimmed.
- `isActive`: Boolean, defaults to true.
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

## Endpoints (via WarehousesController)
- `POST /api/warehouses`: Create warehouse (Roles: ADMIN, STORES)
- `GET /api/warehouses`: List warehouses with pagination, search, active filter (Roles: Authenticated Matrix)
- `GET /api/warehouses/:id`: Get warehouse by ID
- `PATCH /api/warehouses/:id`: Update warehouse / Activate / Deactivate (Roles: ADMIN, STORES)
- `DELETE /api/warehouses/:id`: Safe delete, protected against child Location dependencies (Roles: ADMIN, STORES)

## Validation and Protection
- Global `ValidationPipe` ensures proper DTO structures.
- Trimming implemented using `@Transform` on the `name` and `code` fields for both create and update operations.
- Application-level duplicate check prevents case-insensitive collisions globally across all warehouses.
- Concurrent creation of duplicate warehouses is blocked securely via the database unique constraints.

## Storage and Inventory Boundaries Enforced
- **Creation/Update:** Does not touch `StockBalance` or `StockTransaction`. Does not establish stock quantities.
- **Deactivation/Deletion:** Does not cascade into physical inventory records. Safe delete is fully guarded against dependent `WarehouseLocation` entities, preventing structural corruption.

## Security
- JWT Guard and Roles Guard remain firmly in place.
- Write privileges strictly locked to `ADMIN` and `STORES`.
- Disallowed roles (e.g. `DESIGNER`, `SENIOR_DESIGNER`, `PRODUCTION`, etc.) are explicitly barred from mutations.
