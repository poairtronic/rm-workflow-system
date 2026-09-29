# RMRIT — Complete Actual Development Inventory & Requirement Gap Report

> **FORENSIC AUDIT BASELINE**: This report establishes the exact, unvarnished technical reality of what has ACTUALLY been built in the RMRIT repository (`rm-workflow-system`), contrasting **(1) Documentation Claims**, **(2) Actual Executable Code & Database Migrations**, and **(3) True Manufacturing Business Requirements**.

---

## 1. Executive Summary

A comprehensive forensic audit of the `rm-workflow-system` repository was conducted to distinguish actual working software from architectural designs, documentation claims, and remaining business requirements.

### Real Implementation Reality
1. **Core Development Focus So Far**: Real engineering effort has primarily been concentrated on **Database Schema Design & Migrations (16 migration scripts)**, **Backend NestJS Domain APIs (29 controllers, 24 modules, 35 entities)**, **Enterprise Asynchronous Email Subsystem (PostgreSQL Queue + Gmail OAuth2 API)**, and **In-App Notification Center**.
2. **Frontend Reality**: The frontend is a functional single-page React 19 + Vite application providing foundational operational interfaces for SC creation, RM specification, Stores Issuance, Production receipt/consumption, File uploads, and Notification/Email observability. However, many advanced backend query endpoints, granular filter capabilities, and deep traceability screens are **BACKEND ONLY** or lack dedicated UI views.
3. **Major Newly Identified Business Gaps**:
   * **Delivery Challan (DC) Subsystem (Type 1: Production Process Outward & Type 2: General Inventory Outward)**: **NOT DEVELOPED (0% code/schema present)**.
   * **Vendor Management & SLA Tracking**: **NOT DEVELOPED (0% code/schema present)**.
   * **Production Process Master (Sequential Operations 1..N)**: **NOT DEVELOPED (0% code/schema present)**.
   * **General / Non-SC / Non-PO Material Issuance**: **NOT DEVELOPED (Backend strictly requires SC + RM item for issue)**.
   * **Minimum Stock Level (MSL) Automation & Alerting**: **DATABASE FOUNDATION ONLY (`minimum_inventory` column exists on `products` table, but zero alert engine or dashboard exists)**.
   * **Unified SC & PO End-to-End Traceability Reports**: **BACKEND/DATA PRESENT, BUT DEDICATED REPORTING UI MISSING**.

---

## 2. Actual Repository State

* **Application Name**: RMRIT (Raw-Material Requirements & Inventory Traceability System)
* **Repository Name**: `rm-workflow-system`
* **Independence**: **100% INDEPENDENT APPLICATION**. (Not a branch, continuation, or migration of any legacy system).
* **Current Git Branch**: `main`
* **Current Commit SHA**: `e5896744c90c059f018944ac06ef9dfc345fb083`
* **Git Status**: Clean working tree.
* **Workspace Architecture**: npm workspaces (`backend`, `frontend`).
* **Recent Meaningful Git History**:
  * `e589674` — Automated database seed runner and updated seed scripts.
  * `43f4831` — RMRIT complete end-to-end workflow documentation package.
  * `58c94be` — Phase 16.7 email + in-app notification integration.
  * `573d8a0` — Phase 16.5 read/unread notification state and security isolation.
  * `186037b` — Phase 16.3 workflow event generation implementation.
  * `092c6fb` — Phase 16.1 notification model implementation.
  * `c76298b` — Phase 15.21 final email certification.
  * `18f6b8d` — Phase 15.4 PostgreSQL email worker implementation.

---

## 3. Actual Technology Stack

| Layer | Technology | Actual Version in Code | Verified Status |
| :--- | :--- | :--- | :---: |
| **Frontend Framework** | React | `^19.2.8` | Verified in `frontend/package.json` |
| **Frontend Build Tool** | Vite | `^8.2.2` | Verified in `frontend/package.json` |
| **Frontend Router** | Custom State-based View Router | N/A (`useState<CurrentView>`) | Verified in `src/app/router/index.tsx` |
| **Frontend Styling** | Vanilla CSS Tokens | CSS Custom Properties | Verified in `src/styles/tokens.css` (No Tailwind) |
| **Backend Framework** | NestJS Core & Common | `^12.0.1` | Verified in `backend/package.json` |
| **Backend Language** | TypeScript (ES Modules) | `^6.0.2` (`"type": "module"`) | Verified in `backend/package.json` |
| **ORM / Query Builder** | TypeORM | `^1.1.1` | Verified in `backend/package.json` |
| **Database Driver** | `pg` (node-postgres) | `^8.23.0` | Verified in `backend/package.json` |
| **Database Server** | PostgreSQL 16 (Neon Serverless) | Remote Cloud PostgreSQL | Verified via SSL Connection Pool |
| **Authentication** | Passport JWT + BCrypt | `passport-jwt: ^4.0.1`, `bcryptjs: ^3.0.3` | Verified in `src/auth/` |
| **External Object Storage**| Supabase Cloud Storage | `@supabase/supabase-js: ^2.116.0` | Verified in `src/files/storage/` |
| **External Email API** | Google Cloud Gmail API | `googleapis: ^181.0.0` (OAuth2) | Verified in `src/email/providers/` |
| **Backend Testing** | Vitest | `^4.1.2` (90 test files in `backend/`) | Verified in `backend/package.json` |
| **Frontend Testing** | TypeScript Compiler / Oxlint | `tsc --noEmit`, `oxlint: ^1.79.0` | Verified in `frontend/package.json` |

---

## 4. Git Development History

The commit trajectory reveals the actual sequence of development:

1. **Initial Foundation & Master Data (Phases 1–11)**:
   * Database schema initialized with PostgreSQL UUID extension and 32 initial domain entities.
   * Master data storage hierarchy implemented: Category $\rightarrow$ Family $\rightarrow$ Product, and Warehouse $\rightarrow$ Location $\rightarrow$ Rack $\rightarrow$ Bin.
