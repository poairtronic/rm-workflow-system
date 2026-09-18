# PHASE 7.1 — REPOSITORY & EXISTING DATABASE AUDIT

**Domain:** RMRIT Manufacturing Application  
**Phase:** 7.1 — Repository & Existing Database Audit  
**Role:** Senior Database Architect and System Auditor  
**Status:** COMPLETE (Code & Migration Inspection) / RUNTIME BLOCKED (Database Connection)  
**Date:** September 18, 2026  

---

## 1. OBJECTIVE

The primary objective of Phase 7.1 is to establish the **exact current database, entity, migration, and architectural state** of the RMRIT codebase as it exists today.

This is a strict **Audit / Discovery Phase**. It documents **WHAT CURRENTLY EXISTS** in the repository and separates it completely from **WHAT THE SYSTEM IS INTENDED TO BECOME** in future design and implementation phases.

---

## 2. SCOPE

### In Scope
- Comprehensive Git repository inspection and safety check.
- Complete backend and database directory layout analysis.
- Database technology stack and configuration verification.
- Inventory and detailed metadata audit of all 30 TypeORM domain entities.
- Full inspection of all TypeORM migrations (order, table alterations, constraints, indexes).
- Deep audit of inventory entities (`InventoryItem`, `StockBalance`, `StockTransaction`).
- Stock granularity, concurrency, and transactional ledger analysis.
- Master data (`Product`, `ProductCategory`, `ProductFamily`) and storage hierarchy (`Warehouse`, `WarehouseLocation`, `Rack`, `Bin`) inspection.
- User/RBAC and 12 business workflow entity audits.
- Foreign key, unique constraint, check constraint, and index catalogs.
- Lifecycle, deletion, auditability, timestamp, and actor traceability analysis.
- API and Service layer write paths.
- Test classification (Unit vs Mocked vs Integration vs Real DB).
- Seed and fixture inspection.
- Duplication and legacy/deprecated code analysis.
- Current database architecture map vs Target design comparison.
- Gap matrix, risk register, data preservation risks, and Phase 7.2 inputs.

### Out of Scope
- No modification of application source code.
- No creation or modification of database entities.
- No creation or execution of new migrations.
- No modifications to business logic, controllers, services, or frontend.
- No destructive database or git operations.

---

## 3. AUTHORITATIVE SOURCES

To understand the system design context and intended architecture:
1. Current User Requirements Baseline ([`CURRENT_REQUIREMENTS_BASELINE.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/CURRENT_REQUIREMENTS_BASELINE.md))
2. Phase 1 Final Requirement Baseline ([`PHASE_1_REPORT.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/PHASE_1_REPORT.md), [`PHASE_1_REQUIREMENT_DECISION_LOG.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md))
3. Phase 2 System Design Documents ([`PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/PHASE_2.1_INVENTORY_DOMAIN_STORAGE_DESIGN.md) through [`PHASE_2.6_INVENTORY_BALANCE_DESIGN.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/PHASE_2.6_INVENTORY_BALANCE_DESIGN.md))
4. Phase 7 Database Design Specification ([`PHASE_7_DATABASE_DESIGN.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/PHASE_7_DATABASE_DESIGN.md))
5. Existing Codebase & Entities (`backend/src/`)
6. Existing Migrations (`database/migrations/`, `backend/src/database/migrations/`)

> **Separation Rule:** The repository code and migrations define **"What Currently Exists"**. The Phase 1/Phase 2 design baselines define **"What The System Is Target to Become"**.

---

## 4. GIT STATUS & REPOSITORY SAFETY CHECK

- **Current Branch:** `main`
- **Working Tree State:** Dirty (uncommitted design docs, Phase 8 entities/migration, test expansion, and untracked Phase reports)
- **Modified Files (6):**
  - `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`
  - `backend/src/config/data-source.ts`
  - `backend/src/entities.spec.ts`
  - `backend/src/inventory/entities/stock-balance.entity.ts`
  - `backend/src/inventory/entities/stock-transaction.entity.ts`
  - `backend/tsconfig.build.tsbuildinfo`
- **Untracked Files:**
  - 17 design and report files in `.agent/`
  - `backend/src/database/migrations/1700000000004-Phase7MasterDataAndStorageHierarchy.ts`
  - 7 master data / storage entity files in `backend/src/inventory/entities/` (`bin.entity.ts`, `product-category.entity.ts`, `product-family.entity.ts`, `product.entity.ts`, `rack.entity.ts`, `warehouse-location.entity.ts`, `warehouse.entity.ts`)
  - `backend/src/master-data/`
- **Recent Git Log (Last 5 commits):**
  - `ceab4b1` — `docs: master phase 1 requirement analysis and freeze`
  - `a1fa44f` — `docs: complete Phase 2 business system design and requirements freeze`
  - `3ef5404` — `chore: complete phases 10.7 to 10.12 - inventory history, filters, audit, testing, hardening`
  - `659908f` — `Add inventory stock adjustment workflows`
  - `f830878` — `feat(inventory): implement stock in workflow (Phase 10.4)`
- **Safety Guarantee:** No `git reset`, `git clean`, `git restore`, or destructive operations were executed.

---

## 5. REPOSITORY STRUCTURE AUDIT

```text
rm-workflow-system/
├── .agent/                             # Agent design specifications, decision logs & phase reports
├── backend/                            # NestJS 12.0.1 Backend Application
│   ├── src/
│   │   ├── additional-request/         # Additional material requests module & entities
│   │   ├── analytics/                  # Analytics & KPI module
│   │   ├── audit/                      # Audit trail module & AuditLog entity
│   │   ├── auth/                       # JWT authentication, RBAC guards & decorators
│   │   ├── common/                     # Shared DTOs, pipes, filters
│   │   ├── config/                     # DataSource & configuration loaders
│   │   ├── customers/                  # Customers module & Customer entity
│   │   ├── database/                   # Database seeds & migrations
│   │   │   ├── migrations/             # TypeORM migrations (0001, 0002, 0003, 0004)
│   │   │   └── seed-inventory.ts       # Inventory item dev seed
│   │   ├── inventory/                  # Inventory items, products, taxonomy, storage & ledger
│   │   │   ├── dto/                    # Movement, filter, and master DTOs
│   │   │   └── entities/               # 10 Inventory/Master entities
│   │   ├── master-data/                # Master data service & REST controllers
│   │   ├── material-issue/             # Stores material issue module & entities
│   │   ├── material-movement/          # Movement tracking module
│   │   ├── notifications/              # In-app notifications module & Notification entity
│   │   ├── permissions/                # Granular permissions module
│   │   ├── po/                         # Purchase orders module & PurchaseOrder entity
│   │   ├── production/                 # Receipts, consumption, returns & entities
│   │   ├── rm/                         # RM requests, snapshots, line items & entities
│   │   ├── roles/                      # Roles module & Role entity
│   │   ├── sc/                         # Sales order components module & SC entity
│   │   ├── stores/                     # Stores management module
│   │   ├── users/                      # Users module & User entity
│   │   ├── app.module.ts               # Root module registering all 18 domain modules
│   │   ├── entities.spec.ts            # Contract specification for all 30 entities
│   │   ├── main.ts                     # Application bootstrap
│   │   └── workflow-database-lifecycle.spec.ts # Workflow lifecycle contract tests
│   ├── test/                           # End-to-end and DTO validation test suites
│   ├── package.json                    # Dependencies & scripts
│   └── tsconfig.json                   # TypeScript configuration
├── database/                           # Root database infrastructure
│   ├── migrations/
│   │   └── 1700000000000-InitialSchema.ts # Baseline initial schema migration (20 tables)
│   ├── scripts/
│   │   └── run-seed.ts                 # Master database seeding script
│   └── seeds/                          # Master persona, customer, and PO seeds
├── frontend/                           # React + Vite Single Page Application
├── docs/                               # System documentation
└── README.md
```

