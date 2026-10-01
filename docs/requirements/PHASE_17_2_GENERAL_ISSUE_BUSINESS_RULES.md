# Phase 17.2 — General Issue Business Rules Specification & Certification Report

**Phase:** 17.2 — General Issue Business Rules  
**Module:** `backend/src/general-issue`  
**Execution Gate:** Part A — Backend Completion (Pre-Frontend Gate)  
**Status:** ✅ CERTIFIED & TESTED (38 Tests Passed: 32 Unit/Controller/Schema + 6 Live DB Integration)

---

## 1. Overlap Control Analysis (Mandatory Check)

In accordance with [`rm-workflow-roadmap`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agents/skills/rm-workflow-roadmap/SKILL.md) and [`RMRIT_MODULE_BOUNDARIES.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/RMRIT_MODULE_BOUNDARIES.md), the implementation adheres to the 4-step control system:

| Control Principle | Scope & Component | Details |
| :--- | :--- | :--- |
| **REUSE** | `StockBalance`, `StockTransaction`, `Bin`, `Product`, `User`, `SalesOrderComponent`, `PurchaseOrder` | Reused existing inventory ledger and master data entities as the single source of truth without duplicating tables or creating conflicting state engines. |
| **EXTEND** | `general_issues` table & `GeneralIssue` entity | Extended with nullable `sc_id` and `po_id` foreign keys and indexes to support optional SC/PO association. |
| **NEW** | Phase 17.2 Business Rules & Validations | Added server-side validation for SC/PO consistency, duplicate item prevention, atomic deduction, cancellation stock restoration, and RBAC guards. |
| **DO NOT TOUCH** | Baseline Phases 1–16 (`rm`, `material-issue`, `production`, `additional-request`, `notifications`, `email`) | Standard SC-driven Material Issue and production receipt workflows remain 100% intact and unaffected. |

---

## 2. Phase 17.2 Explicit Business Rules

### Rule 1: SC/PO Optional
* **Specification:** General Issue accommodates non-SC / non-PO issues (Case D from gap report: maintenance, R&D, tooling, consumable shop-floor issuance) while optionally allowing linkage to an existing SC and/or PO.
* **Invariants:**
  * If `scId` is omitted and `poId` is omitted: Fully valid Pure General Issue (`sc_id = NULL`, `po_id = NULL`).
  * If `scId` is provided: The SC must exist in the database, otherwise returns `404 Not Found`.
  * If `poId` is provided: The PO must exist in the database, otherwise returns `404 Not Found`.
  * If both `scId` and `poId` are provided: The system strictly validates that `sc.poId === po.id`. If there is a mismatch, the transaction is rejected with `400 Bad Request` (`Sales Order Component "..." does not belong to Purchase Order "..."`).

### Rule 2: Inventory Quantity Must Be Available
* **Specification:** Before any physical stock decrement occurs, the service verifies that stock is present in the specified Bin.
* **Invariants:**
  * Product must exist and have `isActive === true`. Inactive products reject with `400 Bad Request`.
  * Bin must exist and have `isActive === true`. Inactive bins reject with `400 Bad Request`.
  * `StockBalance` record for `(binId, productId)` must exist with `currentQuantity >= requestedQuantity`. If insufficient or missing, the transaction is rejected with `400 Bad Request` (`Insufficient stock for Product "..." in bin "...". Available: ..., Required: ...`).

### Rule 3: No Negative Stock
* **Specification:** Physical inventory balance cannot become negative under any circumstance, including extreme high-concurrency race conditions.
* **Invariants:**
  * Database-level check constraint on `stock_balances`: `CHECK ("current_quantity" >= 0)`.
  * Concurrency guard via atomic SQL:
    ```sql
    UPDATE stock_balances 
    SET current_quantity = current_quantity - $1, updated_at = NOW() 
    WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1
    ```
  * If affected row count is 0, the system detects a concurrent race condition or balance exhaustion and rolls back the transaction with `400 Bad Request`.

### Rule 4: Server-Side Quantity Validation
* **Specification:** All input quantities are strictly validated on the backend prior to database operations.
* **Invariants:**
  * Quantities must be numbers greater than zero (`@Min(0.001)`). Zero or negative quantities are rejected.
  * Decimal precision is rounded to 3 decimal places using [`QuantityCalculator.roundDecimal()`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/common/utils/quantity-calculator.ts) matching PostgreSQL `numeric(12,3)`.
  * The `items` array must be non-empty (`@ArrayNotEmpty()`).
  * Request payload cannot contain duplicate items targeting the same `(productId, binId)` combination in a single request.
  * `reason` is a mandatory non-empty string. `department`, `requester`, `externalReference`, and `remarks` are optional metadata.

### Rule 5: Atomic Stock Deduction
* **Specification:** Multi-item issues are all-or-nothing transactions executed within an ACID database transaction.
* **Invariants:**
  * Opened via `queryRunner.startTransaction()`.
  * Items are deterministically sorted by `(binId, productId)` before locking and updating to prevent circular deadlocks between concurrent requests.
  * If any item validation fails or stock is insufficient for any item, all decrements are rolled back immediately (`queryRunner.rollbackTransaction()`).

### Rule 6: Transaction Ledger Creation
* **Specification:** Every general issue creates an immutable, append-only record in the unified `stock_transactions` table.
* **Invariants:**
  * `transactionType`: `TransactionType.STOCK_OUT`
  * `productId`: `item.productId`
  * `sourceBinId`: `item.binId`
  * `destinationBinId`: `NULL`
  * `quantity`: `item.quantityIssued`
  * `referenceType`: `'GENERAL_ISSUE'`
  * `referenceId`: `generalIssue.id`
  * `remarks`: Captures issue number, reason, and item remarks.
  * `createdById`: Actor user ID.
  * `stock_balances.last_transaction_id` is updated to link directly to this transaction.

### Rule 7: Who Can Create (RBAC)
* **Authorized Roles:** `STORES`, `ADMIN`
* **Unauthorized Roles:** `PRODUCTION`, `DESIGNER`, `SENIOR_MANAGER`, `GENERAL_MANAGER` receive `403 Forbidden`.
* **Rationale:** Stores personnel are the physical custodians of the warehouse inventory; Admin possesses operational override authority. Production and Designers cannot bypass Stores to decrement inventory unilaterally.

### Rule 8: Who Can View (RBAC)
* **Authorized Roles:** `ADMIN`, `STORES`, `PRODUCTION`, `DESIGNER`, `SENIOR_MANAGER`, `GENERAL_MANAGER` (All 6 active system roles).
* **Rationale:** Provides full organizational visibility, auditability, and shop-floor monitoring without silos.

### Rule 9: Whether Approval Is Required
* **Rule:** **No approval gate is required.**
* **Rationale:** General Issues are executed directly by `STORES` or `ADMIN` on the shop floor. Upon successful submission, the record immediately enters status `ISSUED`. Management roles (`SENIOR_MANAGER`, `GENERAL_MANAGER`) act as real-time observers/monitors without introducing workflow-blocking approval gates.

### Rule 10: Whether Issued Quantity Can Be Reversed
* **Rule:** **Yes, issued quantity can be reversed via explicit cancellation.**
* **Endpoint:** `POST /api/general-issue/:id/cancel`
* **Authorized Roles:** `STORES`, `ADMIN`.
* **Invariants:**
  * Issue must exist and have status `ISSUED`.
  * If the issue is already `CANCELLED`, the system rejects the operation with `400 Bad Request` (`General Issue "..." is already cancelled`).
  * On success, status transitions to `CANCELLED` and cancellation notes are appended to `remarks`.

### Rule 11: How Cancelled Transactions Affect Stock
* **Specification:** Stock is restored cleanly and recorded in the append-only ledger without modifying or deleting history.
* **Invariants:**
  * **Stock Balance Refund:** Stock is refunded back to the original source bin:
    ```sql
    UPDATE stock_balances 
    SET current_quantity = current_quantity + $1, updated_at = NOW() 
    WHERE bin_id = $2 AND product_id = $3
    ```
  * **Offsetting Transaction Ledger Entry:** An immutable offsetting entry is created in `stock_transactions`:
    * `transactionType`: `TransactionType.RETURN`
    * `productId`: `item.productId`
    * `sourceBinId`: `NULL`
    * `destinationBinId`: `item.binId`
    * `quantity`: `item.quantityIssued`
    * `referenceType`: `'GENERAL_ISSUE_CANCEL'`
    * `referenceId`: `generalIssue.id`
    * `createdById`: Actor user ID.
  * **Immutability Guarantee:** Original `STOCK_OUT` transactions are **never deleted or modified**. The ledger remains an unbroken chronological audit trail.

---

## 3. Database Schema & Migration

### Migration File: `1790833300000-Phase17_2_GeneralIssueBusinessRules.ts`
```sql
ALTER TABLE "general_issues" ADD "sc_id" uuid;
ALTER TABLE "general_issues" ADD "po_id" uuid;
CREATE INDEX "IDX_general_issues_sc_id" ON "general_issues" ("sc_id");
CREATE INDEX "IDX_general_issues_po_id" ON "general_issues" ("po_id");
ALTER TABLE "general_issues" ADD CONSTRAINT "FK_general_issues_sc_id" 
  FOREIGN KEY ("sc_id") REFERENCES "sales_order_components"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "general_issues" ADD CONSTRAINT "FK_general_issues_po_id" 
  FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
```

---

## 4. API Endpoints & RBAC Matrix

| Endpoint | Method | Allowed Roles | Description |
| :--- | :---: | :--- | :--- |
| `/api/general-issue` | `POST` | `STORES`, `ADMIN` | Create General Issue (Pure or with optional SC/PO) |
| `/api/general-issue` | `GET` | `ADMIN`, `STORES`, `PRODUCTION`, `DESIGNER`, `SENIOR_MANAGER`, `GENERAL_MANAGER` | List all General Issues |
| `/api/general-issue/:id` | `GET` | `ADMIN`, `STORES`, `PRODUCTION`, `DESIGNER`, `SENIOR_MANAGER`, `GENERAL_MANAGER` | View details of a specific General Issue |
| `/api/general-issue/:id/cancel` | `POST` | `STORES`, `ADMIN` | Reverse issue and restore stock to source bins |

---

## 5. Verification Test Evidence

All 4 test suites passed with 100% green coverage:

```text
 ✓ src/database/general-issue-schema.spec.ts (5 tests)
 ✓ src/general-issue/general-issue.service.spec.ts (20 tests)
 ✓ src/general-issue/general-issue.controller.spec.ts (7 tests)
 ✓ test/phase-17-2-general-issue-integration.spec.ts (6 tests)

Test Files:  4 passed (4)
Tests:       38 passed (38)
```

### Verified Test Scenarios:
1. `creates a general issue with neither SC nor PO (Pure General Issue)`: Verified stock drops by issued amount, `sc_id`/`po_id` remain `null`, and `STOCK_OUT` ledger entry is created.
2. `creates a general issue linking optional SC and matching PO`: Verified relation mapping and stock deduction.
3. `rejects general issue when SC does not belong to specified PO`: Verified mismatch rejection with `400 Bad Request`.
4. `rejects general issue when requested quantity exceeds available stock`: Verified stock balance preservation and rejection.
5. `rejects general issue with zero or negative quantity`: Server-side quantity assertion verified.
6. `cancels general issue, flips status to CANCELLED, and restores stock with RETURN transaction`: Verified full stock restoration, `RETURN` ledger creation, and duplicate cancellation prevention.
7. `RBAC Guard Verification`: Verified create/cancel restricted to `STORES` and `ADMIN`, list/view open to all 6 system roles.