2. **Core Manufacturing Workflow (Phases 12–13)**:
   * Independent SC lifecycle and append-only material movement ledger implemented.
   * Concurrency hardening with pessimistic locking (`FOR UPDATE`) and mathematical conservation checks.
3. **Files & Attachments Subsystem (Phase 14)**:
   * Integration with Supabase Storage bucket (`rmrit-attachments`).
   * Polymorphic attachment associations for PO, SC, RM, and Production documents.
4. **Enterprise Communication & Email Engine (Phase 15)**:
   * Migration from synchronous email designs to a transactional PostgreSQL queue (`email_jobs`).
   * Implementation of `EmailWorkerService` polling with `FOR UPDATE SKIP LOCKED`.
   * Google Cloud OAuth2 Gmail API integration and observability endpoints.
5. **In-App Notification Center (Phase 16)**:
   * In-app `notifications` table, user read/unread isolation, unread count badge, and notification preferences.
6. **Automation & Seeds**:
   * Automated seed runner scripts for instant database bootstrapping.

---

## 5. Complete Module Inventory

| Module Name | Folder Path | Controllers | Services | Entities | Real Implementation Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `AuthModule` | `backend/src/auth` | 1 | 1 | 0 | 🟢 **FULLY DEVELOPED** |
| `UsersModule` | `backend/src/users` | 1 | 1 | 1 | 🟢 **FULLY DEVELOPED** |
| `RolesModule` | `backend/src/roles` | 1 | 1 | 1 | 🟢 **FULLY DEVELOPED** |
| `CustomersModule` | `backend/src/customers` | 1 | 1 | 1 | 🟠 **BACKEND ONLY** (No dedicated customer UI page) |
| `PoModule` | `backend/src/po` | 1 | 1 | 1 | 🟡 **PARTIALLY DEVELOPED** (PO created via SC form in UI) |
| `ScModule` | `backend/src/sc` | 2 | 1 | 1 | 🟢 **FULLY DEVELOPED** |
| `RmModule` | `backend/src/rm` | 1 | 1 | 4 | 🟢 **FULLY DEVELOPED** |
| `StoresModule` | `backend/src/stores` | 1 | 1 | 0 | 🟡 **PARTIALLY DEVELOPED** (Status endpoint only; uses MaterialIssue) |
| `MaterialIssueModule` | `backend/src/material-issue`| 1 | 1 | 2 | 🟢 **FULLY DEVELOPED** (SC-linked issue only) |
| `ProductionModule` | `backend/src/production` | 1 | 1 | 5 | 🟢 **FULLY DEVELOPED** (Receipt, Consume, Return) |
| `AdditionalRequestModule` | `backend/src/additional-request`| 1 | 1 | 2 | 🟠 **BACKEND ONLY** (API exists; UI missing request button) |
| `MaterialMovementModule`| `backend/src/material-movement`| 1 | 1 | 0 | 🟡 **PARTIALLY DEVELOPED** (Status helper only) |
| `MasterDataModule` | `backend/src/master-data` | 7 | 1 | 7 | 🟢 **FULLY DEVELOPED** |
| `InventoryModule` | `backend/src/inventory` | 1 | 2 | 3 | 🟢 **FULLY DEVELOPED** |
| `FilesModule` | `backend/src/files` | 1 | 1 | 1 | 🟢 **FULLY DEVELOPED** |
| `AttachmentsModule` | `backend/src/attachments`| 1 | 1 | 1 | 🟢 **FULLY DEVELOPED** |
| `EmailModule` | `backend/src/email` | 1 | 6 | 2 | 🟢 **FULLY DEVELOPED** |
| `NotificationsModule` | `backend/src/notifications`| 1 | 2 | 3 | 🟢 **FULLY DEVELOPED** |
| `AuditModule` | `backend/src/audit` | 1 | 1 | 1 | 🟠 **BACKEND ONLY** (DB logs written; no frontend viewer) |
| `AnalyticsModule` | `backend/src/analytics` | 1 | 1 | 0 | 🟠 **BACKEND ONLY** (Status endpoint only) |
| `PermissionsModule` | `backend/src/permissions`| 1 | 1 | 0 | 🟡 **PARTIALLY DEVELOPED** (Static permission list) |

---

## 6. Authentication & Users

### Actual Implementation State
* **Login**: `POST /api/auth/login` validates email & salted bcrypt hash. Returns JWT accessToken and user payload.
* **JWT Extraction**: `JwtStrategy` validates `Authorization: Bearer <token>` header, extracts `userId`, `email`, and `roles`.
* **Current User Profile**: `GET /api/auth/me` returns authenticated session context.
* **Dev Login Bypass**: `POST /api/auth/dev-token` generates test token; **strictly blocked when `NODE_ENV=production`**.
* **Account Activation / Deactivation**: `PATCH /api/users/:id/activate` and `PATCH /api/users/:id/deactivate` exist and are restricted to `ADMIN`.
* **Password Reset / Forgot Password**: **🔴 NOT DEVELOPED** (No forgot password or email-based password reset endpoint exists).
* **Frontend Integration**: `LoginPage.tsx` is connected and functional with both standard login and development shortcuts.

---

## 7. Roles & RBAC

### Actual Roles in Database (`Role` Entity)
1. `ADMIN`
2. `DESIGNER`
3. `STORES`
4. `PRODUCTION`
5. `SENIOR_MANAGER`
6. `GENERAL_MANAGER`

### Actual Permission Enforcement
* **Server-Side Enforcement**: Strict. Handled via `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)` metadata.
* **Client-Side Enforcement**: `AppLayout.tsx` switches navigation tabs based on user role.

---

## 8. Customer / Purchase Order (PO)

### Customer Master
* **Backend**: `Customer` entity, `CustomersController`, `CustomersService` with full CRUD (`/api/customers`).
* **Frontend**: **🔴 MISSING UI** (No customer management page in frontend; customer is created programmatically or via seeds).

