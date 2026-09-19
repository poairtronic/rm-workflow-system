# Phase 11.3 - Product Master Data Details

## Data Model Details
The `Product` model implementation is verified and meets specifications.

Fields:
- `id`: UUID (Primary Key)
- `familyId`: UUID (Foreign Key to ProductFamily)
- `name`: String, max length 255, trimmed, globally unique.
- `minimumInventory`: Numeric, defaults to 0, cannot be negative.
- `maximumInventory`: Numeric, nullable, must be >= `minimumInventory`.
- `isActive`: Boolean, defaults to true.
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

## Family Relationship
- A Product must have a valid `familyId`.
- Category is successfully derived through `Product -> ProductFamily -> ProductCategory`.
- The product model does not illegally store `categoryId`.

## Endpoints (via ProductsController)
- `POST /api/products`: Create product (Roles: ADMIN, STORES)
- `GET /api/products`: List products with pagination, search, family filter, active filter (Roles: Authenticated Matrix)
- `GET /api/products/:id`: Get product by ID
- `PATCH /api/products/:id`: Update product / Activate / Deactivate (Roles: ADMIN, STORES)
- *Note:* There is no `DELETE` endpoint, enforcing the non-destructive activation/deactivation lifecycle.

## Validation and Protection
- Global `ValidationPipe` ensures proper DTO structures and numeric checks.
- Trimming implemented using `@Transform` on the `name` field for both create and update operations.
- Application-level duplicate check prevents case-insensitive collisions globally across all products.
- `maximumInventory` is strictly validated to ensure it is not less than `minimumInventory`.

## Inventory Boundaries Enforced
- **Creation:** Does not touch `StockBalance` or `StockTransaction`.
- **Update:** Does not modify any existing inventory data.
- **Deactivation:** Is non-destructive and preserves historical traceability of `StockTransaction` and `InventoryItem` records.

## Security
- JWT Guard and Roles Guard remain firmly in place.
- Write privileges strictly locked to `ADMIN` and `STORES`.
- Disallowed roles (e.g. `DESIGNER`, `SENIOR_DESIGNER`, `PRODUCTION`, etc.) are explicitly barred from mutations.