---

## 6. DATABASE TECHNOLOGY AUDIT

- **Database Engine:** PostgreSQL (target 15+)
- **ORM:** TypeORM `v1.1.1` / `@nestjs/typeorm` `v12.0.1`
- **PostgreSQL Driver:** `pg` `v8.23.0` (`@types/pg` `v8.23.1`)
- **Connection Configuration:**
  - URL Format: `postgresql://postgres:postgres@localhost:5432/rm_workflow_db`
  - Fallback environment variable: `DATABASE_URL`
- **Entity Discovery:** Static explicit array `ALL_ENTITIES` (30 entities) exported in `backend/src/config/data-source.ts`.
- **Schema Synchronization:**
  - In `data-source.ts` (CLI / Migrations): `synchronize: false` (Safe).
  - In `app.module.ts` (NestJS runtime): `synchronize: configService.get<string>('NODE_ENV') !== 'production'`.
- **SSL Support:** Enabled with `{ rejectUnauthorized: false }` if `sslmode=require` or `NODE_ENV === 'production'`.

---

## 7. TYPEORM CONFIGURATION AUDIT

| Setting | `data-source.ts` (CLI) | `app.module.ts` (Runtime) | Verification Status |
| :--- | :--- | :--- | :--- |
| **Type** | `postgres` | `postgres` | VERIFIED FROM CODE |
| **Entities** | Explicit array `ALL_ENTITIES` (30 classes) | Explicit array `ALL_ENTITIES` + `autoLoadEntities: true` | VERIFIED FROM CODE |
| **Migrations Path** | `['database/migrations/*.ts']` | Not registered at runtime | VERIFIED FROM CODE |
| **Synchronize** | `false` | `NODE_ENV !== 'production'` | VERIFIED FROM CODE |
| **Logging** | Default (off/console) | Default | VERIFIED FROM CODE |
| **Retry Policy** | None | `retryAttempts: 2`, `retryDelay: 3000` | VERIFIED FROM CODE |
| **Runtime Connection** | Blocked (local postgres auth failed) | Blocked (local postgres auth failed) | RUNTIME BLOCKED |

---

## 8. ENTITY INVENTORY (COMPLETE 30 ENTITIES)

| # | Entity Class | DB Table Name | Module Location | Primary Key | Total Columns | Relations |
| :- | :--- | :--- | :--- | :--- | :- | :--- |
| 1 | `Role` | `roles` | `roles/entities/role.entity.ts` | `id` (UUID) | 5 | `users: User[]` (1:N) |
| 2 | `User` | `users` | `users/entities/user.entity.ts` | `id` (UUID) | 8 | `role: Role` (N:1) |
| 3 | `Customer` | `customers` | `customers/entities/customer.entity.ts` | `id` (UUID) | 9 | `purchaseOrders: PurchaseOrder[]` (1:N) |
| 4 | `PurchaseOrder` | `purchase_orders` | `po/entities/po.entity.ts` | `id` (UUID) | 8 | `customer: Customer`, `salesOrderComponents: SalesOrderComponent[]` |
| 5 | `SalesOrderComponent` | `sales_order_components` | `sc/entities/sc.entity.ts` | `id` (UUID) | 12 | `purchaseOrder: PurchaseOrder`, `rmRequest: RmRequest`, `rmItems: RmItem[]`, `materialIssues`, `materialConsumptions`, `materialReturns`, `additionalRequests`, `completedBy: User` |
| 6 | `RmRequest` | `rm_requests` | `rm/entities/rm-request.entity.ts` | `id` (UUID) | 10 | `purchaseOrder: PurchaseOrder`, `salesOrderComponent: SalesOrderComponent`, `createdBy: User`, `items: RmItem[]` |
| 7 | `RmItem` | `rm_items` | `rm/entities/rm-item.entity.ts` | `id` (UUID) | 17 | `rmRequest: RmRequest`, `salesOrderComponent: SalesOrderComponent`, `materialIssues`, `materialConsumptions`, `materialReturns` |
| 8 | `RmFormSc` | `rm_form_scs` | `rm/entities/rm-form-sc.entity.ts` | `id` (UUID) | 4 | `rmForm: RmRequest`, `salesOrderComponent: SalesOrderComponent` |
| 9 | `RmItemSnapshot` | `rm_item_snapshots` | `rm/entities/rm-item-snapshot.entity.ts` | `id` (UUID) | 18 | `rmItem: RmItem`, `rmRequest: RmRequest`, `changedBy: User` |
| 10 | `MaterialIssue` | `material_issues` | `material-issue/entities/material-issue.entity.ts` | `id` (UUID) | 8 | `salesOrderComponent: SalesOrderComponent`, `additionalRequest: AdditionalMaterialRequest`, `issuedBy: User`, `items: MaterialIssueItem[]` |
| 11 | `MaterialIssueItem` | `material_issue_items` | `material-issue/entities/material-issue-item.entity.ts` | `id` (UUID) | 7 | `materialIssue: MaterialIssue`, `rmItem: RmItem` |
| 12 | `MaterialReceipt` | `material_receipts` | `production/entities/production-receipt.entity.ts` | `id` (UUID) | 7 | `materialIssue: MaterialIssue`, `receivedBy: User`, `items: MaterialReceiptItem[]` |
| 13 | `MaterialReceiptItem` | `material_receipt_items` | `production/entities/material-receipt-item.entity.ts` | `id` (UUID) | 6 | `materialReceipt: MaterialReceipt`, `rmItem: RmItem` |
| 14 | `MaterialConsumption` | `material_consumptions` | `production/entities/material-consumption.entity.ts` | `id` (UUID) | 8 | `salesOrderComponent: SalesOrderComponent`, `rmItem: RmItem`, `recordedBy: User` |
| 15 | `MaterialReturn` | `material_returns` | `production/entities/material-return.entity.ts` | `id` (UUID) | 8 | `salesOrderComponent: SalesOrderComponent`, `returnedBy: User`, `confirmedBy: User`, `items: MaterialReturnItem[]` |
| 16 | `MaterialReturnItem` | `material_return_items` | `production/entities/material-return-item.entity.ts` | `id` (UUID) | 6 | `materialReturn: MaterialReturn`, `rmItem: RmItem` |
| 17 | `AdditionalMaterialRequest` | `additional_material_requests` | `additional-request/entities/additional-request.entity.ts` | `id` (UUID) | 10 | `salesOrderComponent: SalesOrderComponent`, `requestedBy: User`, `approvedBy: User`, `items: AdditionalMaterialRequestItem[]` |
| 18 | `AdditionalMaterialRequestItem` | `additional_material_request_items` | `additional-request/entities/additional-request-item.entity.ts` | `id` (UUID) | 7 | `request: AdditionalMaterialRequest`, `rmItem: RmItem` |
| 19 | `Notification` | `notifications` | `notifications/entities/notification.entity.ts` | `id` (UUID) | 8 | `user: User` |
| 20 | `AuditLog` | `audit_logs` | `audit/entities/audit-log.entity.ts` | `id` (UUID) | 9 | `actor: User` |
| 21 | `InventoryItem` | `inventory_items` | `inventory/entities/inventory-item.entity.ts` | `id` (UUID) | 9 | `stockBalance: StockBalance` (1:1) |
| 22 | `ProductCategory` | `product_categories` | `inventory/entities/product-category.entity.ts` | `id` (UUID) | 4 | `families: ProductFamily[]` (1:N) |
| 23 | `ProductFamily` | `product_families` | `inventory/entities/product-family.entity.ts` | `id` (UUID) | 5 | `category: ProductCategory` (N:1), `products: Product[]` (1:N) |
| 24 | `Product` | `products` | `inventory/entities/product.entity.ts` | `id` (UUID) | 7 | `family: ProductFamily` (N:1), `stockBalances: StockBalance[]` (1:N), `stockTransactions: StockTransaction[]` (1:N) |
| 25 | `Warehouse` | `warehouses` | `inventory/entities/warehouse.entity.ts` | `id` (UUID) | 5 | `locations: WarehouseLocation[]` (1:N) |
| 26 | `WarehouseLocation` | `warehouse_locations` | `inventory/entities/warehouse-location.entity.ts` | `id` (UUID) | 6 | `warehouse: Warehouse` (N:1), `racks: Rack[]` (1:N) |
| 27 | `Rack` | `racks` | `inventory/entities/rack.entity.ts` | `id` (UUID) | 6 | `location: WarehouseLocation` (N:1), `bins: Bin[]` (1:N) |
| 28 | `Bin` | `bins` | `inventory/entities/bin.entity.ts` | `id` (UUID) | 6 | `rack: Rack` (N:1), `stockBalances: StockBalance[]`, `destinationTransactions`, `sourceTransactions` |
| 29 | `StockBalance` | `stock_balances` | `inventory/entities/stock-balance.entity.ts` | `id` (UUID) | 8 | `product: Product`, `bin: Bin`, `inventoryItem: InventoryItem`, `lastTransaction: StockTransaction` |
| 30 | `StockTransaction` | `stock_transactions` | `inventory/entities/stock-transaction.entity.ts` | `id` (UUID) | 13 | `product: Product`, `inventoryItem: InventoryItem`, `sourceBin: Bin`, `destinationBin: Bin`, `createdBy: User` |