### Purchase Order (PO)
* **Backend**: `PurchaseOrder` entity, `PoController`, `PoService`, and `CreatePoDocumentDto` for PO attachments.
* **Frontend**: `WorkflowPage.tsx` allows entering a `poNumber` string when creating an SC, but does not provide a dedicated PO Master List or PO Detail screen.
* **PO Status**: PO has a `status` field in DB (`DRAFT`, `OPEN`, etc.), but code adheres to the sacred invariant: **A PO is a grouping reference and does not complete or close.**

---

## 9. Sales Order Component (SC)

### Actual Implementation State
* **Creation**: `POST /api/sc` creates an SC linked to a PO.
* **Independent Closure**: `POST /api/sc/:id/close` closes an SC independently without affecting sibling SCs.
* **Completion**: `POST /api/sc/:id/complete` marks manufacturing completion.
* **Supporting Documents**: `POST /api/sc/:id/documents` attaches production inspection test certs via Supabase Storage.
* **Frontend**: `WorkflowPage.tsx` displays SC list, status badges, and selection.
* **Verdict**: 🟢 **FULLY DEVELOPED & OPERATIONAL**.

---

## 10. Raw Material (RM) Requirements

### Actual Implementation State
* **RM Creation**: `POST /api/rm` creates draft form for SC.
* **Dimensional Line Items**: `POST /api/rm/:id/items` captures material, grade, size, dimensions (`length`, `width`, `thickness`, `diameter`, `weight`).
* **Submission**: `POST /api/rm/:id/submit` advances status to `SUBMITTED`, locks draft, triggers notification and email job.
* **Stores Review & Mapping**: `POST /api/rm/:id/review` allows Stores to review availability and map `rm_item` to `mapped_product_id`.
* **Revision Snapshots**: Edits after submission create immutable records in `rm_item_snapshots`.
* **Verdict**: 🟢 **FULLY DEVELOPED & OPERATIONAL**.

---

## 11. Inventory

### Storage Master Data Hierarchy
* `product_categories` $\rightarrow$ `product_families` $\rightarrow$ `products`
* `warehouses` $\rightarrow$ `warehouse_locations` $\rightarrow$ `racks` $\rightarrow$ `bins`
* Full CRUD controllers exist for all 7 levels (`/api/categories`, `/api/families`, `/api/products`, `/api/warehouses`, `/api/locations`, `/api/racks`, `/api/bins`).

### Stock Balances & Ledger
* **Current Truth**: `stock_balances` (`product_id`, `bin_id`, `current_quantity`). Non-negative check constraint enforced (`CHK(current_quantity >= 0)`).
* **Immutable Ledger**: `stock_transactions` (`product_id`, `source_bin_id`, `destination_bin_id`, `quantity > 0`, `transaction_type`).
* **Atomic Transactions**: Stores issuance uses `SELECT ... FOR UPDATE` and atomic SQL:
  ```sql
  UPDATE stock_balances 
  SET current_quantity = current_quantity - $1, updated_at = NOW() 
  WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1
  ```
* **Stock In / Stock Out / Adjustment**: `POST /api/inventory/:id/stock-in`, `POST /api/inventory/:id/stock-out`, `POST /api/inventory/:id/adjustment` implemented and tested.

---

## 12. General Inventory Issue (Case Analysis)

| Issue Scenario | Business Case | Code Implementation Reality | Status |
| :--- | :--- | :--- | :---: |
| **Case A** | `SC + PO + RM` | `MaterialIssueService.createIssue()` validates SC, RM item, mapped product, and decrements stock | 🟢 **FULLY DEVELOPED** |
| **Case B** | `SC but no RM` | Rejected by code (`rmItem.rmRequest.status !== 'REVIEWED'`) | 🔴 **REJECTED BY DESIGN** |
| **Case C** | `PO but no SC` | Rejected by code (`scId` is mandatory) | 🔴 **REJECTED BY DESIGN** |
| **Case D** | **No SC, No PO (General Issue)** | **NO DEDICATED GENERAL ISSUE WORKFLOW**. Generic `stock-out` exists, but does not capture recipient department, project code, or structured non-SC issue voucher. | 🔴 **REQUIRED BUT NOT IMPLEMENTED** |

---

## 13. Production

### Actual Implementation State
* **Material Receipt**: `POST /api/production/receipt` confirms physical arrival on shop floor; advances SC to `IN_PRODUCTION`.
* **Consumption**: `POST /api/production/consume` records consumed quantity into `material_consumptions`.
* **Return Declaration**: `POST /api/production/return` logs returned material in `material_returns` as `PENDING_STORE_ACK` (does not increment warehouse stock).
* **Stores Verification Handshake**: `POST /api/production/return/:id/verify` is executed by Stores to confirm physical receipt, assign destination bin, atomically increment `StockBalance`, and record `RETURN_TO_STORE` in ledger.
* **Server-Side Accounting**: `GET /api/production/accounting/:scId` computes:
  $$\text{Unaccounted} = \text{Received} - \text{Consumed} - \text{Returned}$$
* **Verdict**: 🟢 **FULLY DEVELOPED & OPERATIONAL**.

---

## 14. Production Process Master (Sequential Operations 1..N)

### Forensic Investigation Findings
* Grep for `process_master`, `production_process`, `operation_sequence`, `process_step` across the entire codebase returned **0 results**.
* **Current Reality**: RMRIT treats Production as a monolithic stage (`IN_PRODUCTION` status) between Material Receipt and SC Completion.
* **Gap**: There is no database entity, API, or UI for multi-stage production routing (e.g., *Cutting $\rightarrow$ CNC Machining $\rightarrow$ Heat Treatment $\rightarrow$ Grinding $\rightarrow$ Surface Coating $\rightarrow$ Inspection*).
* **Verdict**: 🔴 **NOT DEVELOPED / MISSING MODULE**.

---

## 15. Delivery Challan (DC) Subsystem

