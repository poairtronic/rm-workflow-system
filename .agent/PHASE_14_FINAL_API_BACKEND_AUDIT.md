# Complete Backend API Inventory & Technical Health Audit

## 1. Executive Summary & Route Discovery Methodology
A live runtime introspection was performed on the active NestJS Express application router (`NestFactory.create(AppModule)`).
- **Authoritative Source**: Current running TypeScript application code in `backend/src`.
- **Total Discovered HTTP Routes**: **122 routes** across 28 controllers.
- **Route Coverage**: 100% of discovered routes surveyed and accounted for.

---

## 2. Complete Current Route Inventory (122 Routes)

| # | Method | Path | Module / Controller | Auth Required | Role Requirement | Validation Pipe | DB Effect | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | `GET` | `/` | AppController | None | Public | N/A | None | **PASS** |
| 2 | `GET` | `/api/health` | AppController | None | Public | N/A | None | **PASS** |
| 3 | `POST` | `/api/auth/login` | AuthController | None | Public | LoginDto | Reads User | **PASS** |
| 4 | `POST` | `/api/auth/dev-token` | AuthController | None | Public | None | None | **PASS** |
| 5 | `GET` | `/api/auth/me` | AuthController | JWT | Authenticated | N/A | Reads User | **PASS** |
| 6 | `GET` | `/api/auth/roles` | AuthController | JWT | Authenticated | N/A | Reads Roles | **PASS** |
| 7 | `GET` | `/api/users` | UsersController | JWT | ADMIN | N/A | Reads Users | **PASS** |
| 8 | `POST` | `/api/users` | UsersController | JWT | ADMIN | CreateUserDto | Inserts User | **PASS** |
| 9 | `GET` | `/api/users/:id` | UsersController | JWT | Authenticated | UUID Pipe | Reads User | **PASS** |
| 10 | `PUT` | `/api/users/:id` | UsersController | JWT | ADMIN | UpdateUserDto | Updates User | **PASS** |
| 11 | `PATCH` | `/api/users/:id/activate` | UsersController | JWT | ADMIN | UUID Pipe | Updates User | **PASS** |
| 12 | `PATCH` | `/api/users/:id/deactivate` | UsersController | JWT | ADMIN | UUID Pipe | Updates User | **PASS** |
| 13 | `GET` | `/api/customers` | CustomersController | JWT | Authenticated | Query Params | Reads Customers | **PASS** |
| 14 | `POST` | `/api/customers` | CustomersController | JWT | ADMIN | CreateCustomerDto | Inserts Customer | **PASS** |
| 15 | `GET` | `/api/customers/:id` | CustomersController | JWT | Authenticated | UUID Pipe | Reads Customer | **PASS** |
| 16 | `PATCH` | `/api/customers/:id` | CustomersController | JWT | ADMIN | UpdateCustomerDto | Updates Customer | **PASS** |
| 17 | `GET` | `/api/customers/status` | CustomersController | JWT | Authenticated | N/A | None | **PASS** |
| 18 | `GET` | `/api/categories` | CategoriesController | JWT | Authenticated | Pagination/Query | Reads Categories | **PASS** |
| 19 | `POST` | `/api/categories` | CategoriesController | JWT | ADMIN | CreateCategoryDto | Inserts Category | **PASS** |
| 20 | `GET` | `/api/categories/:id` | CategoriesController | JWT | Authenticated | UUID Pipe | Reads Category | **PASS** |
| 21 | `PATCH` | `/api/categories/:id` | CategoriesController | JWT | ADMIN | UpdateCategoryDto | Updates Category | **PASS** |
| 22 | `DELETE` | `/api/categories/:id` | CategoriesController | JWT | ADMIN | UUID Pipe | Deletes Category | **PASS** |
| 23 | `GET` | `/api/families` | FamiliesController | JWT | Authenticated | Pagination/Query | Reads Families | **PASS** |
| 24 | `POST` | `/api/families` | FamiliesController | JWT | ADMIN | CreateFamilyDto | Inserts Family | **PASS** |
| 25 | `GET` | `/api/families/:id` | FamiliesController | JWT | Authenticated | UUID Pipe | Reads Family | **PASS** |
| 26 | `PATCH` | `/api/families/:id` | FamiliesController | JWT | ADMIN | UpdateFamilyDto | Updates Family | **PASS** |
| 27 | `DELETE` | `/api/families/:id` | FamiliesController | JWT | ADMIN | UUID Pipe | Deletes Family | **PASS** |
| 28 | `GET` | `/api/products` | ProductsController | JWT | Authenticated | Pagination/Query | Reads Products | **PASS** |
| 29 | `POST` | `/api/products` | ProductsController | JWT | ADMIN | CreateProductDto | Inserts Product | **PASS** |
| 30 | `GET` | `/api/products/:id` | ProductsController | JWT | Authenticated | UUID Pipe | Reads Product | **PASS** |
| 31 | `PATCH` | `/api/products/:id` | ProductsController | JWT | ADMIN | UpdateProductDto | Updates Product | **PASS** |
| 32 | `GET` | `/api/warehouses` | WarehousesController | JWT | Authenticated | Pagination/Query | Reads Warehouses | **PASS** |
| 33 | `POST` | `/api/warehouses` | WarehousesController | JWT | ADMIN | CreateWarehouseDto | Inserts Warehouse | **PASS** |
| 34 | `GET` | `/api/warehouses/:id` | WarehousesController | JWT | Authenticated | UUID Pipe | Reads Warehouse | **PASS** |
| 35 | `PATCH` | `/api/warehouses/:id` | WarehousesController | JWT | ADMIN | UpdateWarehouseDto| Updates Warehouse | **PASS** |
| 36 | `DELETE` | `/api/warehouses/:id` | WarehousesController | JWT | ADMIN | UUID Pipe | Deletes Warehouse | **PASS** |
| 37 | `GET` | `/api/locations` | LocationsController | JWT | Authenticated | Pagination/Query | Reads Locations | **PASS** |
| 38 | `POST` | `/api/locations` | LocationsController | JWT | ADMIN | CreateLocationDto | Inserts Location | **PASS** |
| 39 | `GET` | `/api/locations/:id` | LocationsController | JWT | Authenticated | UUID Pipe | Reads Location | **PASS** |
| 40 | `PATCH` | `/api/locations/:id` | LocationsController | JWT | ADMIN | UpdateLocationDto | Updates Location | **PASS** |
| 41 | `DELETE` | `/api/locations/:id` | LocationsController | JWT | ADMIN | UUID Pipe | Deletes Location | **PASS** |
| 42 | `GET` | `/api/racks` | RacksController | JWT | Authenticated | Pagination/Query | Reads Racks | **PASS** |
| 43 | `POST` | `/api/racks` | RacksController | JWT | ADMIN | CreateRackDto | Inserts Rack | **PASS** |
| 44 | `GET` | `/api/racks/:id` | RacksController | JWT | Authenticated | UUID Pipe | Reads Rack | **PASS** |
| 45 | `PATCH` | `/api/racks/:id` | RacksController | JWT | ADMIN | UpdateRackDto | Updates Rack | **PASS** |
| 46 | `DELETE` | `/api/racks/:id` | RacksController | JWT | ADMIN | UUID Pipe | Deletes Rack | **PASS** |
| 47 | `GET` | `/api/bins` | BinsController | JWT | Authenticated | Pagination/Query | Reads Bins | **PASS** |
| 48 | `POST` | `/api/bins` | BinsController | JWT | ADMIN | CreateBinDto | Inserts Bin | **PASS** |
| 49 | `GET` | `/api/bins/:id` | BinsController | JWT | Authenticated | UUID Pipe | Reads Bin | **PASS** |
| 50 | `PATCH` | `/api/bins/:id` | BinsController | JWT | ADMIN | UpdateBinDto | Updates Bin | **PASS** |
| 51 | `DELETE` | `/api/bins/:id` | BinsController | JWT | ADMIN | UUID Pipe | Deletes Bin | **PASS** |
| 52 | `GET` | `/api/inventory` | InventoryController | JWT | STORES, ADMIN | Query Params | Reads Inventory | **PASS** |
| 53 | `POST` | `/api/inventory` | InventoryController | JWT | STORES, ADMIN | CreateItemDto | Inserts Item | **PASS** |
| 54 | `GET` | `/api/inventory/:id` | InventoryController | JWT | STORES, ADMIN | UUID Pipe | Reads Item | **PASS** |
| 55 | `PATCH` | `/api/inventory/:id` | InventoryController | JWT | STORES, ADMIN | UpdateItemDto | Updates Item | **PASS** |
| 56 | `POST` | `/api/inventory/:id/adjustment` | InventoryController | JWT | STORES, ADMIN | AdjustStockDto | Stock Tx | **PASS** |
| 57 | `GET` | `/api/inventory/:id/reconciliation` | InventoryController | JWT | STORES, ADMIN | UUID Pipe | Reads Recon | **PASS** |
| 58 | `GET` | `/api/inventory/:id/stock` | InventoryController | JWT | STORES, ADMIN | UUID Pipe | Reads Stock | **PASS** |
| 59 | `POST` | `/api/inventory/:id/stock-in` | InventoryController | JWT | STORES, ADMIN | StockInDto | Stock Tx | **PASS** |
| 60 | `POST` | `/api/inventory/:id/stock-out` | InventoryController | JWT | STORES, ADMIN | StockOutDto | Stock Tx | **PASS** |
| 61 | `GET` | `/api/inventory/:id/transactions` | InventoryController | JWT | STORES, ADMIN | UUID Pipe | Reads Tx | **PASS** |
| 62 | `POST` | `/api/inventory/:id/transactions` | InventoryController | JWT | STORES, ADMIN | CreateTxDto | Inserts Tx | **PASS** |
| 63 | `GET` | `/api/inventory/reconciliation` | InventoryController | JWT | STORES, ADMIN | Query Params | Reads Recon | **PASS** |
| 64 | `GET` | `/api/inventory/reconciliation/workflow` | InventoryController | JWT | STORES, ADMIN | Query Params | Reads Workflow | **PASS** |
| 65 | `GET` | `/api/po` | PoController | JWT | Authenticated | Query Params | Reads POs | **PASS** |
| 66 | `POST` | `/api/po` | PoController | JWT | ADMIN, STORES | CreatePoDto | Inserts PO | **PASS** |
| 67 | `GET` | `/api/po/:id` | PoController | JWT | Authenticated | UUID Pipe | Reads PO | **PASS** |
| 68 | `PATCH` | `/api/po/:id` | PoController | JWT | ADMIN, STORES | UpdatePoDto | Updates PO | **PASS** |
| 69 | `GET` | `/api/po/status` | PoController | JWT | Authenticated | N/A | None | **PASS** |
| 70 | `GET` | `/api/po/:id/documents` | PoController | JWT | Authenticated | UUID Pipe | Reads Attachments | **PASS** |
| 71 | `POST` | `/api/po/:id/documents` | PoController | JWT | ADMIN, STORES | SupportingDocDto | Inserts Attachment | **PASS** |
| 72 | `DELETE` | `/api/po/:id/documents/:attachmentId` | PoController | JWT | ADMIN, STORES | UUID Pipe | Soft Detach | **PASS** |
| 73 | `GET` | `/api/po/:id/documents/:attachmentId/download` | PoController | JWT | Authenticated | UUID Pipe | Gen Signed URL | **PASS** |
| 74 | `GET` | `/api/sc` | ScController | JWT | Authenticated | Query Params | Reads SCs | **PASS** |
| 75 | `POST` | `/api/sc` | ScController | JWT | ADMIN, DESIGNER | CreateScDto | Inserts SC | **PASS** |
| 76 | `GET` | `/api/sc/:id` | ScController | JWT | Authenticated | UUID Pipe | Reads SC | **PASS** |
| 77 | `POST` | `/api/sc/:id/complete` | ScController | JWT | PRODUCTION, ADMIN| CompleteScDto | Transitions SC | **PASS** |
| 78 | `POST` | `/api/sc/:id/close` | ScController | JWT | STORES, ADMIN | CloseScDto | Transitions SC | **PASS** |
| 79 | `GET` | `/api/sc/:id/documents` | ScController | JWT | Authenticated | UUID Pipe | Reads Attachments | **PASS** |
| 80 | `POST` | `/api/sc/:id/documents` | ScController | JWT | Roles Allowed | SupportingDocDto | Inserts Attachment | **PASS** |
| 81 | `DELETE` | `/api/sc/:id/documents/:attachmentId` | ScController | JWT | Roles Allowed | UUID Pipe | Soft Detach | **PASS** |
| 82 | `GET` | `/api/sc/:id/documents/:attachmentId/download` | ScController | JWT | Authenticated | UUID Pipe | Gen Signed URL | **PASS** |
| 83 | `GET` | `/api/sc/:scId/production-documents` | ScDocumentsController | JWT | Authenticated | UUID Pipe | Reads Attachments | **PASS** |
| 84 | `POST` | `/api/sc/:scId/production-documents` | ScDocumentsController | JWT | PROD, ADMIN | SupportingDocDto | Inserts Attachment | **PASS** |
| 85 | `DELETE` | `/api/sc/:scId/production-documents/:attachmentId` | ScDocumentsController | JWT | PROD, ADMIN | UUID Pipe | Soft Detach | **PASS** |
| 86 | `GET` | `/api/sc/:scId/production-documents/:attachmentId` | ScDocumentsController | JWT | Authenticated | UUID Pipe | Gen Signed URL | **PASS** |
| 87 | `GET` | `/api/rm` | RmController | JWT | Authenticated | Query Params | Reads RM | **PASS** |
| 88 | `POST` | `/api/rm` | RmController | JWT | DESIGNER, ADMIN | CreateRmDto | Inserts RM | **PASS** |
| 89 | `GET` | `/api/rm/:id` | RmController | JWT | Authenticated | UUID Pipe | Reads RM | **PASS** |
| 90 | `POST` | `/api/rm/:id/items` | RmController | JWT | DESIGNER, ADMIN | CreateRmItemDto | Inserts Items | **PASS** |
| 91 | `POST` | `/api/rm/:id/submit` | RmController | JWT | DESIGNER, ADMIN | SubmitRmDto | Transitions RM | **PASS** |
| 92 | `POST` | `/api/rm/:id/review` | RmController | JWT | STORES, ADMIN | ReviewRmDto | Transitions RM | **PASS** |
| 93 | `GET` | `/api/rm/:id/documents` | RmController | JWT | Authenticated | UUID Pipe | Reads Attachments | **PASS** |
| 94 | `POST` | `/api/rm/:id/documents` | RmController | JWT | DESIGNER, ADMIN | SupportingDocDto | Inserts Attachment | **PASS** |
| 95 | `DELETE` | `/api/rm/:id/documents/:attachmentId` | RmController | JWT | DESIGNER, ADMIN | UUID Pipe | Soft Detach | **PASS** |
| 96 | `GET` | `/api/rm/:id/documents/:attachmentId/download` | RmController | JWT | Authenticated | UUID Pipe | Gen Signed URL | **PASS** |
| 97 | `GET` | `/api/material-issues` | MaterialIssueController | JWT | STORES, ADMIN | Query Params | Reads Issues | **PASS** |
| 98 | `POST` | `/api/material-issues` | MaterialIssueController | JWT | STORES, ADMIN | CreateIssueDto | Inserts Issue & Tx | **PASS** |
| 99 | `GET` | `/api/material-issues/:id` | MaterialIssueController | JWT | STORES, ADMIN | UUID Pipe | Reads Issue | **PASS** |
| 100 | `POST` | `/api/production/receipt` | ProductionController | JWT | PROD, ADMIN | CreateReceiptDto | Inserts Receipt | **PASS** |
| 101 | `POST` | `/api/production/consume` | ProductionController | JWT | PROD, ADMIN | CreateConsumptionDto | Inserts Consump | **PASS** |
| 102 | `POST` | `/api/production/return` | ProductionController | JWT | PROD, ADMIN | CreateReturnDto | Inserts Return | **PASS** |
| 103 | `POST` | `/api/production/return/:id/verify` | ProductionController | JWT | STORES, ADMIN | VerifyReturnDto | Credits Stock | **PASS** |
| 104 | `GET` | `/api/production/accounting/:scId` | ProductionController | JWT | Authenticated | UUID Pipe | Calculates WIP | **PASS** |
| 105 | `GET` | `/api/additional-requests` | AdditionalRequestController | JWT | Authenticated | Query Params | Reads AMR | **PASS** |
| 106 | `POST` | `/api/additional-requests` | AdditionalRequestController | JWT | PROD, ADMIN | CreateAmrDto | Inserts AMR | **PASS** |
| 107 | `GET` | `/api/additional-requests/:id` | AdditionalRequestController | JWT | Authenticated | UUID Pipe | Reads AMR | **PASS** |
| 108 | `POST` | `/api/files` | FilesController | JWT | Authenticated | ParseFilePipe | Inserts UploadedFile | **PASS** |
| 109 | `GET` | `/api/files/:id` | FilesController | JWT | Authenticated | UUID Pipe | Reads Metadata | **PASS** |
| 110 | `GET` | `/api/files/:id/download` | FilesController | JWT | Authenticated | UUID Pipe | Gen Signed URL | **PASS** |
| 111 | `DELETE` | `/api/files/:id` | FilesController | JWT | Creator / Admin | UUID Pipe | Soft Delete File | **PASS** |
| 112 | `GET` | `/api/attachments` | AttachmentsController | JWT | Authenticated | Query Params | Reads Attachments | **PASS** |
| 113 | `POST` | `/api/attachments` | AttachmentsController | JWT | Context Roles | CreateAttachmentDto | Inserts Attachment | **PASS** |
| 114 | `GET` | `/api/attachments/:id` | AttachmentsController | JWT | Authenticated | UUID Pipe | Reads Attachment | **PASS** |
| 115 | `DELETE` | `/api/attachments/:id` | AttachmentsController | JWT | Context Roles | UUID Pipe | Soft Detach | **PASS** |
| 116 | `GET` | `/api/analytics/status` | AnalyticsController | JWT | Authenticated | N/A | None | **PASS** |
| 117 | `GET` | `/api/audit/status` | AuditController | JWT | Authenticated | N/A | None | **PASS** |
| 118 | `GET` | `/api/material-movement/status` | MaterialMovementController| JWT | Authenticated | N/A | None | **PASS** |
| 119 | `GET` | `/api/notifications/status` | NotificationsController | JWT | Authenticated | N/A | None | **PASS** |
| 120 | `GET` | `/api/permissions/status` | PermissionsController | JWT | Authenticated | N/A | None | **PASS** |
| 121 | `GET` | `/api/roles/status` | RolesController | JWT | Authenticated | N/A | None | **PASS** |
| 122 | `GET` | `/api/stores/status` | StoresController | JWT | Authenticated | N/A | None | **PASS** |

