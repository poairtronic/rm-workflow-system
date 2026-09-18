# PHASE 2.3 REPORT

## 1. Objective
Design the complete Product Category and Product Family Master Data domain for RMRIT without modifying application code, establishing exact classification rules, relationships, lifecycles, and downstream inventory query integration.

## 2. Documents Reviewed
- `.agent/CURRENT_REQUIREMENTS_BASELINE.md`
- `.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`
- `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
- `.agent/PHASE_1_REPORT.md`
- `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md`
- `.agent/PHASE_2.1_REPORT.md`
- `.agent/PHASE_2.2_PRODUCT_MASTER_DESIGN.md`
- `.agent/PHASE_2.2_REPORT.md`

## 3. Repository Areas Inspected
- `backend/src/inventory/entities/inventory-item.entity.ts`
- `backend/src/inventory/entities/stock-balance.entity.ts`
- `backend/src/inventory/entities/stock-transaction.entity.ts`

## 4. Category Architecture
`ProductCategory` serves as the top-level classification entity (Name, ID, Active). It is purely taxonomic and contains no inventory balances or movement logic. Name is globally unique (case-insensitive).

## 5. Family Architecture
`ProductFamily` serves as the mid-level operational grouping entity (Name, ID, Category ID, Active). It belongs strictly to one `ProductCategory`. Name is unique per Category.

## 6. Category → Family Relationship
Strict 1:N relationship. A Category can have many Families; each Family must belong to exactly one Category (`categoryId NOT NULL`). Hard deletion of a Category with child Families is `RESTRICT`.

## 7. Family → Product Relationship
Strict 1:N relationship. A Family can have many Products; each Product belongs to exactly one Family (`familyId NOT NULL`). Product Category is derived via `family.category`. Hard deletion of a Family with child Products is `RESTRICT`.

## 8. Inventory Impact
Category and Family do **NOT** hold stock balances or movement records. `Product` remains the sole inventory identity. Total stock per Category or Family is calculated dynamically on-demand via database joins.

## 9. Lifecycle
- Active: Full operational visibility and permits new child creation.
- Inactive: Blocks creation of **NEW** child entries under the parent. Existing child entities and historical stock movements remain completely accessible and readable.

## 10. Deletion Rules
Hard deletion is strictly `RESTRICTED` if any child records exist (Family under Category, Product under Family, Stock under Product). Soft deactivation (`isActive = false`) is used instead.

## 11. Rename/Reassignment Rules
Renaming Category or Family is allowed and instantly reflects across display views without modifying primary keys or historical transaction logs. Reassigning a Family to a different Category is flagged as an open business decision (`DEC-CATFAM-003`).

## 12. Filtering
Cascading UI and query filters: `Category` ──> `Family` ──> `Product` ──> `Bin`. Supported natively via relational SQL joins without cached summary data.

## 13. Historical Traceability
`StockTransaction` records reference `productId`. Renaming or deactivating a Category or Family does not alter historical transaction ledgers or audit logs.

## 14. RBAC
- View: `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`, `ADMIN`.
- Create/Edit/Deactivate: `ADMIN` (Default). Rights for `STORES` or `DESIGNER` are tied to `DEC-CATFAM-006` / `DEC-PROD-011` (Requires Business Decision).

## 15. Auditability
Standard entity timestamps (`createdAt`, `updatedAt`). Transaction ledgers track physical movements separately.

## 16. Migration Impact
Existing `InventoryItem` records will be mapped to `ProductCategory` and `ProductFamily` during Phase 11/12 data migration. A "General Raw Materials" category/family fallback can be used for unclassified legacy data.

## 17. Resolved Decisions
- **DEC-CATFAM-001**: Category Uniqueness Scope (Globally unique, case-insensitive).
- **DEC-CATFAM-004**: Inactive Parent Behavior (Prevents new child creation; existing children unaffected).
- **DEC-CATFAM-005**: Deletion Policy (RESTRICTED if children exist; soft deactivation preferred).
- **DEC-CATFAM-007**: Historical Snapshot (No snapshot required; FK joins preserve point-in-time product identity).

## 18. Unresolved Decisions
- **DEC-CATFAM-002**: Family Uniqueness Scope (Proposed: Unique within parent Category).
- **DEC-CATFAM-003**: Family Category Reassignment (Ability to move Family between Categories).
- **DEC-CATFAM-006**: Category/Family Creation Authority (Which roles can manage master data).
- *Carried forward*: DEC-PROD-010 (Max inventory enforcement), DEC-PROD-013 (Name snapshotting), DEC-PROD-014 (`InventoryItem` reconciliation).

## 19. Risks
- Cascading UI dependencies in frontend forms require careful state management when selecting Category ──> Family ──> Product.

## 20. Phase 2.4 Impact
Phase 2.4 will design Warehouse, Location, Rack, and Bin structures, connecting them to Products via `StockBalance` without tying physical storage to Category/Family.

## 21. Phase 7 Impact
Requires creation of `ProductCategory` and `ProductFamily` TypeORM entities with foreign keys and unique/composite indexes.

## 22. Phase 11 Impact
Requires full backend CRUD APIs, DTO validation, and frontend management screens with cascading filters.

## 23. Phase 12 Impact
Requires integrating Category and Family dropdown filters into Stores Stock In, Stores Issue, and Production Return workflows.

## 24. Files Created/Modified
- `PHASE_2.3_CATEGORY_FAMILY_DESIGN.md` (Created)
- `PHASE_2.3_REPORT.md` (Created)
- `PHASE_1_REQUIREMENT_DECISION_LOG.md` (Updated)

## 25. Verification Performed
- Checked git repository status with `git status`.
- Reviewed Phase 2.1 & Phase 2.2 design documents.
- Verified zero application code modifications.

## 26. Phase Status
READY FOR PHASE 2.4 WITH OPEN BUSINESS DECISIONS