### Forensic Investigation Findings
* Grep for `challan`, `delivery_challan`, `dc_number`, `gate_pass`, `outsource`, `job_work` returned **0 results**.
* **Required Subsystem Capabilities**:
  * **Type 1: Production Process Outward**: SC $\rightarrow$ Intermediate Process $\rightarrow$ Vendor $\rightarrow$ Delivery Challan $\rightarrow$ Vendor Work $\rightarrow$ Return Receipt.
  * **Type 2: General Inventory Outward**: Warehouse Item $\rightarrow$ Vendor $\rightarrow$ Delivery Challan $\rightarrow$ Return Receipt.
* **Current Code Reality**: Neither schema tables, backend controllers, DTOs, nor frontend screens exist.
* **Verdict**: 🔴 **NOT DEVELOPED / MISSING MODULE**.

---

## 16. Vendor Management & Vendor SLA

### Forensic Investigation Findings
* Grep for `vendor`, `vendor_master`, `subcontractor`, `supplier` returned **0 operational entities** (only `customers` exists).
* **Current Code Reality**: No Vendor table, no vendor category, no contact details, no process capabilities, and no SLA duration calculations exist.
* **Verdict**: 🔴 **NOT DEVELOPED / MISSING MODULE**.

---

## 17. Vendor + DC Analytics & SLA Tracking

| Metric / Question | Actual Code Status | Reason |
| :--- | :---: | :--- |
| How many DCs per vendor? | 🔴 **NOT AVAILABLE** | DC & Vendor entities do not exist |
| Which items/SC on open DCs? | 🔴 **NOT AVAILABLE** | DC entity does not exist |
| Overdue DC detection against SLA? | 🔴 **NOT AVAILABLE** | SLA engine does not exist |
| Vendor turnaround duration? | 🔴 **NOT AVAILABLE** | DC lifecycle timestamps do not exist |

---

## 18. Minimum Stock Level (MSL) & Stock Alerts

### Forensic Audit of MSL
* **Database Level**: `products` table contains `minimum_inventory` and `maximum_inventory` numeric columns with check constraints (`CHK(minimum_inventory >= 0)`).
* **Backend Level**: No background cron job, service, or subscriber checks if `SUM(StockBalance.current_quantity) < product.minimum_inventory`.
* **API Level**: No endpoint exists to query products currently below MSL (`/api/inventory/low-stock` does not exist).
* **Notification / Email Level**: Zero low-stock notification triggers or alert suppression keys exist.
* **Frontend Level**: No low-stock alert banner or MSL widget exists on Dashboard or Inventory pages.
* **Verdict**: 🔵 **DATABASE FOUNDATION ONLY**.

---

## 19. SC & PO Traceability (Final RM Reports)

### Current Traceability Capabilities
* **SC Traceability**:
  * **Backend API**: `GET /api/production/accounting/:scId` returns required, issued, received, consumed, returned, and unaccounted quantities.
  * **Frontend UI**: `WorkflowPage.tsx` renders this matrix under "Material Accounting Matrix".
  * **Missing in UI**: Does not display Heat/Batch numbers, CAD drawings, or revision snapshots in a single printable/exportable "Final RM Sheet".
* **PO Traceability**:
  * **Backend API**: `GET /api/sc?poId=:poId` returns all SCs under a PO.
  * **Frontend UI**: No dedicated "PO Tree View" page showing PO $\rightarrow$ All SCs $\rightarrow$ Material consumption status.
* **Verdict**: 🟡 **PARTIALLY DEVELOPED (Data and endpoints exist; comprehensive report view missing)**.

---

## 20. Notification System

### Actual Implementation State
* **Database**: `notifications` table (`id`, `user_id`, `title`, `message`, `type`, `target_entity`, `target_id`, `is_read`, `idempotency_key`, `created_at`).
* **Preferences**: `system_settings` (`GLOBAL_WORKFLOW_EMAIL_ENABLED`) and `user_notification_preferences` (`workflow_email_enabled`).
* **Endpoints**:
  * `GET /api/notifications` (Paginated user alerts)
  * `GET /api/notifications/unread-count` (Unread badge counter)
  * `PATCH /api/notifications/:id/read` (Mark single read)
  * `PATCH /api/notifications/read-all` (Mark all read)
  * `GET /api/notifications/settings` & `PATCH /api/notifications/settings` (Admin global toggle)
  * `GET /api/notifications/preferences/me` & `PATCH /api/notifications/preferences/me` (Personal toggle)
* **Frontend Component**: `NotificationBell` in `AppLayout.tsx` with dropdown list, unread counter badge, and `NotificationSettingsPage.tsx`.
* **Verified Events in Code**:
  * `RM_SUBMITTED` $\rightarrow$ Alerts Stores Manager
  * `MATERIAL_ISSUED` $\rightarrow$ Alerts Production Team
  * `ADDITIONAL_MATERIAL_REQUESTED` $\rightarrow$ Alerts Stores & Senior Manager
  * `SC_COMPLETED` $\rightarrow$ Alerts Senior & General Managers
* **Verdict**: 🟢 **FULLY DEVELOPED & OPERATIONAL**.

---

## 21. Email System

### Actual Implementation State
* **Architecture**: Transactional PostgreSQL Queue (`email_jobs`) + Asynchronous Worker (`EmailWorkerService`) + Google Cloud OAuth2 Gmail API (`GmailApiProvider`).
* **Concurrency & Safety**: Worker polls using `SELECT ... FOR UPDATE SKIP LOCKED`, preventing multiple server instances from sending duplicate emails.
* **Idempotency**: Unique constraint `UQ_email_jobs_idempotency_key` ensures identical workflow events are never enqueued twice.
* **Retry & Failure**: Exponential backoff with jitter up to 3 attempts. Errors logged to `email_logs` with sanitized messages.
* **Observability Endpoint**: `GET /api/email/observability` returns real-time queue metrics.
* **Frontend UI**: `EmailObservabilityPage.tsx` displays live queue health, retry counts, and dead-letter statistics.
* **Verdict**: 🟢 **FULLY DEVELOPED & OPERATIONAL**.

---

## 22. Files & Attachments

