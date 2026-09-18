# PHASE 2.5 — WAREHOUSE LOCATION, RACK & BIN DESIGN DOCUMENT

## 1. Objective
Design the complete lower-level physical storage architecture for RMRIT—`WarehouseLocation`, `Rack`, and `Bin`—and define their exact operational and logical relationships to `Product`, `StockBalance`, and `StockTransaction`. This phase establishes how physical storage is organized inside a warehouse down to the bin level without modifying any application code or database schema.

---

## 2. Source Documents
1. `.agent/CURRENT_REQUIREMENTS_BASELINE.md`
2. `.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`
3. `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
4. `.agent/PHASE_1_REPORT.md`
5. `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md`
6. `.agent/PHASE_2.1_REPORT.md`
7. `.agent/PHASE_2.2_PRODUCT_MASTER_DESIGN.md`
8. `.agent/PHASE_2.2_REPORT.md`
9. `.agent/PHASE_2.3_CATEGORY_FAMILY_DESIGN.md`
10. `.agent/PHASE_2.3_REPORT.md`
11. `.agent/PHASE_2.4_WAREHOUSE_DESIGN.md`
12. `.agent/PHASE_2.4_REPORT.md`
13. Existing repository implementation (`backend/src/inventory`)

---

## 3. Authority Hierarchy
The order of precedence for design governance is:
1. `.agent/CURRENT_REQUIREMENTS_BASELINE.md` (Absolute single source of truth)
2. `.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`
3. `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
4. `.agent/PHASE_1_REPORT.md`
5. `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md` & `.agent/PHASE_2.1_REPORT.md`
6. `.agent/PHASE_2.2_PRODUCT_MASTER_DESIGN.md` & `.agent/PHASE_2.2_REPORT.md`
7. `.agent/PHASE_2.3_CATEGORY_FAMILY_DESIGN.md` & `.agent/PHASE_2.3_REPORT.md`
8. `.agent/PHASE_2.4_WAREHOUSE_DESIGN.md` & `.agent/PHASE_2.4_REPORT.md`
9. Existing codebase implementation
10. Legacy design documents / conceptual references (Fusion Operations screenshots strictly conceptual only)

---

## 4. Storage Hierarchy

### Physical Storage Tree
```
Warehouse (1)
   └── WarehouseLocation (N)
            └── Rack (N)
                 └── Bin (N)
```

### Stock Balance & Movement Models
```
Product (1) ── (N) StockBalance (N) ── (1) Bin

StockTransaction ── (Movement Ledger with sourceBinId & destinationBinId)
```

> **STRICT HIERARCHY RULE**: No intermediate or supplementary physical storage levels (e.g., Zone, Section, Aisle, Shelf, Room, Floor, Storage Area) are introduced into the core data model.

---

## 5. WarehouseLocation Business Definition
- **Definition**: A designated physical or logical zone/area within a specific `Warehouse` (e.g., *Bay A*, *Outdoor Yard 1*, *Cold Zone*).
- **Purpose**: Groups related physical `Rack` structures within a single `Warehouse` for operational navigation, categorization, and logical organization.
- **Scope**: Belongs to exactly one `Warehouse` (`warehouseId NOT NULL`).
- **Storage Capability**:
  - Represents a physical storage section.
  - Contains multiple child `Rack` entities.
  - Does **NOT** directly store inventory balances (`StockBalance` exists strictly at `Product + Bin`).
  - Does **NOT** maintain its own cached stock balance column. Warehouse location stock is derived dynamically via bin aggregation.

---

## 6. WarehouseLocation Data Model
```typescript
export class WarehouseLocation {
  id: string; // UUID primary key
  warehouseId: string; // Mandatory foreign key to parent Warehouse
  code: string; // Location code (e.g., "LOC-A")
  name: string; // Location descriptive name (e.g., "Main Bay A")
  isActive: boolean; // Operational status flag
  createdAt: Date; // Audit creation timestamp
  updatedAt: Date; // Audit modification timestamp
}
```
*Note: Fields such as Capacity, Temperature, Location Type, Dimensions, and Weight Limit are NOT part of the core model and are marked as FUTURE / NOT CURRENTLY REQUIRED.*

---

## 7. Location Identity
- **Primary Key**: Internal immutable UUID `id`.
- **User-Facing Identifier**: `code` scoped strictly to parent `Warehouse` (`(warehouseId, code)`).

---

