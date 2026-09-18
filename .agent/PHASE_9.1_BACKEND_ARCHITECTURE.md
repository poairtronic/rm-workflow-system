# PHASE 9.1 BACKEND ARCHITECTURE & MODULE FOUNDATION

## 1. Pre-Implementation Audit Summary
- **Git Status**: Working tree is clean.
- **Git Log**: Recent commits reflect the successful completion of Phase 8 (Database Schema Implementation, Workflow Implementation, and Integrity Verifications).
- **Compilation Check**: `npm run build` executed successfully with no errors, confirming that the current codebase is syntactically sound and builds correctly.

## 2. Current Module Structure vs Target Domain Boundaries
The current NestJS backend is already structured into distinct feature modules under `backend/src/`. Based on our audit, the current structure strongly aligns with the expected domain boundaries.

### Current Modules:
- **Core / Foundation**: `AppModule`, `ConfigModule`, `TypeOrmModule`
- **Security / User Management**: `AuthModule`, `UsersModule`, `RolesModule`, `PermissionsModule`
- **Master Data / Storage**: `MasterDataModule` (Handles Product Categories, Families, Products, Warehouses, Locations, Racks, Bins)
- **Inventory Engine**: `InventoryModule` (Handles `InventoryItem`, `StockBalance`, `StockTransaction`)
- **Business Workflows**:
  - `PoModule` (Purchase Orders)
  - `ScModule` (Sales Order Components)
  - `RmModule` (RM Specifications & Requests)
  - `MaterialIssueModule` (Material Issue)
  - `ProductionModule` (Receipt, Consumption, Return)
  - `AdditionalRequestModule` (AMR)
- **Cross-cutting**: `NotificationsModule`, `AnalyticsModule`, `AuditModule`, `StoresModule`

### Assessment against Targets
The existing architecture **satisfies the domain boundary requirements**. The separation of `MasterDataModule` (reference data) from `InventoryModule` (stock quantities and ledger) ensures that business transactions depend on inventory, not master data directly. Business workflow modules are isolated and can interact with the Inventory engine via service injection. No major restructuring or rewrites are needed.

## 3. Database Entity to Module Mapping
The physical location of entities is somewhat centralized (e.g., master data entities reside in `inventory/entities/`), but the module registrations are correctly logically bounded:

- **Auth/Users**: `Role`, `User`
- **Customers**: `Customer`
- **PO/SC**: `PurchaseOrder`, `SalesOrderComponent`
- **RM**: `RmRequest`, `RmItem`, `RmFormSc`, `RmItemSnapshot`
- **Material Issue**: `MaterialIssue`, `MaterialIssueItem`
- **Production (Receipt/Consumption/Return)**: `MaterialReceipt`, `MaterialReceiptItem`, `MaterialConsumption`, `MaterialReturn`, `MaterialReturnItem`
- **Additional Request**: `AdditionalMaterialRequest`, `AdditionalMaterialRequestItem`
- **Master Data Module**: `ProductCategory`, `ProductFamily`, `Product`, `Warehouse`, `WarehouseLocation`, `Rack`, `Bin`
- **Inventory Module**: `InventoryItem`, `StockBalance`, `StockTransaction`
- **Cross-cutting**: `Notification`, `AuditLog`

*Rule:* We will keep the entities where they are to avoid breaking existing imports, while managing their lifecycle via their respective logic modules (`MasterDataModule` for catalog/locations, `InventoryModule` for stock).

## 4. Dependency Graph & Service Relationships
- **Business Workflow Modules** (`MaterialIssueModule`, `ProductionModule`, `AdditionalRequestModule`, etc.) will depend on the **InventoryModule** for any stock mutation (Issue, Return Acknowledgement).
- **Business Workflow Modules** will depend on **MasterDataModule** for validating product IDs, bin IDs, and location existence.
- **InventoryModule** acts as the singular gatekeeper for the `StockTransaction` table and `StockBalance` table to guarantee the immutable ledger and prevent double-stock movement or negative inventory.

## 5. Cross-Module Communication Strategy
- **Synchronous Service Injection**: Modules will export their respective services (e.g., `InventoryService`, `MasterDataService`) and other modules will inject them (e.g., `ProductionModule` imports `InventoryModule`).
- **Transaction Boundaries**: Workflows that require cross-module updates (e.g., saving a `MaterialIssue` and updating a `StockBalance`) must accept a TypeORM `EntityManager` (query runner) in the service method to participate in the same database transaction, ensuring atomicity.

## 6. Action Plan for Phase 9.2 (Backend API Implementation)
Since Phase 9.1 confirms the architecture is sound:
1. **No Backend Rebuild**: We will strictly adhere to the rule "DO NOT REBUILD THE BACKEND."
2. **Proceed to Phase 9.2**: Focus on implementing the specific REST APIs, DTOs, and validation logic within the existing module boundaries.
3. **Transaction Safety**: Implement strict transaction propagation using TypeORM's QueryRunner/EntityManager for multi-entity business workflows.
4. **API Integration**: Wire up the NestJS controllers for the workflow entities, ensuring legacy compatibility is maintained where necessary.
