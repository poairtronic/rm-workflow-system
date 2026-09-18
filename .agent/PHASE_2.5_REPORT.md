# PHASE 2.5 REPORT

## 1. Objective
Design the complete lower-level physical storage architecture (`WarehouseLocation`, `Rack`, `Bin`) for RMRIT, establishing how physical storage is organized inside a warehouse down to the bin level, how products are physically located, and what rules govern location, rack, bin, and stock storage, without modifying any application code or database schema.

---

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
- `.agent/PHASE_2.4_WAREHOUSE_DESIGN.md`
- `.agent/PHASE_2.4_REPORT.md`

---

## 3. Repository Areas Inspected
- `backend/src/inventory/entities/inventory-item.entity.ts`
- `backend/src/inventory/entities/stock-balance.entity.ts`
- `backend/src/inventory/entities/stock-transaction.entity.ts`
- `backend/src/inventory/inventory.service.ts`
- `backend/src/inventory/inventory.controller.ts`

---

## 4. Final Storage Hierarchy
The authoritative physical storage hierarchy is strictly:
```
Warehouse (1) ──> (N) WarehouseLocation (1) ──> (N) Rack (1) ──> (N) Bin
```
Operational stock quantity resides at `Product (1) ──> (N) StockBalance (N) <── (1) Bin`.
No intermediate physical storage levels (e.g., Zone, Section, Shelf) are introduced.

---

## 5. WarehouseLocation Design
`WarehouseLocation` represents a physical or logical zone/area within a specific Warehouse. It contains multiple child `Rack` entities. It does NOT maintain cached stock balance columns; location-level balances are derived dynamically via Bin SQL aggregation.

---

## 6. Location Identity and Uniqueness
- **Identity**: System UUID `id` + user-facing business `code` and `name`.
- **Uniqueness Scope**: Preserved from `DEC-WH-007`—`WarehouseLocation.code` is unique *within* its parent Warehouse (`(warehouseId, normalized(code))`). `WarehouseLocation.name` is also unique within its parent Warehouse (`(warehouseId, normalized(name))`).

---

## 7. Location Lifecycle
- **Active**: Allows creation of child Racks/Bins, accepts Stock IN, Stores Issue, and Material Return targeting child Bins.
- **Inactive**: Blocks creation of new Racks/Bins and blocks new Stock IN and Material Return. Existing stock remains physically present and viewable for auditing.

---

## 8. Location Deletion
- **Zero Racks / Zero Stock**: Hard deletion (`DELETE`) permitted.
- **Racks / Bins / Stock / History Present**: Hard deletion `RESTRICTED`. Must use soft deactivation (`isActive = false`) to preserve audit and ledger traceability.

---

## 9. Rack Design
`Rack` represents a physical framework or shelf structure situated within a `WarehouseLocation`. It contains multiple `Bin` storage compartments. Products are assigned to Bins inside the Rack, not directly to the Rack itself.

---

## 10. Rack Identity and Uniqueness
- **Identity**: System UUID `id` + business `code` and `name`.
- **Uniqueness**: `Rack.code` is unique within its parent `WarehouseLocation` (`(locationId, normalized(code))`) per `DEC-RACK-001`.

---

## 11. Rack Lifecycle
- **Active**: Accepts creation of child Bins; permits Stock IN, Stores Issue, and Material Return targeting child Bins.
- **Inactive**: Cannot be created under an inactive Location; blocks creation of new Bins and blocks Stock IN / Material Return. Existing stock remains viewable.

---

## 12. Rack Deletion
- **Zero Bins**: Hard deletion permitted.
- **Bins / Stock / History Present**: Hard deletion `RESTRICTED`. Soft deactivation required.

---

## 13. Bin Design
`Bin` is the most granular physical storage compartment within a Rack and serves as the authoritative physical location for operational stock balances (`StockBalance`).

---

## 14. Bin Identity and Uniqueness
- **Identity**: System UUID `id` + business `code` and `name`.
- **Uniqueness**: `Bin.code` is unique within its parent `Rack` (`(rackId, normalized(code))`) per `DEC-BIN-001`.

---

## 15. Bin Lifecycle
- **Active**: Full operational capability (Stock IN, Stores Issue, Material Return, selection lists).
- **Inactive**: Blocks new Stock IN and Material Return. Existing stock quantity remains viewable in reports.

---

## 16. Bin Deletion
- **Zero Stock / Zero History**: Hard deletion permitted.
- **Stock or Transaction History Present**: Hard deletion strictly `RESTRICTED` to protect ledger integrity.

---

## 17. Product ↔ Bin Relationship
A single `Product` can exist across multiple Bins simultaneously without duplicating Product Master records. Summing `StockBalance.currentQuantity` across all Bins yields global product stock.

---

## 18. StockBalance Impact
`StockBalance` represents current operational stock quantity at `Product + Bin`. Unique constraint `(productId, binId)` ensures exactly one operational balance row per product-bin combination. No higher-level balance tables (`LocationStockBalance`, `RackStockBalance`) are created.

---

## 19. StockTransaction Impact
`StockTransaction` serves as the immutable movement ledger. It captures physical transfers using `sourceBinId` and `destinationBinId`. Ancestor storage levels (Rack, Location, Warehouse) are resolved dynamically via table joins.

---

## 20. Multi-Product Bin Decision
`DEC-PROD-012` remains an **OPEN BUSINESS DECISION**.
- *Option A (Single-Product Bin)*: Restricted by business validation.
- *Option B (Multi-Product Bin)*: Supported natively by the `(productId, binId)` key structure on `StockBalance`.
The design remains open without forcing an unauthorized resolution.

---