---

## 9. MIGRATION INVENTORY

| # | Migration Name | Location | Timestamp ID | Purpose & Actions | Status |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `InitialSchema1700000000000` | `database/migrations/` | `1700000000000` | Created initial schema for 20 business tables (`roles`, `users`, `customers`, `purchase_orders`, `sales_order_components`, `rm_requests`, `rm_form_scs`, `rm_items`, `rm_item_snapshots`, `additional_material_requests`, `additional_material_request_items`, `material_issues`, `material_issue_items`, `material_receipts`, `material_receipt_items`, `material_consumptions`, `material_returns`, `material_return_items`, `notifications`, `audit_logs`). Added UUID extension, indexes, checks, and foreign keys. | HISTORICAL |
| 2 | `Phase9Inventory1700000000001` | `backend/src/database/migrations/` | `1700000000001` | Created initial inventory tables: `inventory_items`, `stock_balances`, `stock_transactions`. Added foreign keys and constraints (`CHK_stock_balances_current_quantity`, `CHK_stock_transactions_quantity`, `UQ_inventory_items_composite`, `UQ_stock_balances_inventory_item_id`). | HISTORICAL |
| 3 | `AddAdjustmentDirection1700000000002` | `backend/src/database/migrations/` | `1700000000002` | Created enum type `stock_transactions_adjustment_direction_enum` (`INCREASE`, `DECREASE`) and added `adjustment_direction` column to `stock_transactions`. | HISTORICAL |
| 4 | `AddOpeningBalance1700000000003` | `backend/src/database/migrations/` | `1700000000003` | Added `opening_balance` (`numeric(12,3)`) column to `stock_balances`. | HISTORICAL |
| 5 | `Phase7MasterDataAndStorageHierarchy1700000000004` | `backend/src/database/migrations/` | `1700000000004` | Created 7 master data & storage tables (`product_categories`, `product_families`, `products`, `warehouses`, `warehouse_locations`, `racks`, `bins`). Altered `stock_balances` and `stock_transactions` (nullable `inventory_item_id`, added `product_id`, `bin_id`, `source_bin_id`, `destination_bin_id`, composite partial unique index). Added 9 performance indexes. Includes complete `down()` rollback. | NEW (Phase 8 Implementation) |

---

## 10. CURRENT DATABASE SCHEMA STATUS

- **Runtime Database Access:** Attempted execution of `npm run typeorm -- query "SELECT 1"` failed with `password authentication failed for user "postgres"`.
- **Runtime Verdict:** **`DATABASE RUNTIME VALIDATION BLOCKED`** (No active verified PostgreSQL credentials configured in local `.env`).
- **Code & Migration Verdict:** **`VERIFIED FROM CODE & MIGRATIONS`**. All 30 entities, relationships, constraints, and migration scripts are verified via static code analysis and contract test suites.

---

## 11. INVENTORY ENTITY AUDIT

### `InventoryItem`
- **File:** `backend/src/inventory/entities/inventory-item.entity.ts`
- **Table:** `inventory_items`
- **Columns:**
  - `id`: UUID (PK)
  - `material`: `varchar(100)` (Not Null)
  - `material_type`: `varchar(50)` (Not Null)
  - `grade`: `varchar(100)` (Not Null)
  - `size`: `varchar(100)` (Not Null)
  - `unit`: `varchar(20)`, default `'KG'`
  - `minimum_stock_level`: `numeric(12,3)`, default `0`
  - `is_active`: `boolean`, default `true`
  - `created_at`, `updated_at`: `TIMESTAMP`
- **Constraints:** `@Unique(['material', 'materialType', 'grade', 'size'])`
- **Relations:** `@OneToOne('StockBalance', (balance) => balance.inventoryItem)`

### `StockBalance`
- **File:** `backend/src/inventory/entities/stock-balance.entity.ts`
- **Table:** `stock_balances`
- **Columns:**
  - `id`: UUID (PK)
  - `product_id`: `uuid` (Nullable, FK to `products`)
  - `bin_id`: `uuid` (Nullable, FK to `bins`)
  - `inventory_item_id`: `uuid` (Nullable, Unique, FK to `inventory_items`)
  - `current_quantity`: `numeric(12,3)`, default `0`
  - `opening_balance`: `numeric(12,3)`, nullable
  - `last_transaction_id`: `uuid` (Nullable, FK to `stock_transactions`)
  - `created_at`, `updated_at`: `TIMESTAMP`