## 8. Location Code Rules
- **Required**: Yes (`NOT NULL`).
- **Uniqueness Scope**: Preserved from DEC-WH-007—unique *within* parent `Warehouse`. `(warehouseId, normalized(code))` must be unique. The same code (e.g., `LOC-A`) may exist in two different Warehouses (`WH-01` and `WH-02`).
- **Normalization**: Trimmed of leading/trailing whitespace, converted to uppercase on input/storage.
- **Max Length**: 50 characters.
- **Allowed Characters**: Alphanumeric, hyphens, underscores (`^[A-Z0-9_-]+$`).
- **Mutability**: Editable via Master Data APIs by authorized users. Changing `code` updates master metadata without mutating internal UUIDs or stock ledger history.

---

## 9. Location Name Rules
- **Required**: Yes (`NOT NULL`).
- **Max Length**: 100 characters.
- **Normalization**: Trimmed of leading/trailing whitespace.
- **Uniqueness**: Unique *within* parent `Warehouse` `(warehouseId, name)` (Case-Insensitive). Global name uniqueness is NOT required.
- **Rename Behavior**: Metadata update only. Does not break historical stock transactions.

---

## 10. Location Lifecycle
- **Active Location (`isActive = true`)**:
  - Permits creation of child `Rack` structures.
  - Permits indirect creation of child `Bin` entities under its Racks.
  - Permits **Stock IN** to its child Bins.
  - Permits **Stores Issue** from its child Bins.
  - Permits verified **Material Return** to its child Bins.
- **Inactive Location (`isActive = false`)**:
  - Blocks creation of new child Racks and Bins.
  - Blocks **Stock IN** to any Bin within this Location.
  - Blocks **Material Return** to any Bin within this Location.
  - Existing stock remains physically present and viewable for auditing/reporting.
  - Can be reactivated by authorized administrators.
  - *Stores Issue from inactive location*: Flagged under `DEC-LOC-004` (Requires Business Decision).

---

## 11. Location Deletion
- **Location with zero Racks & zero Stock**: Hard deletion permitted (`DELETE`).
- **Location with Racks, Bins, Stock, or Historical Transactions**: Hard deletion strictly `RESTRICTED`. Soft deactivation (`isActive = false`) must be used instead to protect historical movement traceability.

---

## 12. Rack — Business Definition
- **Definition**: A specific physical shelving framework or rack unit situated within a `WarehouseLocation`.
- **Purpose**: Houses multiple `Bin` storage compartments.
- **Relationship**: Belongs to exactly one `WarehouseLocation` (`locationId NOT NULL`).
- **Storage Rule**: A Rack contains multiple Bins. A Rack does **NOT** directly store inventory quantity (`StockBalance` is tracked at `Product + Bin`). Product is assigned to Bins inside the Rack, not directly to the Rack itself.

---

## 13. Rack Data Model
```typescript
export class Rack {
  id: string; // UUID primary key
  locationId: string; // Mandatory foreign key to parent WarehouseLocation
  code: string; // Rack code/identifier (e.g., "RACK-01")
  name: string; // Rack descriptive name (e.g., "Heavy Bar Rack 1")
  isActive: boolean; // Operational status flag
  createdAt: Date; // Audit creation timestamp
  updatedAt: Date; // Audit modification timestamp
}
```
*Note: Rack Number vs. Rack Name—Core model maintains both `code` and `name` for clear identification while avoiding unauthorized fields like Capacity or Weight Limit.*

---

## 14. Rack Identity
- **Primary Key**: Internal UUID `id`.
- **Uniqueness Scope**: Flagged as `DEC-RACK-001` (Unique within Location `(locationId, code)` vs Unique within Warehouse `(warehouseId, code)`). Standard baseline recommendation: Unique within Location `(locationId, normalized(code))`.

---

## 15. Rack Code Rules
- **Required**: Yes (`NOT NULL`).
- **Normalization**: Trimmed, converted to uppercase.
- **Max Length**: 50 characters.
- **Allowed Characters**: Alphanumeric, hyphens, underscores (`^[A-Z0-9_-]+$`).
- **Duplicate Behavior**: Rejected if code exists within the designated scope.
- **Rename Behavior**: Metadata update only; UUID remains unchanged.

---

## 16. Rack Lifecycle
- **Active Rack (`isActive = true`)**:
  - Permits creation of child `Bin` compartments.
  - Accepts **Stock IN**, **Stores Issue**, and **Material Return** targeting child Bins.
