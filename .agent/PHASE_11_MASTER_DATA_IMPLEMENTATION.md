# PHASE 11 — MASTER DATA IMPLEMENTATION ARCHITECTURE

## 1. OBJECTIVE
The objective of Phase 11 is to implement the real, working Master Data domain for RMRIT—`ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, and `Bin`—on both the backend and frontend. This phase establishes master data management without creating inventory stock or executing business workflow transactions (which belong to Phase 12).

---

## 2. AUTHORITATIVE SOURCES
1. Current User Requirements (`.agent/CURRENT_REQUIREMENTS_BASELINE.md`)
2. Phase 1 Final Requirement Baseline (`.agent/PHASE_1_REPORT.md`)
3. Final Phase 2 Design Documents (Phases 2.1 through 2.6)
4. Phase 7 Final Database Design (`.agent/PHASE_7_DATABASE_DESIGN.md`)
5. Phase 8 Database Implementation & Migrations
6. Phase 9 Backend Foundation (`.agent/PHASE_9_BACKEND_FOUNDATION.md`)
7. Phase 10 User Management & Inventory Reconciliation (`.agent/PHASE_10_REPORT.md`)
8. Actual Current Repository (`backend/src/`, `frontend/src/`)

---

## 3. CURRENT REPOSITORY FINDINGS
- **Backend Architecture**: `MasterDataModule` (`backend/src/master-data/`) importing `TypeOrmModule.forFeature` for all 7 master data entities.
- **REST APIs**: 7 controllers registered under `/api/categories`, `/api/families`, `/api/products`, `/api/warehouses`, `/api/locations`, `/api/racks`, and `/api/bins`.
- **Frontend Architecture**: `MasterDataPage.tsx` (`frontend/src/pages/MasterDataPage.tsx`) connected to `masterDataService.ts`, featuring tabs, search, active filters, cascading selectors, and modal forms.

---

## 4. CATEGORY IMPLEMENTATION
- **Entity**: `ProductCategory` (`name`, `isActive`).
- **Validation**: Required `name` (max 100), case-insensitive unique constraint (`LOWER(TRIM(name))`).
- **APIs**:
  - `GET /api/categories` — Paginated & searchable list.
  - `GET /api/categories/:id` — Detail view with associated families.
  - `POST /api/categories` — Create category (`ADMIN` only).
  - `PATCH /api/categories/:id` — Update / Activate / Deactivate category (`ADMIN` only).

---

## 5. FAMILY IMPLEMENTATION
- **Entity**: `ProductFamily` (`categoryId`, `name`, `isActive`).
- **Validation**: Required `categoryId` (valid UUID), required `name` (max 100), unique within category (`(categoryId, LOWER(TRIM(name)))`).
- **APIs**:
  - `GET /api/families?parentId=:categoryId` — Filter by parent Category.
  - `POST /api/families` — Create family (`ADMIN` only).
  - `PATCH /api/families/:id` — Update family (`ADMIN` only).

---

## 6. PRODUCT IMPLEMENTATION
- **Entity**: `Product` (`familyId`, `name`, `minimumInventory`, `maximumInventory`, `isActive`).
- **Validation**: Required `familyId` (valid UUID), required `name` (max 255, globally unique), `minimumInventory >= 0`, `maximumInventory >= minimumInventory`.
- **CRITICAL ARCHITECTURAL GUARANTEE**: Creating a `Product` master record NEVER creates a `StockBalance` row. Stock creation occurs exclusively through physical Stores operations.
- **APIs**:
  - `GET /api/products?parentId=:familyId` — Filter by parent Family.
  - `POST /api/products` — Create product (`ADMIN`, `DESIGNER`).
  - `PATCH /api/products/:id` — Update product (`ADMIN`, `DESIGNER`).

---

## 7. WAREHOUSE IMPLEMENTATION
- **Entity**: `Warehouse` (`code`, `name`, `isActive`).
- **Validation**: Required `code` (max 50, uppercase, globally unique), required `name` (max 100, globally unique).
- **APIs**:
  - `GET /api/warehouses` — Paginated list.
  - `POST /api/warehouses` — Create warehouse (`ADMIN`, `STORES`).
  - `PATCH /api/warehouses/:id` — Update warehouse (`ADMIN`, `STORES`).

---

## 8. LOCATION IMPLEMENTATION
- **Entity**: `WarehouseLocation` (`warehouseId`, `code`, `name`, `isActive`).
- **Validation**: Required `warehouseId` (valid UUID), `code` (uppercase, unique within warehouse: `(warehouseId, UPPER(TRIM(code)))`), `name`.
- **APIs**:
  - `GET /api/locations?parentId=:warehouseId` — Filter by parent Warehouse.
  - `POST /api/locations` — Create location (`ADMIN`, `STORES`).
  - `PATCH /api/locations/:id` — Update location (`ADMIN`, `STORES`).

---

## 9. RACK IMPLEMENTATION
- **Entity**: `Rack` (`locationId`, `code`, `name`, `isActive`).
- **Validation**: Required `locationId` (valid UUID), `code` (uppercase, unique within location: `(locationId, UPPER(TRIM(code)))`), `name`.
- **APIs**:
  - `GET /api/racks?parentId=:locationId` — Filter by parent Location.
  - `POST /api/racks` — Create rack (`ADMIN`, `STORES`).
  - `PATCH /api/racks/:id` — Update rack (`ADMIN`, `STORES`).

---

## 10. BIN IMPLEMENTATION
- **Entity**: `Bin` (`rackId`, `code`, `name`, `isActive`).
- **Validation**: Required `rackId` (valid UUID), `code` (uppercase, unique within rack: `(rackId, UPPER(TRIM(code)))`), `name`.
- **APIs**:
  - `GET /api/bins?parentId=:rackId` — Filter by parent Rack.
  - `POST /api/bins` — Create bin (`ADMIN`, `STORES`).
  - `PATCH /api/bins/:id` — Update bin (`ADMIN`, `STORES`).

---

## 11. PRODUCT + BIN RELATIONSHIP
- Master data entities prepare the strict storage structure for physical stock.
- `StockBalance` identity remains composite: `Product (1) ──> (N) StockBalance (N) <── (1) Bin`.
- Global total product stock is derived dynamically via `SUM(StockBalance.currentQuantity)` over all child Bins.

---

## 12. INVENTORY COMPATIBILITY
- Existing `InventoryItem` and inventory transaction APIs remain 100% operational.
- Updating master data records (e.g. renaming a Bin) modifies descriptive text columns without altering underlying internal UUID primary keys or historical `StockTransaction` logs.

---

## 13. REST API DESIGN & ROUTING CONVENTIONS
Standardized REST endpoints:
- `GET/POST/PATCH /api/categories`
- `GET/POST/PATCH /api/families`
- `GET/POST/PATCH /api/products`
- `GET/POST/PATCH /api/warehouses`
- `GET/POST/PATCH /api/locations`
- `GET/POST/PATCH /api/racks`
- `GET/POST/PATCH /api/bins`

---

## 14. RBAC MATRIX

| Resource | View | Create | Update | Deactivate / Reactivate |
| :--- | :---: | :---: | :---: | :---: |
| **Categories** | All 6 Roles | ADMIN | ADMIN | ADMIN |
| **Families** | All 6 Roles | ADMIN | ADMIN | ADMIN |
| **Products** | All 6 Roles | ADMIN, DESIGNER | ADMIN, DESIGNER | ADMIN, DESIGNER |
| **Warehouses** | All 6 Roles | ADMIN, STORES | ADMIN, STORES | ADMIN, STORES |
| **Locations** | All 6 Roles | ADMIN, STORES | ADMIN, STORES | ADMIN, STORES |
| **Racks** | All 6 Roles | ADMIN, STORES | ADMIN, STORES | ADMIN, STORES |
| **Bins** | All 6 Roles | ADMIN, STORES | ADMIN, STORES | ADMIN, STORES |

---

## 15. DTO VALIDATION PIPELINE
- Global `ValidationPipe` enforces `@IsString()`, `@IsUUID('4')`, `@IsNumber()`, `@Min(0)`, `@IsBoolean()`, and `@MaxLength(...)`.
- `forbidNonWhitelisted: true` rejects unknown client payload fields with `400 Bad Request`.

---

## 16. MASTER DATA LIFECYCLE & DELETION
- **Deactivation**: Master items support soft status updates (`isActive = false`).
- **Delete Restrictions**: Master data hard deletion is `RESTRICTED` if child entities or historical stock balances reference the master record.

---

## 17. FRONTEND ARCHITECTURE
- **Page Component**: `MasterDataPage.tsx` supporting 7 domain tabs with full search, active filter toggles, cascading dropdowns, modal forms, and notification banners.
- **API Client**: `masterDataService.ts` utilizing `api` client (Fetch wrapper with JWT headers).
- **Navigation**: Integrated into `AppLayout.tsx` subnavigation for authorized user roles.

---

## 18. TESTING & REGRESSION
- **Backend Unit Tests**: 15 dedicated unit tests in `master-data.service.spec.ts` (119 total backend tests passing).
- **Frontend Build**: Vite + TypeScript compilation (`tsc -b && vite build`) passed with 0 errors.

---

## 19. DATABASE VALIDATION
- Entity relationships, unique constraints, and check constraints verified against TypeORM definitions.

---

## 20. SECURITY AUDIT
- All write operations protected by `JwtAuthGuard` and `RolesGuard`.
- Unknown payload parameters forbidden. SQL parameterization prevents injection.

---

## 21. PERFORMANCE
- Paginated queries (`page`, `pageSize`, max 100) bound server memory usage.
- Relationships indexed by foreign key columns (`categoryId`, `familyId`, `warehouseId`, `locationId`, `rackId`).

---

## 22. OPEN DECISIONS (PRESERVED)
- `DEC-WH-006`, `DEC-PROD-010`, `DEC-PROD-012`, `DEC-PROD-014`, and `DEC-005` remain open for business stakeholder input.

---

## 23. PHASE 12 IMPACT
Master Data implementation is 100% complete and validated. Phase 12 (Core Business Workflows) can now consume validated Product and Bin entities during SC, RM, Material Issue, Production, and Return operations.