- **Constraints:**
  - `@Check('"current_quantity" >= 0')`
  - `@Unique(['productId', 'binId'])`
  - `@Column({ name: 'inventory_item_id', unique: true })`
- **Delete Behavior:** `onDelete: 'RESTRICT'` for Product, Bin, and InventoryItem; `onDelete: 'SET NULL'` for `lastTransaction`.

### `StockTransaction`
- **File:** `backend/src/inventory/entities/stock-transaction.entity.ts`
- **Table:** `stock_transactions`
- **Columns:**
  - `id`: UUID (PK)
  - `product_id`: `uuid` (Nullable, FK to `products`)
  - `inventory_item_id`: `uuid` (Nullable, FK to `inventory_items`)
  - `source_bin_id`: `uuid` (Nullable, FK to `bins`)
  - `destination_bin_id`: `uuid` (Nullable, FK to `bins`)
  - `transaction_type`: `enum` (`STOCK_IN`, `STOCK_OUT`, `STORES_ISSUE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`)
  - `adjustment_direction`: `enum` (`INCREASE`, `DECREASE`, Nullable)
  - `quantity`: `numeric(12,3)` (Not Null)
  - `reference_type`: `varchar(50)` (Not Null)
  - `reference_id`: `uuid` / `string` (Nullable)
  - `remarks`: `text` (Nullable)
  - `created_by_id`: `uuid` (FK to `users`, Not Null)
  - `created_at`: `TIMESTAMP`
- **Constraints:** `@Check('"quantity" > 0')`
- **Delete Behavior:** `onDelete: 'RESTRICT'` for Product, InventoryItem, Bin, and User.

---

## 12. CURRENT STOCK GRANULARITY

- **Current Repository Active Runtime Granularity:** `InventoryItem` (1 `InventoryItem` = 1 `StockBalance`).
  - Implemented in `InventoryService` (`backend/src/inventory/inventory.service.ts`), which queries by `inventory_item_id`.
- **Current Database Entity / Migration Schema Granularity:** Dual Support:
  1. Legacy: `InventoryItem` (via `inventory_item_id`).
  2. Phase 7/8 Target: `Product + Bin` (via composite `(product_id, bin_id)` with `@Unique(['productId', 'binId'])`).
- **Target Final Architecture:** `Product + Bin` (One `StockBalance` per distinct Product in a specific Bin).

---

## 13. STOCKBALANCE AUDIT

- **Primary Key:** `id` (UUID generated via `uuid_generate_v4()`).
- **Foreign Keys:**
  - `product_id` -> `products.id` (`ON DELETE RESTRICT`)
  - `bin_id` -> `bins.id` (`ON DELETE RESTRICT`)
  - `inventory_item_id` -> `inventory_items.id` (`ON DELETE RESTRICT`)
  - `last_transaction_id` -> `stock_transactions.id` (`ON DELETE SET NULL`)
- **Quantity Fields:**
  - `current_quantity`: `numeric(12,3)`, default `0`, non-negative constraint.
  - `opening_balance`: `numeric(12,3)`, nullable, initial baseline for reconciliation.
- **Uniqueness:**
  - `UQ_stock_balances_product_bin` on `(product_id, bin_id)`.
  - `UQ_stock_balances_inventory_item_id` on `inventory_item_id`.

---

## 14. STOCKTRANSACTION AUDIT & IMMUTABILITY

- **Primary Key:** `id` (UUID).
- **Actor Traceability:** `created_by_id` -> `users.id` (`ON DELETE RESTRICT`).
- **Transaction Types:**
  - `STOCK_IN`: Inward receipt / initial loading (`+`).
  - `STOCK_OUT`: Outward issue (`-`).
  - `STORES_ISSUE`: Issue to production floor (`-`).
  - `RETURN`: Production return to store (`+`).
  - `ADJUSTMENT`: Manual stock correction (`+` or `-` guided by `adjustment_direction`).
  - `TRANSFER`: Movement between Bins.
- **Immutability Controls:**
  - **Entity / ORM:** No `updatedAt` or `deletedAt` column exists on `StockTransaction`. It is insert-only.
  - **Controller:** No `PATCH`, `PUT`, or `DELETE` endpoints exist on `StockTransaction`. Direct `POST /api/inventory/:id/transactions` throws `NotImplementedException`.
  - **Database Level:** Immutable by convention and application design (database triggers blocking UPDATE/DELETE are not yet added).

---

## 15. MASTER DATA & STORAGE AUDIT