- **Inactive Rack (`isActive = false`)**:
  - Cannot be created under an inactive Location.
  - Blocks creation of new child Bins under this Rack.
  - Blocks **Stock IN** and **Material Return** targeting child Bins.
  - Existing stock balances remain viewable.
  - Can be reactivated if parent Location is active.

---

## 17. Rack Deletion
- **Rack with zero Bins**: Hard deletion allowed (`DELETE`).
- **Rack with Bins, Stock, or History**: Hard deletion `RESTRICTED`. Must use soft deactivation (`isActive = false`).

---

## 18. Bin — Business Definition
- **Definition**: The most granular physical storage compartment (e.g., shelf bin, slot, drawer, floor marker) within a `Rack`.
- **Authoritative Inventory Storage Level**: As established in Phase 2.1 (`DEC-001`), `Bin` is the authoritative physical storage location where operational stock balances (`StockBalance`) reside.
- **Relationship**: Belongs to exactly one `Rack` (`rackId NOT NULL`).

---

## 19. Bin Data Model
```typescript
export class Bin {
  id: string; // UUID primary key
  rackId: string; // Mandatory foreign key to parent Rack
  code: string; // Bin code (e.g., "BIN-A01")
  name: string; // Bin descriptive name/label (e.g., "Slot A-01")
  isActive: boolean; // Operational status flag
  createdAt: Date; // Audit creation timestamp
  updatedAt: Date; // Audit modification timestamp
}
```
*Note: Advanced features such as Barcode, QR Code, Bin Dimensions, Weight Limit, or Bin Type are OUT OF SCOPE for core master data unless specified by future business requirements.*

---

## 20. Bin Identity
- **Primary Key**: Internal UUID `id`.
- **Uniqueness Scope**: Identified as `DEC-BIN-001` (Bin Code Uniqueness Scope).
  - *Option A*: Unique within parent `Rack` `(rackId, code)`.
  - *Option B*: Unique within parent `Warehouse` `(warehouseId, code)`.
  - *Baseline*: `(rackId, normalized(code))` must be unique at minimum.

---

## 21. Bin Code Rules
- **Required**: Yes (`NOT NULL`).
- **Normalization**: Trimmed, converted to uppercase.
- **Max Length**: 50 characters.
- **Allowed Characters**: Alphanumeric, hyphens, underscores (`^[A-Z0-9_-]+$`).
- **Duplicate Behavior**: Rejection with 409 Conflict.
- **Rename Behavior**: Metadata update only.

---

## 22. Bin → Rack Relationship
- **Cardinality**: `Rack 1 ── N Bin`.
- **Mandatory**: Every Bin MUST belong to exactly one valid Rack (`rackId NOT NULL`).
- **Zero Bins**: A Rack may temporarily contain zero Bins upon creation.
- **Reassignment**: Bin reassignment to another Rack is governed by storage reassignment rules (Section 29).

---

## 23. Multi-Product Bin Decision Analysis
**Status**: `DEC-PROD-012 / MULTI-PRODUCT BIN` remains an **OPEN BUSINESS DECISION**.

### Technical Architecture Comparison:
- **Option A: Single-Product Bin (1 Bin → 1 Product)**
  - *Constraint*: Database or application rule enforces that a `binId` can only be associated with one `productId` in `StockBalance`.
  - *Pros*: Simplifies physical verification and visual picking; eliminates mixing of distinct raw materials or grades.
  - *Cons*: Reduces physical space utilization flexibility.
- **Option B: Multi-Product Bin (1 Bin → Multiple Products)**
  - *Schema Reality*: Core `StockBalance` composite identity `(productId, binId)` natively supports multiple products in a single bin (e.g., `(Product A, Bin 1)` and `(Product B, Bin 1)` as distinct balance rows).
  - *Pros*: Maximum warehouse space efficiency; realistic for bulk storage or divided bins.
  - *Cons*: Requires precise selection during Stores Issue to prevent picking errors.

> **CRITICAL ARCHITECTURAL DIRECTIVE**: Do NOT silently resolve DEC-PROD-012. The underlying database model `(productId, binId)` accommodates Option B cleanly, but whether business rules enforce Option A or Option B remains an open business decision for stakeholders.

---

## 24. Product in Multiple Bins
Supported natively by Phase 2.1. A single `Product` master record can exist across multiple Bins (`Bin A`, `Bin B`, `Bin C`), Racks, Locations, and Warehouses simultaneously:
- Balance Row 1: `(Product P1, Bin 1, Qty: 50)`
- Balance Row 2: `(Product P1, Bin 2, Qty: 30)`
- Total Global Balance: `SUM(50 + 30) = 80` (Calculated dynamically, no duplicate Product Master rows).

