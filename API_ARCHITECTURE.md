# API ARCHITECTURE & CONTRACT DESIGN

**Status: FINAL PHASE 2.5 DESIGN**

## 1. Security Architecture
- **Authentication**: JWT-based. All endpoints (except login) require a valid Bearer token.
- **Authorization (RBAC)**: Enforced via strictly applied `@Roles()` decorators at the Controller level.
- **Backend Authority**: The server is the absolute source of truth.
  - Client-controlled fields like `status`, `userId`, `createdById`, `balance`, and `timestamp` must never be trusted from the JSON payload. They are extracted securely from the JWT (`req.user.sub`) or managed internally by the backend state machine.
- **Object-Level Access**: Users can only modify objects in permissible states (e.g., Designer can only update an RM if status is `DRAFT`).
- **Immutable Records**: Historical records (Submissions, Issues, Receipts, Consumptions) are strictly `POST` only. No `PUT` or `PATCH` endpoints exist for historical transactional data.

## 2. Domain Endpoints

### 2.1 SC (Sub-Contract) & PO
**GET /api/sc**
- **Purpose**: List Sub-Contracts.
- **Actor**: All roles.
- **Response**: Array of SC objects.

**POST /api/sc/:id/complete**
- **Purpose**: Mark an SC as completed.
- **Actor**: `PRODUCTION`, `ADMIN`.
- **Validation**: Checks if all material accounting is balanced (no unaccounted material).
- **State Transition**: `ACTIVE` -> `COMPLETED`.

### 2.2 RM (Raw Material)
**POST /api/sc/:scId/rm**
- **Purpose**: Create a new RM requirement.
- **Actor**: `DESIGNER`.
- **Request**: Array of material items with dimensions/quantities.
- **State Transition**: Initializes as `DRAFT`.

**PUT /api/rm/:id**
- **Purpose**: Update draft RM requirement.
- **Actor**: `DESIGNER`.
- **Validation**: Fails if RM status is NOT `DRAFT`.

**POST /api/rm/:id/submit**
- **Purpose**: Submit RM to Stores.
- **Actor**: `DESIGNER`.
- **State Transition**: `DRAFT` -> `SUBMITTED`.
- **Idempotency**: Protect against double-submission.

### 2.3 Stores (Material Issue)
**POST /api/rm/:id/issue**
- **Purpose**: Issue material against an RM.
- **Actor**: `STORES`.
- **Request**: Items and quantities being physically issued.
- **Validation**: Issued quantity <= requested quantity (unless over-issue is explicitly permitted). Sufficient inventory exists.
- **Internal Integration**: Calls `InventoryService.executeStockOut()` transactionally.
- **State Transition**: RM transitions to `PARTIAL_ISSUE` or `ISSUED`.

### 2.4 Production (Receipt, Consumption)
**POST /api/issue/:id/receive**
- **Purpose**: Acknowledge physical receipt of issued material.
- **Actor**: `PRODUCTION`.
- **Validation**: Received qty <= Issued qty.

**POST /api/receipt/:id/consume**
- **Purpose**: Record consumption of material.
- **Actor**: `PRODUCTION`.
- **Request**: Consumed quantity and reason (normal, wastage, damage).
- **Validation**: Cumulative `consumed + returned` <= `received`.

### 2.5 Production (Return) & Stores (Confirm Return)
**POST /api/receipt/:id/return**
- **Purpose**: Initiate return of unused material.
- **Actor**: `PRODUCTION`.
- **State Transition**: Creates Return record (`PENDING_CONFIRMATION`).

**POST /api/return/:id/confirm**
- **Purpose**: Stores confirms physical receipt of returned material.
- **Actor**: `STORES`.
- **Internal Integration**: Calls `InventoryService.executeStockIn()` transactionally.
- **State Transition**: Return record -> `CONFIRMED`.

### 2.6 Additional Material Request
**POST /api/sc/:scId/additional-request**
- **Purpose**: Request extra material for an SC.
- **Actor**: `PRODUCTION`.
- **Request**: Items, quantities, and explicit reason.
- **State Transition**: Creates Additional Request (`SUBMITTED`).

### 2.7 Inventory (Existing)
*The Inventory API was completed in Phase 10.*
- Future domains (Stores, Production) will **not** invoke `POST /api/inventory/transaction` via HTTP. Instead, they will securely invoke `InventoryService` methods natively on the backend within atomic database transactions to ensure consistency between material workflows and stock ledgers.

### 2.8 Undefined Domains (Out of Scope for API generation)
No endpoints are defined for:
- **Files / Attachments**
- **Email Notifications**
- **Push / System Notifications**
*(Requirements are currently marked as UNDEFINED).*