### Actual Implementation State
* **Storage Provider**: Supabase Cloud Storage (`SupabaseStorageProvider`) targeting bucket `rmrit-attachments`.
* **MIME Security**: `AllowedFileTypeValidator` rejects scripts/executables; allows PDF, JPEG, PNG, XLS, XLSX. 5MB file limit.
* **Polymorphic Link**: `attachments` table links uploaded files to `PO`, `SC`, `RM_REQUEST`, or `PRODUCTION`.
* **Signed URLs**: Temporary signed URLs (60s validity) generated on demand via `/api/files/:id/download`.
* **Frontend UI**: `RmDocumentsSection.tsx`, `PoDocumentsSection.tsx`, and `ScDocumentsSection.tsx` integrated in `WorkflowPage.tsx`.
* **Verdict**: 🟢 **FULLY DEVELOPED & OPERATIONAL**.

---

## 23. Complete API Inventory

| HTTP Method | API Endpoint | Controller | Roles Required | Real Status |
| :--- | :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/login` | `AuthController` | Public | 🟢 Functional |
| `GET` | `/api/auth/roles` | `AuthController` | Public | 🟢 Functional |
| `POST` | `/api/auth/dev-token` | `AuthController` | Public (Blocked in prod) | 🟢 Functional |
| `GET` | `/api/auth/me` | `AuthController` | Authenticated | 🟢 Functional |
| `POST` | `/api/users` | `UsersController` | `ADMIN` | 🟢 Functional |
| `GET` | `/api/users` | `UsersController` | Authenticated | 🟢 Functional |
| `GET` | `/api/users/:id` | `UsersController` | Authenticated | 🟢 Functional |
| `PUT` | `/api/users/:id` | `UsersController` | `ADMIN` | 🟢 Functional |
| `PATCH` | `/api/users/:id/activate` | `UsersController` | `ADMIN` | 🟢 Functional |
| `PATCH` | `/api/users/:id/deactivate` | `UsersController` | `ADMIN` | 🟢 Functional |
| `POST` | `/api/customers` | `CustomersController` | `ADMIN`, `STORES` | 🟠 Backend Only |
| `GET` | `/api/customers` | `CustomersController` | All | 🟠 Backend Only |
| `GET` | `/api/customers/:id` | `CustomersController` | All | 🟠 Backend Only |
| `PATCH` | `/api/customers/:id` | `CustomersController` | `ADMIN`, `STORES` | 🟠 Backend Only |
| `POST` | `/api/po` | `PoController` | `ADMIN`, `STORES` | 🟡 Partial UI |
| `GET` | `/api/po` | `PoController` | All | 🟡 Partial UI |
| `GET` | `/api/po/:id` | `PoController` | All | 🟡 Partial UI |
| `PATCH` | `/api/po/:id` | `PoController` | `ADMIN`, `STORES` | 🟠 Backend Only |
| `POST` | `/api/po/:id/documents` | `PoController` | `ADMIN`, `STORES` | 🟢 Functional |
| `GET` | `/api/po/:id/documents` | `PoController` | All | 🟢 Functional |
| `GET` | `/api/po/:id/documents/:attachmentId/download` | `PoController` | All | 🟢 Functional |
| `DELETE`| `/api/po/:id/documents/:attachmentId` | `PoController` | `ADMIN`, `STORES` | 🟢 Functional |
| `POST` | `/api/sc` | `ScController` | `ADMIN`, `DESIGNER`, `STORES` | 🟢 Functional |
| `GET` | `/api/sc` | `ScController` | All | 🟢 Functional |
| `GET` | `/api/sc/:id` | `ScController` | All | 🟢 Functional |
| `POST` | `/api/sc/:id/complete` | `ScController` | `PRODUCTION`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/sc/:id/close` | `ScController` | `STORES`, `PRODUCTION`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/sc/:id/documents` | `ScController` | `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION` | 🟢 Functional |
| `GET` | `/api/sc/:id/documents` | `ScController` | All | 🟢 Functional |
| `GET` | `/api/sc/:id/documents/:attachmentId/download` | `ScController` | All | 🟢 Functional |
| `DELETE`| `/api/sc/:id/documents/:attachmentId` | `ScController` | `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION` | 🟢 Functional |
| `POST` | `/api/rm` | `RmController` | `DESIGNER`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/rm/:id/items` | `RmController` | `DESIGNER`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/rm/:id/submit` | `RmController` | `DESIGNER`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/rm/:id/review` | `RmController` | `STORES`, `ADMIN` | 🟢 Functional |
| `GET` | `/api/rm` | `RmController` | All | 🟢 Functional |
| `GET` | `/api/rm/:id` | `RmController` | All | 🟢 Functional |
| `POST` | `/api/rm/:id/documents` | `RmController` | `DESIGNER`, `ADMIN` | 🟢 Functional |
| `GET` | `/api/rm/:id/documents` | `RmController` | All | 🟢 Functional |
| `GET` | `/api/rm/:id/documents/:attachmentId/download` | `RmController` | All | 🟢 Functional |
| `DELETE`| `/api/rm/:id/documents/:attachmentId` | `RmController` | `DESIGNER`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/material-issues` | `MaterialIssueController`| `STORES`, `ADMIN` | 🟢 Functional |
| `GET` | `/api/material-issues` | `MaterialIssueController`| All | 🟢 Functional |
| `GET` | `/api/material-issues/:id` | `MaterialIssueController`| All | 🟢 Functional |
| `POST` | `/api/production/receipt` | `ProductionController` | `PRODUCTION`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/production/consume` | `ProductionController` | `PRODUCTION`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/production/return` | `ProductionController` | `PRODUCTION`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/production/return/:id/verify`| `ProductionController`| `STORES`, `ADMIN` | 🟢 Functional |
| `GET` | `/api/production/accounting/:scId` | `ProductionController`| All | 🟢 Functional |
| `POST` | `/api/additional-requests` | `AdditionalRequestController`| `PRODUCTION`, `DESIGNER`, `ADMIN` | 🟠 Backend Only |
| `GET` | `/api/additional-requests` | `AdditionalRequestController`| All | 🟠 Backend Only |
| `GET` | `/api/additional-requests/:id` | `AdditionalRequestController`| All | 🟠 Backend Only |
| `GET` | `/api/inventory` | `InventoryController` | All | 🟢 Functional |
| `GET` | `/api/inventory/reconciliation` | `InventoryController` | All | 🟢 Functional |
| `GET` | `/api/inventory/reconciliation/workflow` | `InventoryController` | All | 🟢 Functional |
| `GET` | `/api/inventory/:id` | `InventoryController` | All | 🟢 Functional |
| `GET` | `/api/inventory/:id/stock` | `InventoryController` | All | 🟢 Functional |
| `GET` | `/api/inventory/:id/transactions`| `InventoryController` | All | 🟢 Functional |
| `POST` | `/api/inventory/:id/stock-in` | `InventoryController` | `STORES`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/inventory/:id/stock-out` | `InventoryController` | `STORES`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/inventory/:id/adjustment` | `InventoryController` | `STORES`, `ADMIN` | 🟢 Functional |
| `POST` | `/api/files` | `FilesController` | Authenticated | 🟢 Functional |
| `GET` | `/api/files/:id` | `FilesController` | Authenticated | 🟢 Functional |
| `GET` | `/api/files/:id/download` | `FilesController` | Authenticated | 🟢 Functional |
| `DELETE`| `/api/files/:id` | `FilesController` | Authenticated | 🟢 Functional |
| `GET` | `/api/notifications` | `NotificationsController`| Authenticated | 🟢 Functional |
| `GET` | `/api/notifications/unread-count`| `NotificationsController`| Authenticated | 🟢 Functional |
| `PATCH` | `/api/notifications/:id/read` | `NotificationsController`| Authenticated | 🟢 Functional |
| `PATCH` | `/api/notifications/read-all` | `NotificationsController`| Authenticated | 🟢 Functional |
| `GET` | `/api/notifications/settings` | `NotificationsController`| `ADMIN` | 🟢 Functional |
| `PATCH` | `/api/notifications/settings` | `NotificationsController`| `ADMIN` | 🟢 Functional |
| `GET` | `/api/notifications/preferences/me`| `NotificationsController`| Authenticated | 🟢 Functional |
| `PATCH` | `/api/notifications/preferences/me`| `NotificationsController`| Authenticated | 🟢 Functional |
| `GET` | `/api/email/observability` | `EmailController` | `ADMIN` | 🟢 Functional |
| `GET` | `/api/categories`, `families`, `products`, `warehouses`, `locations`, `racks`, `bins` | Master Data Controllers | All | 🟢 Functional |