---

## 25. StockBalance Relationship
`StockBalance` represents the **CURRENT OPERATIONAL QUANTITY** for a specific product at a specific physical bin.
```typescript
export class StockBalance {
  id: string; // UUID
  productId: string; // Reference to Product Master (or InventoryItem per DEC-PROD-014)
  binId: string; // Mandatory reference to Bin
  currentQuantity: number; // Numeric(12,3), CHECK >= 0
  openingBalance?: number;
  lastTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```
- **Uniqueness Constraint**: Unique composite key `(productId, binId)`.
- **Zero Quantity Rule**: Retained as a 0.000 balance row to preserve atomic row locking and audit history.
- **No Higher-Level Balances**: `WarehouseStockBalance`, `LocationStockBalance`, or `RackStockBalance` entities MUST NOT be created.

---

## 26. StockTransaction Relationship
`StockTransaction` is the **IMMUTABLE MOVEMENT LEDGER**. It records physical inventory transfers between source and destination bins.
```typescript
export class StockTransaction {
  id: string; // UUID
  productId: string; // Product reference
  sourceBinId?: string; // Nullable for STOCK IN / ADJUSTMENT INCREASE
  destinationBinId?: string; // Nullable for STORES ISSUE / ADJUSTMENT DECREASE
  transactionType: TransactionType; // STOCK_IN, STORES_ISSUE, MOVEMENT, ADJUSTMENT
  quantity: number; // Numeric(12,3), CHECK > 0
  referenceType: string; // e.g., "SC_MATERIAL_ISSUE"
  referenceId?: string;
  createdById: string;
  createdAt: Date;
}
```
Higher-level storage metadata (Rack, Location, Warehouse) is derived by joining `sourceBinId` / `destinationBinId` to `Bin ──> Rack ──> WarehouseLocation ──> Warehouse`.

---

## 27. Stock IN Impact
Operational Stock IN workflow:
1. User selects target `Warehouse`.
2. UI cascades valid child `Locations` ──> `Racks` ──> `Bins`.
3. System verifies target `Bin`, `Rack`, `Location`, and `Warehouse` are all `isActive = true`.
4. System updates/creates `StockBalance(productId, binId)` by incrementing `currentQuantity`.
5. System appends immutable `StockTransaction` with `destinationBinId = binId`.

---

## 28. Stores Issue Impact
Stores Issue workflow:
1. User identifies required `Product`.
2. System displays available bins containing non-zero `StockBalance` for that Product.
3. User selects exact source `Bin`.
4. System validates `StockBalance.currentQuantity >= issueQuantity` and verifies active storage status.
5. System atomically decrements `StockBalance.currentQuantity`.
6. System appends `StockTransaction` with `sourceBinId = binId`.

---

## 29. Material Return Dependency
Material Return from Production depends on `DEC-005` (*Return Destination Bin Policy*).
- Workflow: Production Return ──> Stores Verification ──> Destination Warehouse ──> Location ──> Rack ──> Bin ──> `StockBalance` increment.
- Destination bin rules (Original Bin vs. Dedicated Return/Quarantine Bin) are NOT finalized in this phase and remain dependent on `DEC-005`.

---

## 30. Additional Material Impact
Production requests for additional material follow the standard Stores Issue pathway:
`Additional Request ──> Stores Verification ──> Bin Selection ──> StockBalance Atomic Decrement ──> StockTransaction Ledger`. No secondary workflow entity is created.

---

## 31. Bin Lifecycle
- **Active Bin (`isActive = true`)**: Full operational capability (Stock IN, Stores Issue, Material Return, selection dropdowns).
- **Inactive Bin (`isActive = false`)**:
  - Blocks new Stock IN and Material Return.
  - Blocks Stores Issue (unless explicit business decision under `DEC-BIN-003` permits drain of existing stock).
  - Existing stock quantity remains visible in inventory reports.
  - Can be reactivated if parent Rack, Location, and Warehouse are active.

---

## 32. Parent/Child Cascading Lifecycle
**Decision ID**: `DEC-STORAGE-001` (*Parent Deactivation Cascade*).

### Options Analysis:
- **Model A (Explicit State Cascade)**: Deactivating a parent (e.g., Warehouse or Location) automatically updates `isActive = false` on all child Racks and Bins.
  - *Risk*: Reactivating the parent loses track of which child Bins were previously manually deactivated.