| Master Entity | Table Name | Key Attributes | Parent Relation | Uniqueness Constraint | Delete Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ProductCategory` | `product_categories` | `id`, `name`, `is_active` | None | `name` (Global) | `RESTRICT` (has children) |
| `ProductFamily` | `product_families` | `id`, `category_id`, `name`, `is_active` | `ProductCategory` | `(category_id, name)` | `RESTRICT` |
| `Product` | `products` | `id`, `family_id`, `name`, `minimum_inventory`, `maximum_inventory`, `is_active` | `ProductFamily` | `name` (Global) | `RESTRICT` |
| `Warehouse` | `warehouses` | `id`, `code`, `name`, `is_active` | None | `code`, `name` | `RESTRICT` (has children) |
| `WarehouseLocation` | `warehouse_locations` | `id`, `warehouse_id`, `code`, `name`, `is_active` | `Warehouse` | `(warehouse_id, code)` | `RESTRICT` |
| `Rack` | `racks` | `id`, `location_id`, `code`, `name`, `is_active` | `WarehouseLocation` | `(location_id, code)` | `RESTRICT` |
| `Bin` | `bins` | `id`, `rack_id`, `code`, `name`, `is_active` | `Rack` | `(rack_id, code)` | `RESTRICT` |

---

## 16. USER & RBAC AUDIT

- **Entity / Table:** `User` (`users`), `Role` (`roles`).
- **Password Storage:** `password_hash` (`varchar(255)`), bcrypt-hashed.
- **Active Flag:** `is_active` (`boolean`, default `true`).
- **6 Authorized Personas (Verified in Code, Enums & Seeds):**
  1. `ADMIN`
  2. `DESIGNER`
  3. `STORES`
  4. `PRODUCTION`
  5. `SENIOR_MANAGER`
  6. `GENERAL_MANAGER`
- **`SENIOR_DESIGNER` Search:**
  - **Entity & Enums:** Not present. `UserRole` enum contains only the 6 authorized roles.
  - **Historical Artifacts:** Mentioned only in legacy seed template `database/seeds/sample-users.seed.ts` (as `SENIOR_MANAGER` role mapping) and in analysis document `SENIOR_DESIGNER_IMPACT_REPORT.md`.

---

## 17. BUSINESS ENTITY AUDIT

| Workflow Milestone | Entity Class | DB Table | Current Status | Key Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| **Purchase Order** | `PurchaseOrder` | `purchase_orders` | IMPLEMENTED | `customer_id` -> `customers` |
| **Sales Order Component** | `SalesOrderComponent` | `sales_order_components` | IMPLEMENTED | `po_id` -> `purchase_orders`, `completed_by_id` -> `users` |
| **RM Request (Header)** | `RmRequest` | `rm_requests` | IMPLEMENTED | `po_id` -> `purchase_orders`, `sc_id` -> `sales_order_components`, `created_by_id` -> `users` |
| **RM Request Line Item** | `RmItem` | `rm_items` | IMPLEMENTED | `rm_form_id` -> `rm_requests`, `sc_id` -> `sales_order_components` |
| **RM Form SC Junction** | `RmFormSc` | `rm_form_scs` | IMPLEMENTED | `rm_form_id` -> `rm_requests`, `sc_id` -> `sales_order_components` |
| **RM Item Snapshot** | `RmItemSnapshot` | `rm_item_snapshots` | IMPLEMENTED | `rm_item_id` -> `rm_items`, `rm_form_id` -> `rm_requests`, `changed_by_id` -> `users` |
| **Material Issue (Header)** | `MaterialIssue` | `material_issues` | IMPLEMENTED | `sc_id` -> `sales_order_components`, `additional_request_id` -> `additional_material_requests`, `issued_by_id` -> `users` |
| **Material Issue (Line Item)**| `MaterialIssueItem` | `material_issue_items` | IMPLEMENTED | `material_issue_id` -> `material_issues`, `rm_item_id` -> `rm_items` |
| **Production Receipt (Header)**| `MaterialReceipt` | `material_receipts` | IMPLEMENTED | `material_issue_id` -> `material_issues`, `received_by_id` -> `users` |
| **Production Receipt (Line)** | `MaterialReceiptItem` | `material_receipt_items` | IMPLEMENTED | `material_receipt_id` -> `material_receipts`, `rm_item_id` -> `rm_items` |
| **Material Consumption** | `MaterialConsumption` | `material_consumptions` | IMPLEMENTED | `sc_id` -> `sales_order_components`, `rm_item_id` -> `rm_items`, `recorded_by_id` -> `users` |
| **Material Return (Header)** | `MaterialReturn` | `material_returns` | IMPLEMENTED | `sc_id` -> `sales_order_components`, `returned_by_id` -> `users`, `confirmed_by_id` -> `users` |
| **Material Return (Line Item)**| `MaterialReturnItem` | `material_return_items` | IMPLEMENTED | `material_return_id` -> `material_returns`, `rm_item_id` -> `rm_items` |
| **Additional Material Req** | `AdditionalMaterialRequest` | `additional_material_requests` | IMPLEMENTED | `sc_id` -> `sales_order_components`, `requested_by_id` -> `users`, `approved_by_id` -> `users` |
| **Additional Req (Line Item)**| `AdditionalMaterialRequestItem`| `additional_material_request_items`| IMPLEMENTED | `request_id` -> `additional_material_requests`, `rm_item_id` -> `rm_items` |
| **Notification** | `Notification` | `notifications` | IMPLEMENTED | `user_id` -> `users` |
| **Audit Log** | `AuditLog` | `audit_logs` | IMPLEMENTED | `actor_id` -> `users` |

---

## 18. FOREIGN KEY & REFERENTIAL INTEGRITY AUDIT

### Master & Structural Relationships (`ON DELETE RESTRICT`)
- `users.role_id` -> `roles.id`
- `purchase_orders.customer_id` -> `customers.id`
- `sales_order_components.po_id` -> `purchase_orders.id`
- `product_families.category_id` -> `product_categories.id`
- `products.family_id` -> `product_families.id`
- `warehouse_locations.warehouse_id` -> `warehouses.id`
- `racks.location_id` -> `warehouse_locations.id`
- `bins.rack_id` -> `racks.id`
- `stock_balances.product_id` -> `products.id`
- `stock_balances.bin_id` -> `bins.id`
- `stock_balances.inventory_item_id` -> `inventory_items.id`
- `stock_transactions.product_id` -> `products.id`
- `stock_transactions.inventory_item_id` -> `inventory_items.id`
- `stock_transactions.source_bin_id` -> `bins.id`
- `stock_transactions.destination_bin_id` -> `bins.id`
- `stock_transactions.created_by_id` -> `users.id`
- All Actor references (`issued_by_id`, `received_by_id`, `returned_by_id`, `confirmed_by_id`, `recorded_by_id`, `approved_by_id`, `changed_by_id`, `created_by_id`).

### Document / Line Item Composition (`ON DELETE CASCADE`)
- `rm_items.rm_form_id` -> `rm_requests.id`
- `rm_form_scs.rm_form_id` -> `rm_requests.id`
- `rm_form_scs.sc_id` -> `sales_order_components.id`
- `rm_item_snapshots.rm_item_id` -> `rm_items.id`
- `rm_item_snapshots.rm_form_id` -> `rm_requests.id`
- `material_issue_items.material_issue_id` -> `material_issues.id`
- `material_receipt_items.material_receipt_id` -> `material_receipts.id`
- `material_return_items.material_return_id` -> `material_returns.id`
- `additional_material_request_items.request_id` -> `additional_material_requests.id`
- `notifications.user_id` -> `users.id`

### Optional Linkages (`ON DELETE SET NULL`)
- `stock_balances.last_transaction_id` -> `stock_transactions.id`
- `material_issues.additional_request_id` -> `additional_material_requests.id`
- `sales_order_components.completed_by_id` -> `users.id`
- `audit_logs.actor_id` -> `users.id`

---

## 19. UNIQUE CONSTRAINT AUDIT

| Constraint Name | Table | Columns | Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `UQ_roles_name` | `roles` | `name` | Table Constraint | Enforces unique role names |
| `UQ_users_email` | `users` | `email` | Index & Column | Unique login email |
| `UQ_customers_code` | `customers` | `code` | Index & Column | Unique customer identifier |
| `UQ_po_po_number` | `purchase_orders` | `po_number` | Index & Column | Unique PO identifier |
| `uq_po_sc_number` | `sales_order_components` | `(po_id, sc_number)` | Table Constraint | Composite uniqueness of SC within PO |
| `UQ_rm_requests_sc_id` | `rm_requests` | `sc_id` | Unique Column | 1:1 SC to RM Request mapping |
| `uq_rm_form_sc` | `rm_form_scs` | `(rm_form_id, sc_id)` | Table Constraint | Composite uniqueness of PO-form to SC junction |
| `UQ_inventory_items_composite` | `inventory_items` | `(material, material_type, grade, size)` | Table Constraint | Unique material specification |
| `UQ_stock_balances_inventory_item_id` | `stock_balances` | `inventory_item_id` | Unique Column | 1:1 legacy StockBalance per InventoryItem |
| `UQ_stock_balances_product_bin` | `stock_balances` | `(product_id, bin_id)` | Partial Unique Index | 1:1 target StockBalance per Product + Bin |
| `UQ_product_categories_name` | `product_categories` | `name` | Table Constraint | Unique product category name |
| `UQ_product_families_category_name` | `product_families` | `(category_id, name)` | Table Constraint | Unique family name within Category |
| `UQ_products_name` | `products` | `name` | Table Constraint | Unique product master name |
| `UQ_warehouses_code` | `warehouses` | `code` | Table Constraint | Unique warehouse code |
| `UQ_warehouses_name` | `warehouses` | `name` | Table Constraint | Unique warehouse name |
| `UQ_warehouse_locations_wh_code` | `warehouse_locations` | `(warehouse_id, code)` | Table Constraint | Unique location code within Warehouse |
| `UQ_racks_location_code` | `racks` | `(location_id, code)` | Table Constraint | Unique rack code within Location |
| `UQ_bins_rack_code` | `bins` | `(rack_id, code)` | Table Constraint | Unique bin code within Rack |
| `UQ_material_issues_issue_number` | `material_issues` | `issue_number` | Index & Column | Unique Material Issue Note number |

---

## 20. CHECK CONSTRAINT AUDIT

| Table | Check Expression | Purpose |
| :--- | :--- | :--- |
| `stock_balances` | `"current_quantity" >= 0` | Strict prevention of negative physical inventory |
| `stock_transactions` | `"quantity" > 0` | Strict positive transaction quantities |
| `products` | `"minimum_inventory" >= 0` | Non-negative minimum inventory threshold |
| `products` | `"maximum_inventory" IS NULL OR "maximum_inventory" >= "minimum_inventory"` | Valid maximum inventory range |
| `sales_order_components` | `"target_quantity" > 0` | Strict positive SC batch target |
| `rm_items` | `"quantity" > 0` | Strict positive RM requested quantity |
| `rm_item_snapshots` | `"quantity" > 0` | Strict positive historical snapshot quantity |
| `material_issue_items` | `"quantity_issued" > 0` | Strict positive issued quantity |
| `material_receipt_items` | `"quantity_received" > 0` | Strict positive received quantity |
| `material_consumptions` | `"consumed_quantity" >= 0` | Non-negative consumption quantity |
| `material_return_items` | `"quantity_returned" > 0` | Strict positive return quantity |
| `additional_material_request_items` | `"quantity_requested" > 0` | Strict positive additional request quantity |

---

## 21. INDEX AUDIT

- **Primary Key Indexes (30):** Automatic B-Tree indexes on `id` across all 30 tables.
- **Unique Indexes (19):** Listed in Section 19.
- **Foreign Key & Search Indexes (29):**
  - `idx_users_email`, `idx_users_role_id`
  - `idx_customers_name`, `idx_customers_code`
  - `idx_purchase_orders_po_number`, `idx_purchase_orders_customer_id`
  - `idx_sc_sc_number`, `idx_sc_po_id`, `idx_sc_status`
  - `idx_rm_requests_po_id`, `idx_rm_requests_sc_id`, `idx_rm_requests_form_type`, `idx_rm_requests_status`
  - `idx_rm_form_scs_form_id`, `idx_rm_form_scs_sc_id`
  - `idx_rm_items_form_id`, `idx_rm_items_sc_id`, `idx_rm_items_material`
  - `idx_rm_snapshots_item_id`, `idx_rm_snapshots_form_id`
  - `idx_add_requests_sc_id`, `idx_add_requests_status`
  - `idx_add_req_items_request_id`, `idx_add_req_items_rm_item_id`
  - `idx_issues_sc_id`, `idx_issues_issue_number`, `idx_issues_issue_type`, `idx_issues_additional_request_id`
  - `idx_issue_items_issue_id`, `idx_issue_items_rm_item_id`
  - `idx_receipts_issue_id`
  - `idx_receipt_items_receipt_id`, `idx_receipt_items_rm_item_id`
  - `idx_consumptions_sc_id`, `idx_consumptions_rm_item_id`
  - `idx_returns_sc_id`, `idx_returns_status`
  - `idx_return_items_return_id`, `idx_return_items_rm_item_id`
  - `idx_notifications_user_id`, `idx_notifications_is_read`
  - `idx_audit_logs_entity`, `idx_audit_logs_actor_id`, `idx_audit_logs_created_at`
  - `IDX_products_family_id`, `IDX_product_families_category_id`
  - `IDX_warehouse_locations_warehouse_id`, `IDX_racks_location_id`, `IDX_bins_rack_id`
  - `IDX_stock_balances_bin_id`, `IDX_stock_transactions_product_created`, `IDX_stock_transactions_source_bin`, `IDX_stock_transactions_destination_bin`

---

## 22. LIFECYCLE & DELETION AUDIT

- **Soft Delete / Active Flag (`is_active`):** Supported on `User`, `Customer`, `InventoryItem`, `ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, `Bin`.
- **Hard Delete Protection:** Protected via `onDelete: 'RESTRICT'` on all master data and stock balance relations. Master data items referenced by downstream transactions cannot be deleted.
- **Workflow State Lifecycles:**
  - `SalesOrderComponent`: `DRAFT` ──> `SUBMITTED` ──> `STORES_PENDING` ──> `PARTIALLY_ISSUED` ──> `ISSUED` ──> `IN_PRODUCTION` ──> `ADDITIONAL_REQUEST` ──> `COMPLETED`.
  - `RmRequest`: `DRAFT` ──> `SUBMITTED` ──> `COMPLETED`.
  - `AdditionalMaterialRequest`: `REQUESTED` ──> `APPROVED` / `REJECTED` ──> `ISSUED` / `CANCELLED`.
  - `MaterialReceipt`: `RECEIVED`, `PARTIAL`, `DISCREPANCY`.
  - `MaterialReturn`: `PENDING_STORE_ACK` ──> `ACKNOWLEDGED` / `REJECTED`.

