# PHASE 8.2 — BUSINESS WORKFLOW DATABASE IMPLEMENTATION & DATA RECONCILIATION

## 1. OBJECTIVE
Phase 8.2 implements and reconciles the database schema and entity relationships for the complete manufacturing business workflow domain:
```
Customer → PurchaseOrder → SalesOrderComponent → RmRequest → RmItem → MaterialIssue → MaterialReceipt → MaterialConsumption → MaterialReturn & AdditionalMaterialRequest
```
While preserving existing data, existing functionality, physical inventory authority (`Product + Bin = StockBalance`), immutable transaction ledgering (`StockTransaction`), and legacy `InventoryItem` compatibility.

---

## 2. PRE-CHECK & AUDIT SUMMARY
- **Git Status**: Clean working tree on `main` branch.
- **Phase 8.1 Status**: Verified COMPLETE (`.agent/PHASE_8.1_REPORT.md`).
- **Entity Registration**: All 30 domain entities are registered in `ALL_ENTITIES` in `backend/src/config/data-source.ts`.
- **Test Baseline**: 141 / 141 backend unit tests pass.

---

## 3. DOMAIN WORKFLOW SCHEMA & RELATIONSHIPS

### 3.1. Order Intake Domain
- **`Customer` (`customers`)**:
  - `id`: UUID (PK)
  - `code`: VARCHAR(50) (UNIQUE)
  - `name`: VARCHAR(100) (UNIQUE)
  - `is_active`: BOOLEAN (DEFAULT TRUE)
- **`PurchaseOrder` (`purchase_orders`)**:
  - `id`: UUID (PK)
  - `po_number`: VARCHAR(100) (UNIQUE)
  - `customer_id`: UUID (FK to `customers`, `ON DELETE RESTRICT`)
- **`SalesOrderComponent` (`sales_order_components`)**:
  - `id`: UUID (PK)
  - `sc_number`: VARCHAR(100) (INDEXED)
  - `po_id`: UUID (FK to `purchase_orders`, `ON DELETE RESTRICT`)
  - `product_name`: VARCHAR(150)
  - `target_quantity`: NUMERIC(12,3) (DEFAULT 1)
  - `status`: VARCHAR(50) (DEFAULT `DRAFT`)
  - **Autonomous SC Lifecycle**: SCs under a PO progress and complete independently without aggregate PO-wide completion blockers.

---

### 3.2. Raw Material Specification Domain
- **`RmRequest` (`rm_requests`)**:
  - `id`: UUID (PK)
  - `sc_id`: UUID (FK to `sales_order_components`, `ON DELETE RESTRICT`)
  - `status`: VARCHAR(50) (DEFAULT `DRAFT`)
  - `created_by_id`: UUID (FK to `users`, `ON DELETE RESTRICT`)
- **`RmItem` (`rm_items`)**:
  - `id`: UUID (PK)
  - `rm_form_id`: UUID (FK to `rm_requests`, `ON DELETE CASCADE`)
  - `sc_id`: UUID (FK to `sales_order_components`, `ON DELETE RESTRICT`)
  - `material`, `material_type`, `grade`, `size`, `quantity` (NUMERIC(12,3))
- **`RmFormSc` (`rm_form_scs`)** & **`RmItemSnapshot` (`rm_item_snapshots`)**:
  - Point-in-time snapshot history for RM revision traceability. Baseline remains immutable after submission.

---

### 3.3. Stores Issuance Domain
- **`MaterialIssue` (`material_issues`)**:
  - `id`: UUID (PK)
  - `sc_id`: UUID (FK to `sales_order_components`, `ON DELETE RESTRICT`)
  - `issue_number`: VARCHAR(100) (UNIQUE)
  - `issue_type`: VARCHAR(50) (DEFAULT `INITIAL_ISSUE`)
  - `issued_by_id`: UUID (FK to `users`, `ON DELETE RESTRICT`)
- **`MaterialIssueItem` (`material_issue_items`)**:
  - `id`: UUID (PK)
  - `material_issue_id`: UUID (FK to `material_issues`, `ON DELETE CASCADE`)
  - `rm_item_id`: UUID (FK to `rm_items`, `ON DELETE RESTRICT`)
  - `quantity_issued`: NUMERIC(12,3)
  - **Stock Authority**: Stores Issue is the sole physical store stock decrement event (`StockBalance -= qty`).

---

### 3.4. Production Custody, Consumption & Return Domain
- **`MaterialReceipt` (`material_receipts`)** & **`MaterialReceiptItem` (`material_receipt_items`)**:
  - Records shop-floor custody transfer. Zero store inventory stock mutation.
- **`MaterialConsumption` (`material_consumptions`)**:
  - `id`: UUID (PK)
  - `sc_id`: UUID (FK), `rm_item_id`: UUID (FK), `consumed_quantity`: NUMERIC(12,3)
  - Tracks production usage. Zero store inventory stock mutation (prevents double deduction).
- **`MaterialReturn` (`material_returns`)** & **`MaterialReturnItem` (`material_return_items`)**:
  - Two-stage workflow: Production initiates return (`PENDING_STORE_ACK`, no stock change) → Stores verifies return (`ACKNOWLEDGED`, atomically increments `StockBalance` at destination `bin_id` and logs `StockTransaction`).

---

### 3.5. Additional Material Domain
- **`AdditionalMaterialRequest` (`additional_material_requests`)** & **`AdditionalMaterialRequestItem` (`additional_material_request_items`)**:
  - Tracks shop-floor material variance without altering original RM baseline (`rm_items`).
  - Stock is decremented only when Stores issues the additional material.

---

## 4. INVENTORY MUTATION BOUNDARY MATRIX

| WORKFLOW STAGE | TABLE | INVENTORY STOCK MUTATION | LEDGER MUTATION |
|---|---|---|---|
| RM Creation | `rm_requests` | NONE (0) | NONE |
| RM Submission | `rm_requests` | NONE (0) | NONE |
| Stores Issue | `material_issues` | `StockBalance -= quantity` at `bin_id` | `StockTransaction` logged (`STORES_ISSUE`) |
| Production Receipt | `material_receipts` | NONE (0) | NONE |
| Consumption | `material_consumptions` | NONE (0) | NONE |
| Return Initiated | `material_returns` | NONE (0) | NONE |
| Return Acknowledged | `material_returns` | `StockBalance += quantity` at destination `bin_id` | `StockTransaction` logged (`RETURN`) |
| Additional Request | `additional_material_requests` | NONE (0) | NONE |
| Additional Issue | `material_issues` | `StockBalance -= quantity` at `bin_id` | `StockTransaction` logged (`STORES_ISSUE`) |

---

## 5. FOREIGN KEY & CASCADE POLICIES
- **Header → Owned Lines**: `ON DELETE CASCADE` (e.g. `MaterialIssue` → `MaterialIssueItem`, `MaterialReturn` → `MaterialReturnItem`).
- **Master Data / Historical Reference**: `ON DELETE RESTRICT` (e.g. `products`, `bins`, `sales_order_components`, `users`, `rm_items`).
- **Optional Reference**: `ON DELETE SET NULL` (e.g. `additional_request_id` on `MaterialIssue`).