- **Model B (Inherited Operational Status - RECOMMENDED)**: Child entities preserve their explicit `isActive` master data status in the database. However, operational evaluation checks the full ancestor hierarchy:
  `IsBinUsable = Bin.isActive && Rack.isActive && Location.isActive && Warehouse.isActive`.

---

## 33. Storage Reassignment Rules
Master data updates to parent references (`Bin.rackId`, `Rack.locationId`, `Location.warehouseId`):
- **Rule**: Updating master data hierarchy MUST NOT automatically transfer stock balances.
- **Stock Movement Constraint**: If a Bin contains non-zero `StockBalance` (`currentQuantity > 0`), master data reassignment of that Bin to another Rack/Location is `RESTRICTED` unless an explicit `StockTransaction` physical transfer is executed, OR a business decision (`DEC-STORAGE-003`) permits logical relocation without ledger entries.

---

## 34. Reconciliation
Bin-level reconciliation compares physical counts against system counts:
- `Calculated Balance = Opening Balance + SUM(Stock IN) - SUM(Stock OUT) ± SUM(Adjustments)`.
- Reconciliations are executed at specific `Bin` targets. Discrepancies generate an `ADJUSTMENT` type `StockTransaction`.

---

## 35. Search & Filtering Design
Hierarchical cascading lookup filter design for API and UX:
```
[Select Warehouse]
       ↓ (Filters Locations where location.warehouseId == selectedWarehouse)
[Select Location]
       ↓ (Filters Racks where rack.locationId == selectedLocation)
[Select Rack]
       ↓ (Filters Bins where bin.rackId == selectedRack)
[Select Bin]
```
Product filters (`Category ──> Family ──> Product`) operate orthogonally to storage filters.

---

## 36. Conceptual API Design
*Conceptual design only. No implementation permitted.*

### Endpoints:
- `POST /api/v1/warehouse-locations` — Create Location
- `GET /api/v1/warehouse-locations?warehouseId=:id` — List Locations by Warehouse
- `PATCH /api/v1/warehouse-locations/:id` — Update Location
- `PATCH /api/v1/warehouse-locations/:id/deactivate` — Soft Deactivate Location

- `POST /api/v1/racks` — Create Rack
- `GET /api/v1/racks?locationId=:id` — List Racks by Location
- `PATCH /api/v1/racks/:id` — Update Rack
- `PATCH /api/v1/racks/:id/deactivate` — Soft Deactivate Rack

- `POST /api/v1/bins` — Create Bin
- `GET /api/v1/bins?rackId=:id` — List Bins by Rack
- `PATCH /api/v1/bins/:id` — Update Bin
- `PATCH /api/v1/bins/:id/deactivate` — Soft Deactivate Bin

---

## 37. Conceptual Frontend UX Design
- **Location Master View**: Table displaying Code, Name, Parent Warehouse, Status. Filter dropdown by Warehouse.
- **Rack Master View**: Table displaying Rack Code, Name, Parent Location, Parent Warehouse, Status.
- **Bin Master View**: Table displaying Bin Code, Name, Parent Rack, Location, Warehouse, Active Status.
- **Cascading Select Component**: Reusable UI component enforcing sequential `Warehouse ──> Location ──> Rack ──> Bin` selection during Stock IN and Stores Issue.

---

## 38. Role-Based Access Control (RBAC) Matrix
Based on the 6 baseline roles (`DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`, `ADMIN`):

| Operation | ADMIN | STORES | PRODUCTION | DESIGNER | SENIOR_MANAGER | GENERAL_MANAGER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| View Location/Rack/Bin | Yes | Yes | Yes | Yes | Yes (Read Only) | Yes (Read Only) |
| Create Location/Rack/Bin | Yes | Flagged (DEC-WH-006) | No | No | No | No |
| Edit Location/Rack/Bin | Yes | Flagged (DEC-WH-006) | No | No | No | No |
| Deactivate Storage Entity | Yes | Flagged (DEC-WH-006) | No | No | No | No |
| Hard Delete Storage Entity | Yes | No | No | No | No | No |

---

## 39. Auditability
- **Master Data Auditing**: Entity-level tracking via `createdAt`, `updatedAt`, and audit logs capturing `actorId`, `action`, `oldValues`, and `newValues`.
- **Stock Movement Auditing**: `StockTransaction` remains historically immutable with explicit references to `createdById`, timestamps, and exact source/destination Bin UUIDs.

---