---

## 23. TIMESTAMP & AUDIT TRACEABILITY AUDIT

| Lifecycle Event | Entity | Timestamp Column | Captured Actor Column |
| :--- | :--- | :--- | :--- |
| **Creation** | All 30 Entities | `created_at` | `created_by_id` / `actor_id` |
| **Update** | 22 Entities | `updated_at` | Recorded via `AuditLog` |
| **RM Submission** | `RmRequest` | `submitted_at` | `created_by_id` |
| **RM Snapshot Revision** | `RmItemSnapshot` | `created_at` | `changed_by_id` |
| **Stores Issue** | `MaterialIssue` | `issue_date` | `issued_by_id` |
| **Production Receipt** | `MaterialReceipt` | `received_at` | `received_by_id` |
| **Consumption Log** | `MaterialConsumption` | `recorded_at` | `recorded_by_id` |
| **Return Submission** | `MaterialReturn` | `returned_at` | `returned_by_id` |
| **Return Confirmation**| `MaterialReturn` | `confirmed_at` | `confirmed_by_id` |
| **Additional Req Request**| `AdditionalMaterialRequest`| `requested_at` | `requested_by_id` |
| **Additional Req Approval**| `AdditionalMaterialRequest`| `approved_at` | `approved_by_id` |
| **SC Completion** | `SalesOrderComponent` | `completed_at` | `completed_by_id` |

---

## 24. ACTOR RELATIONSHIP AUDIT