---

## 24. Backend ↔ Frontend Mapping

| Screen / Feature | Backend API | Frontend Component | Connected? | User Usability |
| :--- | :--- | :--- | :---: | :---: |
| **Authentication** | `POST /api/auth/login` | `LoginPage.tsx` | **YES** | Ready |
| **SC Creation & List** | `POST /api/sc`, `GET /api/sc` | `WorkflowPage.tsx` | **YES** | Ready |
| **RM Form & Items** | `POST /api/rm`, `POST /api/rm/:id/items` | `WorkflowPage.tsx` | **YES** | Ready |
| **RM Submission** | `POST /api/rm/:id/submit` | `WorkflowPage.tsx` | **YES** | Ready |
| **Stores Issue** | `POST /api/material-issues` | `WorkflowPage.tsx` | **YES** | Ready |
| **Production Receipt**| `POST /api/production/receipt` | `WorkflowPage.tsx` | **YES** | Ready |
| **Consumption** | `POST /api/production/consume` | `WorkflowPage.tsx` | **YES** | Ready |
| **SC Closure** | `POST /api/sc/:id/close` | `WorkflowPage.tsx` | **YES** | Ready |
| **Document Uploads** | `POST /api/files`, `POST /api/rm/:id/documents`| `RmDocumentsSection.tsx` | **YES** | Ready |
| **In-App Alerts** | `GET /api/notifications` | `NotificationBell.tsx` | **YES** | Ready |
| **Notification Toggles**| `PATCH /api/notifications/preferences/me` | `NotificationSettingsPage.tsx` | **YES** | Ready |
| **Email Queue Monitor**| `GET /api/email/observability` | `EmailObservabilityPage.tsx` | **YES** | Ready |
| **Master Data CRUD** | `/api/categories`, `/api/products`, etc. | `MasterDataPage.tsx` | ⚠️ Discrepancy* | Needs `/api` prefix fix |
| **Additional RM Request**| `POST /api/additional-requests` | None in `WorkflowPage.tsx` | **NO** | Backend Only |
| **Customer Master** | `POST /api/customers` | None | **NO** | Backend Only |
| **Audit Log Viewer** | `GET /api/audit/status` | None | **NO** | Backend Only |

*\*Note: `frontend/src/services/masterDataService.ts` calls `/categories` instead of `/api/categories`.*

---

## 25. Database Forensic Audit

* **Total Entities Registered in `ALL_ENTITIES`**: **35 Entities**.
* **Legacy Entity Status**: `inventory_items` is safely retained for backward compatibility, while active storage utilizes `products`, `stock_balances`, and `stock_transactions`.
* **Referential Constraints**: Zero orphan FKs; critical master data references (Category, Family, Product, Bin, User) enforce `ON DELETE RESTRICT` to protect audit trails.
* **Integrity Constraints**: Non-negativity (`current_quantity >= 0`), positive transactions (`quantity > 0`), and composite unique indexes (`product_id, bin_id`) enforced in PostgreSQL.

---

## 26. Database Migrations Forensic Audit