## 40. Historical Traceability Protection
Renaming a Location, Rack, or Bin modifies only the text attribute (`code` or `name`) on the master entity. Foreign key relationships in `StockBalance` and `StockTransaction` reference immutable UUID `id` values. Stock history remains 100% intact and traceable across master data name edits.

---

## 41. Existing Repository Impact Inspection
Inspection of `backend/src/inventory`:
- **Current State**: Phase 10 entities (`InventoryItem`, `StockBalance`, `StockTransaction`) maintain stock without location granularity. `StockBalance` references `inventoryItemId` directly.
- **Phase 7 DB Impact**: Will add `Warehouse`, `WarehouseLocation`, `Rack`, and `Bin` tables. `StockBalance` will be modified to reference `binId` (composite key with `productId`/`inventoryItemId`).
- **Phase 11 API Impact**: Will introduce location master data CRUD controllers and services.
- **Phase 12 Workflow Impact**: Stores Issue and Stock IN services will mandate `binId` validation.

---

## 42. InventoryItem Dependency
`DEC-PROD-014` (*InventoryItem Reconciliation*) remains **OPEN**.
The physical storage design (`WarehouseLocation ──> Rack ──> Bin`) is completely agnostic to whether `StockBalance` points to `Product` or `InventoryItem` (RM Spec), as `binId` serves strictly as the physical location key.

---

## 43. Migration Impact
- **Legacy Stock**: Pre-existing inventory items lack location metadata.
- **Migration Strategy**: Phase 11/12 migration will create a default `MAIN WAREHOUSE` ──> `DEFAULT LOCATION` ──> `DEFAULT RACK` ──> `DEFAULT BIN` structure to house legacy stock balances until physical auditing assigns them to actual bins.

---

## 44. Performance Design & Indexing

### Database Indexes:
1. `WarehouseLocation`: `CREATE INDEX idx_location_wh_code ON warehouse_locations(warehouse_id, code);`
2. `Rack`: `CREATE INDEX idx_rack_loc_code ON racks(location_id, code);`
3. `Bin`: `CREATE INDEX idx_bin_rack_code ON bins(rack_id, code);`
4. `StockBalance`: `CREATE UNIQUE INDEX idx_stock_balance_prod_bin ON stock_balances(product_id, bin_id);`
5. `StockTransaction`: `CREATE INDEX idx_stock_tx_src_bin ON stock_transactions(source_bin_id);`
6. `StockTransaction`: `CREATE INDEX idx_stock_tx_dest_bin ON stock_transactions(destination_bin_id);`

---

## 45. Validation Matrix

| Entity | Field | Rule | Required | Unique Scope | Mutable | Delete Rule |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `WarehouseLocation` | `code` | Uppercase, Alphanumeric | Yes | `(warehouseId, code)` | Yes | RESTRICT if Racks/Stock exist |
| `WarehouseLocation` | `name` | Trimmed string | Yes | `(warehouseId, name)` | Yes | RESTRICT if Racks/Stock exist |
| `WarehouseLocation` | `warehouseId` | Valid Warehouse UUID | Yes | N/A | No | RESTRICT if Locations exist |
| `Rack` | `code` | Uppercase, Alphanumeric | Yes | `(locationId, code)` | Yes | RESTRICT if Bins/Stock exist |
| `Rack` | `locationId` | Valid Location UUID | Yes | N/A | Restricted | RESTRICT if Bins exist |
| `Bin` | `code` | Uppercase, Alphanumeric | Yes | `(rackId, code)` | Yes | RESTRICT if Stock/Tx exist |
| `Bin` | `rackId` | Valid Rack UUID | Yes | N/A | Restricted | RESTRICT if Stock exist |

---

## 46. Relationship Matrix

| Parent | Child | Cardinality | Required | Delete Rule | Deactivation Impact |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `Warehouse` | `WarehouseLocation` | 1:N | Yes | RESTRICT | Blocks child creation & Stock IN |
| `WarehouseLocation` | `Rack` | 1:N | Yes | RESTRICT | Blocks child creation & Stock IN |
| `Rack` | `Bin` | 1:N | Yes | RESTRICT | Blocks child creation & Stock IN |
| `Bin` | `StockBalance` | 1:N | Yes | RESTRICT | Preserves balance, blocks additions |
| `Bin` | `StockTransaction` (Source) | 1:N | No | RESTRICT | Historical log preserved |
| `Bin` | `StockTransaction` (Dest) | 1:N | No | RESTRICT | Historical log preserved |

---

## 47. Business Rule Matrix

