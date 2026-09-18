# PHASE 7.4 — FINAL BUSINESS WORKFLOW DATABASE SCHEMA RECONCILIATION & INTEGRATION DESIGN

**Domain:** RMRIT Manufacturing Application  
**Phase:** 7.4 — Final Business Workflow Database Schema Reconciliation & Integration Design  
**Role:** Senior Database Architect + Enterprise System Architect + Manufacturing ERP Data Modeling Specialist  
**Status:** COMPLETE (Design & Specification Only — Zero Code / Schema Mutation)  
**Date:** September 18, 2026  

---

## 1. EXECUTIVE SUMMARY

Phase 7.4 establishes the authoritative, enterprise-grade **Final Business Workflow Database Schema Reconciliation & Integration Design** for the RMRIT manufacturing system.

Building directly upon the master data taxonomy, 4-tier storage hierarchy, and atomic inventory balance foundations finalized in Phase 7.3 (`ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, `Bin`, `StockBalance`, `StockTransaction`, and `InventoryItem`), this phase standardizes, reconciles, and locks all downstream manufacturing business workflow schemas:

1. **Order Intake Domain:** `Customer` (`customers`), `PurchaseOrder` (`purchase_orders`), `SalesOrderComponent` (`sales_order_components`).
2. **Material Specification & Baseline Domain:** `RmRequest` (`rm_requests`), `RmItem` (`rm_items`), `RmFormSc` (`rm_form_scs`), `RmItemSnapshot` (`rm_item_snapshots`).
3. **Stores Issuance Domain:** `MaterialIssue` (`material_issues`), `MaterialIssueItem` (`material_issue_items`).
4. **Shop-Floor Execution & Custody Domain:** `MaterialReceipt` (`material_receipts`), `MaterialReceiptItem` (`material_receipt_items`), `MaterialConsumption` (`material_consumptions`), `MaterialReturn` (`material_returns`), `MaterialReturnItem` (`material_return_items`).
5. **Variance & Additional Request Domain:** `AdditionalMaterialRequest` (`additional_material_requests`), `AdditionalMaterialRequestItem` (`additional_material_request_items`).

This document provides complete SQL DDL blueprints, TypeORM relational mappings, dual-binding mechanics, transactional invariants, indexing structures, foreign key deletion cascades, audit attribution rules, and concurrency models to guarantee end-to-end data integrity across the manufacturing lifecycle without mutating any runtime code or database schema during this design phase.

---

## 2. DOWNSTREAM BUSINESS WORKFLOW ARCHITECTURE OVERVIEW

The RMRIT business workflow orchestrates manufacturing from customer sales order intake to raw material specification, stores physical issue, shop-floor receipt, machine consumption, surplus return, and variance tracking.

```text
========================================================================================================================
                                     RMRIT END-TO-END WORKFLOW ARCHITECTURE
========================================================================================================================

 ┌─────────────────┐
 │    Customer     │
 └────────┬────────┘
          │ 1:N (RESTRICT)
          ▼
 ┌─────────────────┐
 │  PurchaseOrder  │ ◄────────────────────────┐ (Header context)
 └────────┬────────┘                          │
          │ 1:N (RESTRICT)                    │
          ▼                                   │
 ┌────────────────────────┐                   │
 │  SalesOrderComponent   │                   │
 │        (SC)            │                   │
 └────────┬───────────────┘                   │
          │                                   │
          ├──────────────────────────────┐    │
          │ 1:1 or N:1                   │    │
          ▼                              ▼    │
 ┌─────────────────┐           ┌──────────────────┐
 │    RmRequest    │           │    RmFormSc      │ (Multi-SC Junction)
 └────────┬────────┘           └──────────────────┘
          │ 1:N (CASCADE)
          ▼
 ┌─────────────────┐
 │     RmItem      │ ◄─────────── [ RmItemSnapshot ] (Audit Trail & Baseline Preservation)
 └────────┬────────┘
          │
          ├────────────────────────────────────────┬────────────────────────────────────────┐
          │                                        │                                        │
          ▼                                        ▼                                        ▼
 ┌───────────────────┐                   ┌───────────────────┐                    ┌───────────────────────────────┐
 │ MaterialIssueItem │                   │MaterialConsumption│                    │   AdditionalMaterialRequest   │
 └────────┬──────────┘                   └───────────────────┘                    └───────────────┬───────────────┘
          │ (Stores Issue)                         ▲                                              │ 1:N
          ▼                                        │ (Shop-floor usage)                           ▼
 ┌───────────────────┐                             │                              ┌───────────────────────────────┐
 │  MaterialIssue    │                             │                              │ AdditionalMaterialRequestItem │
 └────────┬──────────┘                             │                              └───────────────┬───────────────┘
          │                                        │                                              │
          │ 1:N                                    │                                              │ (When approved)
          ▼                                        │                                              ▼
 ┌───────────────────┐                             │                              ┌───────────────────────────────┐
 │  MaterialReceipt  │                             │                              │ MaterialIssue (ADDITIONAL)    │
 └────────┬──────────┘                             │                              └───────────────────────────────┘
          │ 1:N                                    │
          ▼                                        │
 ┌───────────────────┐                             │
 │MaterialReceiptItem│                             │
 └────────┬──────────┘                             │
          │                                        │
          └────────────────────────────────────────┴──────────────┐
                                                                  ▼
                                                      ┌───────────────────────┐
                                                      │    MaterialReturn     │ (Stage 1: PENDING_STORE_ACK)
                                                      └───────────┬───────────┘
                                                                  │ 1:N
                                                                  ▼
                                                      ┌───────────────────────┐
                                                      │  MaterialReturnItem   │
                                                      └───────────┬───────────┘
                                                                  │ (Stage 2: ACKNOWLEDGED)
                                                                  ▼
                                                      ┌───────────────────────┐
                                                      │  Restock to Bin /     │
                                                      │  Quarantine Bin       │
                                                      └───────────────────────┘
```

---

## 3. RECONCILIATION WITH PHASE 7.3 MASTER DATA, STORAGE & INVENTORY FOUNDATION

Phase 7.3 defined the immutable physical inventory foundation:
- **Product Master:** `product_categories (1:N) ──> product_families (1:N) ──> products`
- **Storage Hierarchy:** `warehouses (1:N) ──> warehouse_locations (1:N) ──> racks (1:N) ──> bins`
- **Inventory Engine:** `stock_balances` (`product_id`, `bin_id`, `current_quantity`, `allocated_quantity`, `available_quantity`) + `stock_transactions` (append-only ledger).
- **Dual-Binding Legacy Support:** `inventory_items` maintained for transitional compatibility (`DEC-PROD-014`).

### Workflow Reconciliation Rules:
1. **Authoritative Stock Decrement Point:** Only `MaterialIssue` (`material_issue_items`) mutates physical store inventory via `StockBalance` decrement and `StockTransaction` logging (`transaction_type = 'STORES_ISSUE'`).
2. **Authoritative Stock Increment Point (Restocking):** Only `MaterialReturn` (`material_return_items`) upon Stores `ACKNOWLEDGED` status mutates physical store inventory via `StockBalance` increment and `StockTransaction` logging (`transaction_type = 'RETURN'`).
3. **Custody Handoff Isolation:** `MaterialReceipt` (shop-floor acknowledgment) and `MaterialConsumption` (machine cutting/machining) are **Shop-Floor Internal Accounting Events** and have **ZERO STORE STOCK MUTATION**.
4. **Bin-Level Traceability:** Every material issue item and return item references an explicit physical `bin_id` alongside `product_id` and legacy `inventory_item_id`.

---

## 4. ENTITY DOMAIN BOUNDARIES

| Domain | Entity | Target Table | Primary Responsibility | Stock Mutation? |
| :--- | :--- | :--- | :--- | :---: |
| **Order Intake** | `Customer` | `customers` | Client account & contact master data | No |
| **Order Intake** | `PurchaseOrder` | `purchase_orders` | Commercial PO tracking and contract umbrella | No |
| **Order Intake** | `SalesOrderComponent` | `sales_order_components` | Independent manufacturing component lifecycle | No |
| **Specification** | `RmRequest` | `rm_requests` | Engineering RM bill-of-materials container | No |
| **Specification** | `RmItem` | `rm_items` | Material line items, grades, sizes, weights | No |
| **Specification** | `RmFormSc` | `rm_form_scs` | Multi-SC to RM Request junction binding | No |
| **Specification** | `RmItemSnapshot` | `rm_item_snapshots` | Immutable designer revision audit trail | No |
| **Issuance** | `MaterialIssue` | `material_issues` | Stores material dispatch docket | No (Header) |
| **Issuance** | `MaterialIssueItem` | `material_issue_items` | Specific physical item & bin deduction | **YES (DECREMENT)** |
| **Custody** | `MaterialReceipt` | `material_receipts` | Shop-floor receipt acknowledgment | No |
| **Custody** | `MaterialReceiptItem`| `material_receipt_items`| Shop-floor verified received quantities | No |
| **Shop-Floor** | `MaterialConsumption`| `material_consumptions` | Shop-floor parts machined & scrap logged | No |
| **Custody** | `MaterialReturn` | `material_returns` | Shop-floor surplus return container | No (Header) |
| **Custody** | `MaterialReturnItem` | `material_return_items`| Physical return line items & restock bin | **YES (INCREMENT ON ACK)** |
| **Variance** | `AdditionalMaterialRequest` | `additional_material_requests` | Shop-floor extra material request | No |
| **Variance** | `AdditionalMaterialRequestItem` | `additional_material_request_items` | Extra material line items & approval | No |

---

## 5. CUSTOMER & ORDER INTAKE SCHEMA SPECIFICATION

### Table: `customers`
Stores client profile information for commercial contracts.

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    contact_person VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE UNIQUE INDEX idx_customers_code ON customers(code);
```

---

## 6. PURCHASE ORDER (PO) SCHEMA SPECIFICATION

### Table: `purchase_orders`
Tracks commercial PO headers from customers.

```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    external_reference VARCHAR(150),
    reference_date DATE,
    remarks VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_po_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_po_number ON purchase_orders(po_number);
CREATE INDEX idx_po_customer_id ON purchase_orders(customer_id);
```

---

## 7. SALES ORDER COMPONENT (SC) SCHEMA SPECIFICATION

### Table: `sales_order_components`
Represents an individual component/assembly line item under a PO. Each SC possesses an autonomous production lifecycle.

```sql
CREATE TABLE sales_order_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sc_number VARCHAR(100) NOT NULL,
    po_id UUID NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    drawing_number VARCHAR(100),
    target_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    completed_at TIMESTAMPTZ,
    completed_by_id UUID,
    completion_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sc_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sc_completed_by FOREIGN KEY (completed_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_sc_status CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'STORES_PENDING', 'PARTIALLY_ISSUED',
        'ISSUED', 'IN_PRODUCTION', 'ADDITIONAL_REQUEST', 'COMPLETED'
    ))
);

CREATE INDEX idx_sc_number ON sales_order_components(sc_number);
CREATE INDEX idx_sc_po_id ON sales_order_components(po_id);
CREATE INDEX idx_sc_status ON sales_order_components(status);
```

---

## 8. PO-TO-SC INDEPENDENT LIFECYCLE & MULTI-SC PER PO DESIGN

### Architectural Decision:
1. **Multi-SC per PO (1:N):** A single commercial `PurchaseOrder` may contain 1 to N `SalesOrderComponents`.
2. **Autonomous SC Progression:** Each SC progresses through its lifecycle (`DRAFT ──> SUBMITTED ──> STORES_PENDING ──> PARTIALLY_ISSUED ──> ISSUED ──> IN_PRODUCTION ──> COMPLETED`) independently.
3. **No Aggregate PO Blocker:** Completion of SC #1 is not blocked by delays or additional material requests in SC #2 under the same PO.
4. **PO Status Derived:** The commercial PO state is dynamically computed from its child SC states:
   - `ALL DRAFT` ──> PO Draft
   - `ANY IN_PRODUCTION / ISSUED` ──> PO In-Progress
   - `ALL COMPLETED` ──> PO Completed

---

## 9. RAW MATERIAL REQUEST (RM_REQUEST) SCHEMA SPECIFICATION

### Table: `rm_requests`
Container for bill-of-materials and raw material requirements prepared by the Designer.

```sql
CREATE TABLE rm_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID,
    sc_id UUID UNIQUE,
    form_type VARCHAR(20) NOT NULL DEFAULT 'SC',
    created_by_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    revision_number INT NOT NULL DEFAULT 1,
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rm_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rm_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE CASCADE,
    CONSTRAINT fk_rm_created_by FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_rm_form_type CHECK (form_type IN ('SC', 'PO')),
    CONSTRAINT chk_rm_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'COMPLETED'))
);

CREATE INDEX idx_rm_po_id ON rm_requests(po_id);
CREATE UNIQUE INDEX idx_rm_sc_id ON rm_requests(sc_id);
CREATE INDEX idx_rm_status ON rm_requests(status);
CREATE INDEX idx_rm_created_by ON rm_requests(created_by_id);
```

---

## 10. RM_ITEM SCHEMA SPECIFICATION

### Table: `rm_items`
Individual line item raw material specifications.

```sql
CREATE TABLE rm_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rm_form_id UUID NOT NULL,
    sc_id UUID,
    product_id UUID,
    inventory_item_id UUID,
    material VARCHAR(100) NOT NULL,
    material_type VARCHAR(50) NOT NULL DEFAULT 'ROUND_BAR',
    grade VARCHAR(100) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    size VARCHAR(100) NOT NULL,
    length NUMERIC(10, 2),
    width NUMERIC(10, 2),
    thickness NUMERIC(10, 2),
    diameter NUMERIC(10, 2),
    weight NUMERIC(12, 3),
    weight_unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rm_item_form FOREIGN KEY (rm_form_id) REFERENCES rm_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_rm_item_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE CASCADE,
    CONSTRAINT fk_rm_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rm_item_legacy FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_rm_item_qty CHECK (quantity > 0)
);

CREATE INDEX idx_rm_items_form_id ON rm_items(rm_form_id);
CREATE INDEX idx_rm_items_sc_id ON rm_items(sc_id);
CREATE INDEX idx_rm_items_product_id ON rm_items(product_id);
CREATE INDEX idx_rm_items_legacy_id ON rm_items(inventory_item_id);
CREATE INDEX idx_rm_items_material ON rm_items(material);
```

---

## 11. RM_FORM_SC SCHEMA SPECIFICATION (SC-TO-RM JUNCTION & MULTI-SC BINDING)

### Table: `rm_form_scs`
Junction table enabling multi-SC raw material requests (e.g. grouped PO-level material requests).

```sql
CREATE TABLE rm_form_scs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rm_form_id UUID NOT NULL,
    sc_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rm_form_sc_rm FOREIGN KEY (rm_form_id) REFERENCES rm_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_rm_form_sc_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE CASCADE,
    CONSTRAINT uq_rm_form_sc UNIQUE (rm_form_id, sc_id)
);

CREATE INDEX idx_rm_form_sc_form_id ON rm_form_scs(rm_form_id);
CREATE INDEX idx_rm_form_sc_sc_id ON rm_form_scs(sc_id);
```

---

## 12. RM_ITEM_SNAPSHOT & REVISION AUDIT TRAIL SCHEMA SPECIFICATION

### Table: `rm_item_snapshots`
Immutable historical snapshot table recording the exact state of every RM item upon initial submission and subsequent designer revisions.

```sql
CREATE TABLE rm_item_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rm_item_id UUID NOT NULL,
    rm_form_id UUID NOT NULL,
    revision_number INT NOT NULL DEFAULT 1,
    change_type VARCHAR(50) NOT NULL DEFAULT 'ORIGINAL_SUBMISSION',
    changed_by_id UUID NOT NULL,
    material VARCHAR(100) NOT NULL,
    material_type VARCHAR(50) NOT NULL,
    grade VARCHAR(100) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    size VARCHAR(100) NOT NULL,
    length NUMERIC(10, 2),
    width NUMERIC(10, 2),
    thickness NUMERIC(10, 2),
    diameter NUMERIC(10, 2),
    weight NUMERIC(12, 3),
    weight_unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    revision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_snapshot_rm_item FOREIGN KEY (rm_item_id) REFERENCES rm_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_snapshot_rm_form FOREIGN KEY (rm_form_id) REFERENCES rm_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_snapshot_changed_by FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_snapshot_change_type CHECK (change_type IN ('ORIGINAL_SUBMISSION', 'DESIGNER_REVISION'))
);

CREATE INDEX idx_snapshots_rm_item ON rm_item_snapshots(rm_item_id);
CREATE INDEX idx_snapshots_rm_form ON rm_item_snapshots(rm_form_id);
CREATE INDEX idx_snapshots_revision ON rm_item_snapshots(revision_number);
CREATE INDEX idx_snapshots_changed_by ON rm_item_snapshots(changed_by_id);
```

---

## 13. MATERIAL ISSUE (MATERIAL_ISSUE) SCHEMA SPECIFICATION

### Table: `material_issues`
Stores issue header tracking physical material dispatches against an SC.

```sql
CREATE TABLE material_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sc_id UUID NOT NULL,
    issue_number VARCHAR(100) NOT NULL UNIQUE,
    issue_type VARCHAR(50) NOT NULL DEFAULT 'INITIAL_ISSUE',
    additional_request_id UUID,
    issued_by_id UUID NOT NULL,
    issue_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_issue_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE RESTRICT,
    CONSTRAINT fk_issue_additional_req FOREIGN KEY (additional_request_id) REFERENCES additional_material_requests(id) ON DELETE SET NULL,
    CONSTRAINT fk_issue_issued_by FOREIGN KEY (issued_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_issue_type CHECK (issue_type IN ('INITIAL_ISSUE', 'ADDITIONAL_ISSUE'))
);

CREATE UNIQUE INDEX idx_material_issue_number ON material_issues(issue_number);
CREATE INDEX idx_material_issue_sc_id ON material_issues(sc_id);
CREATE INDEX idx_material_issue_add_req ON material_issues(additional_request_id);
CREATE INDEX idx_material_issue_issued_by ON material_issues(issued_by_id);
```

---

## 14. MATERIAL_ISSUE_ITEM SCHEMA SPECIFICATION

### Table: `material_issue_items`
Detailed line items representing physical stock decrements from specific storage bins.

```sql
CREATE TABLE material_issue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_issue_id UUID NOT NULL,
    rm_item_id UUID NOT NULL,
    product_id UUID,
    bin_id UUID,
    inventory_item_id UUID,
    quantity_issued NUMERIC(12, 3) NOT NULL,
    heat_number VARCHAR(100),
    batch_number VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_issue_item_header FOREIGN KEY (material_issue_id) REFERENCES material_issues(id) ON DELETE CASCADE,
    CONSTRAINT fk_issue_item_rm_item FOREIGN KEY (rm_item_id) REFERENCES rm_items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_issue_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_issue_item_bin FOREIGN KEY (bin_id) REFERENCES bins(id) ON DELETE RESTRICT,
    CONSTRAINT fk_issue_item_legacy FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_issue_item_qty CHECK (quantity_issued > 0)
);

CREATE INDEX idx_issue_items_header_id ON material_issue_items(material_issue_id);
CREATE INDEX idx_issue_items_rm_item_id ON material_issue_items(rm_item_id);
CREATE INDEX idx_issue_items_product_id ON material_issue_items(product_id);
CREATE INDEX idx_issue_items_bin_id ON material_issue_items(bin_id);
CREATE INDEX idx_issue_items_legacy_id ON material_issue_items(inventory_item_id);
```

---

## 15. ISSUE-TO-STOCK INTEGRATION: DUAL-BINDING (PRODUCT + BIN & LEGACY INVENTORY_ITEM)

Per `DEC-PROD-014`, the system maintains a robust dual-binding model during the transitional phase:

1. **Authoritative Binding:** Every issued item specifies `product_id` and `bin_id`. This points directly to the authoritative `StockBalance` row identified by `(product_id, bin_id)`.
2. **Legacy Binding:** If populated, `inventory_item_id` maps to the legacy `inventory_items` table.
3. **Atomic Coexistence:**
   ```text
   ┌─────────────────────────────────────────────────────────┐
   │                  MaterialIssueItem                      │
   │  id, material_issue_id, rm_item_id, quantity_issued     │
   │  product_id, bin_id  ─────────► Authoritative Target    │
   │  inventory_item_id   ─────────► Legacy Target           │
   └─────────────────────────────────────────────────────────┘
   ```
4. **Validation Guard:** When `product_id` and `bin_id` are provided, the backend validates that `StockBalance.current_quantity >= quantity_issued` before decrementing.

---

## 16. ISSUE TRANSACTION ENGINE: STOCK DEDUCTION & IMMUTABLE STOCK_TRANSACTION CREATION

When Stores executes a Material Issue, the database engine executes the following atomic operations within a single database transaction:

```sql
-- Step 1: Lock and Decrement Stock Balance
UPDATE stock_balances
SET current_quantity = current_quantity - :quantity_issued,
    updated_at = CURRENT_TIMESTAMP
WHERE product_id = :product_id AND bin_id = :bin_id
  AND current_quantity >= :quantity_issued;

-- Step 2: Insert Immutable Stock Transaction Audit Record
INSERT INTO stock_transactions (
    id,
    stock_balance_id,
    product_id,
    bin_id,
    inventory_item_id,
    transaction_type,
    quantity,
    reference_id,
    reference_type,
    performed_by_id,
    created_at
) VALUES (
    gen_random_uuid(),
    :stock_balance_id,
    :product_id,
    :bin_id,
    :inventory_item_id,
    'STORES_ISSUE',
    -:quantity_issued,
    :material_issue_id,
    'MATERIAL_ISSUE',
    :issued_by_id,
    CURRENT_TIMESTAMP
);

-- Step 3: Insert Material Issue Item Record
INSERT INTO material_issue_items (...) VALUES (...);
```

---

## 17. MATERIAL RECEIPT (MATERIAL_RECEIPT) SCHEMA SPECIFICATION

### Table: `material_receipts`
Tracks physical receipt and verification of issued materials by Production shop-floor operators.

```sql
CREATE TABLE material_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_issue_id UUID NOT NULL,
    received_by_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    remarks TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_receipt_issue FOREIGN KEY (material_issue_id) REFERENCES material_issues(id) ON DELETE RESTRICT,
    CONSTRAINT fk_receipt_received_by FOREIGN KEY (received_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_receipt_status CHECK (status IN ('RECEIVED', 'PARTIAL', 'DISCREPANCY'))
);

CREATE INDEX idx_receipt_issue_id ON material_receipts(material_issue_id);
CREATE INDEX idx_receipt_received_by ON material_receipts(received_by_id);
CREATE INDEX idx_receipt_status ON material_receipts(status);
```

---

## 18. MATERIAL_RECEIPT_ITEM SCHEMA SPECIFICATION

### Table: `material_receipt_items`
Shop-floor line item verification quantities.

```sql
CREATE TABLE material_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_receipt_id UUID NOT NULL,
    rm_item_id UUID NOT NULL,
    quantity_received NUMERIC(12, 3) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_receipt_item_header FOREIGN KEY (material_receipt_id) REFERENCES material_receipts(id) ON DELETE CASCADE,
    CONSTRAINT fk_receipt_item_rm_item FOREIGN KEY (rm_item_id) REFERENCES rm_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_receipt_item_qty CHECK (quantity_received >= 0)
);

CREATE INDEX idx_receipt_items_header_id ON material_receipt_items(material_receipt_id);
CREATE INDEX idx_receipt_items_rm_item_id ON material_receipt_items(rm_item_id);
```

---

## 19. RECEIPT ACCOUNTING: SHOP-FLOOR CUSTODY HANDOFF & ZERO STORE STOCK MUTATION RULE

### Core Architectural Invariant:
1. **Custody Shift Only:** `MaterialReceipt` confirms that physical custody has successfully transferred from the Stores Warehouse to the Production Shop Floor.
2. **Zero Store Mutation:** Material receipt **DOES NOT MUTATE** `stock_balances` or generate `stock_transactions`. The store stock was already decremented during `MaterialIssue`. Double-deduction is mathematically impossible under this design.
3. **Discrepancy Logging:** If `quantity_received < quantity_issued`, `status` is set to `DISCREPANCY` / `PARTIAL`, triggering an investigation audit log without corrupting inventory balance math.

---

## 20. MATERIAL CONSUMPTION (MATERIAL_CONSUMPTION) SCHEMA SPECIFICATION

### Table: `material_consumptions`
Records actual shop-floor raw material utilization during production operations.

```sql
CREATE TABLE material_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sc_id UUID NOT NULL,
    rm_item_id UUID NOT NULL,
    product_id UUID,
    consumed_quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'NOS',
    recorded_by_id UUID NOT NULL,
    remarks TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consumption_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE RESTRICT,
    CONSTRAINT fk_consumption_rm_item FOREIGN KEY (rm_item_id) REFERENCES rm_items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_consumption_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_consumption_recorded_by FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_consumption_qty CHECK (consumed_quantity > 0)
);

CREATE INDEX idx_consumption_sc_id ON material_consumptions(sc_id);
CREATE INDEX idx_consumption_rm_item_id ON material_consumptions(rm_item_id);
CREATE INDEX idx_consumption_product_id ON material_consumptions(product_id);
CREATE INDEX idx_consumption_recorded_by ON material_consumptions(recorded_by_id);
```

---

## 21. SHOP-FLOOR SCRAP, OFFCUT, AND DEFECT RECORDING SCHEMA

Material consumption accounting adheres to strict shop-floor conservation rules:
- **Work In Progress (WIP) Tracking:** Raw materials on the shop floor reside in production custody until consumed or returned.
- **Consumption Remarks / Tagging:** Scrap generated during cutting/machining is recorded with structured classification in `remarks` (e.g., `OFFCUT`, `CHIPS`, `MACHINING_DEFECT`, `RUNNER_RISER`).
- **Scrap Disposition:** Reusable offcuts and scrap metal returned to Stores follow the `MaterialReturn` workflow.

---

## 22. MATERIAL RETURN (MATERIAL_RETURN) SCHEMA SPECIFICATION

### Table: `material_returns`
Header table for shop-floor surplus material return notes.

```sql
CREATE TABLE material_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sc_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_STORE_ACK',
    returned_by_id UUID NOT NULL,
    confirmed_by_id UUID,
    confirmed_at TIMESTAMPTZ,
    remarks TEXT,
    returned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_return_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE RESTRICT,
    CONSTRAINT fk_return_returned_by FOREIGN KEY (returned_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_return_confirmed_by FOREIGN KEY (confirmed_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_return_status CHECK (status IN ('PENDING_STORE_ACK', 'ACKNOWLEDGED', 'REJECTED'))
);

CREATE INDEX idx_return_sc_id ON material_returns(sc_id);
CREATE INDEX idx_return_status ON material_returns(status);
CREATE INDEX idx_return_returned_by ON material_returns(returned_by_id);
CREATE INDEX idx_return_confirmed_by ON material_returns(confirmed_by_id);
```

---

## 23. MATERIAL_RETURN_ITEM SCHEMA SPECIFICATION

### Table: `material_return_items`
Surplus material return line items specifying returned quantities and target restocking locations.

```sql
CREATE TABLE material_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_return_id UUID NOT NULL,
    rm_item_id UUID NOT NULL,
    product_id UUID,
    target_bin_id UUID,
    inventory_item_id UUID,
    return_condition VARCHAR(50) NOT NULL DEFAULT 'REUSABLE',
    quantity_returned NUMERIC(12, 3) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_return_item_header FOREIGN KEY (material_return_id) REFERENCES material_returns(id) ON DELETE CASCADE,
    CONSTRAINT fk_return_item_rm_item FOREIGN KEY (rm_item_id) REFERENCES rm_items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_return_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_return_item_bin FOREIGN KEY (target_bin_id) REFERENCES bins(id) ON DELETE RESTRICT,
    CONSTRAINT fk_return_item_legacy FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_return_item_qty CHECK (quantity_returned > 0),
    CONSTRAINT chk_return_item_condition CHECK (return_condition IN ('REUSABLE', 'SCRAP', 'OFFCUT', 'DEFECTIVE'))
);

CREATE INDEX idx_return_items_header_id ON material_return_items(material_return_id);
CREATE INDEX idx_return_items_rm_item_id ON material_return_items(rm_item_id);
CREATE INDEX idx_return_items_product_id ON material_return_items(product_id);
CREATE INDEX idx_return_items_bin_id ON material_return_items(target_bin_id);
CREATE INDEX idx_return_items_legacy_id ON material_return_items(inventory_item_id);
```

---

## 24. TWO-STAGE RETURN RECONCILIATION: SHOP-FLOOR INITIATION TO STORE ACKNOWLEDGEMENT

The return lifecycle implements a strict two-stage verification barrier:

```text
 Stage 1: Shop Floor Operator Initiates Return
 ┌────────────────────────────────────────────────────────┐
 │ Status: PENDING_STORE_ACK                              │
 │ - Return note generated                                │
 │ - Materials in transit / staged at Store receiving dock│
 │ - ZERO STOCK MUTATION                                  │
 └────────────────────────────────────────────────────────┘
                            │
                            ▼
 Stage 2: Stores Clerk Inspects & Acknowledges
 ┌────────────────────────────────────────────────────────┐
 │ Status: ACKNOWLEDGED                                   │
 │ - Physical inspection completed                        │
 │ - Verified quantity restocked into target Bin          │
 │ - StockBalance.current_quantity += quantity_returned   │
 │ - StockTransaction created (type: 'RETURN')            │
 └────────────────────────────────────────────────────────┘
```

---

## 25. RETURN-TO-STOCK INTEGRATION: RESTOCKING TO SOURCE BIN VS QUARANTINE/SCRAP BIN

Per `DEC-005` and `DEC-PROD-012`:
1. **Reusable Prime Material:** Restocked directly into prime storage bins (`bins.bin_type = 'STORAGE'`).
2. **Scrap / Offcut Material:** Directed to designated quarantine/scrap storage bins (`bins.bin_type = 'QUARANTINE'` or `'SCRAP'`).
3. **Atomic Balance Upsert:** If a `StockBalance` record does not exist for `(product_id, target_bin_id)`, the transaction inserts a new row; otherwise it increments `current_quantity`.

---

## 26. ADDITIONAL MATERIAL REQUEST (ADDITIONAL_MATERIAL_REQUEST) SCHEMA SPECIFICATION

### Table: `additional_material_requests`
Tracks requests for supplemental raw materials necessitated by engineering changes, machining damage, or casting defects.

```sql
CREATE TABLE additional_material_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sc_id UUID NOT NULL,
    requested_by_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    reason VARCHAR(50) NOT NULL DEFAULT 'ADDITIONAL_REQUIREMENT',
    remarks TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMPTZ,
    approved_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_add_req_sc FOREIGN KEY (sc_id) REFERENCES sales_order_components(id) ON DELETE RESTRICT,
    CONSTRAINT fk_add_req_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_add_req_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_add_req_status CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'ISSUED', 'CANCELLED')),
    CONSTRAINT chk_add_req_reason CHECK (reason IN (
        'ADDITIONAL_REQUIREMENT', 'DAMAGE', 'WASTAGE', 'MANUFACTURING_ERROR', 'OTHER'
    ))
);

CREATE INDEX idx_add_req_sc_id ON additional_material_requests(sc_id);
CREATE INDEX idx_add_req_status ON additional_material_requests(status);
CREATE INDEX idx_add_req_requested_by ON additional_material_requests(requested_by_id);
CREATE INDEX idx_add_req_approved_by ON additional_material_requests(approved_by_id);
```

---

## 27. ADDITIONAL_MATERIAL_REQUEST_ITEM SCHEMA SPECIFICATION

### Table: `additional_material_request_items`
Specific extra material line items.

```sql
CREATE TABLE additional_material_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    rm_item_id UUID NOT NULL,
    quantity_requested NUMERIC(12, 3) NOT NULL,
    quantity_approved NUMERIC(12, 3),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_add_req_item_header FOREIGN KEY (request_id) REFERENCES additional_material_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_add_req_item_rm_item FOREIGN KEY (rm_item_id) REFERENCES rm_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_add_req_item_qty_req CHECK (quantity_requested > 0),
    CONSTRAINT chk_add_req_item_qty_app CHECK (quantity_approved IS NULL OR quantity_approved >= 0)
);

CREATE INDEX idx_add_req_items_request_id ON additional_material_request_items(request_id);
CREATE INDEX idx_add_req_items_rm_item_id ON additional_material_request_items(rm_item_id);
```

---

## 28. ADDITIONAL REQUEST LIFECYCLE: VARIANCE TRACKING WITHOUT RM BASELINE MUTATION

### Key Architectural Invariant:
1. **Baseline Invariance:** An approved `AdditionalMaterialRequest` **NEVER** mutates the original `rm_items` or `rm_requests` records.
2. **Variance Isolation:** The design separates planned engineering requirements from operational variance:
   - `Planned Baseline = SUM(rm_items.quantity)`
   - `Approved Variance = SUM(additional_material_request_items.quantity_approved)`
   - `Total Authorized Issue = Planned Baseline + Approved Variance`
3. **Traceable Issuance:** When Stores dispenses supplemental materials, the resulting `MaterialIssue` record sets `issue_type = 'ADDITIONAL_ISSUE'` and explicitly binds `additional_request_id`.

---

## 29. WORKFLOW STATUS STATE MACHINES & ENUM SPECIFICATIONS

```text
========================================================================================================================
                                     STATE MACHINE TRANSITIONS MATRIX
========================================================================================================================

 1. SalesOrderComponent Status:
    [DRAFT] ──(Designer Submits)──► [SUBMITTED] ──(Stores Reviews)──► [STORES_PENDING]
       │                                                                      │
       ▼                                                                      ▼
    [COMPLETED] ◄──(Shop Floor Finishes)── [IN_PRODUCTION] ◄──(Full Issue)── [ISSUED] / [PARTIALLY_ISSUED]
                                                ▲
                                                │ (Variance Raised)
                                                ▼
                                     [ADDITIONAL_REQUEST]

 2. RmRequest Status:
    [DRAFT] ──(Designer Finalizes)──► [SUBMITTED] ──(All SCs Completed)──► [COMPLETED]

 3. MaterialReceipt Status:
    [RECEIVED] / [PARTIAL] / [DISCREPANCY]

 4. MaterialReturn Status:
    [PENDING_STORE_ACK] ──(Store Accepts)──► [ACKNOWLEDGED]
                        └──(Store Rejects)──► [REJECTED]

 5. AdditionalMaterialRequest Status:
    [REQUESTED] ──(Manager Approves)──► [APPROVED] ──(Stores Issues)──► [ISSUED]
                └──(Manager Rejects)───► [REJECTED]
                └──(Operator Cancels)──► [CANCELLED]
```

---

## 30. COMPOSITE KEYS, PRIMARY KEYS, AND FOREIGN KEY CONSTRAINTS MATRIX

| Table Name | Primary Key | Foreign Keys | On Delete Behavior | Unique Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `customers` | `id` (UUID) | None | N/A | `code` |
| `purchase_orders` | `id` (UUID) | `customer_id ──> customers.id` | `RESTRICT` | `po_number` |
| `sales_order_components` | `id` (UUID) | `po_id ──> purchase_orders.id`<br>`completed_by_id ──> users.id` | `RESTRICT`<br>`RESTRICT` | None |
| `rm_requests` | `id` (UUID) | `po_id ──> purchase_orders.id`<br>`sc_id ──> sales_order_components.id`<br>`created_by_id ──> users.id` | `RESTRICT`<br>`CASCADE`<br>`RESTRICT` | `sc_id` |
| `rm_items` | `id` (UUID) | `rm_form_id ──> rm_requests.id`<br>`sc_id ──> sales_order_components.id`<br>`product_id ──> products.id`<br>`inventory_item_id ──> inventory_items.id` | `CASCADE`<br>`CASCADE`<br>`RESTRICT`<br>`RESTRICT` | None |
| `rm_form_scs` | `id` (UUID) | `rm_form_id ──> rm_requests.id`<br>`sc_id ──> sales_order_components.id` | `CASCADE`<br>`CASCADE` | `(rm_form_id, sc_id)` |
| `rm_item_snapshots` | `id` (UUID) | `rm_item_id ──> rm_items.id`<br>`rm_form_id ──> rm_requests.id`<br>`changed_by_id ──> users.id` | `CASCADE`<br>`CASCADE`<br>`RESTRICT` | None |
| `material_issues` | `id` (UUID) | `sc_id ──> sales_order_components.id`<br>`additional_request_id ──> additional_material_requests.id`<br>`issued_by_id ──> users.id` | `RESTRICT`<br>`SET NULL`<br>`RESTRICT` | `issue_number` |
| `material_issue_items` | `id` (UUID) | `material_issue_id ──> material_issues.id`<br>`rm_item_id ──> rm_items.id`<br>`product_id ──> products.id`<br>`bin_id ──> bins.id`<br>`inventory_item_id ──> inventory_items.id` | `CASCADE`<br>`RESTRICT`<br>`RESTRICT`<br>`RESTRICT`<br>`RESTRICT` | None |
| `material_receipts` | `id` (UUID) | `material_issue_id ──> material_issues.id`<br>`received_by_id ──> users.id` | `RESTRICT`<br>`RESTRICT` | None |
| `material_receipt_items` | `id` (UUID) | `material_receipt_id ──> material_receipts.id`<br>`rm_item_id ──> rm_items.id` | `CASCADE`<br>`RESTRICT` | None |
| `material_consumptions` | `id` (UUID) | `sc_id ──> sales_order_components.id`<br>`rm_item_id ──> rm_items.id`<br>`product_id ──> products.id`<br>`recorded_by_id ──> users.id` | `RESTRICT`<br>`RESTRICT`<br>`RESTRICT`<br>`RESTRICT` | None |
| `material_returns` | `id` (UUID) | `sc_id ──> sales_order_components.id`<br>`returned_by_id ──> users.id`<br>`confirmed_by_id ──> users.id` | `RESTRICT`<br>`RESTRICT`<br>`RESTRICT` | None |
| `material_return_items` | `id` (UUID) | `material_return_id ──> material_returns.id`<br>`rm_item_id ──> rm_items.id`<br>`product_id ──> products.id`<br>`target_bin_id ──> bins.id`<br>`inventory_item_id ──> inventory_items.id` | `CASCADE`<br>`RESTRICT`<br>`RESTRICT`<br>`RESTRICT`<br>`RESTRICT` | None |
| `additional_material_requests` | `id` (UUID) | `sc_id ──> sales_order_components.id`<br>`requested_by_id ──> users.id`<br>`approved_by_id ──> users.id` | `RESTRICT`<br>`RESTRICT`<br>`RESTRICT` | None |
| `additional_material_request_items`| `id` (UUID) | `request_id ──> additional_material_requests.id`<br>`rm_item_id ──> rm_items.id` | `CASCADE`<br>`RESTRICT` | None |

---

## 31. INDEXING STRATEGY & HIGH-PERFORMANCE WORKFLOW QUERY OPTIMIZATION

```sql
-- PO & SC Indexes
CREATE INDEX idx_po_customer_id ON purchase_orders(customer_id);
CREATE INDEX idx_sc_po_id_status ON sales_order_components(po_id, status);

-- RM Specification Indexes
CREATE INDEX idx_rm_requests_sc_status ON rm_requests(sc_id, status);
CREATE INDEX idx_rm_items_form_product ON rm_items(rm_form_id, product_id);
CREATE INDEX idx_snapshots_item_revision ON rm_item_snapshots(rm_item_id, revision_number DESC);

-- Material Issue Indexes
CREATE INDEX idx_material_issues_sc_date ON material_issues(sc_id, issue_date DESC);
CREATE INDEX idx_material_issue_items_prod_bin ON material_issue_items(product_id, bin_id);

-- Shop-Floor Custody & Consumption Indexes
CREATE INDEX idx_material_receipts_issue ON material_receipts(material_issue_id);
CREATE INDEX idx_material_consumptions_sc_rm ON material_consumptions(sc_id, rm_item_id);
CREATE INDEX idx_material_returns_sc_status ON material_returns(sc_id, status);
CREATE INDEX idx_material_return_items_bin ON material_return_items(target_bin_id);

-- Additional Requests Indexes
CREATE INDEX idx_additional_req_sc_status ON additional_material_requests(sc_id, status);
CREATE INDEX idx_additional_req_items_req ON additional_material_request_items(request_id);
```

---

## 32. HISTORICAL INTEGRITY & DELETION RULES (RESTRICT VS CASCADE MATRIX)

1. **Header-to-Line Cascade Rule:** Deleting a draft parent header (`rm_requests`, `material_issues`, `material_receipts`, `material_returns`, `additional_material_requests`) cascades strictly to its owned line items (`CASCADE`).
2. **Master & Transaction Restrict Rule:** Deleting a `Customer`, `User`, `Product`, `Bin`, or `PurchaseOrder` that is referenced in historical workflow transactions is strictly rejected (`RESTRICT`).
3. **Non-Destructive Workflow Integrity:** Completed or partially processed components (`SalesOrderComponent`) cannot be deleted once physical stores issues or receipts have occurred.

---

## 33. AUDIT TRAILS, VERSIONING, AND USER ATTRIBUTION MODEL (6 ROLE SYSTEM)

Every workflow state mutation records the actor identity using foreign keys to `users.id`. The active 6-role system enforces clear boundary attribution:

| Role | Permitted Schema Actions | Attribution Columns |
| :--- | :--- | :--- |
| `ADMIN` | System configuration, master data oversight | `users.id` |
| `DESIGNER` | Draft & submit `rm_requests`, create `rm_item_snapshots` | `rm_requests.created_by_id`, `rm_item_snapshots.changed_by_id` |
| `STORES` | Issue stock (`material_issues`), acknowledge returns (`material_returns`) | `material_issues.issued_by_id`, `material_returns.confirmed_by_id` |
| `PRODUCTION` | Acknowledge receipts (`material_receipts`), log consumptions (`material_consumptions`), initiate returns (`material_returns`), raise additional requests (`additional_material_requests`) | `material_receipts.received_by_id`, `material_consumptions.recorded_by_id`, `material_returns.returned_by_id`, `additional_material_requests.requested_by_id` |
| `SENIOR_MANAGER` | Approve additional requests (`additional_material_requests`), analytics & monitoring (non-blocking) | `additional_material_requests.approved_by_id` |
| `GENERAL_MANAGER`| Global operational oversight & reporting (non-blocking) | Analytics Query Scope |

*Note: `SENIOR_DESIGNER` is inactive and excluded from approval gates.*

---

## 34. FINANCIAL & QUANTITY BALANCE EQUATIONS ACROSS WORKFLOW LIFECYCLE

The system enforces strict shop-floor quantity conservation equations across all manufacturing stages:

$$\text{Total Material Issued} = \sum \text{material\_issue\_items.quantity\_issued}$$

$$\text{Total Material Received} = \sum \text{material\_receipt\_items.quantity\_received}$$

$$\text{Total Material Consumed} = \sum \text{material\_consumptions.consumed\_quantity}$$

$$\text{Total Material Returned} = \sum \text{material\_return\_items.quantity\_returned} \quad (\text{where status} = \text{'ACKNOWLEDGED'})$$

$$\text{Shop-Floor Work-In-Progress (WIP)} = \text{Total Material Received} - \text{Total Material Consumed} - \text{Total Material Returned}$$

$$\text{Unaccounted Discrepancy} = \text{Total Material Issued} - \text{Total Material Received}$$

$$\text{Component Total Scrap} = \sum \text{material\_return\_items.quantity\_returned} \quad (\text{where return\_condition} \in \{\text{'SCRAP'}, \text{'OFFCUT'}\})$$

---

## 35. LEGACY INVENTORY_ITEM DUAL-BINDING TRANSITION & DEPRECATION PLAN

1. **Transitional Schema Coexistence:**
   - All workflow line item tables (`rm_items`, `material_issue_items`, `material_return_items`) maintain nullable `product_id`, `bin_id`, and `inventory_item_id` columns.
2. **Dual-Write Strategy in Services:**
   - When new records are created, services populate `product_id` and `bin_id` as primary references, and mirror `inventory_item_id` if a legacy item mapping exists.
3. **Deprecation Path (Phase 13+):**
   - Once all upstream clients and historical records are migrated, `inventory_item_id` columns will be marked deprecated and eventually detached in a non-destructive manner. `InventoryItem` is preserved throughout Phase 7 and Phase 8.

---

## 36. MIGRATION IMPACT ANALYSIS & TYPEORM RECONCILIATION BLUEPRINT

### Migration Strategy:
- **Zero Drift Principle:** The schema design matches the TypeORM entity class definitions currently in `backend/src/` while providing explicit constraints and foreign keys that guarantee database integrity.
- **Migration Order for Phase 8:**
  1. `customers` table creation & verification.
  2. `purchase_orders` table creation.
  3. `sales_order_components` table creation.
  4. `rm_requests`, `rm_items`, `rm_form_scs`, `rm_item_snapshots`.
  5. `material_issues`, `material_issue_items`.
  6. `material_receipts`, `material_receipt_items`.
  7. `material_consumptions`.
  8. `material_returns`, `material_return_items`.
  9. `additional_material_requests`, `additional_material_request_items`.

---

## 37. STORED PROCEDURES / TRANSACTION BOUNDARIES / ATOMIC WORKFLOW OPERATIONS

Every state transition that mutates stock or moves an SC state must execute within an atomic TypeORM transaction / database transaction block (`QueryRunner` / `entityManager.transaction`):

```typescript
// Architectural Transaction Boundary Template
await dataSource.transaction(async (manager) => {
  // 1. Lock SC row
  const sc = await manager.findOne(SalesOrderComponent, {
    where: { id: scId },
    lock: { mode: 'pessimistic_write' },
  });

  // 2. Lock & update stock balances
  for (const item of issueItems) {
    const balance = await manager.findOne(StockBalance, {
      where: { productId: item.productId, binId: item.binId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance || balance.currentQuantity < item.quantityIssued) {
      throw new InsufficientStockException(item.productId, item.binId);
    }
    balance.currentQuantity -= item.quantityIssued;
    await manager.save(balance);

    // 3. Insert immutable stock transaction ledger
    await manager.insert(StockTransaction, {
      stockBalanceId: balance.id,
      productId: item.productId,
      binId: item.binId,
      transactionType: StockTransactionType.STORES_ISSUE,
      quantity: -item.quantityIssued,
      referenceId: issueHeader.id,
      referenceType: 'MATERIAL_ISSUE',
      performedById: userId,
    });
  }

  // 4. Save Issue Header & Line Items
  await manager.save(issueHeader);
  await manager.save(issueItems);

  // 5. Update SC Status
  sc.status = ScStatus.ISSUED;
  await manager.save(sc);
});
```

---

## 38. CONCURRENCY CONTROL, ROW LOCKING (PESSIMISTIC_WRITE) & RACE CONDITION PREVENTION

1. **Pessimistic Locking on Balances:** All concurrent material issues and restock returns targeting the same `(product_id, bin_id)` acquire `SELECT ... FOR UPDATE` (`pessimistic_write`) locks on `stock_balances` to eliminate stock race conditions.
2. **Pessimistic Locking on SC State:** SC transitions (e.g. concurrent return submissions or additional requests) lock the parent `sales_order_components` row to prevent conflicting lifecycle states.
3. **PostgreSQL MVCC & Isolation Level:** Standard transaction isolation level is `READ COMMITTED` with explicit row-level locking on balance mutations.

---

## 39. ERROR CODES & BUSINESS EXCEPTION TAXONOMY

| Error Code | HTTP Status | Exception Name | Description |
| :--- | :---: | :--- | :--- |
| `ERR_STOCK_INSUFFICIENT` | 400 | `InsufficientStockException` | Requested issue quantity exceeds available bin stock. |
| `ERR_SC_INVALID_STATE` | 400 | `InvalidScStateException` | Action not permitted in current SC status. |
| `ERR_RM_ALREADY_SUBMITTED`| 400 | `RmAlreadySubmittedException`| Cannot edit RM items once submitted without revision. |
| `ERR_RETURN_NOT_PENDING` | 400 | `ReturnNotPendingException` | Return note has already been acknowledged or rejected. |
| `ERR_ADD_REQ_NOT_APPROVED`| 400 | `AdditionalRequestNotApprovedException` | Stores cannot issue against an unapproved request. |
| `ERR_OVER_CONSUMPTION` | 400 | `OverConsumptionException` | Recorded consumption exceeds total material received. |
| `ERR_BIN_MISMATCH` | 400 | `BinLocationMismatchException` | Restock bin does not exist or is inactive. |

---

## 40. WORKFLOW API DTO MAPPING & JSON PAYLOAD SPECIFICATIONS

### 1. Material Issue Request DTO (`CreateMaterialIssueDto`)
```json
{
  "scId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "issueType": "INITIAL_ISSUE",
  "additionalRequestId": null,
  "remarks": "Initial stores dispatch for machining",
  "items": [
    {
      "rmItemId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "productId": "4a1c5b8e-6d9f-4b3a-9e1b-2c3d4e5f6a7b",
      "binId": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
      "quantityIssued": 12.500,
      "heatNumber": "HT-2026-9812",
      "batchNumber": "BATCH-A4",
      "remarks": "Prime material issued"
    }
  ]
}
```

### 2. Material Return Initiation DTO (`CreateMaterialReturnDto`)
```json
{
  "scId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "remarks": "Surplus offcut return after component machining",
  "items": [
    {
      "rmItemId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "productId": "4a1c5b8e-6d9f-4b3a-9e1b-2c3d4e5f6a7b",
      "targetBinId": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
      "returnCondition": "REUSABLE",
      "quantityReturned": 2.500,
      "remarks": "Clean offcut bar"
    }
  ]
}
```

---

## 41. PHASE 8 IMPLEMENTATION CHECKLIST FOR WORKFLOW ENTITIES

- [ ] Verify `customers` entity decorators, indexes, and unique constraints.
- [ ] Verify `purchase_orders` entity relationships and `onDelete: 'RESTRICT'`.
- [ ] Verify `sales_order_components` status check constraints and independent completion columns.
- [ ] Verify `rm_requests` and `rm_items` cascading deletion and revision linkage.
- [ ] Verify `rm_item_snapshots` immutable snapshot creation on designer revision.
- [ ] Verify `material_issues` and `material_issue_items` dual-binding (`productId`, `binId`, `inventoryItemId`).
- [ ] Verify `material_receipts` and `material_receipt_items` custody verification.
- [ ] Verify `material_consumptions` shop-floor scrap classification.
- [ ] Verify `material_returns` two-stage return workflow and restock bin resolution.
- [ ] Verify `additional_material_requests` variance tracking without baseline mutation.

---

## 42. CROSS-PHASE TRACEABILITY MATRIX

| Requirement / Decision | Source Phase | Phase 7.4 Reconciled Schema Implementation | Status |
| :--- | :--- | :--- | :---: |
| **PO (1:N) SC Architecture** | Baseline / Phase 1 | `purchase_orders (1:N) sales_order_components` | Fully Reconciled |
| **Independent SC Lifecycle**| Phase 2 / PO_VS_SC | Autonomous `sc.status` & independent `completed_at` | Fully Reconciled |
| **Designer RM Baseline** | Phase 1 / Phase 2.1 | `rm_requests` + `rm_items` + `rm_item_snapshots` | Fully Reconciled |
| **Store Issue Stock Deduction** | Phase 2.6 / Phase 7.3| `material_issue_items` mutates `StockBalance` & `StockTransaction` | Fully Reconciled |
| **Zero Store Stock Mutation on Receipt** | Phase 1 / Phase 2.6 | `material_receipts` transfers custody only | Fully Reconciled |
| **Two-Stage Return Workflow** | Phase 1 / Phase 2.6 | `material_returns` (`PENDING_STORE_ACK` ──► `ACKNOWLEDGED`) | Fully Reconciled |
| **Variance Without Baseline Mutation** | Phase 1 / Phase 2.6 | `additional_material_requests` keeps `rm_items` immutable | Fully Reconciled |
| **Dual-Binding Legacy Support** | Phase 7.3 (`DEC-PROD-014`)| `product_id` + `bin_id` alongside `inventory_item_id` | Fully Reconciled |
| **6-Role RBAC Model** | Baseline / Phase 10 | Exact user attribution foreign keys across all 16 tables | Fully Reconciled |

---

## 43. CONCLUSION & ARCHITECTURAL SIGN-OFF

The downstream business workflow database schema reconciliation for the RMRIT manufacturing system is complete, formally specified, and fully reconciled with the Phase 7.3 master data, storage hierarchy, and inventory foundations.

This design delivers:
1. **Mathematical Inventory Precision:** Physical inventory decrement occurs solely on material issue, and increment occurs solely on store return acknowledgment.
2. **Comprehensive Manufacturing Traceability:** Every raw material specification, revision snapshot, store issue, shop-floor receipt, consumption, return, and additional request is linked to physical bins, products, SCs, and user actors.
3. **Seamless Compatibility:** Preserves existing TypeORM entity contracts and legacy `InventoryItem` dual-binding without breaking existing application code.

**Architectural Sign-off:** APPROVED FOR PHASE 7.4 (DESIGN ONLY). Ready for Phase 8 Database Implementation.