```text
Migration History (16 Files):
1. 1700000000000-InitialSchema.ts (Baseline: Users, Roles, Customers, PO, SC, RM, Issues, Receipts)
2. 1700000000001-Phase9Inventory.ts (Initial inventory tables)
3. 1700000000002-AddAdjustmentDirection.ts (Inventory adjustment support)
4. 1700000000003-AddOpeningBalance.ts (Opening balance support)
5. 1700000000004-Phase7MasterDataAndStorageHierarchy.ts (7-level storage hierarchy DDL)
6. 1700000000010-Phase12_4_StoresReview.ts (Stores product mapping & review fields)
7. 1789988213370-Phase14_1_FileUploadFoundation.ts (uploaded_files table)
8. 1789989683429-Phase14_2_AttachmentAssociation.ts (attachments table)
9. 1789989683430-Phase14_3_RmDocuments.ts (RM document association index)
10. 1790050110866-AddRemovedAtToFiles.ts (Soft delete timestamps on uploaded_files)
11. 1790100000000-Phase15_2_EmailJobModel.ts (email_jobs queue table)
12. 1790200000000-Phase15_3_AddPriorityToEmailJobs.ts (Priority queue column)
13. 1790300000000-Phase15_7_EmailAuditLogging.ts (email_logs audit history table)
14. 1790400000000-Phase15_9_NotificationPreferences.ts (system_settings & user preferences)
15. 1790500000000-Phase15_11_InAppNotificationsTable.ts (in-app notifications table)
16. 1790600000000-Phase16_9_NotificationIdempotencyKey.ts (Unique idempotency index on notifications)
```

---

## 27. Master Requirement Gap Matrix

| ID | Requirement Area | Currently Developed? | Backend | Frontend | Database | Notifications | Email | Gap Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **REQ-01** | Core PO $\rightarrow$ SC $\rightarrow$ RM Lifecycle | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | Yes | Operational end-to-end. |
| **REQ-02** | Stores Material Issuance (SC-Linked) | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | Yes | Bin-level atomic stock decrement. |
| **REQ-03** | Production Receipt, Consumption, Return | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | Yes | Mathematical accounting verified. |
| **REQ-04** | Return Verification Handshake | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | Yes | Two-step return to bin. |
| **REQ-05** | Independent SC Closure | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | Yes | Closes without affecting sibling SCs. |
| **REQ-06** | File Attachments (Supabase Storage) | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | N/A | N/A | Signed URLs & polymorphic links. |
| **REQ-07** | In-App Notification Center | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | N/A | Bell dropdown, unread count badge. |
| **REQ-08** | Asynchronous Email Queue & Worker | 🟢 **FULLY DEVELOPED** | Yes | Yes | Yes | Yes | Yes | PostgreSQL queue + Gmail API. |
| **REQ-09** | Additional RM Requests (Shortages) | 🟠 **BACKEND ONLY** | Yes | No | Yes | Yes | Yes | API exists; missing request UI. |
| **REQ-10** | Master Data Hierarchy Management | 🟢 **FULLY DEVELOPED** | Yes | Yes* | Yes | N/A | N/A | *Needs frontend URL prefix fix. |
| **REQ-11** | Customer Master Management | 🟠 **BACKEND ONLY** | Yes | No | Yes | N/A | N/A | Full CRUD API exists; no UI page. |
| **REQ-12** | General / Non-SC Material Issue | 🔴 **NOT DEVELOPED** | No | No | No | No | No | Code requires SC + RM item. |
| **REQ-13** | Minimum Stock Level (MSL) Alerts | 🔵 **FOUNDATION ONLY** | No | No | Yes | No | No | Column exists; alert engine missing. |
| **REQ-14** | Production Process Master (1..N Steps) | 🔴 **NOT DEVELOPED** | No | No | No | No | No | Zero process routing entities exist. |
| **REQ-15** | Delivery Challan (Type 1: Process Outward)| 🔴 **NOT DEVELOPED** | No | No | No | No | No | Zero DC entities or APIs exist. |
| **REQ-16** | Delivery Challan (Type 2: Inventory Outward)| 🔴 **NOT DEVELOPED** | No | No | No | No | No | Zero DC entities or APIs exist. |
| **REQ-17** | Vendor Management & Vendor Master | 🔴 **NOT DEVELOPED** | No | No | No | No | No | Zero vendor entities exist. |
| **REQ-18** | Vendor Turnaround & DC SLA Tracking | 🔴 **NOT DEVELOPED** | No | No | No | No | No | Zero SLA calculation logic exists. |
| **REQ-19** | Printable SC Final RM Sheet | 🟡 **PARTIALLY DEVELOPED**| Yes | Partial| Yes | N/A | N/A | Accounting matrix exists; no PDF/sheet. |
| **REQ-20** | PO Tree Traceability View | 🟡 **PARTIALLY DEVELOPED**| Yes | No | Yes | N/A | N/A | APIs exist; no hierarchical view UI. |

---

## 28. Three Levels of Requirements

### Level A — Already Developed & Functional
* JWT Authentication & Role-Based Access Control (6 roles).
* Sales Order Component (SC) creation, listing, and independent closure.
* Raw Material Requirement specification, dimensions, and submission.
* Stores stock review and RM item product mapping.
* Atomic Stores Material Issue from specific warehouse bins.
* Production receipt, consumption, and return declaration.
* Two-step Return Verification handshake with destination bin selection.
* Supabase Storage file uploads and polymorphic attachment association.
* In-app notification center with read/unread tracking and preferences.
* PostgreSQL asynchronous email queue with `SKIP LOCKED` worker and Gmail API.

### Level B — Developed in Backend but Incomplete in Frontend / Automation
* Additional Material Request UI in `WorkflowPage.tsx`.
* Customer Master UI management page.
* Audit Log visualization dashboard.
* Master Data service URL prefix alignment (`/api/categories`, etc.).
* MSL low-stock evaluation engine & automated notification trigger.
* Comprehensive printable SC Final RM Sheet and PO Tree view.

### Level C — Required but Completely Undeveloped (New Modules)
* **Vendor Master Module** (Code, Name, Category, Process capability, Contact).
* **Production Process Master** (Process sequence 1..N, Operations, routing).
* **Delivery Challan Subsystem** (Type 1: Process Outward, Type 2: Inventory Outward, Challan numbers, Expected return dates, Return receipts, PDF generation).
* **Vendor SLA & Turnaround Duration Engine**.
* **General / Non-SC / Non-PO Material Issuance Voucher**.