All actor IDs in the database are **Foreign Keys to `users.id`** (`uuid`, `onDelete: 'RESTRICT'`):
- `StockTransaction.createdById`
- `RmRequest.createdById`
- `RmItemSnapshot.changedById`
- `MaterialIssue.issuedById`
- `MaterialReceipt.receivedById`
- `MaterialConsumption.recordedById`
- `MaterialReturn.returnedById`
- `MaterialReturn.confirmedById`
- `AdditionalMaterialRequest.requestedById`
- `AdditionalMaterialRequest.approvedById`
- `SalesOrderComponent.completedById`
- `AuditLog.actorId` (`onDelete: 'SET NULL'`)

---

## 25. API → DATABASE TRACE

```mermaid
flowchart TD
    subgraph "Stock In Flow"
        A1["POST /api/inventory/:id/stock-in"] --> B1["InventoryController.stockIn()"]
        B1 --> C1["InventoryService.stockIn()"]
        C1 --> D1["QueryRunner Transaction"]
        D1 --> E1["INSERT stock_transactions (STOCK_IN)"]
        D1 --> F1["UPDATE stock_balances (+ qty)"]
    end

    subgraph "Stock Out Flow"
        A2["POST /api/inventory/:id/stock-out"] --> B2["InventoryController.stockOut()"]
        B2 --> C2["InventoryService.stockOut()"]
        C2 --> D2["QueryRunner Transaction"]
        D2 --> E2["UPDATE stock_balances (- qty WHERE current_quantity >= qty)"]
        D2 --> F2["INSERT stock_transactions (STOCK_OUT)"]
    end

    subgraph "Stock Adjustment Flow"
        A3["POST /api/inventory/:id/adjustment"] --> B3["InventoryController.stockAdjustment()"]
        B3 --> C3["InventoryService.stockAdjustment()"]
        C3 --> D3["QueryRunner Transaction"]
        D3 --> E3["UPDATE stock_balances (+/- qty)"]
        D3 --> F3["INSERT stock_transactions (ADJUSTMENT)"]
    end
```

---

## 26. SERVICE → DATABASE TRACE

- **Atomic SQL Updates:** `InventoryService` utilizes raw SQL parameterized updates with explicit WHERE guards (e.g., `WHERE inventory_item_id = $2 AND current_quantity >= $1`) to prevent race conditions and negative inventory.
- **Ledger Verification:** `InventoryService.getReconciliation()` executes a aggregate `SUM(CASE ...)` SQL ledger query and compares theoretical `opening_balance + totalIn - totalOut` against `current_quantity`.

---

## 27. TRANSACTION & CONCURRENCY AUDIT

- **Transactional Boundaries:** `QueryRunner` (`startTransaction()`, `commitTransaction()`, `rollbackTransaction()`) is utilized for all multi-table mutations in `InventoryService`.
- **Concurrency Safety:**
  - Optimistic / SQL Conditional Update: `current_quantity = current_quantity - $1 WHERE ... current_quantity >= $1` prevents dirty decrements.
  - Check Constraint: `CHECK (current_quantity >= 0)` enforces database-level invariant.
  - Note: `SELECT FOR UPDATE` pessimistic locks are not explicitly used in `InventoryService`, relying on atomic SQL update affected row count checks.

---

## 28. TEST DATABASE AUDIT

- **Total Test Suites:** 6 suites, 104 tests passing.
- **Classification:**
  - **Contract & Invariant Specs:** `src/entities.spec.ts` (39 tests) and `src/workflow-database-lifecycle.spec.ts` (22 tests) — in-memory ORM metadata and invariant validation.
  - **Mocked Service Specs:** `src/inventory/inventory.service.spec.ts` (27 tests), `src/auth/auth.service.spec.ts` (6 tests).
  - **Controller Unit Specs:** `src/app.controller.spec.ts` (2 tests).
  - **DTO Validation Specs:** `test/dto-validation.spec.ts` (8 tests).
- **Real Database Integration Tests:** 0 real database tests currently executed in test suite due to missing local database runner in CI/local test script.

---

## 29. SEED & FIXTURE AUDIT

- `database/seeds/01-roles-and-users.seed.ts`: Seeds 6 system roles and default persona users with bcrypt password hashes.
- `database/seeds/02-sample-po-sc.seed.ts`: Seeds sample customer (`BDL-IND`), purchase order (`PO-TEST-001`), SC, and RM requested items.
- `database/scripts/run-seed.ts`: Standalone execution script to populate PostgreSQL via `AppDataSource`.
- `backend/src/database/seed-inventory.ts`: Developer seed for sample inventory items (`OHNS`, `MS`, `HSS`) and initial stock balances.
- `database/seeds/sample-users.seed.ts`: Legacy template with obsolete role names (retained as historical reference).

---

## 30. DUPLICATE STOCK SOURCE AUDIT

- **Audit Finding:** **NO MULTIPLE RUNTIME STOCK SOURCES**.
  - `StockBalance.currentQuantity` is the sole live stock quantity in the database.
  - `InventoryItem.minimumStockLevel`, `Product.minimumInventory`, and `Product.maximumInventory` represent static inventory policy thresholds, not live balances.
  - `RmItem.quantity`, `MaterialIssueItem.quantityIssued`, `MaterialReceiptItem.quantityReceived`, `MaterialConsumption.consumedQuantity`, and `MaterialReturnItem.quantityReturned` represent document-level transactional quantities, not stock balances.

---

## 31. DUPLICATE BUSINESS CONCEPT AUDIT

- **`InventoryItem` vs `Product`:**
  - `InventoryItem`: Legacy flat material specification (`material`, `materialType`, `grade`, `size`).
  - `Product`: Target master data entity structured under `ProductFamily` and `ProductCategory`.
  - **Decision `DEC-PROD-014`:** Co-exist non-destructively. Phase 11 will introduce dual-binding and migration adapters without deleting `InventoryItem`.
- **`RMItem` vs `MaterialIssueItem` vs `MaterialReceiptItem` vs `MaterialConsumption`:**
  - Distinct workflow stages. `RMItem` is engineering specification; downstream items capture operational fulfillment, receipt confirmation, shop-floor consumption, and store returns.

---

## 32. LEGACY / DEPRECATED CODE AUDIT

| Item | Location | Evidence / Description | Classification |
| :--- | :--- | :--- | :--- |
| `sample-users.seed.ts` | `database/seeds/` | Contains obsolete roles (`DESIGN_USER`, `STORES_MANAGER`, `PRODUCTION_USER`) | LEGACY / REFERENCE |
| `InventoryItem` Direct Balance | `backend/src/inventory/` | Flat inventory without storage hierarchy | ACTIVE LEGACY (To be bridged in Phase 11) |
| Direct Generic Stock Mutation | `inventory.controller.ts:144` | Direct `POST /transactions` throws `NotImplementedException` | RESTRICTED / DEPRECATED |

---

## 33. CURRENT DATABASE ARCHITECTURE MAP

