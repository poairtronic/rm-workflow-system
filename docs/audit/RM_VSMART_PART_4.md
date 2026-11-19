# RM Application (V-SMART) Technical & Functional Audit Report
## PART 4: Comprehensive API Endpoint Directory (All 360 Endpoints)

> **Document Context:** Part 4 of 5 of the comprehensive technical audit of the Raw Material (RM) Workflow & Traceability Application (**V-SMART / RMRIT**).  
> **Master Index:** [`docs/audit/RM_VSMART_FULL_REPORT.md`](file:///docs/audit/RM_VSMART_FULL_REPORT.md)  
> **Repository:** `c:/Users/Admin/OneDrive/Desktop/rm-workflow-system`  
> **Audit Date:** November 2026  
> **Mode:** Read-Only Static and Architectural Codebase Audit  

---

## 10. Complete API Endpoint Directory

### 10.0 API Architecture Overview
- **Base Routing Prefix:** All REST API endpoints are served under the global prefix `/api` (configured via `app.setGlobalPrefix('api')` in [`backend/src/main.ts`](file:///backend/src/main.ts)).
- **Top-Level Health Exemption:** Health probes are exposed both at root `/health` and prefixed `/api/health` for compatibility with Render zero-downtime health checkers.
- **Authentication & Authorization Pipeline:**
  1. `JwtAuthGuard`: Decodes and verifies the Bearer token in the `Authorization: Bearer <jwt>` header against `JWT_SECRET`.
  2. `RolesGuard`: Checks the authenticated user's static `role` against the roles declared in the `@Roles(...)` decorator.
  3. `PermissionsGuard`: For dynamic granular permissions, verifies if the user's role has the required permission in `role_permissions`.
  4. `InternalSecretGuard`: Protects server-to-server inter-service webhooks by validating the `x-internal-secret` HTTP header against `RM_INTERNAL_SECRET`, `ECR_INTERNAL_SECRET`, or `MERC_INTERNAL_SECRET`.
- **Throttling & Rate Limiting:** Global rate limit applied via `ThrottlerGuard` (default 100 requests per 60 seconds per IP, configured in [`backend/src/app.module.ts`](file:///backend/src/app.module.ts)).
- **WebSocket Gateway:** Real-time push updates served via Socket.io at path `/socket.io` through `NotificationsGateway` ([`backend/src/notifications/notifications.gateway.ts`](file:///backend/src/notifications/notifications.gateway.ts)).
- **Total Endpoint Metrics:**
  - **Total Controllers:** 42 NestJS controllers
  - **Total Documented Endpoints:** 360 REST endpoints
  - **Health Endpoints:** 2 endpoints (`GET /health`, `GET /api/health`)
  - **WebSocket Events:** 4 event types (`notification`, `stock_update`, `dc_status_change`, `msl_alert`)

---

### Inbound & Outbound Webhook Summary

| Direction | Endpoint / Destination | Auth / Guard | Handler / Source File | Functional Description |
| :--- | :--- | :--- | :--- | :--- |
| **Inbound** | `POST /api/internal/ecr-pending` | `InternalSecretGuard` (`x-internal-secret`) | [`backend/src/ecr-issues/ecr-issues.controller.ts`](file:///backend/src/ecr-issues/ecr-issues.controller.ts) | Ingests rework and rejection reports from external ECR application into `ecr_material_pending`. |
| **Inbound** | `POST /api/internal/merc/indent` | `InternalSecretGuard` (`x-internal-secret`) | [`backend/src/merc-indent/merc-indent.controller.ts`](file:///backend/src/merc-indent/merc-indent.controller.ts) | Ingests pending customer indents from MERC ERP system into `merc_indent_pending`. |
| **Outbound** | `POST ${ECR_API_URL}/api/internal/material-issued` | Header: `x-internal-secret: <ECR_INTERNAL_SECRET>` | [`backend/src/ecr-issues/ecr-issues.service.ts`](file:///backend/src/ecr-issues/ecr-issues.service.ts) | Dispatches notification and issue metadata to ECR when replacement material is issued. |
| **Outbound** | `POST ${MERC_API_URL}/api/internal/rm/item-issued` | Header: `x-internal-secret: <MERC_INTERNAL_SECRET>` | [`backend/src/merc-indent/merc-indent.service.ts`](file:///backend/src/merc-indent/merc-indent.service.ts) | Dispatches fulfillment confirmation to MERC ERP when indent item is issued from stores. |

---

### Controller by Controller Directory (All 42 Controllers, 360 Endpoints)

### 10.1. Controller: `AdditionalRequestController`

* **File:** [`backend/src/additional-request/additional-request.controller.ts`](file:///backend/src/additional-request/additional-request.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/additional-requests` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`createRequest`](file:///backend/src/additional-request/additional-request.controller.ts#L28) | Body: `dto: CreateAdditionalRequestDto` |
| **GET** | `/api/additional-requests` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/additional-request/additional-request.controller.ts#L41) | - |
| **GET** | `/api/additional-requests/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/additional-request/additional-request.controller.ts#L54) | Params: `id: string` |
| **POST** | `/api/additional-requests/:id/approve` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`approveRequest`](file:///backend/src/additional-request/additional-request.controller.ts#L60) | Params: `id: string` |
| **POST** | `/api/additional-requests/:id/reject` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`rejectRequest`](file:///backend/src/additional-request/additional-request.controller.ts#L66) | Params: `id: string` |

---

### 10.2. Controller: `AnalyticsController`

* **File:** [`backend/src/analytics/analytics.controller.ts`](file:///backend/src/analytics/analytics.controller.ts)
* **Endpoints Count:** 1

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/analytics/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/analytics/analytics.controller.ts#L9) | - |

---

### 10.3. Controller: `AppController`

* **File:** [`backend/src/app.controller.ts`](file:///backend/src/app.controller.ts)
* **Endpoints Count:** 2

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `None` | `Authenticated (Default)` | [`getHello`](file:///backend/src/app.controller.ts#L9) | - |
| **GET** | `/api/health` | `None` | `Authenticated (Default)` | [`getHealth`](file:///backend/src/app.controller.ts#L14) | - |

---

### 10.4. Controller: `AttachmentsController`

* **File:** [`backend/src/attachments/attachments.controller.ts`](file:///backend/src/attachments/attachments.controller.ts)
* **Endpoints Count:** 4

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/attachments` | `JwtAuthGuard` | `Authenticated (Default)` | [`createAttachment`](file:///backend/src/attachments/attachments.controller.ts#L25) | Body: `dto: CreateAttachmentDto` |
| **GET** | `/api/attachments` | `JwtAuthGuard` | `Authenticated (Default)` | [`listAttachments`](file:///backend/src/attachments/attachments.controller.ts#L30) | - |
| **GET** | `/api/attachments/:id` | `JwtAuthGuard` | `Authenticated (Default)` | [`getAttachment`](file:///backend/src/attachments/attachments.controller.ts#L41) | Params: `id: string` |
| **DELETE** | `/api/attachments/:id` | `JwtAuthGuard` | `Authenticated (Default)` | [`detachAttachment`](file:///backend/src/attachments/attachments.controller.ts#L46) | Params: `id: string` |

---

### 10.5. Controller: `AuditController`

* **File:** [`backend/src/audit/audit.controller.ts`](file:///backend/src/audit/audit.controller.ts)
* **Endpoints Count:** 4

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/audit/status` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/audit/audit.controller.ts#L24) | - |
| **GET** | `/api/audit/logs` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER,` | [`getLogs`](file:///backend/src/audit/audit.controller.ts#L37) | - |
| **GET** | `/api/audit/export-csv` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`exportCsv`](file:///backend/src/audit/audit.controller.ts#L55) | - |
| **POST** | `/api/audit/log` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`createLog`](file:///backend/src/audit/audit.controller.ts#L76) | Body: `dto: CreateAuditLogDto` |

---

### 10.6. Controller: `AuthController`

* **File:** [`backend/src/auth/auth.controller.ts`](file:///backend/src/auth/auth.controller.ts)
* **Endpoints Count:** 11

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | `None` | `Authenticated (Default)` | [`login`](file:///backend/src/auth/auth.controller.ts#L42) | Body: `loginDto: LoginDto` |
| **POST** | `/api/auth/refresh` | `None` | `Authenticated (Default)` | [`refresh`](file:///backend/src/auth/auth.controller.ts#L70) | Body: `dto: RefreshTokenDto` |
| **POST** | `/api/auth/logout` | `None` | `Authenticated (Default)` | [`logout`](file:///backend/src/auth/auth.controller.ts#L97) | Body: `dto: LogoutDto` |
| **POST** | `/api/auth/forgot-password` | `None` | `Authenticated (Default)` | [`forgotPassword`](file:///backend/src/auth/auth.controller.ts#L115) | Body: `dto: ForgotPasswordDto` |
| **GET** | `/api/auth/verify-reset-token` | `None` | `Authenticated (Default)` | [`verifyResetToken`](file:///backend/src/auth/auth.controller.ts#L123) | - |
| **POST** | `/api/auth/reset-password` | `None` | `Authenticated (Default)` | [`resetPassword`](file:///backend/src/auth/auth.controller.ts#L133) | Body: `dto: ResetPasswordDto` |
| **GET** | `/api/auth/roles` | `None` | `Authenticated (Default)` | [`getRoles`](file:///backend/src/auth/auth.controller.ts#L138) | - |
| **POST** | `/api/auth/dev-token` | `None` | `Authenticated (Default)` | [`getDevToken`](file:///backend/src/auth/auth.controller.ts#L151) | Body: `dto: DevTokenDto` |
| **GET** | `/api/auth/me` | `JwtAuthGuard` | `Authenticated (Default)` | [`getProfile`](file:///backend/src/auth/auth.controller.ts#L161) | - |
| **POST** | `/api/auth/change-password` | `JwtAuthGuard` | `Authenticated (Default)` | [`changePassword`](file:///backend/src/auth/auth.controller.ts#L192) | Body: `dto: ChangePasswordDto` |
| **PATCH** | `/api/auth/profile` | `JwtAuthGuard` | `Authenticated (Default)` | [`updateProfile`](file:///backend/src/auth/auth.controller.ts#L206) | Body: `dto: UpdateProfileDto` |

---

### 10.7. Controller: `ConsumablesController`

* **File:** [`backend/src/consumables/consumables.controller.ts`](file:///backend/src/consumables/consumables.controller.ts)
* **Endpoints Count:** 25

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/consumables/requests` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`createRequest`](file:///backend/src/consumables/consumables.controller.ts#L59) | Body: `dto: CreateConsumableRequestDto` |
| **POST** | `/api/consumables/approvals/bulk-approve` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` | [`bulkApprove`](file:///backend/src/consumables/consumables.controller.ts#L74) | Body: `dto: BulkApproveConsumablesDto` |
| **POST** | `/api/consumables/approvals/bulk-reject` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` | [`bulkReject`](file:///backend/src/consumables/consumables.controller.ts#L89) | Body: `dto: BulkRejectConsumablesDto` |
| **GET** | `/api/consumables/approvals/pending-count` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` | [`getPendingCount`](file:///backend/src/consumables/consumables.controller.ts#L104) | - |
| **GET** | `/api/consumables/approvals/config` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER,` | [`getApprovalConfig`](file:///backend/src/consumables/consumables.controller.ts#L120) | - |
| **PATCH** | `/api/consumables/approvals/config` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`updateApprovalConfig`](file:///backend/src/consumables/consumables.controller.ts#L131) | Body: `dto: UpdateConsumableApprovalConfigDto` |
| **GET** | `/api/consumables/approvals` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.ADMIN` | [`queryApprovals`](file:///backend/src/consumables/consumables.controller.ts#L146) | - |
| **GET** | `/api/consumables/catalog-with-stock` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`getCatalogWithStock`](file:///backend/src/consumables/consumables.controller.ts#L163) | - |
| **GET** | `/api/consumables/requests` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`findAllRequests`](file:///backend/src/consumables/consumables.controller.ts#L180) | - |
| **GET** | `/api/consumables/requests/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`findOneRequest`](file:///backend/src/consumables/consumables.controller.ts#L197) | Params: `id: string` |
| **GET** | `/api/consumables/line-items` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`findAllLineItems`](file:///backend/src/consumables/consumables.controller.ts#L214) | - |
| **GET** | `/api/consumables/line-items/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`findOneItem`](file:///backend/src/consumables/consumables.controller.ts#L231) | Params: `id: string` |
| **GET** | `/api/consumables/warehouse-bins` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`getAllWarehouseBins`](file:///backend/src/consumables/consumables.controller.ts#L248) | - |
| **GET** | `/api/consumables/products/:productId/stock-bins` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`getProductStockBins`](file:///backend/src/consumables/consumables.controller.ts#L265) | Params: `productId: string` |
| **POST** | `/api/consumables/purchase/print-pr` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.DESIGNER` | [`printPurchaseRequisition`](file:///backend/src/consumables/consumables.controller.ts#L276) | Body: `dto: PrintPrDto` |
| **POST** | `/api/consumables/requests/archive-pr-pdf` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`archivePrPdf`](file:///backend/src/consumables/consumables.controller.ts#L297) | Body: `dto: CreateConsumablePoDto` |
| **POST** | `/api/consumables/purchase/receive` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`receivePurchase`](file:///backend/src/consumables/consumables.controller.ts#L340) | Body: `dto: ReceiveConsumablePurchaseDto` |
| **POST** | `/api/consumables/line-items/:id/issue-to-production` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`issueToProduction`](file:///backend/src/consumables/consumables.controller.ts#L355) | Body: `dto: IssueConsumableToProductionDto` |
| **PATCH** | `/api/consumables/line-items/:id/production-receive` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`confirmProductionReceipt`](file:///backend/src/consumables/consumables.controller.ts#L371) | Params: `id: string` |
| **POST** | `/api/consumables/line-items/bulk-delete` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`bulkDeleteLineItems`](file:///backend/src/consumables/consumables.controller.ts#L392) | Body: `dto: BulkDeleteConsumableItemsDto` |
| **DELETE** | `/api/consumables/line-items/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`deleteLineItem`](file:///backend/src/consumables/consumables.controller.ts#L413) | Params: `id: string` |
| **DELETE** | `/api/consumables/requests/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`deleteRequest`](file:///backend/src/consumables/consumables.controller.ts#L434) | Params: `id: string` |
| **GET** | `/api/consumables/alert-settings` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getAlertSettings`](file:///backend/src/consumables/consumables.controller.ts#L448) | - |
| **PATCH** | `/api/consumables/alert-settings` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`updateAlertSettings`](file:///backend/src/consumables/consumables.controller.ts#L455) | Body: `body: {` |
| **POST** | `/api/consumables/check-sla-alerts` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`checkSlaAlerts`](file:///backend/src/consumables/consumables.controller.ts#L474) | - |

---

### 10.8. Controller: `CustomersController`

* **File:** [`backend/src/customers/customers.controller.ts`](file:///backend/src/customers/customers.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/customers/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/customers/customers.controller.ts#L24) | - |
| **POST** | `/api/customers` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`create`](file:///backend/src/customers/customers.controller.ts#L31) | Body: `createCustomerDto: CreateCustomerDto` |
| **GET** | `/api/customers` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/customers/customers.controller.ts#L45) | - |
| **GET** | `/api/customers/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/customers/customers.controller.ts#L59) | Params: `id: string` |
| **PATCH** | `/api/customers/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`update`](file:///backend/src/customers/customers.controller.ts#L66) | Body: `updateCustomerDto: UpdateCustomerDto` |

---

### 10.9. Controller: `DashboardsController`

* **File:** [`backend/src/dashboards/dashboards.controller.ts`](file:///backend/src/dashboards/dashboards.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/dashboards/designer` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN` | [`getDesignerDashboard`](file:///backend/src/dashboards/dashboards.controller.ts#L15) | - |
| **GET** | `/api/dashboards/stores` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`getStoresDashboard`](file:///backend/src/dashboards/dashboards.controller.ts#L22) | - |
| **GET** | `/api/dashboards/production` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.ADMIN` | [`getProductionDashboard`](file:///backend/src/dashboards/dashboards.controller.ts#L28) | - |
| **GET** | `/api/dashboards/management` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`getManagementDashboard`](file:///backend/src/dashboards/dashboards.controller.ts#L34) | - |
| **GET** | `/api/dashboards/overview` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`getUnifiedOverview`](file:///backend/src/dashboards/dashboards.controller.ts#L40) | - |

---

### 10.10. Controller: `DeliveryChallanController`

* **File:** [`backend/src/delivery-challan/delivery-challan.controller.ts`](file:///backend/src/delivery-challan/delivery-challan.controller.ts)
* **Endpoints Count:** 27

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/delivery-challans/type-1` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createType1`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L22) | Body: `dto: CreateDeliveryChallanDto` |
| **POST** | `/api/delivery-challans/type-2` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createType2`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L28) | Body: `dto: CreateDeliveryChallanDto` |
| **GET** | `/api/delivery-challans/merc-pos` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` | [`getMercPos`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L35) | - |
| **GET** | `/api/delivery-challans/merc-po/:poNumber` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`getMercPoItems`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L41) | Params: `poNumber: string` |
| **POST** | `/api/delivery-challans/type-3` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createType3`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L47) | Body: `dto: CreateSplDcDto` |
| **POST** | `/api/delivery-challans/lock-check` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`checkProductLock`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L54) | Body: `dto: LockCheckDto` |
| **GET** | `/api/delivery-challans/type-3` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION` | [`listType3`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L60) | - |
| **GET** | `/api/delivery-challans/custody/vendor/:vendorId` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION` | [`getVendorCustodySummary`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L69) | Params: `vendorId: string` |
| **GET** | `/api/delivery-challans/custody/product/:productId` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION` | [`getProductCustodyTotal`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L75) | Params: `productId: string` |
| **GET** | `/api/delivery-challans/all-movements` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` | [`getAllMovements`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L81) | - |
| **GET** | `/api/delivery-challans/lifecycle-report` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` | [`getLifecycleReport`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L87) | - |
| **GET** | `/api/delivery-challans/movements/:scId` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` | [`getScMovements`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L109) | Params: `scId: string` |
| **GET** | `/api/delivery-challans/overdue` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER, UserRole.PRODUCTION` | [`getOverdueChallans`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L115) | - |
| **POST** | `/api/delivery-challans/check-sla-alerts` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`checkSlaAlerts`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L121) | - |
| **GET** | `/api/delivery-challans` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findAll`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L126) | - |
| **GET** | `/api/delivery-challans/next-type2-item-sequence` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` | [`getNextType2ItemSequence`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L151) | - |
| **GET** | `/api/delivery-challans/rework-items` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.DESIGNER` | [`getReworkItems`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L161) | - |
| **PATCH** | `/api/delivery-challans/rework-items/:reworkId/mark-okay` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`markReworkItemOkay`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L167) | Params: `reworkId: string` |
| **POST** | `/api/delivery-challans/rework-items/:reworkId/re-dispatch` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`reDispatchReworkItem`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L173) | Body: `dto: ReworkReDispatchDto` |
| **GET** | `/api/delivery-challans/:id/printable` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getPrintable`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L183) | Params: `id: string` |
| **GET** | `/api/delivery-challans/:id` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findOne`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L192) | Params: `id: string` |
| **POST** | `/api/delivery-challans/:id/return` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`returnChallan`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L205) | Body: `dto: ReturnDeliveryChallanDto` |
| **PATCH** | `/api/delivery-challans/:id/dock-return` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`dockReturn`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L223) | Body: `dto: ReturnDeliveryChallanDto` |
| **POST** | `/api/delivery-challans/:id/qc-inspect` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`qcInspect`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L241) | Body: `dto: QcInspectDeliveryChallanDto` |
| **PATCH** | `/api/delivery-challans/:id/close` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`closeChallan`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L259) | Params: `id: string` |
| **DELETE** | `/api/delivery-challans/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`deleteChallan`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L269) | Params: `id: string` |
| **DELETE** | `/api/delivery-challans/:id/items/:itemId` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`deleteChallanItem`](file:///backend/src/delivery-challan/delivery-challan.controller.ts#L279) | Params: `id: string, itemId: string` |

---

### 10.11. Controller: `EcrIssuesController`

* **File:** [`backend/src/ecr-issues/ecr-issues.controller.ts`](file:///backend/src/ecr-issues/ecr-issues.controller.ts)
* **Endpoints Count:** 6

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/internal/ecr/material-pending` | `InternalSecretGuard` | `Authenticated (Default)` | [`receivePending`](file:///backend/src/ecr-issues/ecr-issues.controller.ts#L35) | Body: `dto: ReceiveEcrPendingDto` |
| **GET** | `/api/ecr-issues` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`getAll`](file:///backend/src/ecr-issues/ecr-issues.controller.ts#L48) | - |
| **POST** | `/api/ecr-issues/sync` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`syncFromEcr`](file:///backend/src/ecr-issues/ecr-issues.controller.ts#L61) | - |
| **GET** | `/api/ecr-issues/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`getOne`](file:///backend/src/ecr-issues/ecr-issues.controller.ts#L74) | Params: `id: string` |
| **POST** | `/api/ecr-issues/:id/issue` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`issue`](file:///backend/src/ecr-issues/ecr-issues.controller.ts#L94) | Body: `dto: IssueEcrMaterialDto` |
| **DELETE** | `/api/ecr-issues/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` | [`deleteEcrIssue`](file:///backend/src/ecr-issues/ecr-issues.controller.ts#L118) | Params: `id: string` |

---

### 10.12. Controller: `EmailController`

* **File:** [`backend/src/email/email.controller.ts`](file:///backend/src/email/email.controller.ts)
* **Endpoints Count:** 8

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/email/preview-first-digest-run` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`previewFirstDigestRun`](file:///backend/src/email/email.controller.ts#L57) | - |
| **GET** | `/api/email/observability` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`getObservability`](file:///backend/src/email/email.controller.ts#L70) | - |
| **GET** | `/api/email/queue/observability` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`getQueueObservability`](file:///backend/src/email/email.controller.ts#L80) | - |
| **GET** | `/api/email/logs` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`getLogs`](file:///backend/src/email/email.controller.ts#L90) | - |
| **GET** | `/api/email/health` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`getEmailHealth`](file:///backend/src/email/email.controller.ts#L107) | - |
| **POST** | `/api/email/jobs/:id/retry` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`retryJob`](file:///backend/src/email/email.controller.ts#L153) | Params: `jobId: string` |
| **POST** | `/api/email/resend/:jobId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`resendJob`](file:///backend/src/email/email.controller.ts#L188) | Params: `jobId: string` |
| **POST** | `/api/email/test-send` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`sendTestEmail`](file:///backend/src/email/email.controller.ts#L198) | Body: `dto: TestSendEmailDto` |

---

### 10.13. Controller: `AllowedFileTypeValidator`

* **File:** [`backend/src/files/files.controller.ts`](file:///backend/src/files/files.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/files` | `JwtAuthGuard` | `Authenticated (Default)` | [`uploadFile`](file:///backend/src/files/files.controller.ts#L77) | - |
| **GET** | `/api/files/:id` | `JwtAuthGuard` | `Authenticated (Default)` | [`getFileMetadata`](file:///backend/src/files/files.controller.ts#L109) | Params: `id: string` |
| **GET** | `/api/files/:id/download` | `JwtAuthGuard` | `Authenticated (Default)` | [`getFileDownloadUrl`](file:///backend/src/files/files.controller.ts#L123) | Params: `id: string` |
| **DELETE** | `/api/files/:id` | `JwtAuthGuard` | `Authenticated (Default)` | [`removeFile`](file:///backend/src/files/files.controller.ts#L130) | Params: `id: string` |
| **POST** | `/api/files/cleanup-orphans` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`cleanupOrphans`](file:///backend/src/files/files.controller.ts#L140) | - |

---

### 10.14. Controller: `GeneralIssueController`

* **File:** [`backend/src/general-issue/general-issue.controller.ts`](file:///backend/src/general-issue/general-issue.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/general-issue` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createIssue`](file:///backend/src/general-issue/general-issue.controller.ts#L29) | Body: `dto: CreateGeneralIssueDto` |
| **GET** | `/api/general-issue` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/general-issue/general-issue.controller.ts#L48) | - |
| **GET** | `/api/general-issue/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/general-issue/general-issue.controller.ts#L64) | Params: `id: string` |
| **POST** | `/api/general-issue/:id/cancel` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`cancelIssue`](file:///backend/src/general-issue/general-issue.controller.ts#L74) | Body: `dto: CancelGeneralIssueDto` |
| **PATCH** | `/api/general-issue/:id/cancel` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`cancelIssuePatch`](file:///backend/src/general-issue/general-issue.controller.ts#L84) | Body: `dto: CancelGeneralIssueDto` |

---

### 10.15. Controller: `CreateGrnDto`

* **File:** [`backend/src/inventory/inventory.controller.ts`](file:///backend/src/inventory/inventory.controller.ts)
* **Endpoints Count:** 21

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/inventory` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`create`](file:///backend/src/inventory/inventory.controller.ts#L49) | Body: `createDto: CreateInventoryItemDto` |
| **POST** | `/api/inventory/grn` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createGrn`](file:///backend/src/inventory/inventory.controller.ts#L55) | Body: `createDto: CreateGrnDto` |
| **GET** | `/api/inventory` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/inventory/inventory.controller.ts#L69) | - |
| **GET** | `/api/inventory/reconciliation` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getReconciliation`](file:///backend/src/inventory/inventory.controller.ts#L84) | - |
| **GET** | `/api/inventory/reconciliation/workflow` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getWorkflowReconciliation`](file:///backend/src/inventory/inventory.controller.ts#L95) | - |
| **GET** | `/api/inventory/balances` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getBalances`](file:///backend/src/inventory/inventory.controller.ts#L109) | - |
| **GET** | `/api/inventory/transactions` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.DESIGNER,` | [`getAllTransactions`](file:///backend/src/inventory/inventory.controller.ts#L127) | - |
| **POST** | `/api/inventory/scan-transaction` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION` | [`scanStockTransaction`](file:///backend/src/inventory/inventory.controller.ts#L136) | Body: `dto: ScanStockTransactionDto` |
| **POST** | `/api/inventory/stock-in` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`modernStockIn`](file:///backend/src/inventory/inventory.controller.ts#L146) | Body: `dto: ModernStockInDto` |
| **POST** | `/api/inventory/stock-out` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`modernStockOut`](file:///backend/src/inventory/inventory.controller.ts#L156) | Body: `dto: ModernStockOutDto` |
| **POST** | `/api/inventory/adjustment` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`modernStockAdjustment`](file:///backend/src/inventory/inventory.controller.ts#L166) | Body: `dto: ModernStockAdjustmentDto` |
| **POST** | `/api/inventory/transfer` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`modernStockTransfer`](file:///backend/src/inventory/inventory.controller.ts#L176) | Body: `dto: ModernStockTransferDto` |
| **GET** | `/api/inventory/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/inventory/inventory.controller.ts#L192) | Params: `id: string` |
| **GET** | `/api/inventory/:id/reconciliation` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getSingleReconciliation`](file:///backend/src/inventory/inventory.controller.ts#L204) | Params: `id: string` |
| **PATCH** | `/api/inventory/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`update`](file:///backend/src/inventory/inventory.controller.ts#L212) | Body: `updateDto: UpdateInventoryItemDto` |
| **GET** | `/api/inventory/:id/stock` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getStockBalance`](file:///backend/src/inventory/inventory.controller.ts#L224) | Params: `id: string` |
| **GET** | `/api/inventory/:id/transactions` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getTransactions`](file:///backend/src/inventory/inventory.controller.ts#L235) | Params: `id: string` |
| **POST** | `/api/inventory/:id/stock-in` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`stockIn`](file:///backend/src/inventory/inventory.controller.ts#L245) | Body: `dto: CreateStockInDto` |
| **POST** | `/api/inventory/:id/stock-out` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`stockOut`](file:///backend/src/inventory/inventory.controller.ts#L255) | Body: `dto: CreateStockOutDto` |
| **POST** | `/api/inventory/:id/adjustment` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`stockAdjustment`](file:///backend/src/inventory/inventory.controller.ts#L265) | Body: `dto: CreateStockAdjustmentDto` |
| **POST** | `/api/inventory/:id/transactions` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`addTransaction`](file:///backend/src/inventory/inventory.controller.ts#L275) | Body: `_transactionDto: CreateStockTransactionDto` |

---

### 10.16. Controller: `MslController`

* **File:** [`backend/src/inventory/msl.controller.ts`](file:///backend/src/inventory/msl.controller.ts)
* **Endpoints Count:** 8

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/inventory/msl` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getAllMslStatus`](file:///backend/src/inventory/msl.controller.ts#L40) | - |
| **GET** | `/api/inventory/msl/breached` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getBreachedProducts`](file:///backend/src/inventory/msl.controller.ts#L56) | - |
| **GET** | `/api/inventory/msl/alerts` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getActiveAlerts`](file:///backend/src/inventory/msl.controller.ts#L70) | - |
| **GET** | `/api/inventory/msl/products/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getProductMsl`](file:///backend/src/inventory/msl.controller.ts#L86) | Params: `id: string` |
| **GET** | `/api/inventory/msl/products/:id/history` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getProductAlertHistory`](file:///backend/src/inventory/msl.controller.ts#L106) | Params: `id: string` |
| **POST** | `/api/inventory/msl/evaluate` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`evaluateAll`](file:///backend/src/inventory/msl.controller.ts#L117) | - |
| **POST** | `/api/inventory/msl/sweep` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`runSweep`](file:///backend/src/inventory/msl.controller.ts#L126) | - |
| **GET** | `/api/inventory/msl/sweep-status` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getSweepStatus`](file:///backend/src/inventory/msl.controller.ts#L142) | - |

---

### 10.17. Controller: `BinsController`

* **File:** [`backend/src/master-data/controllers/bins.controller.ts`](file:///backend/src/master-data/controllers/bins.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findBins`](file:///backend/src/master-data/controllers/bins.controller.ts#L40) | - |
| **GET** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findBinById`](file:///backend/src/master-data/controllers/bins.controller.ts#L53) | Params: `id: string` |
| **POST** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`createBin`](file:///backend/src/master-data/controllers/bins.controller.ts#L60) | Body: `dto: CreateBinDto` |
| **PATCH** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`updateBin`](file:///backend/src/master-data/controllers/bins.controller.ts#L67) | Body: `dto: UpdateBinDto` |
| **DELETE** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`deleteBin`](file:///backend/src/master-data/controllers/bins.controller.ts#L74) | Params: `id: string` |

---

### 10.18. Controller: `CategoriesController`

* **File:** [`backend/src/master-data/controllers/categories.controller.ts`](file:///backend/src/master-data/controllers/categories.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findCategories`](file:///backend/src/master-data/controllers/categories.controller.ts#L40) | - |
| **GET** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findCategoryById`](file:///backend/src/master-data/controllers/categories.controller.ts#L53) | Params: `id: string` |
| **POST** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` | [`createCategory`](file:///backend/src/master-data/controllers/categories.controller.ts#L60) | Body: `dto: CreateCategoryDto` |
| **PATCH** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` | [`updateCategory`](file:///backend/src/master-data/controllers/categories.controller.ts#L67) | Body: `dto: UpdateCategoryDto` |
| **DELETE** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`deleteCategory`](file:///backend/src/master-data/controllers/categories.controller.ts#L77) | Params: `id: string` |

---

### 10.19. Controller: `FamiliesController`

* **File:** [`backend/src/master-data/controllers/families.controller.ts`](file:///backend/src/master-data/controllers/families.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findFamilies`](file:///backend/src/master-data/controllers/families.controller.ts#L35) | - |
| **GET** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findFamilyById`](file:///backend/src/master-data/controllers/families.controller.ts#L48) | Params: `id: string` |
| **POST** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` | [`createFamily`](file:///backend/src/master-data/controllers/families.controller.ts#L54) | Body: `dto: CreateFamilyDto` |
| **PATCH** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER, UserRole.GENERAL_MANAGER` | [`updateFamily`](file:///backend/src/master-data/controllers/families.controller.ts#L60) | Body: `dto: UpdateFamilyDto` |
| **DELETE** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`deleteFamily`](file:///backend/src/master-data/controllers/families.controller.ts#L69) | Params: `id: string` |

---

### 10.20. Controller: `LocationsController`

* **File:** [`backend/src/master-data/controllers/locations.controller.ts`](file:///backend/src/master-data/controllers/locations.controller.ts)
* **Endpoints Count:** 7

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/locations` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findLocations`](file:///backend/src/master-data/controllers/locations.controller.ts#L40) | - |
| **GET** | `/api/locations/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findLocationById`](file:///backend/src/master-data/controllers/locations.controller.ts#L53) | Params: `id: string` |
| **POST** | `/api/locations` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`createLocation`](file:///backend/src/master-data/controllers/locations.controller.ts#L59) | Body: `dto: CreateLocationDto` |
| **PATCH** | `/api/locations/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`updateLocation`](file:///backend/src/master-data/controllers/locations.controller.ts#L65) | Body: `dto: UpdateLocationDto` |
| **GET** | `/api/locations/:id/active-stocks` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getLocationActiveStocks`](file:///backend/src/master-data/controllers/locations.controller.ts#L81) | Params: `id: string` |
| **POST** | `/api/locations/:id/relocate-and-delete` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`relocateAndDeleteLocation`](file:///backend/src/master-data/controllers/locations.controller.ts#L87) | Body: `dto: RelocateAndDeleteLocationDto` |
| **DELETE** | `/api/locations/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`deleteLocation`](file:///backend/src/master-data/controllers/locations.controller.ts#L98) | Params: `id: string` |

---

### 10.21. Controller: `ProductsController`

* **File:** [`backend/src/master-data/controllers/products.controller.ts`](file:///backend/src/master-data/controllers/products.controller.ts)
* **Endpoints Count:** 9

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findProducts`](file:///backend/src/master-data/controllers/products.controller.ts#L41) | - |
| **GET** | `/by-barcode/:barcode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findProductByBarcode`](file:///backend/src/master-data/controllers/products.controller.ts#L54) | Params: `barcode: string` |
| **POST** | `/backfill-barcodes` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`backfillBarcodes`](file:///backend/src/master-data/controllers/products.controller.ts#L61) | - |
| **GET** | `/next-code` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getNextProductCode`](file:///backend/src/master-data/controllers/products.controller.ts#L75) | - |
| **GET** | `/next-barcode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getNextBarcode`](file:///backend/src/master-data/controllers/products.controller.ts#L90) | - |
| **GET** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findProductById`](file:///backend/src/master-data/controllers/products.controller.ts#L104) | Params: `id: string` |
| **POST** | `/` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`createProduct`](file:///backend/src/master-data/controllers/products.controller.ts#L111) | Body: `dto: CreateProductDto` |
| **PATCH** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`updateProduct`](file:///backend/src/master-data/controllers/products.controller.ts#L118) | Body: `dto: UpdateProductDto` |
| **DELETE** | `/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`deleteProduct`](file:///backend/src/master-data/controllers/products.controller.ts#L128) | Params: `id: string` |

---

### 10.22. Controller: `RacksController`

* **File:** [`backend/src/master-data/controllers/racks.controller.ts`](file:///backend/src/master-data/controllers/racks.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/racks` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findRacks`](file:///backend/src/master-data/controllers/racks.controller.ts#L35) | - |
| **GET** | `/api/racks/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findRackById`](file:///backend/src/master-data/controllers/racks.controller.ts#L48) | Params: `id: string` |
| **POST** | `/api/racks` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`createRack`](file:///backend/src/master-data/controllers/racks.controller.ts#L54) | Body: `dto: CreateRackDto` |
| **PATCH** | `/api/racks/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`updateRack`](file:///backend/src/master-data/controllers/racks.controller.ts#L60) | Body: `dto: UpdateRackDto` |
| **DELETE** | `/api/racks/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`deleteRack`](file:///backend/src/master-data/controllers/racks.controller.ts#L69) | Params: `id: string` |

---

### 10.23. Controller: `WarehousesController`

* **File:** [`backend/src/master-data/controllers/warehouses.controller.ts`](file:///backend/src/master-data/controllers/warehouses.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/warehouses` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findWarehouses`](file:///backend/src/master-data/controllers/warehouses.controller.ts#L38) | - |
| **GET** | `/api/warehouses/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findWarehouseById`](file:///backend/src/master-data/controllers/warehouses.controller.ts#L51) | Params: `id: string` |
| **POST** | `/api/warehouses` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`createWarehouse`](file:///backend/src/master-data/controllers/warehouses.controller.ts#L57) | Body: `dto: CreateWarehouseDto` |
| **PATCH** | `/api/warehouses/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`updateWarehouse`](file:///backend/src/master-data/controllers/warehouses.controller.ts#L63) | Body: `dto: UpdateWarehouseDto` |
| **DELETE** | `/api/warehouses/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`deleteWarehouse`](file:///backend/src/master-data/controllers/warehouses.controller.ts#L72) | Params: `id: string` |

---

### 10.24. Controller: `MaterialIssueController`

* **File:** [`backend/src/material-issue/material-issue.controller.ts`](file:///backend/src/material-issue/material-issue.controller.ts)
* **Endpoints Count:** 3

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/material-issues` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createIssue`](file:///backend/src/material-issue/material-issue.controller.ts#L26) | Body: `dto: CreateMaterialIssueDto` |
| **GET** | `/api/material-issues` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/material-issue/material-issue.controller.ts#L39) | - |
| **GET** | `/api/material-issues/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/material-issue/material-issue.controller.ts#L52) | Params: `id: string` |

---

### 10.25. Controller: `MaterialMovementController`

* **File:** [`backend/src/material-movement/material-movement.controller.ts`](file:///backend/src/material-movement/material-movement.controller.ts)
* **Endpoints Count:** 1

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/material-movement/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/material-movement/material-movement.controller.ts#L11) | - |

---

### 10.26. Controller: `MercIndentController`

* **File:** [`backend/src/merc-indent/merc-indent.controller.ts`](file:///backend/src/merc-indent/merc-indent.controller.ts)
* **Endpoints Count:** 12

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/internal/merc/indent-pending` | `InternalSecretGuard` | `Authenticated (Default)` | [`receiveIndentPending`](file:///backend/src/merc-indent/merc-indent.controller.ts#L36) | Body: `dto: ReceiveMercIndentDto` |
| **GET** | `/api/merc-indents` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`getAll`](file:///backend/src/merc-indent/merc-indent.controller.ts#L49) | - |
| **POST** | `/api/merc-indents/sync` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`syncFromMerc`](file:///backend/src/merc-indent/merc-indent.controller.ts#L61) | - |
| **POST** | `/api/merc-indents/products/create-and-stock` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`createAndStockProduct`](file:///backend/src/merc-indent/merc-indent.controller.ts#L75) | Body: `dto: CreateMercProductDto` |
| **GET** | `/api/merc-indents/:id/full-detail` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`getFullDetail`](file:///backend/src/merc-indent/merc-indent.controller.ts#L88) | Params: `id: string` |
| **GET** | `/api/merc-indents/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`getOne`](file:///backend/src/merc-indent/merc-indent.controller.ts#L101) | Params: `id: string` |
| **GET** | `/api/merc-indents/:id/items/:itemId` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN,` | [`getItemDetail`](file:///backend/src/merc-indent/merc-indent.controller.ts#L114) | Params: `id: string, itemId: string` |
| **POST** | `/api/merc-indents/:id/items/:itemId/issue` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`issueMercItem`](file:///backend/src/merc-indent/merc-indent.controller.ts#L131) | Body: `dto: IssueMercItemDto` |
| **POST** | `/api/merc-indents/:id/items/:itemId/short-close` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`shortCloseMercItem`](file:///backend/src/merc-indent/merc-indent.controller.ts#L143) | Params: `id: string, itemId: string` |
| **POST** | `/api/merc-indents/:id/close` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`closeMercIndent`](file:///backend/src/merc-indent/merc-indent.controller.ts#L154) | Params: `id: string` |
| **DELETE** | `/api/merc-indents/:id/items/:itemId` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` | [`deleteLineItem`](file:///backend/src/merc-indent/merc-indent.controller.ts#L170) | Params: `id: string, itemId: string` |
| **DELETE** | `/api/merc-indents/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.PRODUCTION, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` | [`deleteIndent`](file:///backend/src/merc-indent/merc-indent.controller.ts#L187) | Params: `id: string` |

---

### 10.27. Controller: `EmailPreferencesController`

* **File:** [`backend/src/notifications/email-preferences.controller.ts`](file:///backend/src/notifications/email-preferences.controller.ts)
* **Endpoints Count:** 16

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/email-preferences/events` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getEvents`](file:///backend/src/notifications/email-preferences.controller.ts#L54) | - |
| **GET** | `/api/email-preferences/roles` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getRoleMatrix`](file:///backend/src/notifications/email-preferences.controller.ts#L64) | - |
| **PUT** | `/api/email-preferences/roles/:roleId/events/:eventCode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateRoleEvent`](file:///backend/src/notifications/email-preferences.controller.ts#L74) | Body: `dto: UpdateRoleEventSettingDto` |
| **PUT** | `/api/email-preferences/roles/:roleId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`bulkUpdateRoleEvents`](file:///backend/src/notifications/email-preferences.controller.ts#L95) | Body: `dto: BulkUpdateRoleEventsDto` |
| **GET** | `/api/email-preferences/users` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getUsers`](file:///backend/src/notifications/email-preferences.controller.ts#L114) | - |
| **GET** | `/api/email-preferences/users/:userId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getUserPreferences`](file:///backend/src/notifications/email-preferences.controller.ts#L124) | Params: `userId: string` |
| **PUT** | `/api/email-preferences/users/:userId/events/:eventCode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateUserOverride`](file:///backend/src/notifications/email-preferences.controller.ts#L134) | Body: `dto: UpdateUserEventOverrideDto` |
| **PUT** | `/api/email-preferences/users/:userId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`bulkUpdateUserOverrides`](file:///backend/src/notifications/email-preferences.controller.ts#L155) | Body: `dto: BulkUpdateUserOverridesDto` |
| **GET** | `/api/email-preferences/audit` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getAuditLogs`](file:///backend/src/notifications/email-preferences.controller.ts#L174) | - |
| **GET** | `/api/email-preferences/mode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getMode`](file:///backend/src/notifications/email-preferences.controller.ts#L184) | - |
| **PUT** | `/api/email-preferences/mode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateMode`](file:///backend/src/notifications/email-preferences.controller.ts#L194) | Body: `dto: UpdateEmailPrefsModeDto` |
| **GET** | `/api/email-preferences/sweeps` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getSweeps`](file:///backend/src/notifications/email-preferences.controller.ts#L208) | - |
| **PUT** | `/api/email-preferences/sweeps/:eventCode` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateSweep`](file:///backend/src/notifications/email-preferences.controller.ts#L218) | Body: `dto: UpdateSweepDto` |
| **GET** | `/api/email-preferences/sweeps/:eventCode/preview` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`previewSweep`](file:///backend/src/notifications/email-preferences.controller.ts#L233) | Params: `eventCode: string` |
| **GET** | `/api/email-preferences/skips/summary` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getSkipsSummary`](file:///backend/src/notifications/email-preferences.controller.ts#L243) | - |
| **GET** | `/api/email-preferences/skips` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`getSkips`](file:///backend/src/notifications/email-preferences.controller.ts#L253) | - |

---

### 10.28. Controller: `NotificationsController`

* **File:** [`backend/src/notifications/notifications.controller.ts`](file:///backend/src/notifications/notifications.controller.ts)
* **Endpoints Count:** 13

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/notifications/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/notifications/notifications.controller.ts#L35) | - |
| **GET** | `/api/notifications/unread-count` | `JwtAuthGuard` | `Authenticated (Default)` | [`getUnreadCount`](file:///backend/src/notifications/notifications.controller.ts#L41) | - |
| **PATCH** | `/api/notifications/read-all` | `JwtAuthGuard` | `Authenticated (Default)` | [`markAllAsRead`](file:///backend/src/notifications/notifications.controller.ts#L49) | - |
| **GET** | `/api/notifications` | `JwtAuthGuard` | `Authenticated (Default)` | [`getMyNotifications`](file:///backend/src/notifications/notifications.controller.ts#L56) | - |
| **PATCH** | `/api/notifications/:id/read` | `JwtAuthGuard` | `Authenticated (Default)` | [`markAsRead`](file:///backend/src/notifications/notifications.controller.ts#L72) | - |
| **GET** | `/api/notifications/settings` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`getGlobalSettings`](file:///backend/src/notifications/notifications.controller.ts#L83) | - |
| **PATCH** | `/api/notifications/settings` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateGlobalSettings`](file:///backend/src/notifications/notifications.controller.ts#L91) | Body: `dto: UpdateGlobalPreferenceDto` |
| **GET** | `/api/notifications/system-config` | `JwtAuthGuard` | `Authenticated (Default)` | [`getSystemConfig`](file:///backend/src/notifications/notifications.controller.ts#L107) | - |
| **PATCH** | `/api/notifications/system-config` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`updateSystemConfig`](file:///backend/src/notifications/notifications.controller.ts#L114) | Body: `dto: UpdateSystemConfigDto` |
| **POST** | `/api/notifications/system-config/reset-data` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`resetSystemData`](file:///backend/src/notifications/notifications.controller.ts#L125) | Body: `dto: ResetSystemDataDto` |
| **GET** | `/api/notifications/preferences/me` | `JwtAuthGuard` | `Authenticated (Default)` | [`getMyPreferences`](file:///backend/src/notifications/notifications.controller.ts#L135) | - |
| **PATCH** | `/api/notifications/preferences/me` | `JwtAuthGuard` | `Authenticated (Default)` | [`updateMyPreferences`](file:///backend/src/notifications/notifications.controller.ts#L143) | Body: `dto: UpdateUserPreferenceDto` |
| **PATCH** | `/api/notifications/preferences/:userId` | `JwtAuthGuard` | `Authenticated (Default)` | [`updateUserPreferencesById`](file:///backend/src/notifications/notifications.controller.ts#L160) | Body: `dto: UpdateUserPreferenceDto` |

---

### 10.29. Controller: `PermissionsController`

* **File:** [`backend/src/permissions/permissions.controller.ts`](file:///backend/src/permissions/permissions.controller.ts)
* **Endpoints Count:** 6

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/permissions/modules` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getAllModules`](file:///backend/src/permissions/permissions.controller.ts#L25) | - |
| **GET** | `/permissions/matrix` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`getRoleMatrix`](file:///backend/src/permissions/permissions.controller.ts#L31) | - |
| **PUT** | `/permissions/role/:roleId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateRolePermissions`](file:///backend/src/permissions/permissions.controller.ts#L37) | Body: `dto: UpdateRolePermissionsDto` |
| **GET** | `/permissions/my-modules` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getMyModules`](file:///backend/src/permissions/permissions.controller.ts#L48) | - |
| **GET** | `/permissions/user/:userId` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getUserPermissions`](file:///backend/src/permissions/permissions.controller.ts#L54) | Params: `targetUserId: string` |
| **PUT** | `/permissions/user/:userId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateUserPermissions`](file:///backend/src/permissions/permissions.controller.ts#L74) | Body: `dto: UpdateUserPermissionsDto` |

---

### 10.30. Controller: `PoController`

* **File:** [`backend/src/po/po.controller.ts`](file:///backend/src/po/po.controller.ts)
* **Endpoints Count:** 11

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/po/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/po/po.controller.ts#L38) | - |
| **POST** | `/api/po/emergency` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.GENERAL_MANAGER` | [`createEmergencyPO`](file:///backend/src/po/po.controller.ts#L45) | Body: `body: any` |
| **POST** | `/api/po` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.DESIGNER` | [`create`](file:///backend/src/po/po.controller.ts#L53) | Body: `createPoDto: CreatePoDto` |
| **GET** | `/api/po` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/po/po.controller.ts#L67) | - |
| **GET** | `/api/po/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/po/po.controller.ts#L81) | Params: `id: string` |
| **PATCH** | `/api/po/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`update`](file:///backend/src/po/po.controller.ts#L88) | Body: `updatePoDto: UpdatePoDto` |
| **DELETE** | `/api/po/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`deletePo`](file:///backend/src/po/po.controller.ts#L98) | Params: `id: string` |
| **POST** | `/api/po/:id/documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`attachDocument`](file:///backend/src/po/po.controller.ts#L105) | Body: `dto: CreatePoDocumentDto` |
| **GET** | `/api/po/:id/documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`listDocuments`](file:///backend/src/po/po.controller.ts#L134) | Params: `id: string` |
| **GET** | `/api/po/:id/documents/:attachmentId/download` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`downloadDocument`](file:///backend/src/po/po.controller.ts#L149) | Params: `id: string, attachmentId: string` |
| **DELETE** | `/api/po/:id/documents/:attachmentId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES` | [`detachDocument`](file:///backend/src/po/po.controller.ts#L170) | Params: `id: string, attachmentId: string` |

---

### 10.31. Controller: `ProductionController`

* **File:** [`backend/src/production/production.controller.ts`](file:///backend/src/production/production.controller.ts)
* **Endpoints Count:** 7

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/production/receipt` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.STORES, UserRole.ADMIN` | [`receiveMaterial`](file:///backend/src/production/production.controller.ts#L32) | Body: `dto: CreateProductionReceiptDto` |
| **POST** | `/api/production/consume` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.ADMIN` | [`recordConsumption`](file:///backend/src/production/production.controller.ts#L38) | Body: `dto: CreateMaterialConsumptionDto` |
| **POST** | `/api/production/return` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.ADMIN` | [`recordReturn`](file:///backend/src/production/production.controller.ts#L47) | Body: `dto: CreateMaterialReturnDto` |
| **POST** | `/api/production/return/:id/verify` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`verifyReturn`](file:///backend/src/production/production.controller.ts#L53) | Body: `dto: VerifyReturnDto` |
| **GET** | `/api/production/returns` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getReturns`](file:///backend/src/production/production.controller.ts#L70) | - |
| **GET** | `/api/production/receipts` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getReceipts`](file:///backend/src/production/production.controller.ts#L83) | - |
| **GET** | `/api/production/accounting/:scId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getAccounting`](file:///backend/src/production/production.controller.ts#L96) | Params: `scId: string` |

---

### 10.32. Controller: `ProductionProcessController`

* **File:** [`backend/src/production-process/production-process.controller.ts`](file:///backend/src/production-process/production-process.controller.ts)
* **Endpoints Count:** 11

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/production-processes` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION` | [`create`](file:///backend/src/production-process/production-process.controller.ts#L44) | Body: `createDto: CreateProductionProcessDto` |
| **GET** | `/api/production-processes` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findAll`](file:///backend/src/production-process/production-process.controller.ts#L55) | - |
| **GET** | `/api/production-processes/routing/first` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getFirstProcess`](file:///backend/src/production-process/production-process.controller.ts#L70) | - |
| **GET** | `/api/production-processes/routing/final` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getFinalProcess`](file:///backend/src/production-process/production-process.controller.ts#L78) | - |
| **GET** | `/api/production-processes/routing/vendor-eligible` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getEligibleVendorProcesses`](file:///backend/src/production-process/production-process.controller.ts#L87) | - |
| **POST** | `/api/production-processes/routing/validate-transition` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`validateTransition`](file:///backend/src/production-process/production-process.controller.ts#L95) | Body: `dto: ValidateProcessTransitionDto` |
| **GET** | `/api/production-processes/:id/navigation` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getNavigation`](file:///backend/src/production-process/production-process.controller.ts#L112) | Params: `id: string` |
| **GET** | `/api/production-processes/:id` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findOne`](file:///backend/src/production-process/production-process.controller.ts#L123) | Params: `id: string` |
| **PATCH** | `/api/production-processes/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION` | [`update`](file:///backend/src/production-process/production-process.controller.ts#L135) | Body: `updateDto: UpdateProductionProcessDto` |
| **PATCH** | `/api/production-processes/:id/toggle-active` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION` | [`toggleActive`](file:///backend/src/production-process/production-process.controller.ts#L148) | Params: `id: string` |
| **DELETE** | `/api/production-processes/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.PRODUCTION` | [`remove`](file:///backend/src/production-process/production-process.controller.ts#L160) | Params: `id: string` |

---

### 10.33. Controller: `ReportsController`

* **File:** [`backend/src/reports/reports.controller.ts`](file:///backend/src/reports/reports.controller.ts)
* **Endpoints Count:** 8

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/reports/process-wise` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`getProcessWise`](file:///backend/src/reports/reports.controller.ts#L18) | - |
| **GET** | `/api/reports/item-wise` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`getItemWise`](file:///backend/src/reports/reports.controller.ts#L24) | - |
| **GET** | `/api/reports/rm-consumption` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`getRmConsumption`](file:///backend/src/reports/reports.controller.ts#L30) | - |
| **GET** | `/api/reports/export/excel/traceability` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`exportTraceabilityExcel`](file:///backend/src/reports/reports.controller.ts#L38) | - |
| **GET** | `/api/reports/export/excel/stock-movement` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.STORES` | [`exportStockMovementExcel`](file:///backend/src/reports/reports.controller.ts#L71) | - |
| **GET** | `/api/reports/export/excel/vendor-sla` | `JwtAuthGuard, RolesGuard` | `UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`exportVendorSlaExcel`](file:///backend/src/reports/reports.controller.ts#L104) | - |
| **GET** | `/api/reports/export/pdf/delivery-challan/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`exportDeliveryChallanPdf`](file:///backend/src/reports/reports.controller.ts#L137) | Params: `id: string` |
| **GET** | `/api/reports/export/pdf/material-issue/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN` | [`exportMaterialIssueSlipPdf`](file:///backend/src/reports/reports.controller.ts#L165) | Params: `id: string` |

---

### 10.34. Controller: `ReworkController`

* **File:** [`backend/src/rework/rework.controller.ts`](file:///backend/src/rework/rework.controller.ts)
* **Endpoints Count:** 2

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/rework/sc-list` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getScList`](file:///backend/src/rework/rework.controller.ts#L22) | - |
| **POST** | `/api/rework/submit` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`submitRework`](file:///backend/src/rework/rework.controller.ts#L28) | Body: `dto: SubmitReworkDto` |

---

### 10.35. Controller: `RmController`

* **File:** [`backend/src/rm/rm.controller.ts`](file:///backend/src/rm/rm.controller.ts)
* **Endpoints Count:** 22

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/rm` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`createRm`](file:///backend/src/rm/rm.controller.ts#L45) | Body: `dto: CreateRmDto` |
| **POST** | `/api/rm/draft` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`createDraftRm`](file:///backend/src/rm/rm.controller.ts#L51) | Body: `dto: CreateDraftRmDto` |
| **GET** | `/api/rm/po/:poId/draft` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`getDraftRmByPo`](file:///backend/src/rm/rm.controller.ts#L57) | Params: `poId: string` |
| **PUT** | `/api/rm/po/:poId/draft` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`updateDraftRm`](file:///backend/src/rm/rm.controller.ts#L63) | Body: `dto: UpdateDraftRmDto` |
| **POST** | `/api/rm/po/:poId/submit` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`submitDraftRmByPo`](file:///backend/src/rm/rm.controller.ts#L69) | Params: `poId: string` |
| **GET** | `/api/rm/next-part-number` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER,` | [`getNextPartNumber`](file:///backend/src/rm/rm.controller.ts#L82) | - |
| **GET** | `/api/rm/mine` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`getMine`](file:///backend/src/rm/rm.controller.ts#L88) | - |
| **GET** | `/api/rm/stores/queue` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`getStoresQueue`](file:///backend/src/rm/rm.controller.ts#L94) | - |
| **POST** | `/api/rm/:id/items` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`addRmItem`](file:///backend/src/rm/rm.controller.ts#L100) | Body: `dto: CreateRmItemDto` |
| **POST** | `/api/rm/:id/submit` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN` | [`submitRm`](file:///backend/src/rm/rm.controller.ts#L109) | Body: `dto: SubmitRmDto` |
| **POST** | `/api/rm/:id/review` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`reviewRm`](file:///backend/src/rm/rm.controller.ts#L115) | Body: `dto: StoresReviewRmDto` |
| **POST** | `/api/rm/:id/reject` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.ADMIN` | [`rejectRm`](file:///backend/src/rm/rm.controller.ts#L125) | Body: `remarks: string` |
| **GET** | `/api/rm` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/rm/rm.controller.ts#L142) | - |
| **GET** | `/api/rm/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/rm/rm.controller.ts#L163) | Params: `id: string` |
| **DELETE** | `/api/rm/po/:poId` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`deleteRmByPo`](file:///backend/src/rm/rm.controller.ts#L169) | Params: `poId: string` |
| **DELETE** | `/api/rm/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`deleteRm`](file:///backend/src/rm/rm.controller.ts#L175) | Params: `id: string` |
| **DELETE** | `/api/rm/:id/items/:itemId` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN` | [`deleteRmItem`](file:///backend/src/rm/rm.controller.ts#L181) | Params: `id: string, itemId: string` |
| **PATCH** | `/api/rm/:id/items/:itemId` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN` | [`updateRmItem`](file:///backend/src/rm/rm.controller.ts#L191) | Body: `dto: UpdateRmItemDto` |
| **POST** | `/api/rm/:id/documents` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN` | [`attachDocument`](file:///backend/src/rm/rm.controller.ts#L202) | Body: `dto: CreateRmDocumentDto` |
| **GET** | `/api/rm/:id/documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`listDocuments`](file:///backend/src/rm/rm.controller.ts#L229) | Params: `id: string` |
| **GET** | `/api/rm/:id/documents/:attachmentId/download` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`downloadDocument`](file:///backend/src/rm/rm.controller.ts#L243) | Params: `id: string, attachmentId: string` |
| **DELETE** | `/api/rm/:id/documents/:attachmentId` | `JwtAuthGuard, RolesGuard` | `UserRole.DESIGNER, UserRole.ADMIN` | [`detachDocument`](file:///backend/src/rm/rm.controller.ts#L263) | Params: `id: string, attachmentId: string` |

---

### 10.36. Controller: `RolesController`

* **File:** [`backend/src/roles/roles.controller.ts`](file:///backend/src/roles/roles.controller.ts)
* **Endpoints Count:** 1

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/roles/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/roles/roles.controller.ts#L9) | - |

---

### 10.37. Controller: `ScDocumentsController`

* **File:** [`backend/src/sc/sc-documents.controller.ts`](file:///backend/src/sc/sc-documents.controller.ts)
* **Endpoints Count:** 5

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/sc/:scId/production-documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` | [`attachDocument`](file:///backend/src/sc/sc-documents.controller.ts#L29) | Body: `dto: CreateProductionDocumentDto` |
| **GET** | `/api/sc/:scId/production-documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`listDocuments`](file:///backend/src/sc/sc-documents.controller.ts#L55) | Params: `scId: string` |
| **GET** | `/api/sc/:scId/production-documents/:attachmentId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`getDocument`](file:///backend/src/sc/sc-documents.controller.ts#L68) | Params: `scId: string, attachmentId: string` |
| **PATCH** | `/api/sc/:scId/production-documents/:attachmentId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` | [`updateDocument`](file:///backend/src/sc/sc-documents.controller.ts#L81) | Body: `dto: UpdateProductionDocumentDto` |
| **DELETE** | `/api/sc/:scId/production-documents/:attachmentId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` | [`detachDocument`](file:///backend/src/sc/sc-documents.controller.ts#L101) | Params: `scId: string, attachmentId: string` |

---

### 10.38. Controller: `ScController`

* **File:** [`backend/src/sc/sc.controller.ts`](file:///backend/src/sc/sc.controller.ts)
* **Endpoints Count:** 13

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/sc` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES` | [`createSc`](file:///backend/src/sc/sc.controller.ts#L41) | Body: `dto: CreateScDto` |
| **GET** | `/api/sc` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findAll`](file:///backend/src/sc/sc.controller.ts#L54) | - |
| **GET** | `/api/sc/test/:id` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`testFindOne`](file:///backend/src/sc/sc.controller.ts#L64) | Params: `id: string` |
| **GET** | `/api/sc/stores/pending-grouped` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`getStoresPendingGrouped`](file:///backend/src/sc/sc.controller.ts#L70) | - |
| **GET** | `/api/sc/production/grouped` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`getProductionGrouped`](file:///backend/src/sc/sc.controller.ts#L76) | - |
| **GET** | `/api/sc/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`findOne`](file:///backend/src/sc/sc.controller.ts#L89) | Params: `id: string` |
| **DELETE** | `/api/sc/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER` | [`deleteSc`](file:///backend/src/sc/sc.controller.ts#L95) | Params: `id: string` |
| **POST** | `/api/sc/:id/complete` | `JwtAuthGuard, RolesGuard` | `UserRole.PRODUCTION, UserRole.ADMIN` | [`completeSc`](file:///backend/src/sc/sc.controller.ts#L101) | Body: `dto: CompleteScDto` |
| **POST** | `/api/sc/:id/close` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.ADMIN` | [`closeSc`](file:///backend/src/sc/sc.controller.ts#L111) | Body: `dto: CloseScDto` |
| **POST** | `/api/sc/:id/documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` | [`attachDocument`](file:///backend/src/sc/sc.controller.ts#L121) | Body: `dto: CreateScSupportingDocumentDto` |
| **GET** | `/api/sc/:id/documents` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`listDocuments`](file:///backend/src/sc/sc.controller.ts#L149) | Params: `id: string` |
| **GET** | `/api/sc/:id/documents/:attachmentId/download` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER,` | [`downloadDocument`](file:///backend/src/sc/sc.controller.ts#L163) | Params: `id: string, attachmentId: string` |
| **DELETE** | `/api/sc/:id/documents/:attachmentId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION` | [`detachDocument`](file:///backend/src/sc/sc.controller.ts#L183) | Params: `id: string, attachmentId: string` |

---

### 10.39. Controller: `StoresController`

* **File:** [`backend/src/stores/stores.controller.ts`](file:///backend/src/stores/stores.controller.ts)
* **Endpoints Count:** 1

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/stores/status` | `None` | `Authenticated (Default)` | [`getStatus`](file:///backend/src/stores/stores.controller.ts#L9) | - |

---

### 10.40. Controller: `TraceabilityController`

* **File:** [`backend/src/traceability/traceability.controller.ts`](file:///backend/src/traceability/traceability.controller.ts)
* **Endpoints Count:** 11

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/traceability/rm/lifecycle-summary` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getRmLifecycleSummary`](file:///backend/src/traceability/traceability.controller.ts#L47) | - |
| **GET** | `/api/traceability/rm/reconciliation-queue` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getRmReconciliationQueue`](file:///backend/src/traceability/traceability.controller.ts#L66) | - |
| **GET** | `/api/traceability/po/:poId/consolidated` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getConsolidatedPoTraceability`](file:///backend/src/traceability/traceability.controller.ts#L85) | Params: `poId: string` |
| **GET** | `/api/traceability/sc/:scId/consolidated` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getConsolidatedScTraceability`](file:///backend/src/traceability/traceability.controller.ts#L105) | Params: `scId: string` |
| **GET** | `/api/traceability/sc/:scId/rm-usage` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getFinalRmUsage`](file:///backend/src/traceability/traceability.controller.ts#L123) | Params: `scId: string` |
| **GET** | `/api/traceability/vendors/performance-analytics` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getVendorPerformanceAnalytics`](file:///backend/src/traceability/traceability.controller.ts#L143) | - |
| **GET** | `/api/traceability/vendors/:vendorId/traceability` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getVendorTraceability`](file:///backend/src/traceability/traceability.controller.ts#L161) | Params: `vendorId: string` |
| **GET** | `/api/traceability/analytics/process-outward` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getProcessOutwardAnalytics`](file:///backend/src/traceability/traceability.controller.ts#L180) | - |
| **GET** | `/api/traceability/analytics/item-outward` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getItemOutwardAnalytics`](file:///backend/src/traceability/traceability.controller.ts#L197) | - |
| **GET** | `/api/traceability/analytics/rm-consumption` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getRmConsumptionAnalytics`](file:///backend/src/traceability/traceability.controller.ts#L214) | - |
| **GET** | `/api/traceability/analytics/inventory-msl-status` | `JwtAuthGuard, RolesGuard` | `UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.ADMIN, UserRole.GENERAL_MANAGER,` | [`getInventoryMslStatus`](file:///backend/src/traceability/traceability.controller.ts#L234) | - |

---

### 10.41. Controller: `UsersController`

* **File:** [`backend/src/users/users.controller.ts`](file:///backend/src/users/users.controller.ts)
* **Endpoints Count:** 10

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/users` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`create`](file:///backend/src/users/users.controller.ts#L31) | Body: `createUserDto: CreateUserDto` |
| **GET** | `/api/users` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findAll`](file:///backend/src/users/users.controller.ts#L36) | - |
| **GET** | `/api/users/:id` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findOne`](file:///backend/src/users/users.controller.ts#L41) | Params: `id: string` |
| **PUT** | `/api/users/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`update`](file:///backend/src/users/users.controller.ts#L47) | Body: `updateUserDto: UpdateUserDto` |
| **PATCH** | `/api/users/:id/active` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`toggleActive`](file:///backend/src/users/users.controller.ts#L53) | Body: `dto: ToggleUserActiveDto` |
| **PATCH** | `/api/users/:id/role` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`updateRole`](file:///backend/src/users/users.controller.ts#L64) | Body: `dto: UpdateUserRoleDto` |
| **PATCH** | `/api/users/:id/activate` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`activate`](file:///backend/src/users/users.controller.ts#L70) | Params: `id: string` |
| **PATCH** | `/api/users/:id/deactivate` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`deactivate`](file:///backend/src/users/users.controller.ts#L76) | Params: `id: string` |
| **POST** | `/api/users/:id/reset-password` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`resetPassword`](file:///backend/src/users/users.controller.ts#L83) | Params: `id: string` |
| **DELETE** | `/api/users/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN` | [`remove`](file:///backend/src/users/users.controller.ts#L89) | Params: `id: string` |

---

### 10.42. Controller: `VendorController`

* **File:** [`backend/src/vendor/vendor.controller.ts`](file:///backend/src/vendor/vendor.controller.ts)
* **Endpoints Count:** 24

| Method | Route Path | Guard / Auth | Roles Allowed | Handler Method | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/vendors` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`create`](file:///backend/src/vendor/vendor.controller.ts#L64) | Body: `createDto: CreateVendorDto` |
| **GET** | `/api/vendors` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findAll`](file:///backend/src/vendor/vendor.controller.ts#L73) | - |
| **GET** | `/api/vendors/capabilities/by-process/:processId` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getVendorsForProcess`](file:///backend/src/vendor/vendor.controller.ts#L85) | Params: `processId: string` |
| **PATCH** | `/api/vendors/slas/:slaId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`updateSla`](file:///backend/src/vendor/vendor.controller.ts#L98) | Body: `dto: UpdateVendorSlaDto` |
| **DELETE** | `/api/vendors/slas/:slaId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`removeSla`](file:///backend/src/vendor/vendor.controller.ts#L112) | Params: `slaId: string` |
| **POST** | `/api/vendors/slas/cleanup-duplicates` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`cleanupDuplicateSlas`](file:///backend/src/vendor/vendor.controller.ts#L125) | - |
| **GET** | `/api/vendors/slas` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getAllSlas`](file:///backend/src/vendor/vendor.controller.ts#L134) | - |
| **GET** | `/api/vendors/compare/by-process/:processId` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`compareVendors`](file:///backend/src/vendor/vendor.controller.ts#L143) | Params: `processId: string` |
| **POST** | `/api/vendors/slas/:slaId/override` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER` | [`recordOverride`](file:///backend/src/vendor/vendor.controller.ts#L156) | Body: `dto: RecordSlaOverrideDto` |
| **GET** | `/api/vendors/slas/:slaId/overrides` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getOverrides`](file:///backend/src/vendor/vendor.controller.ts#L170) | Params: `slaId: string` |
| **GET** | `/api/vendors/:id` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`findOne`](file:///backend/src/vendor/vendor.controller.ts#L181) | Params: `id: string` |
| **GET** | `/api/vendors/:id/compliance` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getVendorCompliance`](file:///backend/src/vendor/vendor.controller.ts#L189) | Params: `vendorId: string` |
| **PATCH** | `/api/vendors/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`update`](file:///backend/src/vendor/vendor.controller.ts#L202) | Body: `updateDto: UpdateVendorDto` |
| **PATCH** | `/api/vendors/:id/toggle-active` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`toggleActive`](file:///backend/src/vendor/vendor.controller.ts#L216) | Params: `id: string` |
| **DELETE** | `/api/vendors/:id` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`remove`](file:///backend/src/vendor/vendor.controller.ts#L227) | Params: `id: string` |
| **POST** | `/api/vendors/:id/capabilities` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`assignCapability`](file:///backend/src/vendor/vendor.controller.ts#L244) | Body: `dto: AssignVendorCapabilityDto` |
| **GET** | `/api/vendors/:id/capabilities` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getVendorCapabilities`](file:///backend/src/vendor/vendor.controller.ts#L256) | Params: `vendorId: string` |
| **GET** | `/api/vendors/:id/capabilities/:processId/validate` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`validateVendorProcess`](file:///backend/src/vendor/vendor.controller.ts#L267) | Params: `vendorId: string, processId: string` |
| **PATCH** | `/api/vendors/:id/capabilities/:processId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`updateCapability`](file:///backend/src/vendor/vendor.controller.ts#L281) | Body: `dto: UpdateVendorCapabilityDto` |
| **DELETE** | `/api/vendors/:id/capabilities/:processId` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`removeCapability`](file:///backend/src/vendor/vendor.controller.ts#L296) | Params: `vendorId: string, processId: string` |
| **POST** | `/api/vendors/:id/slas` | `JwtAuthGuard, RolesGuard` | `UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER` | [`createSla`](file:///backend/src/vendor/vendor.controller.ts#L314) | Body: `dto: CreateVendorSlaDto` |
| **GET** | `/api/vendors/:id/slas` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getVendorSlas`](file:///backend/src/vendor/vendor.controller.ts#L326) | Params: `vendorId: string` |
| **GET** | `/api/vendors/:id/slas/:processId` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`getSlaForVendorProcess`](file:///backend/src/vendor/vendor.controller.ts#L337) | Params: `vendorId: string, processId: string` |
| **GET** | `/api/vendors/:id/slas/:processId/expected-return` | `JwtAuthGuard, RolesGuard` | `Authenticated (Default)` | [`calculateExpectedReturnDate`](file:///backend/src/vendor/vendor.controller.ts#L349) | Params: `vendorId: string, processId: string` |

---

