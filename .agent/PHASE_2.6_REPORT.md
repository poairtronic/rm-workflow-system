# PHASE 2.6 REPORT: INVENTORY BALANCE DESIGN

## 1. Executive Summary
Phase 2.6 has successfully defined and frozen the authoritative **Inventory Balance Domain Design** for the RMRIT manufacturing system. This design establishes **`Product + Bin = One StockBalance`** as the non-negotiable physical balance granularity, cleanly separating Master Data from inventory balances, and immutable transaction ledgers from mutable balance states.

This phase was executed strictly as a **DESIGN-ONLY** phase. No source code, database tables, migrations, APIs, frontend components, or existing business logic were modified.

---

## 2. What Was Reviewed
1. **Authoritative Governance & Requirements**:
   - `.agent/CURRENT_REQUIREMENTS_BASELINE.md` (Single source of truth)
   - `.agent/REQUIREMENT_CHANGE_RECONCILIATION.md`
   - `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
   - `.agent/PHASE_1_REPORT.md`
2. **Preceding Phase 2 Architecture Documents**:
   - `.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md` & `.agent/PHASE_2.1_REPORT.md`
   - `.agent/PHASE_2.2_PRODUCT_MASTER_DESIGN.md` & `.agent/PHASE_2.2_REPORT.md`
   - `.agent/PHASE_2.3_CATEGORY_FAMILY_DESIGN.md` & `.agent/PHASE_2.3_REPORT.md`
   - `.agent/PHASE_2.4_WAREHOUSE_DESIGN.md` & `.agent/PHASE_2.4_REPORT.md`
   - `.agent/PHASE_2.5_LOCATION_RACK_BIN_DESIGN.md` & `.agent/PHASE_2.5_REPORT.md`
3. **Repository Implementation Areas**:
   - `backend/src/inventory/entities/inventory-item.entity.ts`
   - `backend/src/inventory/entities/stock-balance.entity.ts`
   - `backend/src/inventory/entities/stock-transaction.entity.ts`
   - `backend/src/inventory/inventory.service.ts`
   - `backend/src/inventory/inventory.controller.ts`
   - `backend/src/inventory/dto/*`
   - `backend/src/database/migrations/*`
   - `frontend/src/pages/InventoryPage.tsx`

---

## 3. What Was Designed
1. **Authoritative Balance Model**:
   - Explicitly anchored at `Product (UUID) + Bin (UUID) = StockBalance`.
   - Prohibited duplicate / cached balance tables for Warehouse, Location, Rack, or Global totals.
   - Defined dynamic SQL aggregation formulas to derive Rack, Location, Warehouse, and Global product stock on demand.
2. **Quantity Lifecycle & Mutation Rules**:
   - Standardized 8 quantity types: Current Quantity, Opening Balance, Stock IN, Stock OUT, Stores Issue, Material Return, Adjustment, Transfer.
   - Enforced database-level non-negative constraint (`CHECK (current_quantity >= 0)`).
   - Preserved `NUMERIC(12,3)` manufacturing precision.
3. **Ledger & Movement Traceability**:
   - `StockTransaction` specified as the immutable append-only ledger capturing 5W1H (`productId`, `sourceBinId`, `destinationBinId`, `transactionType`, `quantity`, `referenceType`, `referenceId`, `remarks`, `createdById`, `createdAt`).
   - Detailed exact source/destination semantics across all movement types.
4. **Concurrency & Atomicity**:
   - Designed atomic conditional SQL update patterns with row-level locking to guarantee safe concurrent stock issues without race conditions.
5. **Reconciliation Engine**:
   - Defined bin-level ledger verification formula: $Q_{\text{current}} == Q_{\text{open}} + \sum \text{Tx IN} - \sum \text{Tx OUT} \pm \sum \text{Adjustments}$.
   - Specified reconciliation rollup logic from Bin up to Global Product totals.
6. **Master Data & Storage Interaction**:
   - Defined active/inactive cascading operational rules across storage nodes.
   - Isolated master data renaming from transaction histories using immutable UUIDs.
   - Restricted storage master hierarchy reassignment for bins containing active stock.
7. **Legacy Migration Pathway**:
   - Formulated default storage mapping (`MAIN WAREHOUSE ──> DEFAULT LOCATION ──> DEFAULT RACK ──> DEFAULT BIN`) to house pre-existing Phase 10 stock with `opening_balance`.

---

## 4. What Was Confirmed
- [x] **`Product + Bin` is the single authoritative stock balance granularity.**
- [x] **`Product` does NOT own current stock quantity or storage IDs.**
- [x] **`Warehouse`, `Location`, and `Rack` do NOT own duplicate cached stock balance columns.**
- [x] **`Bin` is the authoritative physical storage anchor.**
- [x] **One `Product` + One `Bin` has exactly one authoritative `StockBalance` row (`UNIQUE(product_id, bin_id)`).**
- [x] **`StockTransaction` is an immutable movement history ledger.**
- [x] **Physical stock cannot become negative.**
- [x] **Stock IN targets an exact, active Bin.**
- [x] **Stock OUT / Stores Issue originates from an exact, active Bin.**
- [x] **Return destination storage decision (`DEC-005`) is correctly documented and preserved.**
- [x] **Global product stock is derived dynamically from child bin balances.**
- [x] **Minimum and Maximum Inventory remain product-level master data values.**
- [x] **Reconciliation supports bin-level verification.**
- [x] **Zero-balance rows remain persisted (`0.000`), never deleted.**
- [x] **Storage master renaming does not silently move stock.**
- [x] **Legacy `InventoryItem` reconciliation (`DEC-PROD-014`) is documented and preserved.**
- [x] **RBAC adheres strictly to the 6 baseline roles (no `SENIOR_DESIGNER`).**
- [x] **No unauthorized features were added (no batch, lot, serial, unit conversion, FIFO, cost accounting, etc.).**

---

## 5. What Was Reconciled & Found in Current Implementation
- **Current Repo State**: The existing Phase 10 implementation maintains `StockBalance` 1:1 with `InventoryItem` and executes atomic raw SQL updates in `InventoryService`. It uses `NUMERIC(12,3)` and check constraints.
- **Architectural Shift**: Phase 2.6 supersedes the 1:1 global item balance with `(Product, Bin)` composite balance identity while preserving and reusing the atomic SQL update pattern, transaction ledger approach, and non-negative constraints.
- **Reconciliation Model**: Current reconciliation was performed per item. Phase 2.6 extends this to authoritative bin-level reconciliation with rollup aggregations.

---

## 6. What Was NOT Changed
- **Zero code changes**: No backend files (`backend/src/...`) or frontend files (`frontend/src/...`) were edited.
- **Zero database schema changes**: No database tables, column definitions, or constraints were altered.
- **Zero migrations created**: No migration scripts were added to `backend/src/database/migrations`.
- **Existing Phase 10 workflows**: The current running system remains completely intact and undisturbed.

---

## 7. Decision Register Status

### Resolved Decisions:
- **DEC-001**: Stock Balance Granularity (`Product + Bin` level) — **RESOLVED**.
- **DEC-002**: Multi-Location Product Support (N Bins across N Warehouses) — **RESOLVED**.
- **DEC-006**: Source/Destination in Movement Ledger (`sourceBinId`, `destinationBinId`) — **RESOLVED**.
- **DEC-007**: Product Total Stock Aggregation (Dynamic SQL sum over Bins) — **RESOLVED**.
- **DEC-008**: Stock Status Precedence (Out [0], Low [<Min], Normal, Excess [>Max]) — **RESOLVED**.
- **DEC-BAL-001**: Opening Balance Immutability (Immutable once operations begin) — **RESOLVED**.
- **DEC-BAL-002**: Zero Balance Lifecycle (Persist `0.000` row, never delete) — **RESOLVED**.

### Open Decisions Preserved for Stakeholder / Business Resolution:
- **DEC-005**: Return Destination Storage Policy (Original Bin vs Dedicated Quarantine Bin vs Stores Selection).
- **DEC-PROD-010**: Maximum Inventory Enforcement (Warning Notification vs Hard Blocking).
- **DEC-PROD-011**: Product Master Creation Authority (`ADMIN` only vs `STORES`/`DESIGNER`).
- **DEC-PROD-012**: Multi-Product Bin Policy (Single-Product Bin vs Multi-Product Bin).
- **DEC-PROD-013**: Transaction Name Snapshot (Dynamic join vs text snapshot).
- **DEC-PROD-014**: Existing `InventoryItem` vs Product Master Reconciliation.
- **DEC-WH-006**: Warehouse & Location Creation Authority (`ADMIN` only vs `STORES`).
- **DEC-WH-008**: Inter-Warehouse Stock Transfer Requirement.
- **DEC-LOC-001** to **DEC-LOC-004**: Location Code standard, Name uniqueness scope, Reassignment, and Inactive Issue policies.
- **DEC-RACK-001** to **DEC-RACK-003**: Rack Code scope, Lifecycle, and Reassignment policies.
- **DEC-BIN-001** to **DEC-BIN-004**: Bin Code scope, Multi-Product constraint, Lifecycle, and Reassignment policies.
- **DEC-STORAGE-001** & **DEC-STORAGE-002**: Parent Deactivation Cascade and Delete policies.

---

## 8. Readiness Assessment & Blockers
- **Blockers**: None. All core inventory balance structures, identities, atomic movement semantics, and aggregations are fully designed and frozen. Open decisions do not impede the technical data model or subsequent phase design.
- **Phase 2.7 Readiness**: The Inventory Balance Domain design is complete and fully reconciled with all master data and storage hierarchies.

---

## 9. Final Status

$$\textbf{STATUS: READY FOR PHASE 2.7}$$