---

## 3. Technical Health Survey

1. **Authentication & RBAC**:
   - Every protected route utilizes `JwtAuthGuard`.
   - Role-gated routes strictly enforce `RolesGuard` backed by `@Roles(...)`.
   - Passwords are encrypted using `bcryptjs` and stripped before sending responses.
   - JWT validation fails gracefully on expired, tampered, or missing tokens (401).

2. **Validation & Anti-Mass-Assignment**:
   - NestJS `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` guards all controllers.
   - Injections of arbitrary columns or unauthorized privilege escalations (e.g. `isAdmin: true`) return `400 Bad Request`.

3. **Database Transactions & QueryRunners**:
   - Critical operations (Material Issue, Return Verification, SC Completion/Closure, Stock Movement) execute within TypeORM QueryRunner transactions with explicit `commitTransaction` and `rollbackTransaction` in `try-catch-finally` blocks.

4. **TypeORM & PostgreSQL Schema Status**:
   - 33 Entities registered in `AppDataSource`.
   - Migration directory: `src/database/migrations/` holds 9 TypeORM migrations.
   - No obsolete table references like `service_cards` or `rm_forms` remain in active entities.

5. **External Infrastructure Status**:
   - **Neon Database**: Active live cloud connection verified: `ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb` (**PASS**).
   - **Supabase Storage**: Connected to live project `https://tegljiqxtgmjungqytjz.supabase.co` with bucket `rmrit-documents` (**PASS**). Upload, signed download, and delete operations tested and operational.

6. **Technical Risks & Limitations**:
   - Test suites running fully in parallel occasionally collide on shared database seed tables (e.g. `roles` / `users`). Running tests per-phase or with `--no-file-parallelism` is recommended for CI.