## 21. Storage Reassignment
Master data edits to parent links (`Bin.rackId`, `Rack.locationId`, `Location.warehouseId`) do NOT automatically move stock. Reassignment of storage entities containing non-zero stock is `RESTRICTED` unless an explicit physical movement transaction is executed.

---

## 22. Parent/Child Lifecycle
Governed by `DEC-STORAGE-001` (Inherited Operational Status model recommended): Child entities retain their explicit `isActive` flag in master data, but operational eligibility evaluates ancestor status: `Bin.isActive && Rack.isActive && Location.isActive && Warehouse.isActive`.

---

## 23. Stock IN Impact
Stores selects `Warehouse ──> Location ──> Rack ──> Bin`. System validates that all storage ancestors are active, atomically increments `StockBalance(productId, binId)`, and logs a `StockTransaction` with `destinationBinId`.

---

## 24. Stores Issue Impact
Stores selects specific source `Bin` containing non-zero stock balance for the required `Product`. System validates balance sufficiency, atomically decrements `StockBalance`, and logs a `StockTransaction` with `sourceBinId`.

---

## 25. Material Return Dependency
Material Return destination bin logic depends on `DEC-005` (*Return Destination Bin Policy*). The storage hierarchy provides the required physical bin target once `DEC-005` is finalized.

---

## 26. Additional Material Impact
Additional material requests follow the standard Stores Issue pathway: `Stores Verification ──> Bin Selection ──> Atomic Decrement ──> StockTransaction Ledger`.

---

## 27. Reconciliation
Reconciliation targets specific physical `Bins`. Calculated balance (`Opening + Stock IN - Stock OUT ± Adjustments`) is verified against physical counts, logging `ADJUSTMENT` transactions for discrepancies.

---

## 28. Search/Filtering
Cascading UI/API filters enforce sequential selection (`Warehouse ──> Location ──> Rack ──> Bin`), preventing invalid cross-parent selections.

---

## 29. RBAC
- **View**: All 6 baseline roles (`DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`, `ADMIN`).
- **Create/Edit/Deactivate**: `ADMIN` (Default). `STORES` creation authority flagged under `DEC-WH-006`.
- **Delete**: `ADMIN` only (subject to RESTRICT rules).

---

## 30. Auditability
Master data changes record entity timestamps (`createdAt`, `updatedAt`) and audit logs. Movement transactions reference immutable Bin UUIDs and actor IDs.

---

## 31. Historical Traceability
Renaming a Location, Rack, or Bin updates only descriptive text attributes. Foreign keys in `StockBalance` and `StockTransaction` reference immutable internal UUIDs, guaranteeing complete historical traceability.

---

## 32. Existing Implementation Impact
Inspected `backend/src/inventory`. Phase 10 entities currently track stock without location identifiers. Phase 7 will introduce TypeORM entities for `WarehouseLocation`, `Rack`, and `Bin`, and update `StockBalance` and `StockTransaction` to mandate `binId`.

---

## 33. Migration Impact
Legacy stock records without location metadata will be mapped to a default `MAIN WAREHOUSE / DEFAULT LOCATION / DEFAULT RACK / DEFAULT BIN` structure during Phase 11/12 data migration.

---

## 34. Resolved Decisions
- **DEC-WH-001**: Warehouse Code Format.
- **DEC-WH-002**: Warehouse Code Global Uniqueness.
- **DEC-WH-003**: Warehouse Name Global Uniqueness.
- **DEC-WH-004**: Warehouse Deactivation Rules.
- **DEC-WH-005**: Warehouse Deletion Policy.
- **DEC-WH-007**: Location Uniqueness Scope (`(warehouseId, code)`).

---

## 35. Unresolved Decisions
- **DEC-WH-006**: Warehouse & Location Master Creation Authority (`ADMIN` vs `STORES`).
- **DEC-WH-008**: Inter-Warehouse Transfer Requirement.
- **DEC-005**: Return Destination Storage Rule.
- **DEC-PROD-010**: Maximum Inventory Enforcement.
- **DEC-PROD-012**: Multi-Product Bin Policy.
- **DEC-PROD-014**: InventoryItem vs Product Reconciliation.
- **DEC-LOC-001** through **DEC-LOC-004**: Location Code, Name, Reassignment & Lifecycle policies.
- **DEC-RACK-001** through **DEC-RACK-003**: Rack Code Scope, Lifecycle & Reassignment policies.
- **DEC-BIN-001** through **DEC-BIN-004**: Bin Code Scope, Multi-Product constraint, Lifecycle & Reassignment policies.
- **DEC-STORAGE-001** & **DEC-STORAGE-002**: Parent Deactivation Cascade & Delete policies.

---

## 36. Risks
- **UI Cascading Latency**: Deep hierarchy (`Warehouse ──> Location ──> Rack ──> Bin`) must be efficiently indexed in DB to maintain fast UX dropdown population.

---

## 37. Phase 7 Impact
Requires TypeORM schemas for `WarehouseLocation`, `Rack`, and `Bin`, foreign keys, and composite indexes on `StockBalance(product_id, bin_id)`.

---

## 38. Phase 11 Impact
Requires REST APIs for Location, Rack, and Bin CRUD operations and master data frontend management views.

---

## 39. Phase 12 Impact
Requires cascading bin selection in Stores Stock IN, Stores Issue, and Material Return screens.

---

## 40. Files Created/Modified
- `.agent/PHASE_2.5_LOCATION_RACK_BIN_DESIGN.md` (Created)
- `.agent/PHASE_2.5_REPORT.md` (Created)

---

## 41. Verification Performed
- Inspected repository files (`backend/src/inventory`).
- Verified git status (`git status`).
- Confirmed zero application code or database schema modifications.

---

## 42. Phase Status
**PHASE 2.5 COMPLETE — DESIGN ONLY. READY FOR HUMAN REVIEW.**