| Rule ID | Statement | Status |
| :--- | :--- | :---: |
| **BR-STORAGE-001** | Every WarehouseLocation belongs to exactly one Warehouse (`warehouseId NOT NULL`). | AUTHORITATIVE |
| **BR-STORAGE-002** | Every Rack belongs to exactly one WarehouseLocation (`locationId NOT NULL`). | AUTHORITATIVE |
| **BR-STORAGE-003** | Every Bin belongs to exactly one Rack (`rackId NOT NULL`). | AUTHORITATIVE |
| **BR-STORAGE-004** | StockBalance is tracked strictly at Product + Bin level. | AUTHORITATIVE |
| **BR-STORAGE-005** | WarehouseLocation does not maintain cached stock balances. | AUTHORITATIVE |
| **BR-STORAGE-006** | Rack does not maintain cached stock balances. | AUTHORITATIVE |
| **BR-STORAGE-007** | Bin is the authoritative physical stock location. | AUTHORITATIVE |
| **BR-STORAGE-008** | A single Product may exist across multiple Bins simultaneously. | AUTHORITATIVE |
| **BR-STORAGE-009** | A single Product may exist across multiple Warehouses simultaneously. | AUTHORITATIVE |
| **BR-STORAGE-010** | Master data edits must never silently move physical stock balances. | AUTHORITATIVE |
| **BR-STORAGE-011** | Historical StockTransactions must remain immutable and traceable. | AUTHORITATIVE |
| **BR-STORAGE-012** | Child storage entities cannot exist without valid parent entities. | AUTHORITATIVE |
| **BR-STORAGE-013** | Invalid parent-child selections must be rejected by APIs and UI components. | AUTHORITATIVE |
| **BR-STORAGE-014** | Warehouse-level stock is derived dynamically via SQL aggregation over child Bins. | AUTHORITATIVE |

---

## 48. Edge-Case Matrix

| # | Edge Case Scenario | System Behavior Status | Detail / Action |
| :---: | :--- | :---: | :--- |
| 1 | Warehouse with zero Locations | SUPPORTED | Valid master data state upon creation. |
| 2 | Location with zero Racks | SUPPORTED | Valid state; cannot receive stock until Bin added. |
| 3 | Rack with zero Bins | SUPPORTED | Valid state; cannot receive stock until Bin added. |
| 4 | Bin with zero stock | SUPPORTED | Retained as 0.000 balance row for auditability. |
| 5 | Bin with positive stock | SUPPORTED | Active operational balance. |
| 6 | Product in one Bin | SUPPORTED | Standard single-bin storage. |
| 7 | Product in multiple Bins | SUPPORTED | Supported via multiple `StockBalance` rows. |
| 8 | Product in multiple Warehouses | SUPPORTED | Supported across distinct storage hierarchies. |
| 9 | Duplicate Location code in same WH | RESTRICTED | 409 Conflict rejection `(warehouseId, code)`. |
| 10 | Same Location code in different WHs | SUPPORTED | Valid scope separation (`WH-01/LOC-A` vs `WH-02/LOC-A`). |
| 11 | Duplicate Rack code in same Location | RESTRICTED | 409 Conflict rejection `(locationId, code)`. |
| 12 | Same Rack code in different Locations | SUPPORTED | Valid scope separation. |
| 13 | Duplicate Bin code in same Rack | RESTRICTED | 409 Conflict rejection `(rackId, code)`. |
| 14 | Same Bin code in different Racks | SUPPORTED | Valid scope separation. |
| 15 | Rename Location | SUPPORTED | Metadata update; history preserved via UUIDs. |
| 16 | Rename Rack | SUPPORTED | Metadata update; history preserved via UUIDs. |
| 17 | Rename Bin | SUPPORTED | Metadata update; history preserved via UUIDs. |
| 18 | Deactivate Location | SUPPORTED | Blocks Stock IN; preserves current stock view. |
| 19 | Deactivate Rack | SUPPORTED | Blocks Stock IN under child Bins. |
| 20 | Deactivate Bin | SUPPORTED | Blocks new Stock IN to bin. |
| 21 | Delete Location with Racks | RESTRICTED | Must deconstruct/deactivate child Racks first. |
| 22 | Delete Rack with Bins | RESTRICTED | Must deconstruct/deactivate child Bins first. |
| 23 | Delete Bin with stock | RESTRICTED | Hard delete forbidden when `currentQuantity > 0`. |
| 24 | Delete Bin with historical tx | RESTRICTED | Hard delete forbidden to preserve movement history. |
| 25 | Move Location to another WH | REQUIRES DECISION | Flagged under `DEC-LOC-003`. |
| 26 | Move Rack to another Location | REQUIRES DECISION | Flagged under `DEC-RACK-003`. |
| 27 | Move Bin to another Rack | REQUIRES DECISION | Flagged under `DEC-BIN-004`. |
| 28 | Multi-product Bin | REQUIRES DECISION | Open under `DEC-PROD-012`. |
| 29 | Legacy stock without location | SUPPORTED | Handled via Default Migration Bin in Phase 11/12. |
| 30 | Stock IN to inactive storage | RESTRICTED | Rejected with 400 Bad Request. |
| 31 | Stores Issue from inactive storage | REQUIRES DECISION | Flagged under `DEC-BIN-003`. |
| 32 | Material Return to inactive storage | RESTRICTED | Rejected; active bin target required. |