---

## 29. Recommended Development Order for Next AI Agent

```text
┌────────────────────────────────────────────────────────────┐
│ Phase 17: General Issue & MSL Automation                   │
│  - General / Non-SC Material Issue voucher                 │
│  - MSL low-stock detection engine + notification triggers  │
│  - Master Data UI URL prefix alignment                     │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Phase 18: Vendor Master & Production Process Master        │
│  - Vendor entity, migration, CRUD API, and frontend UI     │
│  - Production Process sequence (Process 1..N) master data   │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Phase 19: Delivery Challan (DC) Subsystem & SLA Tracking   │
│  - DC Type 1 (Process outward) & Type 2 (Inventory outward)│
│  - DC creation, return receipt, status, and PDF printout   │
│  - Vendor SLA duration calculation & overdue alerts        │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Phase 20: Comprehensive Traceability & Reporting           │
│  - Printable SC Final RM Sheet (Heat/Batch, CAD, Consumed) │
│  - Complete PO Tree Traceability View                      │
│  - Vendor & DC performance analytics dashboard             │
└────────────────────────────────────────────────────────────┘
```

---

## 30. What Must NOT Be Rebuilt

1. **Do NOT rebuild the PostgreSQL Email Queue / Worker architecture** (`EmailModule`, `EmailWorkerService`, `GmailApiProvider`). It is hardened with exponential backoff and `SKIP LOCKED`.
2. **Do NOT rebuild the In-App Notification Center** (`NotificationsModule`, `NotificationBell`). It already supports read/unread tracking and idempotency.
3. **Do NOT rebuild the dual-layer Inventory Architecture** (`StockBalance` + `StockTransaction`).
4. **Do NOT alter the PO vs SC relationship** (PO remains a reference grouping; SCs close independently).
5. **Do NOT rebuild Supabase Storage file upload foundation** (`FilesModule`, `AttachmentsModule`).
6. **Do NOT alter the two-step Return Verification handshake**.

---

## 31. Final Classification

```text
RMRIT CURRENT DEVELOPMENT POSITION

FULLY DEVELOPED:
- JWT Authentication & RBAC Guards
- SC Independent Lifecycle & Closure
- RM Requirement Dimensional Authoring & Revision Snapshots
- Stores Review & Product Mapping
- Atomic Bin-Level Stores Material Issuance
- Production Receipt, Consumption, and Return Handshake
- Server-Side Material Accounting Math
- Supabase Object Storage & Polymorphic Attachments
- In-App Notification Center with Read/Unread State
- PostgreSQL Asynchronous Email Queue & Worker (Gmail API)
- 7-Level Master Data Hierarchy (Category -> Bin)

PARTIALLY DEVELOPED:
- Purchase Order Management (Backend full; Frontend limited to SC creation form)
- Additional Material Requests (Backend full; Frontend missing action button)
- SC & PO Traceability (Accounting API exists; Printable/Hierarchical UI missing)
- Master Data Frontend (Endpoints functional; needs /api prefix alignment)

BACKEND ONLY:
- Customer Master Management API
- Audit Log Recording & Querying
- Operations Analytics Status API

DATABASE FOUNDATION ONLY:
- Minimum & Maximum Stock Levels (Columns minimum_inventory and maximum_inventory exist)

DOCUMENTATION ONLY:
- Theoretical automated warehouse ERP integrations
- Machine telemetry pipelines

NOT DEVELOPED:
- Delivery Challan (DC) Subsystem (Type 1 Process Outward & Type 2 Inventory Outward)
- Vendor Management Master & Categories
- Vendor Turnaround SLA Calculation & Overdue Engine
- Production Process Master (Multi-stage operations 1..N)
- General / Non-SC / Non-PO Material Issuance Voucher
- Printable SC Final RM Report & PO Hierarchical Tree

NOT VERIFIED:
- Direct hardware thermal barcode/label printers (No hardware telemetry in repo)
```

```text
RMRIT ACTUAL DEVELOPMENT FOCUS SO FAR

Migrations: 95%
Backend APIs: 90%
Email Subsystem: 95%
Notification Subsystem: 95%
Inventory Core: 85%
RM & SC Workflow: 90%
Production Core: 85%
Frontend Core UI: 60%
MSL Automation: 15% (Schema only)
General Issue: 0%
Delivery Challan (DC): 0%
Vendor Management: 0%
Production Process Master: 0%
SLA Tracking: 0%
Advanced Reporting / Print Sheets: 20%
```

---

## 32. What the Next Development Agent Must Know

1. **What already works**: The entire backend manufacturing lifecycle (SC $\rightarrow$ RM $\rightarrow$ Stores Issue $\rightarrow$ Production Receipt $\rightarrow$ Consumption $\rightarrow$ Return Verification $\rightarrow$ Independent SC Closure), the PostgreSQL email queue/worker, in-app notifications, and Supabase file uploads are fully implemented, functional, and backed by 16 database migrations.
2. **What must not be touched**: Do not rewrite TypeORM entities or modify working migration files. Do not alter the PO/SC independent relationship. Do not replace the asynchronous PostgreSQL email queue with direct HTTP calls.
3. **What is missing and must be built next**:
   * **General Material Issue**: Build a dedicated issuance flow for Stores when there is no SC/PO reference.
   * **MSL Engine**: Implement low-stock calculation against `minimum_inventory` and trigger notification/email alerts.
   * **Vendor Master & Production Process Master**: Create schemas, migrations, NestJS modules, and frontend CRUD views.
   * **Delivery Challan (DC)**: Create DC module supporting Type 1 (Process Outward) and Type 2 (Inventory Outward), vendor return tracking, SLA calculation, and PDF challan generation.
   * **Printable Traceability Reports**: Build a consolidated "Final RM Sheet" for SCs and a "Hierarchical Tree View" for POs.
