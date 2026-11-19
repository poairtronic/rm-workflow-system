# RM Application (V-SMART) Technical & Functional Audit Report
## PART 5: Quality, Reliability, Readiness, Technical Debt & Complete Appendices

> **Document Context:** Part 5 of 5 of the comprehensive technical audit of the Raw Material (RM) Workflow & Traceability Application (**V-SMART / RMRIT**).  
> **Master Index:** [`docs/audit/RM_VSMART_FULL_REPORT.md`](file:///docs/audit/RM_VSMART_FULL_REPORT.md)  
> **Repository:** `c:/Users/Admin/OneDrive/Desktop/rm-workflow-system`  
> **Audit Date:** November 2026  
> **Mode:** Read-Only Static and Architectural Codebase Audit  

---

## 14. Logging, Audit Trail, Error Handling, Monitoring & Export Engines

### 14.1 Application Logging & HTTP Request Tracing
- **Logging Engine:** NestJS built-in `Logger` service ([`backend/src/common/middleware/request-logger.middleware.ts`](file:///backend/src/common/middleware/request-logger.middleware.ts)).
- **HTTP Request Tracing:** Global middleware `RequestLoggerMiddleware` intercepts all incoming HTTP requests. It logs method, URL path, client IP address, user agent, response status code, and latency in milliseconds.
- **Production Sanitization:** Request bodies containing sensitive keys (`password`, `token`, `refreshToken`, `clientSecret`) are stripped or masked prior to log output.

### 14.2 Audit Trail & Governance Ledger
- **Audit Service:** `AuditService` ([`backend/src/audit/audit.service.ts`](file:///backend/src/audit/audit.service.ts)) writing to the immutable ledger table `audit_logs` ([`backend/src/audit/entities/audit-log.entity.ts`](file:///backend/src/audit/entities/audit-log.entity.ts)).
- **Logged Events:**
  - User authentication (`LOGIN`, `LOGOUT`, `PASSWORD_RESET`)
  - RM requisition creation and approval
  - Stores issuance of raw materials and extra materials
  - Delivery Challan dispatch, return receipt, and QC outcome
  - Consumable indent submission, SM approval, and purchase receipt
  - User permission and role modifications
- **Ledger Schema:** `audit_logs` records `id`, `user_id`, `action`, `entity_name`, `entity_id`, `old_values` (JSONB), `new_values` (JSONB), `ip_address`, `user_agent`, and timestamp.

### 14.3 Error Handling & Exception Filtering
- **Global Exception Filter:** `HttpExceptionFilter` ([`backend/src/common/filters/http-exception.filter.ts`](file:///backend/src/common/filters/http-exception.filter.ts)).
- **Behavior:**
  - Normalizes all errors into a standard JSON contract: `{ statusCode, timestamp, path, message, error }`.
  - Database exceptions (PostgreSQL errors like unique violation `23505` or foreign key violation `23503`) are caught and translated into client-safe HTTP 400/409 responses, concealing internal SQL queries and connection parameters.
  - Production mode hides stack traces; non-production environments retain detailed debug traces.

### 14.4 Health Probes & Monitoring
- **Health Endpoints:** `GET /health` and `GET /api/health` powered by `@nestjs/terminus` ([`backend/src/health/health.controller.ts`](file:///backend/src/health/health.controller.ts)). Checks TypeORM database connectivity and memory usage.
- **Automated Keepalive Action:** `.github/workflows/render-keepalive.yml` executes a curl probe every 10 minutes between 06:00 and 22:00 IST (Monday - Saturday) to maintain Render compute instances active during operational shifts.
- **Email Observability:** Integrated `EmailObservabilityService` tracks hourly and daily dispatch volumes, quota thresholds, and delivery failures.

### 14.5 Document & Spreadsheet Export Engines
- **Excel Spreadsheet Generator:** `ExcelReportService` ([`backend/src/reports/excel/excel-report.service.ts`](file:///backend/src/reports/excel/excel-report.service.ts)) using `exceljs` (v4.4.0). Generates multi-tab workbooks for:
  - Stock Balances & Bin Inventory
  - Material Issue Slips & Consumption History
  - Delivery Challan Aging & Vendor Turnaround Analysis
  - Consumable Indent Fulfillment Ledger
- **PDF Document Generator:** `PdfGeneratorService` ([`backend/src/reports/pdf/pdf-generator.service.ts`](file:///backend/src/reports/pdf/pdf-generator.service.ts)) using `pdfmake` (v0.2.20). Generates strictly formatted A4 printable documents for:
  - Delivery Challan Triplicate Slips (`SDC/YY-YY/XXXX`)
  - Stores Raw Material Issue Slips (`ISS-...`)
  - Consumable Purchase Requisition Slips (`PR-XXXX`) with digital signature vector blocks.

---

## 15. Testing Frameworks, Suites & Execution Protocols

### 15.1 Backend Testing Suite
- **Test Runner & Engine:** **Vitest** (`v3.2.4`) with `@vitest/coverage-v8`, replacing legacy Jest for sub-second test execution.
- **Integration & E2E:** `supertest` (`v7.0.0`) and `@nestjs/testing`.
- **Spec File Inventory:** **174 test suites** across all 36 backend modules.
- **Coverage Focus:**
  - State machine transitions (`state-machine-validator.spec.ts`)
  - Dimension and cut-size weight calculators (`quantity-calculator.spec.ts`)
  - DC product-lock advisory transaction locks (`delivery-challan.service.spec.ts`)
  - Email quota pacing and Google OAuth refresh cycles (`email-worker.service.spec.ts`)
- **Execution Commands:**
  ```bash
  # Run all unit and integration tests
  npm --prefix backend run test
  
  # Run tests in watch mode during development
  npm --prefix backend run test:watch
  
  # Generate code coverage report
  npm --prefix backend run test:cov
  
  # Execute end-to-end API test suite
  npm --prefix backend run test:e2e
  ```

### 15.2 Frontend Testing Suite
- **Browser & E2E Engine:** **Playwright** (`@playwright/test` v1.58.2).
- **Spec File Inventory:** **7 test suites** covering primary user journeys (Authentication, RM Creation, Stores Issue, DC Dispatch).
- **Execution Commands:**
  ```bash
  # Run Playwright end-to-end tests
  npm --prefix frontend run test
  ```

---

## 16. Integration Readiness & Two-Way Sync Assessment

### 16.1 Target External Systems
1. **ECR (Error Correction Report Application):** Rework and rejection workflow synchronization.
2. **MERC (MERC Customer ERP System):** Customer purchase order and indent synchronization.

### 16.2 Exposed Tables & Endpoints for Two-Way Sync
| External System | Inbound Endpoint (They Call RM) | Outbound Webhook (RM Calls Them) | Core Tables Involved | Data Payload Content |
| :--- | :--- | :--- | :--- | :--- |
| **ECR** | `POST /api/internal/ecr-pending` | `POST ${ECR_API_URL}/api/internal/material-issued` | `ecr_material_pending`, `sales_order_components`, `stock_balances` | Report number, component name, quantity affected, root cause, issued material slip ID. |
| **MERC** | `POST /api/internal/merc/indent` | `POST ${MERC_API_URL}/api/internal/rm/item-issued` | `merc_indent_pending`, `merc_indent_line_items`, `products` | Customer PO number, item dimensions (e.g. DIA 45 X 120), required quantity, stores issue confirmation. |

### 16.3 Identification Mapping Gaps & Idempotency Concerns
1. **Primary Key Mismatch:**
   - RM uses internal UUIDv4 strings for all entity IDs.
   - ECR uses alphanumeric report numbers (`ECR-YYYY-XXXX`).
   - MERC uses external integer IDs and PO strings (`PO-XXXX`).
   - *Mitigation:* RM maintains dedicated external reference columns (`report_number`, `merc_item_id`) with unique composite indexing.
2. **Dimension String Parsing Ambiguity:**
   - MERC transmits free-form dimension text (e.g. `"DIA 50 x 200 MM - EN8D"`).
   - RM product catalog uses structured numerical fields (`outer_diameter`, `cut_length`, `grade`).
   - *Risk:* Automated string parsing can fail if external ERP users alter text conventions. A fallback manual mapping queue is required.
3. **Idempotency & Replay Protection:**
   - Currently, inbound webhooks check for existing records by external reference ID. However, if network timeouts cause retries during concurrent requests, race conditions could arise.
   - *Recommendation:* Enforce unique database constraints on `report_number` and add dedicated idempotency key headers (`x-idempotency-key`).

---

## 17. Technical Debt, Architectural Risks & Prioritized Defect Registry

| Severity | Issue Description | Root Cause & Impact | File Reference | Recommended Remediation |
| :---: | :--- | :--- | :--- | :--- |
| **HIGH** | **Gmail Free-Tier Daily Quota Cap (400/day)** | System relies on personal Gmail account. Cap of 400 emails/day can be exhausted during high production activity, delaying critical MSL and DC alerts. | [`backend/src/email/email-worker.service.ts#L32`](file:///backend/src/email/email-worker.service.ts#L32) | Migrate to dedicated enterprise transactional provider (SendGrid, AWS SES, or Google Workspace Relay). |
| **HIGH** | **Render & Neon Serverless Cold Starts** | On free/hobby tiers, Neon PostgreSQL suspends compute after 5 min of inactivity; Render web service idles after 15 min. Initial morning requests encounter 40-60s latency. | [`.github/workflows/render-keepalive.yml`](file:///.github/workflows/render-keepalive.yml) | Upgrade to provisioned Render Starter / Neon Launch instance with continuous compute. |
| **HIGH** | **Insecure Secret Fallback in Guards** | `InternalSecretGuard` accepts default hardcoded fallback string if environment variables are not injected in runtime. | [`backend/src/common/guards/internal-secret.guard.ts#L17`](file:///backend/src/common/guards/internal-secret.guard.ts#L17) | Reject request immediately with 500 configuration error if `RM_INTERNAL_SECRET` is unset. |
| **MEDIUM** | **SMS Alerts Enabled Stub** | Column `sms_alerts_enabled` exists in `vendor_slas` and UI toggle exists, but no backend SMS service or vendor gateway is implemented. | [`backend/src/vendor/entities/vendor-sla.entity.ts#L71`](file:///backend/src/vendor/entities/vendor-sla.entity.ts#L71) | Implement SMS gateway (Twilio / MSG91) or hide the toggle from UI to eliminate user confusion. |
| **MEDIUM** | **Password Reset Lacks CAPTCHA** | Public `POST /api/auth/forgot-password` endpoint allows unauthenticated requests without bot protection, risking email spamming. | [`backend/src/auth/auth.controller.ts#L78`](file:///backend/src/auth/auth.controller.ts#L78) | Integrate Cloudflare Turnstile or strict IP-level rate limiting on password reset endpoint. |
| **MEDIUM** | **Concurrent Refresh Token Race Condition** | When frontend makes parallel requests with an expiring token, multiple refresh requests trigger reuse detection, invalidating user session. | [`backend/src/auth/auth.service.ts#L180`](file:///backend/src/auth/auth.service.ts#L180) | Introduce 30-second grace window for rotated refresh tokens before invalidating family. |
| **LOW** | **Hardcoded Company Attribution in PDF Generator** | PDF generator contains hardcoded headers, logos, and signature blocks for V-SMART / Amritha. | [`backend/src/reports/pdf/pdf-generator.service.ts#L80`](file:///backend/src/reports/pdf/pdf-generator.service.ts#L80) | Externalize company branding, logos, and signatures into dynamic database configuration. |

---

## 18. Appendices

### 18.1 Complete Database Table Registry (All 67 Tables)

| # | Database Table Name | Primary Entity Class | Module / Subsystem | Column Count |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `additional_material_request_items` | `AdditionalMaterialRequestItem` | `additional-request` | 2 |
| 2 | `additional_material_requests` | `AdditionalMaterialRequest` | `additional-request` | 3 |
| 3 | `email_alert_watch` | `EmailAlertWatch` | `alert-sweeps` | 0 |
| 4 | `attachments` | `Attachment` | `attachments` | 1 |
| 5 | `audit_logs` | `AuditLog` | `audit` | 4 |
| 6 | `password_reset_tokens` | `PasswordResetToken` | `auth` | 0 |
| 7 | `refresh_tokens` | `RefreshToken` | `auth` | 2 |
| 8 | `consumable_request_items` | `ConsumableRequestItem` | `consumables` | 25 |
| 9 | `consumable_requests` | `ConsumableRequest` | `consumables` | 6 |
| 10 | `customers` | `Customer` | `customers` | 3 |
| 11 | `dc_movements` | `DcMovement` | `delivery-challan` | 12 |
| 12 | `dc_qc_inspections` | `DcQcInspection` | `delivery-challan` | 11 |
| 13 | `dc_rework_items` | `DcReworkItem` | `delivery-challan` | 21 |
| 14 | `delivery_challan_items` | `DeliveryChallanItem` | `delivery-challan` | 27 |
| 15 | `delivery_challans` | `DeliveryChallan` | `delivery-challan` | 22 |
| 16 | `ecr_material_pending` | `EcrMaterialPending` | `ecr-issues` | 4 |
| 17 | `alert_notification_state` | `AlertNotificationState` | `email` | 0 |
| 18 | `digest_shadow_log` | `DigestShadowLog` | `email` | 0 |
| 19 | `email_jobs` | `EmailJob` | `email` | 9 |
| 20 | `email_logs` | `EmailLog` | `email` | 6 |
| 21 | `uploaded_files` | `UploadedFile` | `files` | 2 |
| 22 | `general_issue_items` | `GeneralIssueItem` | `general-issue` | 2 |
| 23 | `general_issues` | `GeneralIssue` | `general-issue` | 7 |
| 24 | `bins` | `Bin` | `inventory` | 0 |
| 25 | `inventory_items` | `InventoryItem` | `inventory` | 0 |
| 26 | `msl_alerts` | `MslAlert` | `inventory` | 1 |
| 27 | `product_categories` | `ProductCategory` | `inventory` | 0 |
| 28 | `product_families` | `ProductFamily` | `inventory` | 0 |
| 29 | `products` | `Product` | `inventory` | 4 |
| 30 | `racks` | `Rack` | `inventory` | 0 |
| 31 | `stock_balances` | `StockBalance` | `inventory` | 5 |
| 32 | `stock_transactions` | `StockTransaction` | `inventory` | 10 |
| 33 | `warehouse_locations` | `WarehouseLocation` | `inventory` | 0 |
| 34 | `warehouses` | `Warehouse` | `inventory` | 0 |
| 35 | `material_issue_items` | `MaterialIssueItem` | `material-issue` | 5 |
| 36 | `material_issues` | `MaterialIssue` | `material-issue` | 2 |
| 37 | `merc_indent_line_items` | `MercIndentLineItem` | `merc-indent` | 13 |
| 38 | `merc_indent_pending` | `MercIndentPending` | `merc-indent` | 3 |
| 39 | `email_setting_audit` | `EmailSettingAudit` | `notifications` | 1 |
| 40 | `email_skip_log` | `EmailSkipLog` | `notifications` | 10 |
| 41 | `notification_events` | `NotificationEvent` | `notifications` | 0 |
| 42 | `notifications` | `Notification` | `notifications` | 3 |
| 43 | `role_email_settings` | `RoleEmailSetting` | `notifications` | 1 |
| 44 | `system_settings` | `SystemSetting` | `notifications` | 1 |
| 45 | `user_email_overrides` | `UserEmailOverride` | `notifications` | 1 |
| 46 | `user_notification_preferences` | `UserNotificationPreference` | `notifications` | 0 |
| 47 | `role_module_permissions` | `RoleModulePermission` | `permissions` | 0 |
| 48 | `system_modules` | `SystemModule` | `permissions` | 1 |
| 49 | `user_module_permissions` | `UserModulePermission` | `permissions` | 0 |
| 50 | `purchase_orders` | `PurchaseOrder` | `po` | 4 |
| 51 | `material_consumptions` | `MaterialConsumption` | `production` | 1 |
| 52 | `material_receipt_items` | `MaterialReceiptItem` | `production` | 1 |
| 53 | `material_return_items` | `MaterialReturnItem` | `production` | 1 |
| 54 | `material_returns` | `MaterialReturn` | `production` | 3 |
| 55 | `material_receipts` | `MaterialReceipt` | `production` | 2 |
| 56 | `production_processes` | `ProductionProcess` | `production-process` | 12 |
| 57 | `rm_form_scs` | `RmFormSc` | `rm` | 0 |
| 58 | `rm_item_snapshots` | `RmItemSnapshot` | `rm` | 6 |
| 59 | `rm_items` | `RmItem` | `rm` | 19 |
| 60 | `rm_requests` | `RmRequest` | `rm` | 7 |
| 61 | `roles` | `Role` | `roles` | 1 |
| 62 | `sales_order_components` | `SalesOrderComponent` | `sc` | 5 |
| 63 | `users` | `User` | `users` | 1 |
| 64 | `vendor_process_capabilities` | `VendorProcessCapability` | `vendor` | 8 |
| 65 | `vendor_sla_overrides` | `VendorSlaOverride` | `vendor` | 9 |
| 66 | `vendor_slas` | `VendorSla` | `vendor` | 16 |
| 67 | `vendors` | `Vendor` | `vendor` | 12 |

---

### 18.2 Complete API Endpoint Registry (All 360 Endpoints)

| # | Method | Path | Controller | Primary Role / Guard |
| :---: | :---: | :--- | :--- | :--- |
| 1 | **POST** | `/api/additional-requests` | `AdditionalRequestController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 2 | **GET** | `/api/additional-requests` | `AdditionalRequestController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 3 | **GET** | `/api/additional-requests/:id` | `AdditionalRequestController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 4 | **POST** | `/api/additional-requests/:id/approve` | `AdditionalRequestController` | `UserRole.STORES, UserRole.ADMIN` |
| 5 | **POST** | `/api/additional-requests/:id/reject` | `AdditionalRequestController` | `UserRole.STORES, UserRole.ADMIN` |
| 6 | **GET** | `/api/analytics/status` | `AnalyticsController` | `Authenticated (Default)` |
| 7 | **GET** | `/` | `AppController` | `Authenticated (Default)` |
| 8 | **GET** | `/api/health` | `AppController` | `Authenticated (Default)` |
| 9 | **POST** | `/api/attachments` | `AttachmentsController` | `Authenticated (Default)` |
| 10 | **GET** | `/api/attachments` | `AttachmentsController` | `Authenticated (Default)` |
| 11 | **GET** | `/api/attachments/:id` | `AttachmentsController` | `Authenticated (Default)` |
| 12 | **DELETE** | `/api/attachments/:id` | `AttachmentsController` | `Authenticated (Default)` |
| 13 | **GET** | `/api/audit/status` | `AuditController` | `Authenticated (Default)` |
| 14 | **GET** | `/api/audit/logs` | `AuditController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER,` |
| 15 | **GET** | `/api/audit/export-csv` | `AuditController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 16 | **POST** | `/api/audit/log` | `AuditController` | `UserRole.ADMIN` |
| 17 | **POST** | `/api/auth/login` | `AuthController` | `Authenticated (Default)` |
| 18 | **POST** | `/api/auth/refresh` | `AuthController` | `Authenticated (Default)` |
| 19 | **POST** | `/api/auth/logout` | `AuthController` | `Authenticated (Default)` |
| 20 | **POST** | `/api/auth/forgot-password` | `AuthController` | `Authenticated (Default)` |
| 21 | **GET** | `/api/auth/verify-reset-token` | `AuthController` | `Authenticated (Default)` |
| 22 | **POST** | `/api/auth/reset-password` | `AuthController` | `Authenticated (Default)` |
| 23 | **GET** | `/api/auth/roles` | `AuthController` | `Authenticated (Default)` |
| 24 | **POST** | `/api/auth/dev-token` | `AuthController` | `Authenticated (Default)` |
| 25 | **GET** | `/api/auth/me` | `AuthController` | `Authenticated (Default)` |
| 26 | **POST** | `/api/auth/change-password` | `AuthController` | `Authenticated (Default)` |
| 27 | **PATCH** | `/api/auth/profile` | `AuthController` | `Authenticated (Default)` |
| 28 | **POST** | `/api/consumables/requests` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 29 | **POST** | `/api/consumables/approvals/bulk-approve` | `ConsumablesController` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` |
| 30 | **POST** | `/api/consumables/approvals/bulk-reject` | `ConsumablesController` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` |
| 31 | **GET** | `/api/consumables/approvals/pending-count` | `ConsumablesController` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` |
| 32 | **GET** | `/api/consumables/approvals/config` | `ConsumablesController` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER,` |
| 33 | **PATCH** | `/api/consumables/approvals/config` | `ConsumablesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 34 | **GET** | `/api/consumables/approvals` | `ConsumablesController` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` |
| 35 | **GET** | `/api/consumables/catalog-with-stock` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 36 | **GET** | `/api/consumables/requests` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 37 | **GET** | `/api/consumables/requests/:id` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 38 | **GET** | `/api/consumables/line-items` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 39 | **GET** | `/api/consumables/line-items/:id` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 40 | **GET** | `/api/consumables/warehouse-bins` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 41 | **GET** | `/api/consumables/products/:productId/stock-bins` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 42 | **POST** | `/api/consumables/purchase/print-pr` | `ConsumablesController` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.DESIGNER` |
| 43 | **POST** | `/api/consumables/requests/archive-pr-pdf` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 44 | **POST** | `/api/consumables/purchase/receive` | `ConsumablesController` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 45 | **POST** | `/api/consumables/line-items/:id/issue-to-production` | `ConsumablesController` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 46 | **PATCH** | `/api/consumables/line-items/:id/production-receive` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 47 | **POST** | `/api/consumables/line-items/bulk-delete` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 48 | **DELETE** | `/api/consumables/line-items/:id` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 49 | **DELETE** | `/api/consumables/requests/:id` | `ConsumablesController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 50 | **GET** | `/api/consumables/alert-settings` | `ConsumablesController` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 51 | **PATCH** | `/api/consumables/alert-settings` | `ConsumablesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 52 | **POST** | `/api/consumables/check-sla-alerts` | `ConsumablesController` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 53 | **GET** | `/api/customers/status` | `CustomersController` | `Authenticated (Default)` |
| 54 | **POST** | `/api/customers` | `CustomersController` | `UserRole.ADMIN, UserRole.STORES` |
| 55 | **GET** | `/api/customers` | `CustomersController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 56 | **GET** | `/api/customers/:id` | `CustomersController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 57 | **PATCH** | `/api/customers/:id` | `CustomersController` | `UserRole.ADMIN, UserRole.STORES` |
| 58 | **GET** | `/api/dashboards/designer` | `DashboardsController` | `UserRole.DESIGNER, UserRole.ADMIN` |
| 59 | **GET** | `/api/dashboards/stores` | `DashboardsController` | `UserRole.STORES, UserRole.ADMIN` |
| 60 | **GET** | `/api/dashboards/production` | `DashboardsController` | `UserRole.PRODUCTION, UserRole.ADMIN` |
| 61 | **GET** | `/api/dashboards/management` | `DashboardsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 62 | **GET** | `/api/dashboards/overview` | `DashboardsController` | `UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 63 | **POST** | `/api/delivery-challans/type-1` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN` |
| 64 | **POST** | `/api/delivery-challans/type-2` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN` |
| 65 | **GET** | `/api/delivery-challans/merc-pos` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` |
| 66 | **GET** | `/api/delivery-challans/merc-po/:poNumber` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN` |
| 67 | **POST** | `/api/delivery-challans/type-3` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN` |
| 68 | **POST** | `/api/delivery-challans/lock-check` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 69 | **GET** | `/api/delivery-challans/type-3` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION` |
| 70 | **GET** | `/api/delivery-challans/custody/vendor/:vendorId` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION` |
| 71 | **GET** | `/api/delivery-challans/custody/product/:productId` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION` |
| 72 | **GET** | `/api/delivery-challans/all-movements` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` |
| 73 | **GET** | `/api/delivery-challans/lifecycle-report` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` |
| 74 | **GET** | `/api/delivery-challans/movements/:scId` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` |
| 75 | **GET** | `/api/delivery-challans/overdue` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION` |
| 76 | **POST** | `/api/delivery-challans/check-sla-alerts` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 77 | **GET** | `/api/delivery-challans` | `DeliveryChallanController` | `Authenticated (Default)` |
| 78 | **GET** | `/api/delivery-challans/next-type2-item-sequence` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` |
| 79 | **GET** | `/api/delivery-challans/rework-items` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` |
| 80 | **PATCH** | `/api/delivery-challans/rework-items/:reworkId/mark-okay` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN` |
| 81 | **POST** | `/api/delivery-challans/rework-items/:reworkId/re-dispatch` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN` |
| 82 | **GET** | `/api/delivery-challans/:id/printable` | `DeliveryChallanController` | `Authenticated (Default)` |
| 83 | **GET** | `/api/delivery-challans/:id` | `DeliveryChallanController` | `Authenticated (Default)` |
| 84 | **POST** | `/api/delivery-challans/:id/return` | `DeliveryChallanController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 85 | **PATCH** | `/api/delivery-challans/:id/dock-return` | `DeliveryChallanController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 86 | **POST** | `/api/delivery-challans/:id/qc-inspect` | `DeliveryChallanController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 87 | **PATCH** | `/api/delivery-challans/:id/close` | `DeliveryChallanController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 88 | **DELETE** | `/api/delivery-challans/:id` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 89 | **DELETE** | `/api/delivery-challans/:id/items/:itemId` | `DeliveryChallanController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 90 | **POST** | `/api/internal/ecr/material-pending` | `EcrIssuesController` | `Authenticated (Default)` |
| 91 | **GET** | `/api/ecr-issues` | `EcrIssuesController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 92 | **POST** | `/api/ecr-issues/sync` | `EcrIssuesController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 93 | **GET** | `/api/ecr-issues/:id` | `EcrIssuesController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 94 | **POST** | `/api/ecr-issues/:id/issue` | `EcrIssuesController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 95 | **DELETE** | `/api/ecr-issues/:id` | `EcrIssuesController` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` |
| 96 | **GET** | `/api/email/preview-first-digest-run` | `EmailController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 97 | **GET** | `/api/email/observability` | `EmailController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 98 | **GET** | `/api/email/queue/observability` | `EmailController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 99 | **GET** | `/api/email/logs` | `EmailController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 100 | **GET** | `/api/email/health` | `EmailController` | `UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 101 | **POST** | `/api/email/jobs/:id/retry` | `EmailController` | `UserRole.ADMIN` |
| 102 | **POST** | `/api/email/resend/:jobId` | `EmailController` | `UserRole.ADMIN` |
| 103 | **POST** | `/api/email/test-send` | `EmailController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 104 | **POST** | `/api/files` | `AllowedFileTypeValidator` | `Authenticated (Default)` |
| 105 | **GET** | `/api/files/:id` | `AllowedFileTypeValidator` | `Authenticated (Default)` |
| 106 | **GET** | `/api/files/:id/download` | `AllowedFileTypeValidator` | `Authenticated (Default)` |
| 107 | **DELETE** | `/api/files/:id` | `AllowedFileTypeValidator` | `Authenticated (Default)` |
| 108 | **POST** | `/api/files/cleanup-orphans` | `AllowedFileTypeValidator` | `UserRole.ADMIN` |
| 109 | **POST** | `/api/general-issue` | `GeneralIssueController` | `UserRole.STORES, UserRole.ADMIN` |
| 110 | **GET** | `/api/general-issue` | `GeneralIssueController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 111 | **GET** | `/api/general-issue/:id` | `GeneralIssueController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 112 | **POST** | `/api/general-issue/:id/cancel` | `GeneralIssueController` | `UserRole.STORES, UserRole.ADMIN` |
| 113 | **PATCH** | `/api/general-issue/:id/cancel` | `GeneralIssueController` | `UserRole.STORES, UserRole.ADMIN` |
| 114 | **POST** | `/api/inventory` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 115 | **POST** | `/api/inventory/grn` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 116 | **GET** | `/api/inventory` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 117 | **GET** | `/api/inventory/reconciliation` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 118 | **GET** | `/api/inventory/reconciliation/workflow` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 119 | **GET** | `/api/inventory/balances` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 120 | **GET** | `/api/inventory/transactions` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` |
| 121 | **POST** | `/api/inventory/scan-transaction` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION` |
| 122 | **POST** | `/api/inventory/stock-in` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 123 | **POST** | `/api/inventory/stock-out` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 124 | **POST** | `/api/inventory/adjustment` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 125 | **POST** | `/api/inventory/transfer` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 126 | **GET** | `/api/inventory/:id` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 127 | **GET** | `/api/inventory/:id/reconciliation` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 128 | **PATCH** | `/api/inventory/:id` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 129 | **GET** | `/api/inventory/:id/stock` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 130 | **GET** | `/api/inventory/:id/transactions` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 131 | **POST** | `/api/inventory/:id/stock-in` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 132 | **POST** | `/api/inventory/:id/stock-out` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 133 | **POST** | `/api/inventory/:id/adjustment` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 134 | **POST** | `/api/inventory/:id/transactions` | `CreateGrnDto` | `UserRole.STORES, UserRole.ADMIN` |
| 135 | **GET** | `/api/inventory/msl` | `MslController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 136 | **GET** | `/api/inventory/msl/breached` | `MslController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 137 | **GET** | `/api/inventory/msl/alerts` | `MslController` | `UserRole.ADMIN, UserRole.STORES, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 138 | **GET** | `/api/inventory/msl/products/:id` | `MslController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 139 | **GET** | `/api/inventory/msl/products/:id/history` | `MslController` | `UserRole.ADMIN, UserRole.STORES, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 140 | **POST** | `/api/inventory/msl/evaluate` | `MslController` | `UserRole.ADMIN, UserRole.STORES` |
| 141 | **POST** | `/api/inventory/msl/sweep` | `MslController` | `UserRole.ADMIN, UserRole.STORES` |
| 142 | **GET** | `/api/inventory/msl/sweep-status` | `MslController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 143 | **GET** | `/` | `BinsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 144 | **GET** | `/:id` | `BinsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 145 | **POST** | `/` | `BinsController` | `UserRole.ADMIN, UserRole.STORES` |
| 146 | **PATCH** | `/:id` | `BinsController` | `UserRole.ADMIN, UserRole.STORES` |
| 147 | **DELETE** | `/:id` | `BinsController` | `UserRole.ADMIN, UserRole.STORES` |
| 148 | **GET** | `/` | `CategoriesController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 149 | **GET** | `/:id` | `CategoriesController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 150 | **POST** | `/` | `CategoriesController` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` |
| 151 | **PATCH** | `/:id` | `CategoriesController` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` |
| 152 | **DELETE** | `/:id` | `CategoriesController` | `UserRole.ADMIN, UserRole.STORES` |
| 153 | **GET** | `/` | `FamiliesController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 154 | **GET** | `/:id` | `FamiliesController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 155 | **POST** | `/` | `FamiliesController` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` |
| 156 | **PATCH** | `/:id` | `FamiliesController` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` |
| 157 | **DELETE** | `/:id` | `FamiliesController` | `UserRole.ADMIN, UserRole.STORES` |
| 158 | **GET** | `/api/locations` | `LocationsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 159 | **GET** | `/api/locations/:id` | `LocationsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 160 | **POST** | `/api/locations` | `LocationsController` | `UserRole.ADMIN, UserRole.STORES` |
| 161 | **PATCH** | `/api/locations/:id` | `LocationsController` | `UserRole.ADMIN, UserRole.STORES` |
| 162 | **GET** | `/api/locations/:id/active-stocks` | `LocationsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 163 | **POST** | `/api/locations/:id/relocate-and-delete` | `LocationsController` | `UserRole.ADMIN, UserRole.STORES` |
| 164 | **DELETE** | `/api/locations/:id` | `LocationsController` | `UserRole.ADMIN, UserRole.STORES` |
| 165 | **GET** | `/` | `ProductsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 166 | **GET** | `/by-barcode/:barcode` | `ProductsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 167 | **POST** | `/backfill-barcodes` | `ProductsController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 168 | **GET** | `/next-code` | `ProductsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 169 | **GET** | `/next-barcode` | `ProductsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 170 | **GET** | `/:id` | `ProductsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 171 | **POST** | `/` | `ProductsController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 172 | **PATCH** | `/:id` | `ProductsController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 173 | **DELETE** | `/:id` | `ProductsController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 174 | **GET** | `/api/racks` | `RacksController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 175 | **GET** | `/api/racks/:id` | `RacksController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 176 | **POST** | `/api/racks` | `RacksController` | `UserRole.ADMIN, UserRole.STORES` |
| 177 | **PATCH** | `/api/racks/:id` | `RacksController` | `UserRole.ADMIN, UserRole.STORES` |
| 178 | **DELETE** | `/api/racks/:id` | `RacksController` | `UserRole.ADMIN, UserRole.STORES` |
| 179 | **GET** | `/api/warehouses` | `WarehousesController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 180 | **GET** | `/api/warehouses/:id` | `WarehousesController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 181 | **POST** | `/api/warehouses` | `WarehousesController` | `UserRole.ADMIN, UserRole.STORES` |
| 182 | **PATCH** | `/api/warehouses/:id` | `WarehousesController` | `UserRole.ADMIN, UserRole.STORES` |
| 183 | **DELETE** | `/api/warehouses/:id` | `WarehousesController` | `UserRole.ADMIN, UserRole.STORES` |
| 184 | **POST** | `/api/material-issues` | `MaterialIssueController` | `UserRole.STORES, UserRole.ADMIN` |
| 185 | **GET** | `/api/material-issues` | `MaterialIssueController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 186 | **GET** | `/api/material-issues/:id` | `MaterialIssueController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 187 | **GET** | `/api/material-movement/status` | `MaterialMovementController` | `Authenticated (Default)` |
| 188 | **POST** | `/api/internal/merc/indent-pending` | `MercIndentController` | `Authenticated (Default)` |
| 189 | **GET** | `/api/merc-indents` | `MercIndentController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 190 | **POST** | `/api/merc-indents/sync` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 191 | **POST** | `/api/merc-indents/products/create-and-stock` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN` |
| 192 | **GET** | `/api/merc-indents/:id/full-detail` | `MercIndentController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 193 | **GET** | `/api/merc-indents/:id` | `MercIndentController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 194 | **GET** | `/api/merc-indents/:id/items/:itemId` | `MercIndentController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` |
| 195 | **POST** | `/api/merc-indents/:id/items/:itemId/issue` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN` |
| 196 | **POST** | `/api/merc-indents/:id/items/:itemId/short-close` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN` |
| 197 | **POST** | `/api/merc-indents/:id/close` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN` |
| 198 | **DELETE** | `/api/merc-indents/:id/items/:itemId` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` |
| 199 | **DELETE** | `/api/merc-indents/:id` | `MercIndentController` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` |
| 200 | **GET** | `/api/email-preferences/events` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 201 | **GET** | `/api/email-preferences/roles` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 202 | **PUT** | `/api/email-preferences/roles/:roleId/events/:eventCode` | `EmailPreferencesController` | `UserRole.ADMIN` |
| 203 | **PUT** | `/api/email-preferences/roles/:roleId` | `EmailPreferencesController` | `UserRole.ADMIN` |
| 204 | **GET** | `/api/email-preferences/users` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 205 | **GET** | `/api/email-preferences/users/:userId` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 206 | **PUT** | `/api/email-preferences/users/:userId/events/:eventCode` | `EmailPreferencesController` | `UserRole.ADMIN` |
| 207 | **PUT** | `/api/email-preferences/users/:userId` | `EmailPreferencesController` | `UserRole.ADMIN` |
| 208 | **GET** | `/api/email-preferences/audit` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 209 | **GET** | `/api/email-preferences/mode` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 210 | **PUT** | `/api/email-preferences/mode` | `EmailPreferencesController` | `UserRole.ADMIN` |
| 211 | **GET** | `/api/email-preferences/sweeps` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 212 | **PUT** | `/api/email-preferences/sweeps/:eventCode` | `EmailPreferencesController` | `UserRole.ADMIN` |
| 213 | **GET** | `/api/email-preferences/sweeps/:eventCode/preview` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 214 | **GET** | `/api/email-preferences/skips/summary` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 215 | **GET** | `/api/email-preferences/skips` | `EmailPreferencesController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 216 | **GET** | `/api/notifications/status` | `NotificationsController` | `Authenticated (Default)` |
| 217 | **GET** | `/api/notifications/unread-count` | `NotificationsController` | `Authenticated (Default)` |
| 218 | **PATCH** | `/api/notifications/read-all` | `NotificationsController` | `Authenticated (Default)` |
| 219 | **GET** | `/api/notifications` | `NotificationsController` | `Authenticated (Default)` |
| 220 | **PATCH** | `/api/notifications/:id/read` | `NotificationsController` | `Authenticated (Default)` |
| 221 | **GET** | `/api/notifications/settings` | `NotificationsController` | `UserRole.ADMIN` |
| 222 | **PATCH** | `/api/notifications/settings` | `NotificationsController` | `UserRole.ADMIN` |
| 223 | **GET** | `/api/notifications/system-config` | `NotificationsController` | `Authenticated (Default)` |
| 224 | **PATCH** | `/api/notifications/system-config` | `NotificationsController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 225 | **POST** | `/api/notifications/system-config/reset-data` | `NotificationsController` | `UserRole.ADMIN` |
| 226 | **GET** | `/api/notifications/preferences/me` | `NotificationsController` | `Authenticated (Default)` |
| 227 | **PATCH** | `/api/notifications/preferences/me` | `NotificationsController` | `Authenticated (Default)` |
| 228 | **PATCH** | `/api/notifications/preferences/:userId` | `NotificationsController` | `Authenticated (Default)` |
| 229 | **GET** | `/permissions/modules` | `PermissionsController` | `Authenticated (Default)` |
| 230 | **GET** | `/permissions/matrix` | `PermissionsController` | `UserRole.ADMIN` |
| 231 | **PUT** | `/permissions/role/:roleId` | `PermissionsController` | `UserRole.ADMIN` |
| 232 | **GET** | `/permissions/my-modules` | `PermissionsController` | `Authenticated (Default)` |
| 233 | **GET** | `/permissions/user/:userId` | `PermissionsController` | `Authenticated (Default)` |
| 234 | **PUT** | `/permissions/user/:userId` | `PermissionsController` | `UserRole.ADMIN` |
| 235 | **GET** | `/api/po/status` | `PoController` | `Authenticated (Default)` |
| 236 | **POST** | `/api/po/emergency` | `PoController` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` |
| 237 | **POST** | `/api/po` | `PoController` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER` |
| 238 | **GET** | `/api/po` | `PoController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 239 | **GET** | `/api/po/:id` | `PoController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 240 | **PATCH** | `/api/po/:id` | `PoController` | `UserRole.ADMIN, UserRole.STORES` |
| 241 | **DELETE** | `/api/po/:id` | `PoController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 242 | **POST** | `/api/po/:id/documents` | `PoController` | `UserRole.ADMIN, UserRole.STORES` |
| 243 | **GET** | `/api/po/:id/documents` | `PoController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 244 | **GET** | `/api/po/:id/documents/:attachmentId/download` | `PoController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 245 | **DELETE** | `/api/po/:id/documents/:attachmentId` | `PoController` | `UserRole.ADMIN, UserRole.STORES` |
| 246 | **POST** | `/api/production/receipt` | `ProductionController` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN` |
| 247 | **POST** | `/api/production/consume` | `ProductionController` | `UserRole.PRODUCTION, UserRole.ADMIN` |
| 248 | **POST** | `/api/production/return` | `ProductionController` | `UserRole.PRODUCTION, UserRole.ADMIN` |
| 249 | **POST** | `/api/production/return/:id/verify` | `ProductionController` | `UserRole.STORES, UserRole.ADMIN` |
| 250 | **GET** | `/api/production/returns` | `ProductionController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 251 | **GET** | `/api/production/receipts` | `ProductionController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 252 | **GET** | `/api/production/accounting/:scId` | `ProductionController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 253 | **POST** | `/api/production-processes` | `ProductionProcessController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION` |
| 254 | **GET** | `/api/production-processes` | `ProductionProcessController` | `Authenticated (Default)` |
| 255 | **GET** | `/api/production-processes/routing/first` | `ProductionProcessController` | `Authenticated (Default)` |
| 256 | **GET** | `/api/production-processes/routing/final` | `ProductionProcessController` | `Authenticated (Default)` |
| 257 | **GET** | `/api/production-processes/routing/vendor-eligible` | `ProductionProcessController` | `Authenticated (Default)` |
| 258 | **POST** | `/api/production-processes/routing/validate-transition` | `ProductionProcessController` | `Authenticated (Default)` |
| 259 | **GET** | `/api/production-processes/:id/navigation` | `ProductionProcessController` | `Authenticated (Default)` |
| 260 | **GET** | `/api/production-processes/:id` | `ProductionProcessController` | `Authenticated (Default)` |
| 261 | **PATCH** | `/api/production-processes/:id` | `ProductionProcessController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION` |
| 262 | **PATCH** | `/api/production-processes/:id/toggle-active` | `ProductionProcessController` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION` |
| 263 | **DELETE** | `/api/production-processes/:id` | `ProductionProcessController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.PRODUCTION` |
| 264 | **GET** | `/api/reports/process-wise` | `ReportsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 265 | **GET** | `/api/reports/item-wise` | `ReportsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 266 | **GET** | `/api/reports/rm-consumption` | `ReportsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 267 | **GET** | `/api/reports/export/excel/traceability` | `ReportsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 268 | **GET** | `/api/reports/export/excel/stock-movement` | `ReportsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.STORES` |
| 269 | **GET** | `/api/reports/export/excel/vendor-sla` | `ReportsController` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 270 | **GET** | `/api/reports/export/pdf/delivery-challan/:id` | `ReportsController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 271 | **GET** | `/api/reports/export/pdf/material-issue/:id` | `ReportsController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` |
| 272 | **GET** | `/api/rework/sc-list` | `ReworkController` | `Authenticated (Default)` |
| 273 | **POST** | `/api/rework/submit` | `ReworkController` | `Authenticated (Default)` |
| 274 | **POST** | `/api/rm` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 275 | **POST** | `/api/rm/draft` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 276 | **GET** | `/api/rm/po/:poId/draft` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 277 | **PUT** | `/api/rm/po/:poId/draft` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 278 | **POST** | `/api/rm/po/:poId/submit` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 279 | **GET** | `/api/rm/next-part-number` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` |
| 280 | **GET** | `/api/rm/mine` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 281 | **GET** | `/api/rm/stores/queue` | `RmController` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 282 | **POST** | `/api/rm/:id/items` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 283 | **POST** | `/api/rm/:id/submit` | `RmController` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` |
| 284 | **POST** | `/api/rm/:id/review` | `RmController` | `UserRole.STORES, UserRole.ADMIN` |
| 285 | **POST** | `/api/rm/:id/reject` | `RmController` | `UserRole.STORES, UserRole.ADMIN` |
| 286 | **GET** | `/api/rm` | `RmController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 287 | **GET** | `/api/rm/:id` | `RmController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 288 | **DELETE** | `/api/rm/po/:poId` | `RmController` | `UserRole.DESIGNER, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 289 | **DELETE** | `/api/rm/:id` | `RmController` | `UserRole.DESIGNER, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 290 | **DELETE** | `/api/rm/:id/items/:itemId` | `RmController` | `UserRole.DESIGNER, UserRole.ADMIN` |
| 291 | **PATCH** | `/api/rm/:id/items/:itemId` | `RmController` | `UserRole.DESIGNER, UserRole.ADMIN` |
| 292 | **POST** | `/api/rm/:id/documents` | `RmController` | `UserRole.DESIGNER, UserRole.ADMIN` |
| 293 | **GET** | `/api/rm/:id/documents` | `RmController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 294 | **GET** | `/api/rm/:id/documents/:attachmentId/download` | `RmController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 295 | **DELETE** | `/api/rm/:id/documents/:attachmentId` | `RmController` | `UserRole.DESIGNER, UserRole.ADMIN` |
| 296 | **GET** | `/api/roles/status` | `RolesController` | `Authenticated (Default)` |
| 297 | **POST** | `/api/sc/:scId/production-documents` | `ScDocumentsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` |
| 298 | **GET** | `/api/sc/:scId/production-documents` | `ScDocumentsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 299 | **GET** | `/api/sc/:scId/production-documents/:attachmentId` | `ScDocumentsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 300 | **PATCH** | `/api/sc/:scId/production-documents/:attachmentId` | `ScDocumentsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` |
| 301 | **DELETE** | `/api/sc/:scId/production-documents/:attachmentId` | `ScDocumentsController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` |
| 302 | **POST** | `/api/sc` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES` |
| 303 | **GET** | `/api/sc` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 304 | **GET** | `/api/sc/test/:id` | `ScController` | `Authenticated (Default)` |
| 305 | **GET** | `/api/sc/stores/pending-grouped` | `ScController` | `UserRole.ADMIN, UserRole.STORES, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 306 | **GET** | `/api/sc/production/grouped` | `ScController` | `UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 307 | **GET** | `/api/sc/:id` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 308 | **DELETE** | `/api/sc/:id` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` |
| 309 | **POST** | `/api/sc/:id/complete` | `ScController` | `UserRole.PRODUCTION, UserRole.ADMIN` |
| 310 | **POST** | `/api/sc/:id/close` | `ScController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.ADMIN` |
| 311 | **POST** | `/api/sc/:id/documents` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` |
| 312 | **GET** | `/api/sc/:id/documents` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 313 | **GET** | `/api/sc/:id/documents/:attachmentId/download` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` |
| 314 | **DELETE** | `/api/sc/:id/documents/:attachmentId` | `ScController` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` |
| 315 | **GET** | `/api/stores/status` | `StoresController` | `Authenticated (Default)` |
| 316 | **GET** | `/api/traceability/rm/lifecycle-summary` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 317 | **GET** | `/api/traceability/rm/reconciliation-queue` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 318 | **GET** | `/api/traceability/po/:poId/consolidated` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 319 | **GET** | `/api/traceability/sc/:scId/consolidated` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 320 | **GET** | `/api/traceability/sc/:scId/rm-usage` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 321 | **GET** | `/api/traceability/vendors/performance-analytics` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 322 | **GET** | `/api/traceability/vendors/:vendorId/traceability` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 323 | **GET** | `/api/traceability/analytics/process-outward` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 324 | **GET** | `/api/traceability/analytics/item-outward` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 325 | **GET** | `/api/traceability/analytics/rm-consumption` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 326 | **GET** | `/api/traceability/analytics/inventory-msl-status` | `TraceabilityController` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` |
| 327 | **POST** | `/api/users` | `UsersController` | `UserRole.ADMIN` |
| 328 | **GET** | `/api/users` | `UsersController` | `Authenticated (Default)` |
| 329 | **GET** | `/api/users/:id` | `UsersController` | `Authenticated (Default)` |
| 330 | **PUT** | `/api/users/:id` | `UsersController` | `UserRole.ADMIN` |
| 331 | **PATCH** | `/api/users/:id/active` | `UsersController` | `UserRole.ADMIN` |
| 332 | **PATCH** | `/api/users/:id/role` | `UsersController` | `UserRole.ADMIN` |
| 333 | **PATCH** | `/api/users/:id/activate` | `UsersController` | `UserRole.ADMIN` |
| 334 | **PATCH** | `/api/users/:id/deactivate` | `UsersController` | `UserRole.ADMIN` |
| 335 | **POST** | `/api/users/:id/reset-password` | `UsersController` | `UserRole.ADMIN` |
| 336 | **DELETE** | `/api/users/:id` | `UsersController` | `UserRole.ADMIN` |
| 337 | **POST** | `/api/vendors` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 338 | **GET** | `/api/vendors` | `VendorController` | `Authenticated (Default)` |
| 339 | **GET** | `/api/vendors/capabilities/by-process/:processId` | `VendorController` | `Authenticated (Default)` |
| 340 | **PATCH** | `/api/vendors/slas/:slaId` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 341 | **DELETE** | `/api/vendors/slas/:slaId` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 342 | **POST** | `/api/vendors/slas/cleanup-duplicates` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 343 | **GET** | `/api/vendors/slas` | `VendorController` | `Authenticated (Default)` |
| 344 | **GET** | `/api/vendors/compare/by-process/:processId` | `VendorController` | `Authenticated (Default)` |
| 345 | **POST** | `/api/vendors/slas/:slaId/override` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` |
| 346 | **GET** | `/api/vendors/slas/:slaId/overrides` | `VendorController` | `Authenticated (Default)` |
| 347 | **GET** | `/api/vendors/:id` | `VendorController` | `Authenticated (Default)` |
| 348 | **GET** | `/api/vendors/:id/compliance` | `VendorController` | `Authenticated (Default)` |
| 349 | **PATCH** | `/api/vendors/:id` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 350 | **PATCH** | `/api/vendors/:id/toggle-active` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 351 | **DELETE** | `/api/vendors/:id` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 352 | **POST** | `/api/vendors/:id/capabilities` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 353 | **GET** | `/api/vendors/:id/capabilities` | `VendorController` | `Authenticated (Default)` |
| 354 | **GET** | `/api/vendors/:id/capabilities/:processId/validate` | `VendorController` | `Authenticated (Default)` |
| 355 | **PATCH** | `/api/vendors/:id/capabilities/:processId` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 356 | **DELETE** | `/api/vendors/:id/capabilities/:processId` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 357 | **POST** | `/api/vendors/:id/slas` | `VendorController` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` |
| 358 | **GET** | `/api/vendors/:id/slas` | `VendorController` | `Authenticated (Default)` |
| 359 | **GET** | `/api/vendors/:id/slas/:processId` | `VendorController` | `Authenticated (Default)` |
| 360 | **GET** | `/api/vendors/:id/slas/:processId/expected-return` | `VendorController` | `Authenticated (Default)` |

---

### 18.3 Full Environment Variable Reference (All 60 Variables)

| # | Environment Variable | Category | Required / Optional | Default Value | Purpose |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `ALERT_DIGEST_MODE` | `undefined` | Optional | `none` | undefined |
| 2 | `ALERT_REALERT_COOLDOWN_HOURS` | `undefined` | Optional | `none` | undefined |
| 3 | `ALERT_SWEEP_CRON_SCHEDULE` | `undefined` | Optional | `none` | undefined |
| 4 | `ALLOW_REAL_EMAIL_IN_DEV` | `undefined` | Optional | `none` | undefined |
| 5 | `COMPANY_ADDRESS` | `undefined` | Optional | `none` | undefined |
| 6 | `COMPANY_EMAIL` | `undefined` | Optional | `none` | undefined |
| 7 | `COMPANY_GSTIN` | `undefined` | Optional | `none` | undefined |
| 8 | `COMPANY_NAME` | `undefined` | Optional | `none` | undefined |
| 9 | `COMPANY_PHONE` | `undefined` | Optional | `none` | undefined |
| 10 | `COMPANY_WEBSITE` | `undefined` | Optional | `none` | undefined |
| 11 | `CONSUMABLE_SLA_CRON_SCHEDULE` | `undefined` | Optional | `none` | undefined |
| 12 | `CONSUMABLE_SM_APPROVAL_MODE` | `undefined` | Optional | `none` | undefined |
| 13 | `CONSUMABLE_SM_APPROVAL_SCOPE` | `undefined` | Optional | `none` | undefined |
| 14 | `DATABASE_URL` | `undefined` | Optional | `none` | undefined |
| 15 | `DATABASE_URL_DIRECT` | `undefined` | Optional | `none` | undefined |
| 16 | `DB_DATABASE` | `undefined` | Optional | `none` | undefined |
| 17 | `DB_HOST` | `undefined` | Optional | `none` | undefined |
| 18 | `DB_PASSWORD` | `undefined` | Optional | `none` | undefined |
| 19 | `DB_PORT` | `undefined` | Optional | `none` | undefined |
| 20 | `DB_USERNAME` | `undefined` | Optional | `none` | undefined |
| 21 | `DC_SLA_CRON_SCHEDULE` | `undefined` | Optional | `none` | undefined |
| 22 | `ECR_API_URL` | `undefined` | Optional | `none` | undefined |
| 23 | `ECR_DATABASE_URL` | `undefined` | Optional | `none` | undefined |
| 24 | `ECR_INTERNAL_SECRET` | `undefined` | Optional | `none` | undefined |
| 25 | `EMAIL_DAILY_LIMIT` | `undefined` | Optional | `none` | undefined |
| 26 | `EMAIL_MAX_JOB_AGE_HOURS` | `undefined` | Optional | `none` | undefined |
| 27 | `EMAIL_PREFS_V2_MODE` | `undefined` | Optional | `none` | undefined |
| 28 | `EMAIL_PRIORITY_RESERVE` | `undefined` | Optional | `none` | undefined |
| 29 | `EMAIL_PROVIDER_TYPE` | `undefined` | Optional | `none` | undefined |
| 30 | `EMAIL_RETRY_MAX_DELAY` | `undefined` | Optional | `none` | undefined |
| 31 | `EMAIL_SEND_INTERVAL_MS` | `undefined` | Optional | `none` | undefined |
| 32 | `EMAIL_WORKER_BATCH_SIZE` | `undefined` | Optional | `none` | undefined |
| 33 | `EMAIL_WORKER_ENABLED` | `undefined` | Optional | `none` | undefined |
| 34 | `EMAIL_WORKER_MAX_RETRY_BACKOFF_SECONDS` | `undefined` | Optional | `none` | undefined |
| 35 | `EMAIL_WORKER_POLL_INTERVAL_MS` | `undefined` | Optional | `none` | undefined |
| 36 | `EMAIL_WORKER_RETRY_BACKOFF_SECONDS` | `undefined` | Optional | `none` | undefined |
| 37 | `EMAIL_WORKER_SHUTDOWN_TIMEOUT_MS` | `undefined` | Optional | `none` | undefined |
| 38 | `EMAIL_WORKER_STALE_THRESHOLD_SECONDS` | `undefined` | Optional | `none` | undefined |
| 39 | `ENABLE_MERC_CRON` | `undefined` | Optional | `none` | undefined |
| 40 | `FRONTEND_URL` | `undefined` | Optional | `none` | undefined |
| 41 | `GMAIL_CLIENT_ID` | `undefined` | Optional | `none` | undefined |
| 42 | `GMAIL_CLIENT_SECRET` | `undefined` | Optional | `none` | undefined |
| 43 | `GMAIL_REFRESH_TOKEN` | `undefined` | Optional | `none` | undefined |
| 44 | `GMAIL_SENDER_EMAIL` | `undefined` | Optional | `none` | undefined |
| 45 | `JWT_SECRET` | `undefined` | Optional | `none` | undefined |
| 46 | `MERC_API_URL` | `undefined` | Optional | `none` | undefined |
| 47 | `MERC_INTERNAL_SECRET` | `undefined` | Optional | `none` | undefined |
| 48 | `MERC_SYNC_CRON_SCHEDULE` | `undefined` | Optional | `none` | undefined |
| 49 | `MSL_CRON_SCHEDULE` | `undefined` | Optional | `none` | undefined |
| 50 | `NODE_ENV` | `undefined` | Optional | `none` | undefined |
| 51 | `PORT` | `undefined` | Optional | `none` | undefined |
| 52 | `RM_INTERNAL_SECRET` | `undefined` | Optional | `none` | undefined |
| 53 | `SEED_DEFAULT_PASSWORD` | `undefined` | Optional | `none` | undefined |
| 54 | `SUPABASE_SERVICE_KEY` | `undefined` | Optional | `none` | undefined |
| 55 | `SUPABASE_SERVICE_ROLE_KEY` | `undefined` | Optional | `none` | undefined |
| 56 | `SUPABASE_STORAGE_BUCKET` | `undefined` | Optional | `none` | undefined |
| 57 | `SUPABASE_URL` | `undefined` | Optional | `none` | undefined |
| 58 | `TYPEORM_SYNC` | `undefined` | Optional | `none` | undefined |
| 59 | `VITE_ECR_BASE_URL` | `undefined` | Optional | `none` | undefined |
| 60 | `VITEST` | `undefined` | Optional | `none` | undefined |

---

### 18.4 Developer & Operator Command Cheat-Sheet

```bash
# ==============================================================================
# 1. LOCAL DEVELOPMENT SETUP
# ==============================================================================
# Install backend and frontend dependencies
npm --prefix backend install
npm --prefix frontend install

# Start PostgreSQL database via Docker Compose
docker compose up -d postgres

# Start backend in development watch mode (runs on http://localhost:3000)
npm --prefix backend run start:dev

# Start frontend in development mode (runs on http://localhost:5173)
npm --prefix frontend run dev

# ==============================================================================
# 2. DATABASE MIGRATIONS & SEEDING
# ==============================================================================
# Run all pending TypeORM migrations
npm --prefix backend run migration:run

# Revert the most recently executed migration
npm --prefix backend run migration:revert

# Generate a new migration from entity schema diff
npm --prefix backend run migration:generate -- src/database/migrations/NewMigrationName

# Seed initial database records (admin user, standard roles, warehouse bins)
npm --prefix backend run seed

# ==============================================================================
# 3. TESTING & CODE QUALITY
# ==============================================================================
# Run backend Vitest unit and integration suite (174 test files)
npm --prefix backend run test

# Run backend tests with coverage report
npm --prefix backend run test:cov

# Run Playwright frontend end-to-end test suite
npm --prefix frontend run test

# Build backend TypeScript artifacts for production
npm --prefix backend run build

# Build frontend Vite static bundle for production
npm --prefix frontend run build

# ==============================================================================
# 4. RUNTIME VERIFICATION CHECKS (REQUIRES SERVER CHECK)
# ==============================================================================
# Check backend health probe status
curl -I http://localhost:3000/health

# Check PostgreSQL active connection pool count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"

# Check pending background email jobs in queue
psql $DATABASE_URL -c "SELECT status, count(*) FROM email_jobs GROUP BY status;"

# Check unread MSL inventory alerts
psql $DATABASE_URL -c "SELECT severity, count(*) FROM msl_alerts WHERE status = 'ACTIVE' GROUP BY severity;"
```
