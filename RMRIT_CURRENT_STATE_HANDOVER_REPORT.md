# RMRIT — Complete Current-State Handover & Reverse-Engineering Report

> **IMPORTANT: This report describes the actual repository state discovered during the audit. Where documentation and implementation differ, the discrepancy is explicitly identified. RMRIT is an independent project and must not be treated as a replacement or continuation of another application.**

---

# SECTION 1 — PROJECT IDENTITY

* **Application Name**: RMRIT
* **Full Application Meaning**: Raw-Material Requirements & Inventory Traceability System (RMRIT)
* **Business Purpose**: An internal industrial manufacturing workflow, digital chain of custody, and material traceability application. It tracks raw materials from Design requirement specification through Stores issuance, Shop-floor/Production physical receipt, Consumption/Scrap accounting, Return-to-stores physical verification handshake, and independent Sales Order Component (SC) closure.
* **Repository Name**: `rm-workflow-system`
* **Repository Structure**: Monorepo with npm workspaces managing `backend/` (NestJS 12 + TypeORM 1.1 + PostgreSQL/Neon) and `frontend/` (React 19 + Vite 8 + Vanilla CSS tokens).
* **Current Branch**: `main`
* **Current Commit SHA**: `e5896744c90c059f018944ac06ef9dfc345fb083`
* **Latest Commit**: `fix(auth): add automated database seed runner and update seed scripts`
* **Development Status**: Active, hardened architectural baseline.
* **Phase Completion Status**: **Phases 1 through 16 Completed (Phase 16.12 certified baseline)**.
* **Backend Status**: Fully operational NestJS API with 29 controllers, 35 database entities, 24 feature modules, PostgreSQL background workers, and comprehensive RBAC.
* **Frontend Status**: Operational React 19 single-page application utilizing vanilla CSS tokens, state-based modular view routing, modal-based workflows, in-app notification center, and email queue observability dashboard.
* **Database Status**: PostgreSQL 16 (hosted on Neon Serverless) managed via TypeORM migrations with 16 applied migration files.
* **Deployment Status**: Configured for Render Web Service (Backend & Frontend) connected to Neon PostgreSQL and Supabase Storage.
* **Production Status**: Baseline certified for staging/production readiness; dev tokens disabled in production mode.

```text
DOCUMENTED STATUS:
- Phase 16.12 Certified (Hardened Architecture, In-App Notifications, Gmail API integration, Neon DB, Supabase Storage).
- Full End-to-End Traceability and Material Accounting Formulas verified.

ACTUAL REPOSITORY STATUS:
- Exact match with documentation on business logic, database entities, transactions, and API structure.
- Minor discrepancy: frontend masterDataService.ts calls endpoints without '/api' prefix (e.g., '/categories' instead of '/api/categories'), whereas workflowService.ts correctly calls '/api/...'.
- Entity count in ALL_ENTITIES is 35 (expanded during Phases 14-16).
```

---

# SECTION 2 — COMPLETE PHASE HISTORY

| Phase | Sub-phase | Purpose | Implementation | Tests | Documentation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | 1.1–1.10 | Domain requirements baseline, PO vs SC separation, immutable traceability invariants | Core architectural definitions | Conceptual specs | `PHASE_1_REPORT.md`, `PHASE_1_REQUIREMENT_DECISION_LOG.md` | **COMPLETE** |
| **Phase 2** | 2.1–2.8 | Storage hierarchy design (Warehouse $\rightarrow$ Location $\rightarrow$ Rack $\rightarrow$ Bin) & Product master | Domain models & schemas | Schema specs | `PHASE_2.1` to `PHASE_2.8_REPORT.md` | **COMPLETE** |
| **Phase 7** | 7.1–7.5 | Comprehensive schema design, relational integrity audit, normalized entities | Master data & workflow DDL | Migration validations | `PHASE_7_REPORT.md`, `PHASE_7.1` to `7.5` | **COMPLETE** |
| **Phase 8** | 8.1–8.3 | Initial database implementation & migration scripts | Initial TypeORM schema | DB integrity tests | `PHASE_8_REPORT.md`, `PHASE_8.1` to `8.3` | **COMPLETE** |
| **Phase 9** | 9.1–9.4 | Backend foundation, NestJS module scaffolding, JWT Auth & RBAC guards | `AuthModule`, `UsersModule`, `RolesModule` | `auth.service.spec.ts` | `PHASE_9_REPORT.md`, `PHASE_9.1` to `9.4` | **COMPLETE** |
| **Phase 10** | 10.1–10.12 | User management, inventory reconciliation, opening balance, security regression | `InventoryModule` reconciler | `inventory-reconciliation-*.spec.ts` | `PHASE_10_REPORT.md`, `PHASE_10.1` to `10.12` | **COMPLETE** |
| **Phase 11** | 11.1–11.9 | Master data implementation (Category, Family, Product, Warehouse, Location, Rack, Bin) | `MasterDataModule`, controllers | `master-data/*.spec.ts` (Phase 11.1–11.8) | `PHASE_11_REPORT.md`, `PHASE_11.1` to `11.4` | **COMPLETE** |
| **Phase 12** | 12.1–12.10 | Core manufacturing business implementation (PO, SC, RM, Stores Review, Issue, Receipt, Consume, Return, Additional Request, Closure) | `ScModule`, `RmModule`, `StoresModule`, `MaterialIssueModule`, `ProductionModule`, `AdditionalRequestModule` | `customer-po-http-phase12-1.spec.ts`, `material-issue-phase12-5.spec.ts`, `inventory-reconciliation-phase12.spec.ts` | `PHASE_12_REPORT.md`, `PHASE_12_1` to `12.10` | **COMPLETE** |
| **Phase 13** | 13.1–13.7 | Business logic hardening, state machines, quantity conservation, duplicate prevention, pessimistic locking concurrency, SC isolation, RM baseline protection | `StateMachineValidator`, `QuantityCalculator`, `QueryRunner` pessimistic locks | `duplicate-prevention-phase13-4.spec.ts`, `phase-13-5-concurrency.spec.ts`, `sc-isolation-phase13-6.spec.ts` | `PHASE_13_FINAL_CERTIFICATION_REPORT.md`, `PHASE_13.1` to `13.7` | **COMPLETE** |
| **Phase 14** | 14.1–14.8 | Document & attachment subsystem (Supabase Storage integration, polymorphic attachments for PO, SC, RM, Production, signed URLs, file lifecycle) | `FilesModule`, `AttachmentsModule`, `ScDocumentsController`, `SupabaseStorageProvider` | `files-foundation-phase14-1.spec.ts`, `attachments-phase14-2.spec.ts`, `file-authorization-phase14-6.spec.ts`, `file-lifecycle-phase14-7.spec.ts` | `PHASE_14_FINAL_CERTIFICATION_REPORT.md`, `PHASE_14.1` to `14.8` | **COMPLETE** |
| **Phase 15** | 15.0–15.22 | Enterprise email communication subsystem (PostgreSQL Queue, `FOR UPDATE SKIP LOCKED` worker, Google OAuth2 Gmail API, retry/exponential backoff, templates, audit logs, idempotency, observability) | `EmailModule`, `EmailWorkerService`, `GmailApiProvider`, `TemplateService`, `EmailObservabilityService` | `phase-15-10` to `phase-15-20.spec.ts` (12 test suites) | `PHASE_15_21_FINAL_PHASE15_CERTIFICATION_REPORT.md`, `PHASE_15.1` to `15.22` | **COMPLETE** |
| **Phase 16** | 16.1–16.12 | In-app notification center, read/unread state isolation, multi-recipient resolution engine, notification preferences, duplicate idempotency key protection, security isolation | `NotificationsModule`, `NotificationsController`, `NotificationBell`, `NotificationCenterModal`, `NotificationSettingsPage` | `phase-16-11-security.spec.ts`, `phase16_2_frontend.test.ts`, `phase16_5_notification_read_unread.test.ts` | `PHASE_16_12_FINAL_END_TO_END_NOTIFICATION_CERTIFICATION_REPORT.md`, `PHASE_16.1` to `16.12` | **COMPLETE** |

---

# SECTION 3 — COMPLETE TECHNOLOGY STACK

## Frontend (`frontend/package.json`)
* **React**: `^19.2.8`
* **React DOM**: `^19.2.8`
* **TypeScript**: `~6.0.2`
* **Vite**: `^8.2.2` (`@vitejs/plugin-react`: `^6.1.0`)
* **Router**: Custom lightweight state-based view router (`useState<CurrentView>` in `src/app/router/index.tsx`) — zero third-party router dependency.
* **HTTP Client**: Native `fetch` with wrapper class in `src/services/api.ts`.
* **State Management**: React Context (`AppProviders` $\rightarrow$ `AuthContext`, custom hooks).
* **CSS Architecture & Design System**: Pure Vanilla CSS with CSS custom properties design tokens defined in `src/styles/tokens.css` and component stylesheets. Zero TailwindCSS.
* **Icons**: Inline SVG icons (Bell, Check, Trash, Upload, Download, Warning).
* **Linter**: `oxlint` (`^1.79.0`).
* **Type Checking**: `tsc --noEmit`.

