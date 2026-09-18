# PHASE 2.2: PRODUCT MASTER DESIGN

## 1. Objective
Design the Product Master Domain for RMRIT based strictly on authoritative requirements. This phase defines what a Product is, its data structure, taxonomy, lifecycle, and its integration with the Inventory domain (Phase 2.1 design). This is a design-only phase.

## 2. Source Documents Reviewed
- `.agent/CURRENT_REQUIREMENTS_BASELINE.md`
- `.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`
- `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
- `.agent/PHASE_1_REPORT.md`
- `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md`
- Existing Phase 10 entities (`InventoryItem`, `StockBalance`, `StockTransaction`).

## 3. Product Hierarchy
The hierarchy strictly follows:
`ProductCategory` (1) ──> (N) `ProductFamily` (1) ──> (N) `Product`

**Rules:**
- A Category can contain many Families.
- A Family belongs to exactly one Category.
- A Product belongs to exactly one Family.
- A Product's Category is derived strictly through its Family (no direct foreign key on Product to Category to prevent inconsistencies).
- A Family cannot exist without a Category.
- A Product cannot exist without a Family.
- Many-to-many relationships are NOT supported.

## 4. Product Master Required Fields
- **Name**: (String, required, max 255 chars). The primary human-readable identifier.
- **Family ID**: (UUID, required). Foreign key to ProductFamily.
- **Minimum Inventory**: (Numeric, required, default 0, non-negative).
- **Maximum Inventory**: (Numeric, optional/nullable, non-negative).
- **Active**: (Boolean, required, default true).

*Note: Fields like Unit Cost, Color, Barcode, etc., are explicitly excluded per requirements.*

## 5. Product Identity
- **Internal ID**: UUID (primary key).
- **Product Name**: Must be uniquely identifiable.
- **Product Code / SKU**: Not required by current requirements. Will not be implemented.
- **Normalization**: Names must be trimmed (leading/trailing whitespace removed). "ABC PRODUCT" and " abc product " will be treated as identical during uniqueness validation. Case-insensitive uniqueness is recommended.

## 6. Category Design
- **Purpose**: Highest-level grouping of products.
- **Fields**: ID (UUID), Name (String, Unique, Required), Active (Boolean).
- **Delete Behavior**: Restricted (cannot delete if Families are attached). Deactivation supported.

## 7. Family Design
- **Purpose**: Mid-level grouping of associated products.
- **Fields**: ID (UUID), Name (String, Required), Category ID (UUID, Required), Active (Boolean).
- **Uniqueness**: Family Name must be unique *globally* (to avoid confusion like having "Screws" under two different categories).
- **Delete Behavior**: Restricted (cannot delete if Products are attached). Deactivation supported.

## 8. Product ↔ Inventory Relationship
- **Lifecycle Independence**: Product creation does NOT create stock or a `StockBalance` record. A Product becomes inventory-trackable the moment it is referenced in a `StockTransaction` (e.g., Stock In) which generates a `StockBalance` for a specific Bin.
- **Zero Stock**: Supported. A Product can have zero stock (either no `StockBalance` records exist, or the sum of existing quantities is exactly 0).
- **Active/Inactive Status**: 
  - An inactive Product cannot receive new stock IN or be issued OUT.
  - Inactivating a Product does NOT delete its `StockBalance` or `StockTransaction` history.
  - Historical transactions remain permanently traceable using the Product ID.

## 9. Minimum / Maximum Inventory
- **Scope**: Evaluated against the GLOBAL sum of all valid `StockBalance` quantities for the Product. (Per Phase 2.1).
- **Minimum Inventory**: Must be >= 0.
- **Maximum Inventory**: Must be >= 0. If set, must be >= Minimum Inventory.
- **Enforcement (Max)**: Open Business Decision (DEC-PROD-010). Currently tracked as informational for Stock Status.

## 10. Product Stock Status
Matches Phase 2.1 definitions based on global sum:
- **OUT OF STOCK**: Total == 0
- **LOW STOCK**: Total > 0 AND Total < Minimum
- **NORMAL**: Total >= Minimum AND Total <= Maximum (if Max is defined) OR Total >= Minimum (if Max is not defined).
- **EXCESS STOCK**: Total > Maximum (if Max is defined).

## 11. Delete / Deactivation Rules
- **Hard Deletion**: Allowed ONLY if the entity has no child dependencies (e.g., a Product has no `StockTransaction`, `StockBalance`, or RM references).
- **Soft Deactivation**: Used once references exist. Preserves historical traceability. Renaming is allowed, but historical audit logs must reflect the name at the time of the transaction (or transactions rely on relational IDs and render the current name).

## 12. Historical Traceability
Product identity (UUID) remains stable. Renaming a Product will reflect the new name in historical views that join the tables. If point-in-time naming is strictly required for legal/audit reasons, a snapshot field (e.g., `productNameSnapshot`) must be added to `StockTransaction` (Requires Business Decision - DEC-PROD-013).

## 13. Multi-Warehouse / Multi-Bin Support
Supported natively. The Product Master contains no location data. Location is strictly handled by `StockBalance` and `StockTransaction`.

## 14. Existing InventoryItem Reconciliation
The current `InventoryItem` table contains highly specific RM fields (`material`, `materialType`, `grade`, `size`).
- **Conflict**: The new Product concept only requires Name, Min, Max, Family, Category.
- **Analysis**: `InventoryItem` currently acts as a hybrid of a Product Master and an RM Material Specification. 
- **Recommendation (Phase 7 impact)**: `InventoryItem` should be mapped/migrated to the new `Product` entity. The granular fields (`material`, `grade`, `size`) likely need to be consolidated into the Product Name (e.g., "Steel Plate 10mm Grade A") OR the RM workflow needs to retain a separate specification entity that maps to a `Product`.
- **Decision**: DEC-PROD-014 (Requires Business Decision to determine if RM fields belong on Product or if Product is an abstract parent).

## 15. API Impact
New standard CRUD endpoints for:
- `/api/product-categories`
- `/api/product-families`
- `/api/products`
Must support pagination, filtering (by active status, parent ID, name), and DTO validation (preventing negative min/max).

## 16. Frontend Impact
New Master Data management screens:
- List views with search/filter.
- Create/Edit modals for Category, Family, and Product.
- Cascading dropdowns (Select Category -> Filter Families).
- Inventory views must join and display the new Hierarchy.

## 17. Security / RBAC Design
- **View Authority**: DESIGNER, STORES, PRODUCTION, SENIOR_MANAGER, GENERAL_MANAGER, ADMIN.
- **Create/Edit Authority**: ADMIN (assumed as safe default). Whether STORES or DESIGNER can create master products is an Open Business Decision (DEC-PROD-011).

## 18. Auditability
Master Data changes (Create/Update/Activate/Deactivate) should track `createdBy`, `createdAt`, `updatedBy`, `updatedAt`. Standard TypeORM auditing. A separate `AuditLog` table for master data changes is NOT required unless specifically requested.

## 19. Migration Impact
- Existing `InventoryItem` records must be transformed into `Product` records.
- A default "Legacy Category" and "Legacy Family" may need to be created to satisfy the hierarchy constraints for existing items.

## 20. Validation Matrix
| Entity | Field | Rule | Required | Duplicate Allowed | Delete Allowed |
|--------|-------|------|----------|-------------------|----------------|
| Category | Name | Trimmed, non-empty | Yes | No (Case-insensitive) | Only if no Families |
| Family | Name | Trimmed, non-empty | Yes | No (Global) | Only if no Products |
| Product | Name | Trimmed, non-empty | Yes | No (Global) | Only if no transactions |
| Product | Min Inv | >= 0 | Yes | N/A | N/A |
| Product | Max Inv | >= Min (if set) | No | N/A | N/A |

## 21. Relationship Matrix
| Parent | Child | Cardinality | Required | Delete Behavior |
|--------|-------|-------------|----------|-----------------|
| Category | Family | 1:N | Yes | RESTRICT |
| Family | Product | 1:N | Yes | RESTRICT |
| Product | StockBalance | 1:N | No | RESTRICT |
| Product | StockTransaction| 1:N | No | RESTRICT |

## 22. Business Rule Matrix
- **BR-PROD-001**: Product must belong to a valid Family.
- **BR-PROD-002**: Family must belong to a valid Category.
- **BR-PROD-003**: Product creation does not change stock.
- **BR-PROD-004**: Product stock is derived from StockBalance.
- **BR-PROD-005**: Product total stock is the sum of valid bin balances.
- **BR-PROD-006**: Product identity remains stable for historical traceability.
- **BR-PROD-007**: Inactive Product cannot perform prohibited future stock operations (In/Out).
- **BR-PROD-008**: Minimum Inventory participates in stock status.
- **BR-PROD-009**: Maximum Inventory participates in stock status.
- **BR-PROD-010**: Duplicate master records must be prevented.
- **BR-PROD-011**: Historical transactions must remain traceable.
- **BR-PROD-012**: Multi-warehouse storage must be supported.

## 23. Edge-Case Matrix
- **Category with no Families**: Allowed.
- **Product with zero stock**: Allowed (Status: OUT OF STOCK).
- **Inactive Product with historical transactions**: Allowed. Transactions remain visible.
- **Rename referenced Product**: Allowed. New name reflects everywhere automatically.
- **Duplicate Name Creation**: Rejected at API/DB level (Unique constraint).
- **Min > Max during Update**: Rejected at API/DTO validation level.

## 24. Performance Considerations
- Unique Index on `ProductCategory(name)`.
- Unique Index on `ProductFamily(name)`.
- Unique Index on `Product(name)`.
- Index on `Product(familyId)`.
- Index on `ProductFamily(categoryId)`.

## 25. Decision Register
| Decision | Rationale | Status | Impacted Phase |
|----------|-----------|--------|----------------|
| **DEC-PROD-001** Product identity | UUID + globally unique name. Simplest, safest approach. | RESOLVED | Phase 7 / 11 |
| **DEC-PROD-002** Category → Family cardinality | 1:N as per requirements. | RESOLVED | Phase 7 / 11 |
| **DEC-PROD-003** Family → Product cardinality | 1:N as per requirements. | RESOLVED | Phase 7 / 11 |
| **DEC-PROD-004** Product category derivation | Derived through Family to prevent DB anomalies. | RESOLVED | Phase 7 / 11 |
| **DEC-PROD-005** Product uniqueness | Globally unique by name. | RESOLVED | Phase 7 / 11 |
| **DEC-PROD-006** Family uniqueness scope | Globally unique to avoid UI confusion. | RESOLVED | Phase 7 / 11 |
| **DEC-PROD-007** Lifecycle | Active/Inactive boolean. Prevents new transactions when inactive. | RESOLVED | Phase 11 / 12 |
| **DEC-PROD-008** Deletion policy | Hard delete restricted if referenced. Soft deactivation used otherwise. | RESOLVED | Phase 11 |
| **DEC-PROD-009** Minimum inventory scope | Global sum of all bins. | RESOLVED | Phase 12 |
| **DEC-PROD-010** Max inventory enforcement | How to enforce max limits. | REQUIRES BUSINESS DECISION | Phase 12 |
| **DEC-PROD-011** Creation authority | Which roles can create products. | REQUIRES BUSINESS DECISION | Phase 11 |
| **DEC-PROD-012** Multi-product bin | Dependent on physical layout rules. | REQUIRES BUSINESS DECISION | Phase 2.1 / 12 |
| **DEC-PROD-013** Transaction name snapshot | Whether historical ledgers need immutable string names. | REQUIRES BUSINESS DECISION | Phase 7 |
| **DEC-PROD-014** InventoryItem Reconciliation | How RM fields map to abstract Product names. | REQUIRES BUSINESS DECISION | Phase 7 |

## 26. Phase 7 Impact
Requires creation of `ProductCategory`, `ProductFamily`, and `Product` entities. `InventoryItem` will likely be refactored into `Product` pending DEC-PROD-014. Foreign keys in `StockBalance` and `StockTransaction` must point to `Product`.

## 27. Phase 11 Impact
Requires full CRUD implementation (Controllers, Services, DTOs, React components) for the three Master Data entities, enforcing all validation rules and RBAC.

## 28. Phase 12 Impact
Material Issue and Stock In workflows must validate against Product active status and enforce Minimum/Maximum inventory alert/block rules once decided.
