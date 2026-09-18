# PHASE 2.4 REPORT

## 1. Objective
Design the top-level physical storage master—`Warehouse`—for RMRIT without modifying application code, defining its identity, code/name rules, lifecycle, relationship to `WarehouseLocation`, dynamic inventory aggregation, and workflow impact.

## 2. Documents Reviewed
- `.agent/CURRENT_REQUIREMENTS_BASELINE.md`
- `.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`
- `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
- `.agent/PHASE_1_REPORT.md`
- `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md`
- `.agent/PHASE_2.1_REPORT.md`
- `.agent/PHASE_2.2_PRODUCT_MASTER_DESIGN.md`
- `.agent/PHASE_2.2_REPORT.md`
- `.agent/PHASE_2.3_CATEGORY_FAMILY_DESIGN.md`
- `.agent/PHASE_2.3_REPORT.md`

## 3. Repository Areas Inspected
- `backend/src/inventory/entities/inventory-item.entity.ts`
- `backend/src/inventory/entities/stock-balance.entity.ts`
- `backend/src/inventory/entities/stock-transaction.entity.ts`

## 4. Warehouse Architecture
`Warehouse` serves as the top-level container of physical storage (Code, Name, ID, Active). It represents physical buildings or major storage yards. It does **NOT** maintain cached stock balances directly.

## 5. Warehouse Identity
Internal system UUID + user-facing business `code` (uppercase string, e.g. `WH-01`) and `name` (e.g. *Main Steel Storage Yard*).

## 6. Warehouse Code/Name Rules
- `code`: Mandatory, globally unique (case-insensitive), stored in uppercase, max 50 chars.
- `name`: Mandatory, globally unique (case-insensitive), max 100 chars.

## 7. Warehouse Lifecycle
- Active: Permits creation of new Locations and accepts new **Stock IN**, **Stores Issue**, and **Material Return**.
- Inactive: Blocks creation of **new** Locations and blocks **new Stock IN**. Existing stock balances and historical transactions remain queryable.

## 8. Warehouse Deletion
Hard deletion is strictly `RESTRICTED` if any child Locations, Bins, Stock Balances, or Stock Transactions exist. Soft deactivation (`isActive = false`) must be used instead.

## 9. Warehouse → Location Relationship
Strict 1:N relationship. A Warehouse contains many Locations; each Location belongs to exactly one Warehouse (`warehouseId NOT NULL`). Location code is unique *within* its parent Warehouse.

## 10. Warehouse → Inventory Relationship
`Product` is independent of `Warehouse`. `StockBalance` is tracked at `Product + Bin`. Warehouse-level stock is calculated dynamically via SQL aggregation.

## 11. Multi-Warehouse Support
A single Product can exist across multiple Bins in multiple Warehouses simultaneously without duplicating Product Master records.

## 12. Stock Aggregation
Aggregated on-demand: `SUM(StockBalance.currentQuantity)` for all Bins within all Racks within all Locations of that Warehouse. No duplicate cached balance columns.

## 13. Movement Impact
Stock movements capture source and destination Bins, which cascade up to their respective Warehouses.

## 14. Stores Issue Impact
Stores Issue selects a specific Bin under a Warehouse, decrementing `StockBalance` atomically.

## 15. Return Dependency
Material Return destination bin under a Warehouse depends on the resolution of `DEC-005` (Return destination storage rule).

## 16. RBAC
- View: All 6 active roles.
- Create/Edit/Deactivate: `ADMIN` (Default). `STORES` creation authority flagged under `DEC-WH-006` (Requires Business Decision).

## 17. Auditability
Standard entity timestamps (`createdAt`, `updatedAt`). Stock transactions reference immutable Bin IDs.

## 18. Historical Traceability
Warehouse code/name renames do not modify underlying UUID foreign keys or historical transaction logs.

## 19. Existing Implementation Impact
Existing Phase 10 implementation has no location entities. Phase 7 will add `Warehouse`, `WarehouseLocation`, `Rack`, and `Bin` entities.

## 20. Migration Impact
Legacy stock records will map to a default "Main Warehouse" / "Default Bin" during Phase 11/12 data migration.

## 21. Resolved Decisions
- **DEC-WH-001**: Warehouse Code Format (Uppercase string, max 50 chars, trimmed).
- **DEC-WH-002**: Warehouse Code Uniqueness (Globally unique, case-insensitive).
- **DEC-WH-003**: Warehouse Name Uniqueness (Globally unique, case-insensitive).
- **DEC-WH-004**: Warehouse Deactivation Rules (Blocks new Locations and Stock IN; preserves history).
- **DEC-WH-005**: Warehouse Deletion Policy (RESTRICTED if Locations/Stock exist; soft deactivation used).
- **DEC-WH-007**: Location Uniqueness Scope (Unique within parent Warehouse `(warehouseId, code)`).

## 22. Unresolved Decisions
- **DEC-WH-006**: Warehouse Creation Authority (`ADMIN` vs `STORES`).
- **DEC-WH-008**: Inter-Warehouse Transfer Requirement (Whether direct WH-to-WH transfer is required).
- *Carried forward*: DEC-005 (Return Destination Bin), DEC-PROD-010 (Max Inventory Enforcement), DEC-PROD-014 (`InventoryItem` reconciliation).

## 23. Risks
- Cascading storage selection (Warehouse ──> Location ──> Rack ──> Bin) in Stores Issue forms requires clean UI dropdown performance.

## 24. Phase 2.5 Impact
Phase 2.5 will design `WarehouseLocation`, `Rack`, and `Bin` entities using the `warehouseId` root and location uniqueness scope defined in Phase 2.4.

## 25. Phase 7 Impact
Requires creation of `Warehouse` TypeORM entity with unique indexes on `code` and `name`.

## 26. Phase 11 Impact
Requires backend Warehouse CRUD API endpoints and frontend management views.

## 27. Phase 12 Impact
Requires integrating Warehouse dropdown selection into Stores Stock IN and Stores Issue screens.

## 28. Files Created/Modified
- `PHASE_2.4_WAREHOUSE_DESIGN.md` (Created)
- `PHASE_2.4_REPORT.md` (Created)
- `PHASE_1_REQUIREMENT_DECISION_LOG.md` (Updated)

## 29. Verification Performed
- Verified git repository status (`git status`).
- Inspected Phase 2.1, 2.2, 2.3 design documents.
- Confirmed zero application code modifications.

## 30. Phase Status
READY FOR PHASE 2.5 WITH OPEN BUSINESS DECISIONS