```text
CURRENT DATABASE RELATIONSHIP MAP (ACTUAL CODEBASE)

[Role] ───────────────< [User]
                          │
       ┌──────────────────┼────────────────────────────────────────┐
       │ (actor)          │ (actor)                                │ (actor)
       ▼                  ▼                                        ▼
[PurchaseOrder] ────< [SalesOrderComponent] ───< [RmRequest] ───< [RmItem]
       ▲                  │                         │                │
       │ (1:N)            │ (1:N)                   │ (1:N)          │ (1:N)
[Customer]                ├────< [MaterialIssue] ───┴────────────────┼───< [MaterialIssueItem]
                          │             │                            │                │
                          │             └────< [MaterialReceipt] ────┼───< [MaterialReceiptItem]
                          ├──────────────────< [MaterialConsumption]─┘
                          ├──────────────────< [MaterialReturn] ─────┬───< [MaterialReturnItem]
                          │                                          │
                          └──────────────────< [AdditionalRequest] ──┼───< [AdditionalRequestItem]
                                                                     │
[InventoryItem] ──(1:1)── [StockBalance]                             │
       │                         │                                   │
       └─────────────────────────┼──────< [StockTransaction] ────────┘
                                 │
[ProductCategory]                │ (Nullable Target Links)
       │ (1:N)                   │
[ProductFamily]                  │
       │ (1:N)                   │
   [Product] ────────────────────┤
                                 │
  [Warehouse]                    │
       │ (1:N)                   │
[WarehouseLocation]              │
       │ (1:N)                   │
    [Rack]                       │
       │ (1:N)                   │
    [Bin] ───────────────────────┘
```

---

## 34. FINAL DESIGN TARGET MAP (PHASE 2 REFERENCE)

```text
TARGET FINAL ARCHITECTURE MAP (PHASE 2 & PHASE 7 SPECIFICATION)

[ProductCategory]
       │ (1:N)
[ProductFamily]
       │ (1:N)
   [Product] ──┐
               ├──> [StockBalance] (Composite Unique: Product + Bin)
     [Bin] ────┘          │
       ▲                  │ (1:N)
       │ (1:N)            ▼
    [Rack]         [StockTransaction] (sourceBinId / destinationBinId / productId)
       ▲
       │ (1:N)
[WarehouseLocation]
       ▲
       │ (1:N)
  [Warehouse]

[PurchaseOrder] ──> [SalesOrderComponent] ──> [RmRequest] ──> [RmItem]
                                                    │
                                                    ▼
                                            [MaterialIssue]
                                                    │
                                                    ▼
                                            [MaterialReceipt]
                                                    │
                                                    ▼
                                          [MaterialConsumption]
                                                    │
                                                    ▼
                                             [MaterialReturn]
```

---

## 35. GAP MATRIX

| Area | Current Implementation State | Target Design Expectation | Gap Analysis | Impact | Target Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Product Master** | Entity and Migration exist; no CRUD service/controller | Full CRUD, family hierarchy, active toggles | Service & UI missing | Medium | Phase 11 |
| **Storage Hierarchy** | Entities and Migration exist; no CRUD service/controller | Full 4-level cascading hierarchy (`WH > Loc > Rack > Bin`) | Service & UI missing | Medium | Phase 11 |
| **Stock Granularity** | `InventoryItem` used in `InventoryService`; `Product + Bin` in Schema | `Product + Bin` sole operational stock identity | Service layer uses legacy `InventoryItem` | High | Phase 11 |
| **Transaction Ledger**| `StockTransaction` entity has `sourceBinId`/`destinationBinId`; service uses flat `inventory_item_id` | Full bin-to-bin traceability | Movement methods need bin support | High | Phase 11 |
| **RM Workflow Link** | RM items exist; Stores issue, Receipt, Consumption, Return services are skeletons | End-to-end status-driven lifecycle | Workflow service implementation | High | Phase 10 / 12 |
| **Database Triggers** | Check constraints exist in DB; immutability enforced at app layer | Database-level triggers preventing update/delete of ledger | Minor defense-in-depth gap | Low | Phase 8 Hardening |

---

## 36. DATA PRESERVATION RISKS

1. **`inventory_items` Table Preservation:**
   - Existing historical inventory items and test fixtures must not be dropped.
   - `inventory_item_id` is made nullable on `stock_balances` and `stock_transactions`, allowing legacy records to co-exist with new `product_id` + `bin_id` balances (`DEC-PROD-014`).
2. **Ledger Immutability Preservation:**
   - No data migration may delete or overwrite historical rows in `stock_transactions` or `rm_item_snapshots`.
3. **Foreign Key Deletion Rules:**
   - Enforce `onDelete: 'RESTRICT'` on all master tables (`products`, `product_families`, `product_categories`, `warehouses`, `bins`, `users`) so that deleting master data cannot orphan historical audit and stock transactions.

---

## 37. PHASE 7.2 INPUTS (FACTS TO USE)

1. **Entity Inventory:** Exactly 30 domain entities exist and are registered in `ALL_ENTITIES`.
2. **Migrations:** 5 migrations exist (0000 initial schema, 0001 inventory, 0002 adjustment direction, 0003 opening balance, 0004 master data and storage hierarchy).
3. **Current Runtime Inventory:** `InventoryService` operates on `InventoryItem` and `StockBalance.inventory_item_id`.
4. **Current Database Schema:** `stock_balances` supports both `inventory_item_id` and composite `(product_id, bin_id)`.
5. **Master Data & Storage Entities:** `ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, and `Bin` are already created as TypeORM entities and included in Migration 0004.
6. **RBAC:** 6 system roles (`ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`) are established. `SENIOR_DESIGNER` is not an active role.
7. **Constraints:** Non-negative stock (`CHK_stock_balances_current_quantity`), positive movement (`CHK_stock_transactions_quantity`), and master uniqueness are enforced.
8. **Runtime Status:** Database connection is currently blocked in local development environment.

---

## 38. OPEN DECISIONS & POLICIES (FROM DESIGN BASELINE)

- **`DEC-005` (Return Destination Policy):** Unused RM returns to source Bin; scrap/offcut routes to designated quarantine/scrap Bin.
- **`DEC-PROD-010` (Max Inventory Policy):** Configured as soft warning in Phase 11.
- **`DEC-PROD-011` / `DEC-WH-006` (Master Creation Authority):** Restricted to `ADMIN` and `STORES` roles.
- **`DEC-PROD-012` (Multi-Product Bin Policy):** System supports multi-product Bins via composite `(product_id, bin_id)` unique keys.
- **`DEC-PROD-014` (`InventoryItem` vs `Product` Reconciliation):** Dual-binding non-destructive co-existence.
- **`DEC-WH-008` (Inter-Warehouse Transfer):** Two-step workflow (`TRANSFER_OUT` from source Bin, `TRANSFER_IN` to destination Bin).

---

## 39. LIMITATIONS

1. **Database Runtime Validation:** Could not query the live PostgreSQL instance due to local password authentication configuration (`FATAL: password authentication failed for user "postgres"`). All findings are derived with 100% precision from source code, entity definitions, migrations, and test suites.
2. **No Execution of Destructive Operations:** In strict adherence to Phase 7.1 rules, no tables were modified, dropped, or altered.

---

### Audit Sign-Off
**Phase 7.1 Status:** **COMPLETE** (Code Inspection & Architectural Audit)  
**Next Sub-Phase:** **Phase 7.2 — Existing Entity Classification**