---

## 49. Decision Register

### Resolved Decisions:
- **DEC-WH-001**: Warehouse Code Format (Uppercase string, max 50 chars, trimmed).
- **DEC-WH-002**: Warehouse Code Uniqueness (Globally unique, case-insensitive).
- **DEC-WH-003**: Warehouse Name Uniqueness (Globally unique, case-insensitive).
- **DEC-WH-004**: Warehouse Deactivation Rules (Blocks new Locations and Stock IN; preserves history).
- **DEC-WH-005**: Warehouse Deletion Policy (RESTRICTED if child entities exist).
- **DEC-WH-007**: Location Uniqueness Scope (Unique within parent Warehouse `(warehouseId, code)`).

### Open Decisions (Preserved / Created):
- **DEC-WH-006**: Warehouse & Location Master Creation Authority (`ADMIN` vs `STORES`).
- **DEC-WH-008**: Inter-Warehouse Transfer Requirement.
- **DEC-005**: Return Destination Storage Rule (Original Bin vs Quarantine Bin).
- **DEC-PROD-010**: Maximum Inventory Enforcement.
- **DEC-PROD-012**: Multi-Product Bin (1 Bin ──> 1 Product vs 1 Bin ──> Multiple Products).
- **DEC-PROD-014**: InventoryItem vs Product Reconciliation.
- **DEC-LOC-001**: Location Code Format Standard (Baseline: Uppercase, alphanumeric, max 50).
- **DEC-LOC-002**: Location Name Uniqueness Scope (Baseline: Unique within parent Warehouse).
- **DEC-LOC-003**: Location Reassignment Policy (Allowed without stock vs Restricted).
- **DEC-LOC-004**: Stores Issue from Inactive Location Policy.
- **DEC-RACK-001**: Rack Code Uniqueness Scope (Baseline: Unique within parent Location).
- **DEC-RACK-002**: Rack Lifecycle Deactivation Rules.
- **DEC-RACK-003**: Rack Reassignment Policy.
- **DEC-BIN-001**: Bin Code Uniqueness Scope (Baseline: Unique within parent Rack).
- **DEC-BIN-002**: Multi-Product Bin Business Constraint.
- **DEC-BIN-003**: Stores Issue from Inactive Bin Policy.
- **DEC-BIN-004**: Bin Reassignment Policy.
- **DEC-STORAGE-001**: Parent Deactivation Cascade Model (Explicit State vs Inherited Status).
- **DEC-STORAGE-002**: Storage Master Hard Delete Criteria.

---

## 50. Phase 7, 11 & 12 Impact

### Phase 7 — Database Design
- Design TypeORM entities for `WarehouseLocation`, `Rack`, and `Bin`.
- Add foreign key constraints: `WarehouseLocation ──> Warehouse`, `Rack ──> WarehouseLocation`, `Bin ──> Rack`.
- Update `StockBalance` table to add mandatory `binId` foreign key and composite unique index `(product_id, bin_id)`.
- Update `StockTransaction` table to add nullable `source_bin_id` and `destination_bin_id` foreign keys.

### Phase 11 — Master Data Implementation
- Implement CRUD services and controllers for `WarehouseLocation`, `Rack`, and `Bin`.
- Enforce code normalization and unique constraints in DTO validation pipelines.
- Build cascading storage management views in frontend.

### Phase 12 — Core Business Workflow
- Integrate cascading `Warehouse ──> Location ──> Rack ──> Bin` selection into Stores Stock IN UI.
- Update Stores Issue service to select specific source `binId` and execute atomic decrement.
- Update Material Return service to process verified returns to destination bins per `DEC-005`.