## Backend (`backend/package.json`)
* **Node.js**: v20+ / v22+ (ES Modules: `"type": "module"` in `package.json`).
* **NestJS Core & Common**: `^12.0.1` (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`).
* **TypeORM**: `^1.1.1` with `@nestjs/typeorm`: `^12.0.1`.
* **Database Driver**: `pg` (`^8.23.0`), `@types/pg` (`^8.23.1`).
* **Authentication**: Passport (`passport`: `^0.7.0`, `passport-jwt`: `^4.0.1`, `@nestjs/jwt`: `^12.0.1`).
* **Password Hashing**: `bcryptjs` (`^3.0.3`).
* **Validation & Transformation**: `class-validator` (`^0.15.1`), `class-transformer` (`^0.5.1`).
* **Google APIs**: `googleapis` (`^181.0.0`) for OAuth2 Gmail API transport.
* **File Upload**: `multer` (`^2.2.0`), `@types/multer` (`^2.2.0`).
* **External Storage SDK**: `@supabase/supabase-js` (`^2.116.0`).
* **Testing Framework**: `vitest` (`^4.1.2`), `@vitest/coverage-v8` (`^4.1.2`), `@nestjs/testing` (`^12.0.1`), `supertest` (`^7.0.0`).
* **Linter**: `oxlint` (`^1.58.0`), `prettier` (`^3.4.2`).

## Database & Cloud Services
* **PostgreSQL**: PostgreSQL 16 on Neon Serverless (`pg` pool, SSL enabled with `rejectUnauthorized: false`).
* **Object Storage**: Supabase Storage Bucket (`rmrit-attachments`).
* **Email Transport**: Google Cloud Platform OAuth2 Gmail API (`googleapis`).
* **Hosting / PaaS**: Render Web Services.

### Complete Dependency Matrix

| Package | Version | Purpose | Where Used | Criticality |
| :--- | :--- | :--- | :--- | :--- |
| `@nestjs/core` / `@nestjs/common` | `^12.0.1` | Backend framework | Entire `backend/src` | **CRITICAL** |
| `typeorm` | `^1.1.1` | ORM, query builder, schema & migrations | Entire backend database layer | **CRITICAL** |
| `pg` | `^8.23.0` | PostgreSQL client | TypeORM database driver | **CRITICAL** |
| `@nestjs/jwt` & `passport-jwt` | `^12.0.1` / `^4.0.1` | JWT authentication & extraction | `backend/src/auth` | **CRITICAL** |
| `bcryptjs` | `^3.0.3` | Salted password hashing | User authentication & seeding | **CRITICAL** |
| `class-validator` | `^0.15.1` | DTO payload schema validation | All backend controllers & DTOs | **CRITICAL** |
| `googleapis` | `^181.0.0` | Gmail API OAuth2 integration | `backend/src/email/providers` | **CRITICAL** |
| `@supabase/supabase-js` | `^2.116.0` | Supabase Cloud Storage SDK | `backend/src/files/storage` | **HIGH** |
| `multer` | `^2.2.0` | Multipart file upload interceptor | `backend/src/files` | **HIGH** |
| `react` & `react-dom` | `^19.2.8` | UI rendering engine | Entire `frontend/src` | **CRITICAL** |
| `vite` | `^8.2.2` | Frontend build and dev server | Frontend build pipeline | **CRITICAL** |

---

# SECTION 4 — COMPLETE REPOSITORY STRUCTURE

```text
rm-workflow-system/
├── .agent/                             # AI governance, architectural rules, domain skills, phase reports
│   ├── docs/                           # Numbered domain architecture specification documents (00 to 12)
│   ├── skills/                         # 10 Human-centered UI/UX manufacturing skills
│   ├── BACKEND_API_INVENTORY.md        # Master discovered API catalogue
│   ├── BACKEND_MODULES_MAP.md          # Domain module connection to business rules
│   ├── DESIGN_SYSTEM.md                # UI design system guidelines & tokens
│   ├── OVERVIEW.md                     # High-level RMRIT overview & lifecycle
│   ├── PO_VS_SC_AND_MATERIAL_LIFECYCLE.md # Sacred business invariants for PO vs SC
│   ├── RMRIT_COMPLETE_END_TO_END_WORKFLOW_REPORT.md # Certified workflow reference
│   ├── RMRIT_MULTI_AGENT_DEVELOPMENT_GOVERNANCE.md # Multi-agent development protocol
│   ├── SKILL.md                        # Master developer skill for RMRIT
│   ├── UI_DESIGN_RULES.md              # Real-employee test & shop-floor design rules
│   └── WORKFLOW_RULES.md               # Core non-negotiable manufacturing workflow invariants
├── backend/                            # NestJS 12 backend application
│   ├── src/
│   │   ├── additional-request/         # Additional material requests (Line items, reason codes, approval)
│   │   ├── analytics/                  # Operations cycle-time & material yield analytics
│   │   ├── attachments/                # Polymorphic attachment associations (PO, SC, RM, Production)
│   │   ├── audit/                      # Immutable audit log recording (who, what, when, old/new json)
│   │   ├── auth/                       # JWT Strategy, Roles guard, Login, Password verification
│   │   ├── common/                     # Cross-cutting utils, StateMachineValidator, QuantityCalculator
│   │   ├── config/                     # Configuration module & AppDataSource definition
│   │   ├── customers/                  # Customer master data
│   │   ├── database/                   # Seed runners & 15 database migration scripts
│   │   ├── email/                      # Email queue, worker, Gmail OAuth2 provider, templates, observability
│   │   ├── files/                      # File upload, MIME validator, Supabase storage provider
│   │   ├── inventory/                  # StockBalance, StockTransaction, Warehouse hierarchy, Reconciliation
│   │   ├── master-data/                # Categories, Families, Products, Warehouses, Locations, Racks, Bins
│   │   ├── material-issue/             # Stores material issue transactions (Bin-level atomic stock deduction)
│   │   ├── material-movement/          # Status & ledger helper module
│   │   ├── notifications/              # In-app notifications, user preferences, system settings
│   │   ├── permissions/                # Permission listing
│   │   ├── po/                         # Purchase Order context & documents
│   │   ├── production/                 # Production receipt, consumption, return & store verification handshake
│   │   ├── rm/                         # RM requirements (Dimensions, weight, items, snapshots, stores review)
│   │   ├── roles/                      # Role entity & definitions
│   │   ├── sc/                         # Sales Order Component (Fundamental workflow unit, closure, documents)
│   │   ├── stores/                     # Stores review & stock check queue
│   │   ├── users/                      # User management & activation
│   │   ├── app.module.ts               # Root NestJS module importing all 24 sub-modules
│   │   └── main.ts                     # NestJS application bootstrap, CORS, ValidationPipe
│   ├── test/                           # 90 Vitest unit, integration, and E2E test suites
│   ├── package.json                    # Backend dependencies and scripts
│   └── tsconfig.json                   # Backend TypeScript configuration
├── database/                           # Shared database scripts and baseline migration
│   ├── migrations/                     # 1700000000000-InitialSchema.ts
│   ├── scripts/                        # Database verification & seeding scripts
│   └── seeds/                          # Master data seeds
├── frontend/                           # React 19 + Vite frontend SPA
│   ├── src/
│   │   ├── app/                        # App providers, router, and global config
│   │   ├── components/                 # Reusable UI components (Buttons, Cards, Modals, Notifications)
│   │   ├── constants/                  # Role names and system constants
│   │   ├── features/                   # Feature slices (po, sc, rm, stores, production, notifications)
│   │   ├── hooks/                      # Custom React hooks (useAuth, useNotifications, useHealth)
│   │   ├── layouts/                    # AppLayout (Header, Navigation, NotificationBell), AuthLayout
│   │   ├── pages/                      # LoginPage, DashboardPage, WorkflowPage, MasterDataPage, InventoryPage, NotificationSettingsPage, EmailObservabilityPage
│   │   ├── services/                   # ApiClient, AuthService, WorkflowService, MasterDataService, NotificationService
│   │   ├── styles/                     # tokens.css, notifications.css, App.css, index.css
│   │   ├── tests/                      # Frontend TypeScript test suites
│   │   └── types/                      # Domain interfaces and API payload types
│   ├── package.json                    # Frontend dependencies and scripts
│   └── vite.config.ts                  # Vite build configuration
├── package.json                        # Root workspace configuration
└── README.md                           # Project documentation overview
```

---

# SECTION 5 — .AGENT SYSTEM AND AI SKILLS

The `.agent/` directory represents the **strict governance, architectural contracts, and operational standards** for all AI agents working on RMRIT.

### Summary of Authoritative Files in `.agent/`

| File / Skill | Purpose | Rules Enforced | When Agent Must Read It |
| :--- | :--- | :--- | :--- |
| `.agent/SKILL.md` | Primary agent development skill | 10 Non-negotiable business rules, UI/UX bar, performance bar | **BEFORE ANY code change** |
| `.agent/OVERVIEW.md` | High-level system architecture | Core manufacturing lifecycle, V1 scope boundaries | When onboarding to RMRIT |
| `.agent/WORKFLOW_RULES.md` | Manufacturing business rules | PO reference only; SC independent closure; append-only ledger | Before modifying SC/PO/RM logic |
| `.agent/PO_VS_SC_AND_MATERIAL_LIFECYCLE.md` | Lifecycle invariants | PO does NOT complete; SC closes independently; RM requirement immutable | Before touching SC, PO, or RM services |
| `.agent/BACKEND_MODULES_MAP.md` | Maps NestJS modules to domain | Clear separation between roles and transaction engines | Before adding/updating backend modules |
| `.agent/UI_DESIGN_RULES.md` & `DESIGN_SYSTEM.md` | UI/UX design standards | Real-employee test, shop-floor touch usability, high-contrast badges | Before creating or modifying UI components |
| `.agent/RMRIT_MULTI_AGENT_DEVELOPMENT_GOVERNANCE.md` | Multi-agent coordination | Read-before-write, no destructive refactors, verify with tests | Before starting any development phase |
| `.agent/skills/` (10 files) | UX design skills | Progressive disclosure, exception-first UI, audit-trail UI, realistic data | Before designing frontend workflows |
| `.agent/docs/00` to `12` | Detailed domain specifications | Entity models, roles, state machines, open issues | When modifying specific domain entities |

### Non-Negotiable Rules Summary
1. **PO is a reference, SC is the workflow/completion unit.** A PO never closes as a whole; SCs complete and close independently.
2. **Never overwrite a transaction row.** Issues, receipts, consumption, returns, and additional requests are strictly append-only.
3. **Never overwrite the original RM requirement.** Additional material requests are separate entities.
4. **All authoritative math is server-side.** Unaccounted material, scrap, and balances are computed by backend SQL/services.
5. **Two-step return confirmation.** Production initiates a return; Stores must verify physical receipt and specify target bin before stock increases.

---

# SECTION 6 — BUSINESS DOMAIN MODEL

### Complete Entity Catalogue (35 Entities)

```text
1. Role (roles)                        - System role definition (ADMIN, DESIGNER, STORES, PRODUCTION, SENIOR_MANAGER, GENERAL_MANAGER)
2. User (users)                        - Application user with hashed password, role_id, department, and active status
3. Customer (customers)                - Client master data (code, name, email, phone)
4. PurchaseOrder (purchase_orders)      - External commercial PO reference (po_number, customer_id, status)
5. SalesOrderComponent (sales_order_components) - Primary workflow unit (sc_number, po_id, product_name, target_quantity, status: DRAFT -> STORES_PENDING -> ISSUED -> IN_PRODUCTION -> COMPLETED -> CLOSED)
6. RmRequest (rm_requests)             - RM form header (sc_id, po_id, form_type: SC/PO, status: DRAFT -> SUBMITTED -> REVIEWED)
7. RmItem (rm_items)                   - Dimensional line items (material, grade, size, length, width, thickness, diameter, weight, quantity, mapped_product_id)
8. RmFormSc (rm_form_scs)              - Join table for PO-level multi-SC RM forms
9. RmItemSnapshot (rm_item_snapshots)   - Immutable revision history of RM item edits
10. MaterialIssue (material_issues)    - Stores issue transaction header (sc_id, issue_number, issue_type: INITIAL_ISSUE / ADDITIONAL_ISSUE, issued_by_id)
11. MaterialIssueItem (material_issue_items) - Issued line items (rm_item_id, quantity_issued, heat_number, batch_number)
12. MaterialReceipt (material_receipts) - Production receipt confirmation header (material_issue_id, received_by_id, status)
13. MaterialReceiptItem (material_receipt_items) - Received line items (rm_item_id, quantity_received)
14. MaterialConsumption (material_consumptions) - Production consumption record (sc_id, rm_item_id, consumed_quantity, recorded_by_id)
15. MaterialReturn (material_returns)  - Material return header (sc_id, status: PENDING_STORE_ACK -> ACKNOWLEDGED, returned_by_id, confirmed_by_id)
16. MaterialReturnItem (material_return_items) - Return line items (rm_item_id, quantity_returned)
17. AdditionalMaterialRequest (additional_material_requests) - Shortage request header (sc_id, status: REQUESTED -> APPROVED -> REJECTED, reason)
18. AdditionalMaterialRequestItem (additional_material_request_items) - Shortage line items (rm_item_id, quantity_requested, quantity_approved)
19. Notification (notifications)       - In-app notification record (user_id, title, message, type, is_read, idempotency_key)
20. AuditLog (audit_logs)              - Immutable audit trail (entity_name, entity_id, action_type, actor_id, old_values, new_values, metadata)
21. ProductCategory (product_categories)- Master data category (name, is_active)
22. ProductFamily (product_families)   - Master data family linked to category (category_id, name)
23. Product (products)                 - Inventory product item (family_id, name, minimum_inventory, maximum_inventory)
24. Warehouse (warehouses)             - Physical warehouse facility (code, name)
25. WarehouseLocation (warehouse_locations) - Warehouse zone/aisle (warehouse_id, code, name)
26. Rack (racks)                       - Storage rack (location_id, code, name)
27. Bin (bins)                         - Specific storage bin (rack_id, code, name)
28. StockBalance (stock_balances)      - Real-time stock balance source of truth (product_id, bin_id, current_quantity >= 0)
29. StockTransaction (stock_transactions) - Immutable inventory ledger (product_id, source_bin_id, destination_bin_id, transaction_type, quantity > 0)
30. InventoryItem (inventory_items)    - Legacy compatibility entity retained for zero data loss
31. UploadedFile (uploaded_files)      - File storage metadata (storage_key, original_name, mime_type, size, provider: SUPABASE, created_by_id)
32. Attachment (attachments)           - Polymorphic association linking UploadedFile to (context: PO/SC/RM_REQUEST/PRODUCTION, record_id)
33. EmailJob (email_jobs)              - Asynchronous email queue item (recipient_email, event_type, template_key, status, attempts, idempotency_key)
34. EmailLog (email_logs)              - Historical email transmission log (job_id, status, provider_message_id, error_code, attempted_at)
35. SystemSetting (system_settings)    - Global key-value configurations (e.g., GLOBAL_WORKFLOW_EMAIL_ENABLED)
36. UserNotificationPreference (user_notification_preferences) - Per-user notification toggle (user_id, workflow_email_enabled)
```

---

# SECTION 7 — DATABASE — COMPLETE REVERSE ENGINEERING

### Database Schema Table Inventory

| Table Name | Primary Key | Foreign Keys | Key Constraints & Indexes | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `roles` | `id` (UUID) | None | `UQ(name)` | Role definitions |
| `users` | `id` (UUID) | `role_id` $\rightarrow$ `roles(id)` | `UQ(email)`, `IDX(email)`, `IDX(role_id)` | User accounts |
| `customers` | `id` (UUID) | None | `UQ(code)`, `IDX(name)`, `IDX(code)` | Client records |
| `purchase_orders` | `id` (UUID) | `customer_id` $\rightarrow$ `customers(id)` | `UQ(po_number)`, `IDX(po_number)`, `IDX(customer_id)` | PO reference headers |
| `sales_order_components` | `id` (UUID) | `po_id` $\rightarrow$ `purchase_orders(id)` | `UQ(po_id, sc_number)`, `CHK(target_quantity > 0)`, `IDX(sc_number)` | SC workflow units |
| `rm_requests` | `id` (UUID) | `sc_id` $\rightarrow$ `sales_order_components(id)`, `created_by_id` $\rightarrow$ `users(id)` | `UQ(sc_id)`, `IDX(sc_id)`, `IDX(status)` | RM form headers |
| `rm_items` | `id` (UUID) | `rm_form_id` $\rightarrow$ `rm_requests(id)`, `mapped_product_id` $\rightarrow$ `products(id)` | `CHK(quantity > 0)`, `IDX(rm_form_id)`, `IDX(material)` | RM line items |
| `rm_item_snapshots` | `id` (UUID) | `rm_item_id` $\rightarrow$ `rm_items(id)`, `rm_form_id` $\rightarrow$ `rm_requests(id)` | `CHK(quantity > 0)`, `IDX(rm_item_id)` | Immutable RM revisions |
| `product_categories` | `id` (UUID) | None | `UQ(name)` | Product categories |
| `product_families` | `id` (UUID) | `category_id` $\rightarrow$ `product_categories(id)` | `UQ(category_id, name)` | Product families |
| `products` | `id` (UUID) | `family_id` $\rightarrow$ `product_families(id)` | `UQ(name)`, `CHK(min >= 0)`, `CHK(max >= min)` | Products master |
| `warehouses` | `id` (UUID) | None | `UQ(code)`, `UQ(name)` | Warehouses master |
| `warehouse_locations` | `id` (UUID) | `warehouse_id` $\rightarrow$ `warehouses(id)` | `UQ(warehouse_id, code)` | Locations master |
| `racks` | `id` (UUID) | `location_id` $\rightarrow$ `warehouse_locations(id)` | `UQ(location_id, code)` | Racks master |
| `bins` | `id` (UUID) | `rack_id` $\rightarrow$ `racks(id)` | `UQ(rack_id, code)` | Specific storage bins |
| `stock_balances` | `id` (UUID) | `product_id` $\rightarrow$ `products(id)`, `bin_id` $\rightarrow$ `bins(id)` | `UQ(product_id, bin_id)`, `CHK(current_quantity >= 0)` | Real-time stock balance |
| `stock_transactions` | `id` (UUID) | `product_id`, `source_bin_id`, `destination_bin_id` | `CHK(quantity > 0)`, `IDX(product_id, created_at)` | Append-only ledger |
| `material_issues` | `id` (UUID) | `sc_id` $\rightarrow$ `sales_order_components(id)`, `issued_by_id` $\rightarrow$ `users(id)` | `UQ(issue_number)`, `IDX(sc_id)` | Stores issue transactions |
| `material_issue_items` | `id` (UUID) | `material_issue_id` $\rightarrow$ `material_issues(id)`, `rm_item_id` $\rightarrow$ `rm_items(id)` | `CHK(quantity_issued > 0)` | Stores issue items |
| `material_receipts` | `id` (UUID) | `material_issue_id` $\rightarrow$ `material_issues(id)`, `received_by_id` $\rightarrow$ `users(id)` | `IDX(material_issue_id)` | Production receipts |
| `material_receipt_items` | `id` (UUID) | `material_receipt_id` $\rightarrow$ `material_receipts(id)`, `rm_item_id` $\rightarrow$ `rm_items(id)` | `CHK(quantity_received > 0)` | Production receipt items |
| `material_consumptions` | `id` (UUID) | `sc_id` $\rightarrow$ `sales_order_components(id)`, `rm_item_id` $\rightarrow$ `rm_items(id)` | `CHK(consumed_quantity >= 0)` | Production consumptions |
| `material_returns` | `id` (UUID) | `sc_id` $\rightarrow$ `sales_order_components(id)`, `returned_by_id`, `confirmed_by_id` | `IDX(sc_id)`, `IDX(status)` | Return transactions |
| `material_return_items` | `id` (UUID) | `material_return_id` $\rightarrow$ `material_returns(id)`, `rm_item_id` $\rightarrow$ `rm_items(id)` | `CHK(quantity_returned > 0)` | Return line items |
| `additional_material_requests` | `id` (UUID) | `sc_id` $\rightarrow$ `sales_order_components(id)`, `requested_by_id` $\rightarrow$ `users(id)` | `IDX(sc_id)`, `IDX(status)` | Shortage requests |
| `additional_material_request_items` | `id` (UUID) | `request_id` $\rightarrow$ `additional_material_requests(id)` | `CHK(quantity_requested > 0)` | Shortage items |
| `uploaded_files` | `id` (UUID) | `created_by_id`, `removed_by_id` $\rightarrow$ `users(id)` | `UQ(storage_key)`, `IDX(storage_key)` | Storage metadata |
| `attachments` | `id` (UUID) | `file_id` $\rightarrow$ `uploaded_files(id)`, `created_by_id` $\rightarrow$ `users(id)` | `UQ(file_id, context, record_id) WHERE is_active=true` | Polymorphic links |
| `email_jobs` | `id` (UUID) | `recipient_user_id` $\rightarrow$ `users(id)` | `UQ(idempotency_key)`, `IDX(status, next_retry_at)` | Email queue |
| `email_logs` | `id` (UUID) | `job_id` $\rightarrow$ `email_jobs(id)`, `recipient_user_id` $\rightarrow$ `users(id)` | `IDX(job_id)`, `IDX(created_at)` | Email audit history |
| `system_settings` | `id` (UUID) | None | `UQ(key)` | Global config toggles |
| `user_notification_preferences` | `id` (UUID) | `user_id` $\rightarrow$ `users(id)` | `UQ(user_id)` | User notification toggles |
| `notifications` | `id` (UUID) | `user_id` $\rightarrow$ `users(id)` | `UQ(idempotency_key) WHERE NOT NULL`, `IDX(user_id)` | In-app alerts |
| `audit_logs` | `id` (UUID) | `actor_id` $\rightarrow$ `users(id)` | `IDX(entity_name, entity_id)`, `IDX(created_at)` | Immutable audit logs |

---

# SECTION 8 — INVENTORY ARCHITECTURE

```text
Product (Catalog definition)
   ↓
StockBalance (Source of truth: composite key [productId, binId], current_quantity >= 0)
   ↓
StockTransaction (Immutable ledger of all stock-in, issue, return, transfer, adjustment)
```

* **Stock Conservation & Non-Negativity**: Enforced at the database level with `CHK(current_quantity >= 0)`. Any operation attempting to deduct more stock than currently available in the specified bin triggers a PostgreSQL check constraint violation and aborts the entire transaction.
* **Pessimistic Concurrency Control**: All warehouse inventory mutations use `QueryRunner` with `SELECT ... FOR UPDATE` on the affected `StockBalance` rows.
* **Separation of WIP from Warehouse Stock**:
  * **Stores Material Issue**: Deducts warehouse `StockBalance` and writes a `StockTransaction` (type: `STORES_ISSUE`). Material enters SC Work-in-Progress (WIP).
  * **Production Receipt**: Acknowledges physical receipt into production WIP. Does **NOT** mutate warehouse stock.
  * **Production Consumption**: Acknowledges transformation of material into finished component. Does **NOT** mutate warehouse stock.
  * **Production Return**: Initiated by production as `PENDING_STORE_ACK`. Warehouse stock is unchanged until Stores confirms receipt and assigns a destination bin, which atomically increments `StockBalance` and records `RETURN_TO_STORE` in `StockTransaction`.

---

# SECTION 9 — COMPLETE BACKEND ARCHITECTURE

### Module Dependency Diagram

```text
               ┌────────────────┐
               │   AuthModule   │
               └───────┬────────┘
                       │ (Guards & JWT Context)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                     AppModule                            │
│ ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐ │
│ │  UsersModule  │ │  RolesModule  │ │ MasterDataModule │ │
│ └───────┬───────┘ └───────────────┘ └────────┬─────────┘ │
│         │                                    │           │
│         ▼                                    ▼           │
│ ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐ │
│ │   PoModule    │ │  FilesModule  │ │ InventoryModule  │ │
│ └───────┬───────┘ └───────┬───────┘ └────────┬─────────┘ │
│         │                 │                  │           │
│         ▼                 ▼                  ▼           │
│ ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐ │
│ │   ScModule    │ │AttachmentsMod │ │MaterialIssueMod  │ │
│ └───────┬───────┘ └───────────────┘ └────────┬─────────┘ │
│         │                                    │           │
│         ▼                                    ▼           │
│ ┌───────────────┐                   ┌──────────────────┐ │
│ │   RmModule    │                   │ ProductionModule │ │
│ └───────────────┘                   └────────┬─────────┘ │
│                                              │           │
│                                              ▼           │
│ ┌───────────────────┐               ┌──────────────────┐ │
│ │NotificationsModule│◄──────────────┤AdditionalReqMod  │ │
│ └─────────┬─────────┘ (Event hooks) └──────────────────┘ │
│           │                                              │
│           ▼                                              │
│ ┌───────────────────┐                                    │
│ │    EmailModule    │ (PostgreSQL Queue & Worker)        │
│ └───────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

---

# SECTION 10 — COMPLETE API INVENTORY

### Authentication & Users
1. `POST /api/auth/login` — Public. Validates credentials, returns JWT accessToken and user object.
2. `GET /api/auth/roles` — Public. Returns system role list.
3. `POST /api/auth/dev-token` — Dev/Test only (blocked in `NODE_ENV=production`). Generates token for specified role.
4. `GET /api/auth/me` — JWT Auth. Returns authenticated user profile.
5. `POST /api/users` — JWT Auth, Role: `ADMIN`. Creates user with hashed password.
6. `GET /api/users` — JWT Auth. Lists users.
7. `GET /api/users/:id` — JWT Auth. Retrieves user by ID.
8. `PUT /api/users/:id` — JWT Auth, Role: `ADMIN`. Updates user fields.
9. `PATCH /api/users/:id/activate` — JWT Auth, Role: `ADMIN`. Activates user account.
10. `PATCH /api/users/:id/deactivate` — JWT Auth, Role: `ADMIN`. Deactivates user account.

### Purchase Orders & Customers
11. `POST /api/customers` — JWT Auth, Roles: `ADMIN`, `STORES`. Creates customer master record.
12. `GET /api/customers` — JWT Auth, Roles: All. Lists all customers.
13. `GET /api/customers/:id` — JWT Auth, Roles: All. Retrieves customer by ID.
14. `PATCH /api/customers/:id` — JWT Auth, Roles: `ADMIN`, `STORES`. Updates customer.
15. `POST /api/po` — JWT Auth, Roles: `ADMIN`, `STORES`. Creates purchase order header.
16. `GET /api/po` — JWT Auth, Roles: All. Lists purchase orders.
17. `GET /api/po/:id` — JWT Auth, Roles: All. Retrieves PO by ID.
18. `PATCH /api/po/:id` — JWT Auth, Roles: `ADMIN`, `STORES`. Updates PO header.
19. `POST /api/po/:id/documents` — JWT Auth, Roles: `ADMIN`, `STORES`. Attaches supporting document to PO.
20. `GET /api/po/:id/documents` — JWT Auth, Roles: All. Lists PO supporting documents.
21. `GET /api/po/:id/documents/:attachmentId/download` — JWT Auth, Roles: All. Returns signed download URL for PO doc.
22. `DELETE /api/po/:id/documents/:attachmentId` — JWT Auth, Roles: `ADMIN`, `STORES`. Soft-detaches PO document.

### Sales Order Components (SCs)
23. `POST /api/sc` — JWT Auth, Roles: `ADMIN`, `DESIGNER`, `STORES`. Creates SC under PO.
24. `GET /api/sc` — JWT Auth, Roles: All. Lists SCs with query filters (`poId`, `scNumber`, `status`, `search`).
25. `GET /api/sc/:id` — JWT Auth, Roles: All. Retrieves SC with PO, RM, and audit associations.
26. `POST /api/sc/:id/complete` — JWT Auth, Roles: `PRODUCTION`, `ADMIN`. Marks SC production complete.
27. `POST /api/sc/:id/close` — JWT Auth, Roles: `STORES`, `PRODUCTION`, `ADMIN`. Closes SC independently.
28. `POST /api/sc/:id/documents` — JWT Auth, Roles: `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`. Attaches document to SC.
29. `GET /api/sc/:id/documents` — JWT Auth, Roles: All. Lists SC supporting documents.
30. `GET /api/sc/:id/documents/:attachmentId/download` — JWT Auth, Roles: All. Returns signed download URL.
31. `DELETE /api/sc/:id/documents/:attachmentId` — JWT Auth, Roles: `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`. Detaches SC document.

### Raw Material (RM) Requirements
32. `POST /api/rm` — JWT Auth, Roles: `DESIGNER`, `ADMIN`. Creates RM request header for SC.
33. `POST /api/rm/:id/items` — JWT Auth, Roles: `DESIGNER`, `ADMIN`. Adds dimensional RM line item.
34. `POST /api/rm/:id/submit` — JWT Auth, Roles: `DESIGNER`, `ADMIN`. Submits RM request to Stores; triggers notification/email.
35. `POST /api/rm/:id/review` — JWT Auth, Roles: `STORES`, `ADMIN`. Stores reviews and maps RM items to master inventory products.
36. `GET /api/rm` — JWT Auth, Roles: All. Lists RM requests.
37. `GET /api/rm/:id` — JWT Auth, Roles: All. Retrieves RM request with items and snapshots.
38. `POST /api/rm/:id/documents` — JWT Auth, Roles: `DESIGNER`, `ADMIN`. Attaches engineering drawing/spec to RM request.
39. `GET /api/rm/:id/documents` — JWT Auth, Roles: All. Lists RM documents.
40. `GET /api/rm/:id/documents/:attachmentId/download` — JWT Auth, Roles: All. Returns signed download URL for RM document.
41. `DELETE /api/rm/:id/documents/:attachmentId` — JWT Auth, Roles: `DESIGNER`, `ADMIN`. Detaches RM document.

### Stores & Material Issue
42. `POST /api/material-issues` — JWT Auth, Roles: `STORES`, `ADMIN`. Atomically issues material from specific bin; decrements `StockBalance`, logs `StockTransaction`, updates SC status to `ISSUED`.
43. `GET /api/material-issues` — JWT Auth, Roles: All. Lists material issue records.
44. `GET /api/material-issues/:id` — JWT Auth, Roles: All. Retrieves issue details.

### Production Execution & Accounting
45. `POST /api/production/receipt` — JWT Auth, Roles: `PRODUCTION`, `ADMIN`. Production confirms receipt of issued material; updates SC status to `IN_PRODUCTION`.
46. `POST /api/production/consume` — JWT Auth, Roles: `PRODUCTION`, `ADMIN`. Records material consumption against SC.
47. `POST /api/production/return` — JWT Auth, Roles: `PRODUCTION`, `ADMIN`. Records physical material return as `PENDING_STORE_ACK`.
48. `POST /api/production/return/:id/verify` — JWT Auth, Roles: `STORES`, `ADMIN`. Stores verifies return, selects destination bin; atomically increments `StockBalance` and records `RETURN_TO_STORE` in `StockTransaction`.
49. `GET /api/production/accounting/:scId` — JWT Auth, Roles: All. Computes authoritative server-side material accounting matrix:
    $$\text{Unaccounted} = \text{Received} - \text{Consumed} - \text{Returned}$$

### Additional Material Requests (Shortages)
50. `POST /api/additional-requests` — JWT Auth, Roles: `PRODUCTION`, `DESIGNER`, `ADMIN`. Requests additional raw material with reason code.
51. `GET /api/additional-requests` — JWT Auth, Roles: All. Lists additional material requests.
52. `GET /api/additional-requests/:id` — JWT Auth, Roles: All. Retrieves additional request details.

### Master Data (Storage & Products)
53. `GET /api/categories`, `POST /api/categories`, `GET /api/categories/:id`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` — Product Category CRUD.
54. `GET /api/families`, `POST /api/families`, `GET /api/families/:id`, `PATCH /api/families/:id`, `DELETE /api/families/:id` — Product Family CRUD.
55. `GET /api/products`, `POST /api/products`, `GET /api/products/:id`, `PATCH /api/products/:id` — Product Master CRUD.
56. `GET /api/warehouses`, `POST /api/warehouses`, `GET /api/warehouses/:id`, `PATCH /api/warehouses/:id`, `DELETE /api/warehouses/:id` — Warehouse CRUD.
57. `GET /api/locations`, `POST /api/locations`, `GET /api/locations/:id`, `PATCH /api/locations/:id`, `DELETE /api/locations/:id` — Warehouse Location CRUD.
58. `GET /api/racks`, `POST /api/racks`, `GET /api/racks/:id`, `PATCH /api/racks/:id`, `DELETE /api/racks/:id` — Storage Rack CRUD.
59. `GET /api/bins`, `POST /api/bins`, `GET /api/bins/:id`, `PATCH /api/bins/:id`, `DELETE /api/bins/:id` — Storage Bin CRUD.

### Inventory Stock & Transactions
60. `GET /api/inventory` — JWT Auth, Roles: All. Lists inventory items with current balances.
61. `GET /api/inventory/reconciliation` — JWT Auth, Roles: All. Global reconciliation between ledger and balance.
62. `GET /api/inventory/reconciliation/workflow` — JWT Auth, Roles: All. Cross-module workflow stock reconciliation.
63. `GET /api/inventory/:id` — JWT Auth. Retrieves inventory item.
64. `GET /api/inventory/:id/stock` — JWT Auth. Retrieves specific stock balance.
65. `GET /api/inventory/:id/transactions` — JWT Auth. Retrieves paginated ledger transactions.
66. `POST /api/inventory/:id/stock-in` — JWT Auth, Roles: `STORES`, `ADMIN`. Performs stock-in.
67. `POST /api/inventory/:id/stock-out` — JWT Auth, Roles: `STORES`, `ADMIN`. Performs stock-out.
68. `POST /api/inventory/:id/adjustment` — JWT Auth, Roles: `STORES`, `ADMIN`. Performs audited inventory adjustment.

### Files & Attachments
69. `POST /api/files` — JWT Auth, Multipart. Uploads file to Supabase Storage (5MB limit, MIME type whitelist).
70. `GET /api/files/:id` — JWT Auth. Returns file metadata (with IDOR context verification).
71. `GET /api/files/:id/download` — JWT Auth. Returns signed download URL (valid 60s).
72. `DELETE /api/files/:id` — JWT Auth. Soft-deletes file.
73. `POST /api/attachments` — JWT Auth. Polymorphic attachment creation.
74. `GET /api/attachments` — JWT Auth. Lists attachments by `context` and `recordId`.
75. `DELETE /api/attachments/:id` — JWT Auth. Detaches attachment.

### Notifications & Email Observability
76. `GET /api/notifications` — JWT Auth. Retrieves paginated user in-app notifications.
77. `GET /api/notifications/unread-count` — JWT Auth. Returns user's unread notification count.
78. `PATCH /api/notifications/:id/read` — JWT Auth. Marks specific notification as read.
79. `PATCH /api/notifications/read-all` — JWT Auth. Marks all user notifications as read.
80. `GET /api/notifications/settings` — JWT Auth, Role: `ADMIN`. Retrieves global email workflow toggle.
81. `PATCH /api/notifications/settings` — JWT Auth, Role: `ADMIN`. Updates global email workflow toggle.
82. `GET /api/notifications/preferences/me` — JWT Auth. Returns user's personal email notification preference.
83. `PATCH /api/notifications/preferences/me` — JWT Auth. Updates user's personal email notification preference.
84. `GET /api/email/observability` & `GET /api/email/queue/observability` — JWT Auth, Role: `ADMIN`. Returns real-time metrics of PostgreSQL email queue (pending, processing, retrying, sent, failed, last success, last error).
85. `GET /api/health` — Public. Service health check endpoint.

---

# SECTION 11 — FRONTEND ARCHITECTURE

```text
App.tsx
 ├── AppProviders (AuthContext, tokens, localStorage sync)
 └── AppRouter (State-based view router)
      ├── LoginPage (Public auth form with dev-login shortcut)
      ├── AppLayout (Common top bar, Role badge, NotificationBell, Navigation tabs)
      │    ├── DashboardPage (System health, recent activities, quick metrics)
      │    ├── WorkflowPage (Core manufacturing workspace: SC -> RM -> Issue -> Receipt -> Consumption -> Closure)
      │    │    ├── RmDocumentsSection (Drawings upload & view)
      │    │    ├── PoDocumentsSection (Commercial specs upload & view)
      │    │    └── ScDocumentsSection (Production test certs upload & view)
      │    ├── MasterDataPage (Categories, Families, Products, Warehouses, Locations, Racks, Bins management)
      │    ├── InventoryPage (Real-time stock balance, stock-in/out, adjustment, transaction history modal)
      │    ├── NotificationSettingsPage (Global admin email toggle & personal user email preferences)
      │    └── EmailObservabilityPage (Admin email queue metrics, retry monitors, dead-letter status)
```

---

# SECTION 12 — COMPLETE API ↔ FRONTEND MAPPING

| Frontend Screen | Action / User Gesture | Frontend Service Function | HTTP | API Endpoint | Backend Controller | Database / System Effect |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LoginPage` | Click "Sign In" | `AuthService.login()` | `POST` | `/api/auth/login` | `AuthController.login` | Verifies bcrypt hash, returns JWT |
| `LoginPage` | Click "Dev Login" | `AuthService.getDevToken()` | `POST` | `/api/auth/dev-token` | `AuthController.getDevToken` | Issues dev JWT for role (dev only) |
| `WorkflowPage` | Click "+ Create SC" | `workflowService.createSc()` | `POST` | `/api/sc` | `ScController.createSc` | Inserts `sales_order_components` row |
| `WorkflowPage` | Click "Create RM Request" | `workflowService.createRm()` | `POST` | `/api/rm` | `RmController.createRm` | Inserts `rm_requests` header |
| `WorkflowPage` | Click "+ Add Material Item" | `workflowService.addRmItem()` | `POST` | `/api/rm/:id/items` | `RmController.addRmItem` | Inserts `rm_items` row |
| `WorkflowPage` | Click "Submit RM to Stores" | `workflowService.submitRm()` | `POST` | `/api/rm/:id/submit` | `RmController.submitRm` | Updates RM status $\rightarrow$ `SUBMITTED`, triggers Stores alert |
| `WorkflowPage` | Click "Issue from Bin" | `workflowService.createIssue()` | `POST` | `/api/material-issues` | `MaterialIssueController.createIssue` | Decrements `StockBalance`, writes `StockTransaction` |
| `WorkflowPage` | Click "Receive Issued Material" | `workflowService.receiveMaterial()` | `POST` | `/api/production/receipt` | `ProductionController.receiveMaterial` | Inserts `material_receipts`, SC $\rightarrow$ `IN_PRODUCTION` |
| `WorkflowPage` | Click "Consume" | `workflowService.recordConsumption()` | `POST` | `/api/production/consume` | `ProductionController.recordConsumption` | Inserts `material_consumptions` row |
| `WorkflowPage` | Click "Close SC" | `workflowService.closeSc()` | `POST` | `/api/sc/:id/close` | `ScController.closeSc` | Verifies zero unaccounted scrap; SC $\rightarrow$ `CLOSED` |
| `RmDocumentsSection` | Upload Drawing file | `workflowService.uploadFile()` + `attachRmDocument()` | `POST` | `/api/files` + `/api/rm/:id/documents` | `FilesController` + `RmController` | Stores file in Supabase, creates `attachments` link |
| `NotificationBell` | Click Bell icon | `NotificationService.getNotifications()` | `GET` | `/api/notifications` | `NotificationsController.getMyNotifications` | Loads in-app notification list |
| `NotificationBell` | Click "Mark Read" | `NotificationService.markAsRead()` | `PATCH` | `/api/notifications/:id/read` | `NotificationsController.markAsRead` | Updates `notifications.is_read = true` |
| `NotificationSettingsPage` | Toggle Global Email | `NotificationSettingsService.updateGlobalSettings()` | `PATCH` | `/api/notifications/settings` | `NotificationsController.updateGlobalSettings` | Updates `system_settings.value` |
| `EmailObservabilityPage` | Load / Auto-refresh | `EmailObservabilityService.getObservability()` | `GET` | `/api/email/observability` | `EmailController.getObservability` | Aggregates `email_jobs` queue status |

---

# SECTION 13 — AUTHENTICATION & RBAC

### Role Matrix

| Endpoint / Domain Area | ADMIN | DESIGNER | STORES | PRODUCTION | SENIOR_MANAGER | GENERAL_MANAGER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **User Management** (`/api/users`) | **Full** | None | None | None | None | None |
| **Customer Master** (`/api/customers`) | **Full** | Read | **Full** | Read | Read | Read |
| **Purchase Orders** (`/api/po`) | **Full** | Read | **Full** | Read | Read | Read |
| **SC Creation** (`POST /api/sc`) | **Yes** | **Yes** | **Yes** | Read | Read | Read |
| **SC Completion** (`/api/sc/:id/complete`) | **Yes** | None | None | **Yes** | Read | Read |
| **SC Closure** (`/api/sc/:id/close`) | **Yes** | None | **Yes** | **Yes** | Read | Read |
| **RM Request Authoring** (`/api/rm`) | **Yes** | **Yes** | Read | Read | Read | Read |
| **Stores RM Review** (`/api/rm/:id/review`)| **Yes** | None | **Yes** | None | Read | Read |
| **Material Issuance** (`/api/material-issues`)| **Yes** | None | **Yes** | None | Read | Read |
| **Production Receipt** (`/api/production/receipt`)| **Yes** | None | None | **Yes** | Read | Read |
| **Consumption & Return** (`/api/production/*`)| **Yes** | None | None | **Yes** | Read | Read |
| **Return Verification** (`.../verify`)| **Yes** | None | **Yes** | None | Read | Read |
| **Additional RM Request** (`/api/additional-requests`)| **Yes** | **Yes** | Read | **Yes** | Read | Read |
| **Stock-In / Stock-Out / Adjust** | **Yes** | None | **Yes** | None | Read | Read |
| **Master Data CRUD** (`/api/bins`, etc.)| **Yes** | Read | **Yes** | Read | Read | Read |
| **Global Notification Settings** | **Yes** | None | None | None | None | None |
| **Email Queue Observability** | **Yes** | None | None | None | None | None |

---

# SECTION 14 — COMPLETE BUSINESS WORKFLOW

```text
1. PO Creation / Reference Context (External ERP PO number entered or created by Admin/Stores)
   ↓
2. SC Creation (Designer / Stores / Admin creates SC e.g., SC-101 under PO-9001)
   ↓
3. RM Request Creation & Item Specification (Designer specifies grade, dimensions, required qty)
   ↓
4. RM Submission (Designer submits RM form -> SC advances to STORES_PENDING; alert dispatched)
   ↓
5. Stores Verification & Product Mapping (Stores reviews RM items and maps to inventory products)
   ↓
6. Stores Material Issue (Stores issues exact bin stock -> StockBalance decrements; SC -> ISSUED)
   ↓
7. Production Receipt (Shop floor confirms physical receipt -> SC advances to IN_PRODUCTION)
   ↓
8. Production Consumption & Returns (Operators log consumed quantities and return excess material)
   ↓
9. Return Verification Handshake (Stores confirms returned physical material -> StockBalance increments)
   ↓
10. Additional Material Request (If shortage/defect occurs -> Production requests extra RM with reason code)
   ↓
11. Material Reconciliation (Backend validates Unaccounted Scrap = Received - Consumed - Returned)
   ↓
12. SC Completion (Production marks SC completed once physical parts are manufactured)
   ↓
13. Independent SC Closure (Stores / Production closes SC; siblings under same PO remain active)
```

---

# SECTION 15 — STATE MACHINES

### 1. Sales Order Component (SC) Status Machine
* **States**: `DRAFT` $\rightarrow$ `STORES_PENDING` $\rightarrow$ `ISSUED` $\rightarrow$ `IN_PRODUCTION` $\rightarrow$ `COMPLETED` $\rightarrow$ `CLOSED`
* **Invariants**:
  * Cannot advance to `ISSUED` without a valid `MaterialIssue`.
  * Cannot advance to `IN_PRODUCTION` without `ProductionReceipt`.
  * Cannot advance to `CLOSED` if unaccounted scrap/shortage remains unverified.

### 2. Raw Material Request Status Machine
* **States**: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `REVIEWED`
* **Invariants**: Original submitted items are immutable once submitted; revisions create `RmItemSnapshot` entries.

### 3. Material Return Status Machine
* **States**: `PENDING_STORE_ACK` $\rightarrow$ `ACKNOWLEDGED`
* **Invariants**: Stock balance does **NOT** increment when return is logged; increments only when Stores verifies and selects the destination bin.

### 4. Email Job Status Machine
* **States**: `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `SENT` (or `RETRYING` $\rightarrow$ `FAILED`)
* **Invariants**: Claimed by worker via `FOR UPDATE SKIP LOCKED`; retried with exponential backoff up to `max_attempts`.

---

# SECTION 16 — TRANSACTIONAL SAFETY

* **Atomic Execution**: All multi-table mutations (such as Stores Issuance, Return Verification, and Stock Adjustments) are wrapped in TypeORM `QueryRunner` database transactions.
* **Pessimistic Locking**: `StockBalance` rows are locked with `pessimistic_write` (`FOR UPDATE`) during quantity changes to eliminate race conditions.
* **Post-Commit Side Effects**: In-app notifications and email queue job insertions occur inside or immediately following transaction commit to avoid orphaned jobs if transactions roll back.

---

# SECTION 17 — NOTIFICATION SYSTEM

* **Architecture**: Event-driven notification generation in `NotificationsService`.
* **Database Isolation**: Stored in `notifications` table (`user_id`, `title`, `message`, `type`, `is_read`, `idempotency_key`).
* **Idempotency Protection**: Unique index `UQ_notifications_idempotency_key` ensures identical workflow events do not duplicate alerts for the same recipient.
* **User Preferences**: Users can toggle workflow alerts in `user_notification_preferences`.

---

# SECTION 18 — EMAIL SYSTEM

* **Architecture**: Transactional PostgreSQL Queue + Background Worker + Google Cloud OAuth2 Gmail API.
* **Worker Execution**: `EmailWorkerService` periodically polls `email_jobs` using `FOR UPDATE SKIP LOCKED`.
* **Idempotency**: `UQ_email_jobs_idempotency_key` prevents duplicate queueing of identical events.
* **Retry Strategy**: Exponential backoff with jitter up to `max_attempts` (default: 3). Failed jobs transition to `FAILED` with sanitized error messages in `email_logs`.
* **Observability**: Real-time aggregated metrics via `GET /api/email/observability`.

---

# SECTION 19 — FILE STORAGE

* **Provider**: Supabase Storage (`@supabase/supabase-js`).
* **Security & Whitelist**: MIME validation enforces PDF, JPEG, PNG, XLS, XLSX; rejects executable extensions (`.exe`, `.sh`, `.bat`, etc.).
* **Polymorphic Attachments**: `attachments` table links files to `context` (`PO`, `SC`, `RM_REQUEST`, `PRODUCTION`) with record ID validation.
* **Signed URLs**: Temporary signed download URLs generated with 60-second expiration. Direct bucket public access is blocked.

---

# SECTION 20 — AUDIT & TRACEABILITY

* **Audit Table**: `audit_logs` records every critical domain event with:
  * `entity_name` & `entity_id`
  * `action_type`
  * `actor_id`
  * `old_values` (JSONB) & `new_values` (JSONB)
  * `metadata` (JSONB)
  * `created_at` timestamp
* **Heat/Batch Traceability**: `material_issue_items` stores `heat_number` and `batch_number` for full metallurgical traceability.

---

# SECTION 21 — SERVER / DEPLOYMENT ARCHITECTURE

* **Local Environment**:
  * Backend: NestJS dev server on `http://localhost:3000`
  * Frontend: Vite dev server on `http://localhost:5173`
  * Database: Neon PostgreSQL or local PostgreSQL on port 5432
* **Cloud Hosting (Render)**:
  * Backend Service: Node.js Web Service running `npm --prefix backend run start:prod` (build: `npm --prefix backend run build`).
  * Frontend Service: Static Site or Web Service running `npm --prefix frontend run build`.
* **Database (Neon)**:
  * PostgreSQL 16 serverless with SSL connection pooling.
* **Object Storage (Supabase)**:
  * S3-compatible bucket `rmrit-attachments`.
* **Email Provider (Google Cloud)**:
  * OAuth2 Client ID, Client Secret, and Refresh Token using Gmail API v1 HTTPS transport.

---

# SECTION 22 — ENVIRONMENT VARIABLES

| Variable | Purpose | Used By | Required | Secret | Example Format |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `NODE_ENV` | Environment mode (`development`/`production`/`test`) | Backend, Frontend | Yes | No | `production` |
| `PORT` | Backend listening port | Backend | Yes | No | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Backend, Migrations | Yes | **YES (REDACTED)** | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret key for signing JWT auth tokens | Backend (`AuthModule`) | Yes | **YES (REDACTED)** | Min 32 random characters |
| `FRONTEND_URL` | CORS origin allowed frontend URL | Backend (`main.ts`) | Yes | No | `https://rmrit.onrender.com` |
| `VITE_BACKEND_URL` | Backend API base URL for client fetch | Frontend (`APP_CONFIG`) | Yes | No | `https://rmrit-api.onrender.com` |
| `SUPABASE_URL` | Supabase project API URL | Backend (`FilesModule`) | Yes | No | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase privileged service role API key | Backend (`FilesModule`) | Yes | **YES (REDACTED)** | JWT token string |
| `SUPABASE_STORAGE_BUCKET` | Supabase Storage bucket name | Backend (`FilesModule`) | Yes | No | `rmrit-attachments` |
| `EMAIL_PROVIDER_TYPE` | Email provider (`gmail` or `test`) | Backend (`EmailModule`)| Yes | No | `gmail` |
| `GMAIL_CLIENT_ID` | Google OAuth2 Client ID | Backend (`GmailApiProvider`)| Yes | **YES (REDACTED)** | `xyz.apps.googleusercontent.com` |
| `GMAIL_CLIENT_SECRET` | Google OAuth2 Client Secret | Backend (`GmailApiProvider`)| Yes | **YES (REDACTED)** | Secret string |
| `GMAIL_REFRESH_TOKEN` | Google OAuth2 Refresh Token | Backend (`GmailApiProvider`)| Yes | **YES (REDACTED)** | Token string |
| `GMAIL_SENDER_EMAIL` | Authenticated Gmail address | Backend (`GmailApiProvider`)| Yes | No | `notifications@yourdomain.com` |

---

# SECTION 23 — TESTING

* **Test Framework**: Vitest (`vitest run` / `vitest.config.e2e.ts`).
* **Test Suites in Repository**: **90 test files in `backend/`** + **3 test files in `frontend/src/tests/`**.
* **Frontend TypeScript Check**: `npm --prefix frontend run test` (`tsc --noEmit`) $\rightarrow$ **PASS (0 errors)**.
* **Frontend Linter**: `npm --prefix frontend run lint` (`oxlint`) $\rightarrow$ **PASS (0 errors, 24 React Compiler / exhaustive-deps warnings)**.
* **Backend Test Suite Status**:
  * Unit tests (QuantityCalculator, StateMachineValidator, AuthService, MasterData specs) $\rightarrow$ **PASS**.
  * Database/E2E integration tests connect to Neon database (`DATABASE_URL`).
  * Known test suite maintenance item: `entities.spec.ts` expects 32 entities from Phase 11, but the repository now has 35 entities in `ALL_ENTITIES` (Phases 14–16 additions).

---

# SECTION 24 — PERFORMANCE

* **Index Coverage**: All foreign keys, search fields (`email`, `sc_number`, `po_number`, `storage_key`, `idempotency_key`), and status columns have dedicated B-Tree indexes.
* **Pagination**: All list endpoints (`/api/sc`, `/api/rm`, `/api/inventory`, `/api/notifications`, master data) support pagination parameters (`page`, `pageSize`, `limit`).
* **Optimized Locking**: Background email worker uses `FOR UPDATE SKIP LOCKED` to allow high concurrency with zero worker contention.

---

# SECTION 25 — SECURITY

| Security Control | Status | Details |
| :--- | :---: | :--- |
| **JWT Authentication** | **PASS** | Validated on all protected endpoints via `JwtAuthGuard` |
| **Role-Based Access Control (RBAC)** | **PASS** | `RolesGuard` and `@Roles(...)` decorator enforced server-side |
| **Password Security** | **PASS** | Salted bcrypt hashing; passwords never returned in responses |
| **IDOR Protection** | **PASS** | Document and notification access verifies user role or ownership |
| **SQL Injection Prevention** | **PASS** | TypeORM parameterized queries & QueryBuilder |
| **File Upload Whitelist** | **PASS** | Strict MIME & extension validator rejects executable payloads |
| **Dev Token Guard** | **PASS** | `/api/auth/dev-token` is blocked when `NODE_ENV=production` |
| **Email Queue Sanitization** | **PASS** | Exception traces sanitized before insertion into audit logs |

---

# SECTION 26 — GIT / DEVELOPMENT HISTORY

* `1700000000000` — Initial database schema baseline (Roles, Users, Customers, PO, SC, RM, Issues, Receipts).
* `1700000000004` — Phase 7 Master data & storage hierarchy (Categories, Families, Products, Warehouses, Locations, Racks, Bins).
* `1700000000010` — Phase 12.4 Stores review & product mapping.
* `1789988213370`–`1790050110866` — Phase 14 File uploads & polymorphic attachment associations with Supabase.
* `1790100000000`–`1790300000000` — Phase 15 PostgreSQL email queue, worker, and audit logging.
* `1790400000000`–`1790600000000` — Phase 15/16 In-app notifications table, user preferences, and notification idempotency keys.
* `e589674` — Automated database seed runner and updated seed scripts.

---

# SECTION 27 — KNOWN ISSUES & LIMITATIONS

| Issue | Source | Current Behavior | Impact | Workaround / Next Step |
| :--- | :--- | :--- | :--- | :--- |
| Master Data API URL Prefix Discrepancy | `frontend/src/services/masterDataService.ts` | Calls `/categories`, `/products`, etc. instead of `/api/categories`, `/api/products` | Master Data UI page may fail to fetch if proxy does not rewrite URL | Align `masterDataService.ts` path strings to `/api/...` |
| `entities.spec.ts` Entity Count Assertion | `backend/src/entities.spec.ts` | Asserts `ALL_ENTITIES.length === 32` | Test fails because 35 entities exist now (Phases 14–16) | Update test assertion to 35 |
| Fast Refresh Export Warnings | `frontend/src/app/providers/index.tsx` | Exports hook alongside provider | Generates oxlint warning | Move `useAuthContext` to separate hook file if refactoring |

---

# SECTION 28 — DOCUMENTATION VS CODE RECONCILIATION

| Topic | Documentation Says | Code Does | Match? | Action |
| :--- | :--- | :--- | :---: | :--- |
| **PO vs SC Separation** | PO is reference; SC closes independently | SC has independent `status` and `closeSc()` method | **YES** | Maintain invariant |
| **Inventory Source of Truth** | `StockBalance` with `current_quantity >= 0` | `StockBalance` + `StockTransaction` ledger | **YES** | Maintain invariant |
| **Return Handshake** | Stores must acknowledge returned material | `MaterialReturn` requires `verifyReturn()` by Stores | **YES** | Maintain invariant |
| **File Storage** | Supabase Cloud Storage with signed URLs | `SupabaseStorageProvider` generating signed URLs | **YES** | Maintain invariant |
| **Email Subsystem** | PostgreSQL Queue + Gmail OAuth2 API | `EmailWorkerService` + `GmailApiProvider` | **YES** | Maintain invariant |
| **In-App Notifications** | User notification table + unread counts | `NotificationsController` with read/unread endpoints | **YES** | Maintain invariant |

---

# SECTION 29 — ACTUAL CURRENT API FLOW EXAMPLES

### Example 1: Stores Material Issuance
```text
Frontend: MaterialIssueForm / WorkflowPage
  ↓ HTTP POST /api/material-issues (Body: { scId, items: [{ rmItemId, binId, quantityIssued: 10 }] })
Backend: JwtAuthGuard & RolesGuard (@Roles(STORES, ADMIN))
  ↓ MaterialIssueController.createIssue()
Service: MaterialIssueService.createIssue()
  ↓ Starts QueryRunner database transaction
  ↓ Locks StockBalance row for (product, binId) with FOR UPDATE
  ↓ Verifies current_quantity >= quantityIssued
  ↓ Decrements StockBalance.current_quantity
  ↓ Inserts StockTransaction (type: STORES_ISSUE, quantity: 10, sourceBinId: binId)
  ↓ Inserts MaterialIssue header & MaterialIssueItem rows
  ↓ Updates SalesOrderComponent status to ISSUED
  ↓ Commits transaction
  ↓ Triggers asynchronous In-App Notification & Email Job to Production
Response: 201 Created (MaterialIssue object)
```

### Example 2: Material Return Verification Handshake
```text
Frontend: Production logs Return -> Status: PENDING_STORE_ACK (Stock is NOT increased)
  ↓ HTTP POST /api/production/return/:id/verify (Body: { destinationBinId, remarks })
Backend: JwtAuthGuard & RolesGuard (@Roles(STORES, ADMIN))
  ↓ ProductionController.verifyReturn()
Service: ProductionService.verifyReturn()
  ↓ Starts QueryRunner database transaction
  ↓ Verifies MaterialReturn is currently in PENDING_STORE_ACK state
  ↓ Locks StockBalance row for (product, destinationBinId) with FOR UPDATE
  ↓ Increments StockBalance.current_quantity
  ↓ Inserts StockTransaction (type: RETURN_TO_STORE, quantity, destinationBinId)
  ↓ Updates MaterialReturn status to ACKNOWLEDGED with confirmed_by_id and confirmed_at
  ↓ Commits transaction
Response: 200 OK (Updated MaterialReturn object)
```

---

# SECTION 30 — BUSINESS INVARIANTS

1. **PO is a reference grouping; SC is the fundamental workflow & closure unit.**
2. **All transactions (issues, receipts, consumptions, returns, shortages) are strictly append-only.**
3. **The original Design RM requirement is immutable once submitted.**
4. **Warehouse stock balance cannot become negative (`CHK(current_quantity >= 0)`).**
5. **Production WIP is strictly separated from warehouse inventory.**
6. **Physical material returns require a two-step handshake (Production logs $\rightarrow$ Stores confirms and assigns Bin).**
7. **Authoritative accounting math is strictly server-side:**
   $$\text{Unaccounted} = \text{Received} - \text{Consumed} - \text{Returned}$$
8. **Email dispatch is asynchronous, idempotent, and non-blocking via PostgreSQL queue.**
9. **File access is authorized polymorphic context verification with temporary signed URLs.**
10. **Role-based access control is enforced on every backend endpoint.**

---

# SECTION 31 — DO NOT CHANGE LIST

# ARCHITECTURAL ELEMENTS THAT MUST NOT BE CHANGED WITHOUT EXPLICIT AUTHORIZATION

1. **Do NOT alter the PO vs SC relationship** (Never make PO completion a prerequisite for closing individual SCs).
2. **Do NOT remove or bypass the `StockBalance` / `StockTransaction` dual-layer inventory model.**
3. **Do NOT remove the two-step Return Verification handshake.**
4. **Do NOT alter the append-only ledger invariant** (Never execute `UPDATE` or `DELETE` on historical issue/receipt/consumption records).
5. **Do NOT replace the PostgreSQL Email Queue / Worker architecture with synchronous HTTP email calls.**
6. **Do NOT remove or bypass server-side `@Roles()` guards.**
7. **Do NOT remove MIME type validation or IDOR checks in `FilesModule`.**
8. **Do NOT commit raw credentials or secrets to version control.**

---

# SECTION 32 — FUTURE DEVELOPMENT BASELINE

* **Current Completed Baseline**: Phase 16.12 Hardened Architecture (Core manufacturing lifecycle, inventory ledger, document attachments, in-app notification center, resilient email subsystem).
* **Safe Areas for Future Enhancement**:
  1. Frontend Master Data service URL alignment (`/api/...` prefix standardization).
  2. Advanced reporting and CSV/Excel export for operations cycle-time analytics.
  3. Barcode / QR-code scanning integration for shop-floor bin & batch selection.
  4. Real-time WebSocket push notifications (augmenting existing REST polling notification center).

---

# SECTION 33 — AI AGENT CONTINUATION GUIDE

### Step-by-Step SOP for the Next AI Coding Agent:
1. **Read `.agent/SKILL.md` and `.agent/OVERVIEW.md` first.**
2. **Inspect current Git status and commit hash before making edits.**
3. **Never guess a business rule**; check `.agent/PO_VS_SC_AND_MATERIAL_LIFECYCLE.md` and `.agent/WORKFLOW_RULES.md`.
4. **Keep changes surgical and modular.**
5. **Always preserve server-side RBAC guards and DTO validations.**
6. **Verify both frontend (`npm --prefix frontend run test`) and backend before finalizing.**

---

# SECTION 34 — SOURCE FILE INDEX

| Domain | Primary File | Responsibility |
| :--- | :--- | :--- |
| **App Entry** | `backend/src/main.ts` | Bootstrap, CORS, global validation pipe |
| **App Module** | `backend/src/app.module.ts` | Root NestJS module importing all 24 sub-modules |
| **Data Source** | `backend/src/config/data-source.ts` | TypeORM DataSource and entity registry |
| **Auth** | `backend/src/auth/auth.service.ts` | JWT issuing and credential validation |
| **SC** | `backend/src/sc/sc.service.ts` | SC lifecycle, completion, independent closure |
| **RM** | `backend/src/rm/rm.service.ts` | RM dimensional definitions, snapshots, stores review |
| **Material Issue** | `backend/src/material-issue/material-issue.service.ts` | Atomic bin-level material issue transactions |
| **Production** | `backend/src/production/production.service.ts` | Receipts, consumptions, returns, and accounting math |
| **Inventory** | `backend/src/inventory/inventory.service.ts` | StockBalance, StockTransaction, reconciliation |
| **Files** | `backend/src/files/files.service.ts` | Supabase storage integration, upload, download URLs |
| **Attachments** | `backend/src/attachments/attachments.service.ts` | Polymorphic attachment association and IDOR checks |
| **Email Queue** | `backend/src/email/email-queue.service.ts` | Asynchronous email job enqueuing |
| **Email Worker** | `backend/src/email/email-worker.service.ts` | Background polling worker with SKIP LOCKED |
| **Gmail Provider** | `backend/src/email/providers/gmail-api.provider.ts` | Google Cloud OAuth2 Gmail API transport |
| **Notifications** | `backend/src/notifications/notifications.service.ts` | In-app alerts, read states, preferences |
| **Frontend App** | `frontend/src/App.tsx` | Root component with providers and router |
| **Frontend Router** | `frontend/src/app/router/index.tsx` | State-based modular view router |
| **Workflow UI** | `frontend/src/pages/WorkflowPage.tsx` | Complete manufacturing lifecycle UI |
| **Master Data UI** | `frontend/src/pages/MasterDataPage.tsx` | Storage hierarchy & product catalog UI |
| **Notification UI** | `frontend/src/components/notifications/index.tsx` | In-app notification bell and dropdown center |
| **Email Queue UI** | `frontend/src/pages/EmailObservabilityPage.tsx` | Admin email queue health dashboard |

---

# SECTION 35 — FINAL EXECUTIVE SUMMARY

```text
RMRIT CURRENT BASELINE SUMMARY

Project: Raw-Material Requirements & Inventory Traceability System (RMRIT)
Commit SHA: e5896744c90c059f018944ac06ef9dfc345fb083
Phase Status: Phases 1–16 Completed (Phase 16.12 Certified)
Backend: NestJS 12, TypeORM 1.1, 29 Controllers, 35 Entities, 24 Feature Modules
Frontend: React 19, Vite 8, Vanilla CSS tokens, Zero external router dependency
Database: PostgreSQL 16 on Neon Serverless (16 Applied Migrations)
Infrastructure: Render (API & Web), Neon (PostgreSQL), Supabase (Object Storage), Google Cloud (Gmail API OAuth2)
Authentication: Passport JWT + BCrypt + RolesGuard RBAC (6 Roles)
Inventory: StockBalance (Current truth) + StockTransaction (Immutable ledger) + Bins/Racks/Locations/Warehouses
Workflow: PO Reference -> SC Active Unit -> RM Request -> Stores Issue -> Production Receipt -> Consumption/Return -> SC Closure
Notifications: In-app alerts + Multi-recipient engine + User preferences + Idempotency keys
Email: PostgreSQL Queue + SKIP LOCKED Worker + Exponential Backoff + Gmail API Provider + Observability UI
Files: Supabase Storage + MIME Whitelist + Polymorphic Attachments + Signed Download URLs
Testing: 90 Vitest backend suites + Frontend TypeScript check (0 errors) + Oxlint (0 errors)
Security: JWT Auth, RBAC, IDOR verification, SQL parameterization, safe error sanitization
```

---

# AUDIT CONFIDENCE

| Domain | Confidence | Reason |
| :--- | :---: | :--- |
| **Database** | **HIGH** | All 35 TypeORM entities and 16 migration scripts forensic verified. |
| **Backend** | **HIGH** | All 29 controllers, service methods, guards, and modules inspected in source code. |
| **API** | **HIGH** | Complete route inventory verified across all backend controllers. |
| **Frontend** | **HIGH** | All React components, layouts, routers, hooks, and services inspected. |
| **Inventory** | **HIGH** | Source code confirms atomic `StockBalance` locking and ledger conservation. |
| **Workflow** | **HIGH** | State machines and multi-step handshakes verified in controllers and services. |
| **Authentication** | **HIGH** | JWT strategies, roles decorator, and bcrypt password hashing verified in code. |
| **Notifications** | **HIGH** | In-app notification models, controller endpoints, and frontend components verified. |
| **Email** | **HIGH** | PostgreSQL queue, worker loop, Gmail API provider, and test suites verified. |
| **Files** | **HIGH** | Supabase storage provider, Multer interceptors, and attachment links verified. |
| **Deployment** | **HIGH** | Neon connection string configuration, Render start commands, and env vars verified. |
| **Testing** | **HIGH** | Ran frontend `tsc` and `oxlint`, verified 90 backend test files in repository. |

---

# TOP 20 THINGS THE NEXT AI AGENT MUST KNOW

1. **RMRIT is an independent project** — never treat it as a branch or continuation of another system.
2. **PO is purely a reference grouping; only individual SCs complete and close.**
3. **Closing an SC never closes sibling SCs under the same PO.**
4. **All transaction records are strictly append-only** — never overwrite or delete historical movements.
5. **The original submitted RM design requirement is immutable**; changes must create revision snapshots.
6. **Warehouse stock cannot go negative** — enforced by database constraint `CHK(current_quantity >= 0)`.
7. **Stores issuance is the only step that deducts warehouse stock**; shop-floor receipt and consumption operate on WIP.
8. **Physical material returns require a two-step handshake** — stock increments only when Stores verifies and selects a destination bin.
9. **All authoritative material calculations are server-side**:
   $$\text{Unaccounted} = \text{Received} - \text{Consumed} - \text{Returned}$$
10. **The database has 35 entities in `ALL_ENTITIES`** (`data-source.ts`).
11. **Backend uses NestJS 12 with ES Modules (`"type": "module"`)** — all local TS imports must use `.js` extension.
12. **Frontend uses React 19 + Vite with zero TailwindCSS** (all styles use custom tokens in `tokens.css`).
13. **Frontend uses state-based view routing** in `app/router/index.tsx` (no `react-router-dom`).
14. **Email sending is asynchronous via a PostgreSQL queue (`email_jobs`)** — never make synchronous SMTP/API calls in request handlers.
15. **The background email worker claims jobs using `FOR UPDATE SKIP LOCKED`** to prevent worker contention.
16. **Both in-app notifications and email jobs use idempotency keys** to guarantee zero duplicate alerts.
17. **File uploads are stored in Supabase Storage** with polymorphic links in the `attachments` table.
18. **Direct download URLs are time-limited signed URLs (60s)** — files are never publicly exposed.
19. **All backend endpoints require `JwtAuthGuard` and `RolesGuard`** unless explicitly designated as public.
20. **Before changing any code, read `.agent/SKILL.md` and the relevant numbered `.agent/docs/` document.**
