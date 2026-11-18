# Phase P2 Report: Backend Approval Engine Implementation

**Date:** 2026-11-18  
**Phase:** P2 – Backend Approval Engine  
**Status:** PASS (Pre-push verification gate passed; STOPPED for approval)

---

## 1. Executive Summary

Phase P2 establishes the complete backend business logic and REST API for the Consumables Senior Manager Approval Engine. Under the default setting (`CONSUMABLE_SM_APPROVAL_MODE=OFF`), system behaviour is 100% identical to legacy operation with zero regression on existing queues, in-flight items, or unit tests. When `CONSUMABLE_SM_APPROVAL_MODE=ON`, line items are held in `PENDING_SM_APPROVAL` status until an authorized Senior Manager or Administrator acts via the bulk approval endpoints.

All 19 newly authored automated tests in `backend/src/consumables/consumables-approval.spec.ts` and all 35 existing tests in `consumables.service.spec.ts` pass cleanly (54 total passed).

---

## 2. Step 0 Audit Findings & Resolution

### Finding A: Requesting User Tracking on `consumable_requests`
- **Audit Question:** Does `consumable_requests` store the requesting user's ID (not only the free-text `requested_by`)?
- **Finding:** No. `consumable_requests` only stored free-text `requested_by: varchar(150)`, `prepared_by`, `verified_by`, and `approved_by`. The authenticated user ID was received by `createRequest(dto, userId)` in the controller but was discarded.
- **Resolution:**
  - Added additive nullable column `created_by_user_id: uuid` (with foreign key to `users(id)` on delete `SET NULL`) via migration `1794300001000-AddConsumableRequestCreatedByUserId.ts`.
  - Foreign key constraint is deterministically named `FK_87035767e14fa7864d9c738c97a` matching TypeORM's naming convention (verified with TypeORM schema builder: 0 pending schema changes).
  - Updated `ConsumableRequest` entity and populated `createdByUserId: userId || null` in `createRequest`.

### Finding B: Stock Availability & Role Guard Patterns
- **Audit Question:** How is stock availability computed in `createRequest`, and how should role permissions be guarded?
- **Finding:** Stock availability is computed via `getAvailableStock(productId)`, aggregating `StockBalance.currentQuantity` across all warehouse bins for the product.
- **Resolution:**
  - Reused `getAvailableStock(productId)` during `bulkApprove` for `STOCK_ITEM` lines.
  - Implemented an **in-batch running allocation tally** (`batchAllocatedMap = new Map<string, number>()`) inside the database transaction. If multiple lines in the same batch request the same item, the available balance is deducted line-by-line; once depleted, subsequent lines automatically switch to track `NON_STOCK_OR_NEW` and status `OPEN`.
  - Guarded all approval endpoints with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(UserRole.SENIOR_MANAGER, UserRole.ADMIN)`. `GENERAL_MANAGER`, `STORES`, and `PRODUCTION` roles are strictly blocked (403).

---

## 3. Implementation Details

### 3.1 Configuration Service Integration
Added `getApprovalConfig()` in `ConsumablesService`:
- Reads `CONSUMABLE_SM_APPROVAL_MODE` (`OFF` | `ON`, default `OFF`).
- Reads `CONSUMABLE_SM_APPROVAL_SCOPE` (`ALL` | `PURCHASE_ONLY`, default `ALL`).
- If an invalid value is supplied, it logs a warning and falls back safely to `OFF` and `ALL`.

### 3.2 Dual-Track `createRequest` Routing
Per-line approval routing is applied without altering existing track classification:
- **`mode=OFF`:** Every line receives `approvalStatus = APPROVED` and `approvedAt = now` (identical to legacy operation).
- **`mode=ON, scope=ALL`:** Every line receives `approvalStatus = PENDING_SM_APPROVAL` and `approvedAt = null`. Applies uniformly even if created by a Senior Manager or Administrator.
- **`mode=ON, scope=PURCHASE_ONLY`:** `STOCK_ITEM` lines receive `APPROVED`; `NON_STOCK_OR_NEW` lines receive `PENDING_SM_APPROVAL`.

### 3.3 Transactional Bulk Approval (`POST /api/consumables/approvals/bulk-approve`)
- Restricts payload to 1–200 UUIDs (`ArrayMinSize(1)`, `ArrayMaxSize(200)`).
- Runs in a single transaction with pessimistic row-locking (`FOR UPDATE`) on matching pending items.
- Evaluates live stock with running allocation map. If stock is insufficient, flips track to `NON_STOCK_OR_NEW`, sets status `OPEN`, logs audit event `CONSUMABLE_TRACK_SWITCHED`, and appends to `switchedToPurchase` return payload.
- Updates pending lines to `APPROVED`, sets `approvedById`, `approvedAt = now`, `approvalBatchId = uuidv4()`, and logs audit event `CONSUMABLE_APPROVED`.
- Non-pending or already-approved items are safely ignored; duplicate calls approve 0 items (`approvedCount: 0`).

### 3.4 Transactional Bulk Rejection (`POST /api/consumables/approvals/bulk-reject`)
- Restricts payload to 1–200 UUIDs with mandatory `rejectionReason` (min 5 characters).
- Runs in a single transaction with pessimistic row-locking on `PENDING_SM_APPROVAL` lines.
- Updates lines to `REJECTED`, sets `rejectedById`, `rejectedAt = now`, `rejectionReason`, `approvalBatchId = uuidv4()`, and logs audit event `CONSUMABLE_REJECTED`.

### 3.5 Workflow Action Gates
- **`printPurchaseRequisition`:** Checks all target items. If any line has `approvalStatus !== null && approvalStatus !== APPROVED`, throws `BadRequestException` naming the unapproved items. No lines are modified.
- **`receivePurchase`:** Throws `BadRequestException` if the target item is unapproved.
- **`issueToProduction`:** Throws `BadRequestException` if the target item is unapproved.
- *Note:* Existing legacy rows with `approvalStatus IS NULL` are treated as `APPROVED`.

### 3.6 Deletion Protections
- **`deleteLineItem`:** Throws `BadRequestException` (HTTP 400) if `approvalStatus === REJECTED`. Rejected lines are preserved for audit trail.
- **`bulkDeleteLineItems`:** Evaluates all target IDs upfront; throws `BadRequestException` (HTTP 400) naming all rejected items if any are found in the batch.

---

## 4. REST API Contract & Specifications

All approval routes are declared before dynamic `:id` routes in `ConsumablesController` to guarantee deterministic route resolution.

### Endpoint Summary
| Method | Route | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/consumables/approvals/bulk-approve` | `SENIOR_MANAGER`, `ADMIN` | Approves 1–200 pending consumable items |
| `POST` | `/api/consumables/approvals/bulk-reject` | `SENIOR_MANAGER`, `ADMIN` | Rejects 1–200 pending items with reason |
| `GET` | `/api/consumables/approvals` | `SENIOR_MANAGER`, `ADMIN` | Paginated query of consumable items by approval status |
| `GET` | `/api/consumables/approvals/pending-count` | `SENIOR_MANAGER`, `ADMIN` | Badge count of items in `PENDING_SM_APPROVAL` |
| `GET` | `/api/consumables/approvals/config` | `SENIOR_MANAGER`, `ADMIN`, `STORES`, `PRODUCTION`, `GENERAL_MANAGER` | Returns `{ mode, scope }` |

---

### API Contract Details

#### 1. Bulk Approve
`POST /api/consumables/approvals/bulk-approve`

**Headers:**
`Authorization: Bearer <JWT>` (Roles: `SENIOR_MANAGER` or `ADMIN`)

**Request Body:**
```json
{
  "itemIds": [
    "c8a14e1f-4b0d-45f8-b3ec-19f8d9510001",
    "d9b25f2a-5c1e-46a9-c4fd-20a9e0620002"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "batchId": "7a3e9c40-128a-4db3-97c1-19b8417c8003",
  "approvedCount": 2,
  "ignoredCount": 0,
  "switchedToPurchase": [
    {
      "id": "d9b25f2a-5c1e-46a9-c4fd-20a9e0620002",
      "description": "Bearing 6204-2RS"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: `{"message": "At least 1 item ID must be provided"}` or `{"message": "Cannot approve more than 200 items in a single batch"}`
- `403 Forbidden`: Role not authorized (`GENERAL_MANAGER`, `STORES`, `PRODUCTION`)

---

#### 2. Bulk Reject
`POST /api/consumables/approvals/bulk-reject`

**Headers:**
`Authorization: Bearer <JWT>` (Roles: `SENIOR_MANAGER` or `ADMIN`)

**Request Body:**
```json
{
  "itemIds": [
    "c8a14e1f-4b0d-45f8-b3ec-19f8d9510001"
  ],
  "rejectionReason": "Standard nitrile gloves are already available in Tool Room B; use existing inventory."
}
```

**Success Response (200 OK):**
```json
{
  "batchId": "8f4a1d50-239b-4ec4-a8d2-30c9528d9004",
  "rejectedCount": 1,
  "ignoredCount": 0
}
```

**Error Responses:**
- `400 Bad Request`: `{"message": "Rejection reason must be at least 5 characters long"}`

---

#### 3. Query Approvals
`GET /api/consumables/approvals?status=PENDING&track=STOCK_ITEM&search=Drill&page=1&pageSize=25`

**Headers:**
`Authorization: Bearer <JWT>` (Roles: `SENIOR_MANAGER` or `ADMIN`)

**Success Response (200 OK):**
```json
{
  "items": [
    {
      "id": "c8a14e1f-4b0d-45f8-b3ec-19f8d9510001",
      "requestCode": "CR-2026-0042",
      "description": "Drill Bit 10mm HSS",
      "productCode": "DRILL-10MM",
      "itemCategoryTrack": "STOCK_ITEM",
      "status": "READY_FOR_ISSUE",
      "requestedQty": 5,
      "uom": "NOS",
      "unitPrice": 120.00,
      "estimatedTotal": 600.00,
      "requestedBy": "Ramanathan K",
      "endUserInVelan": "Bay 3 CNC Line",
      "createdAt": "2026-11-18T10:15:30.000Z",
      "approvalStatus": "PENDING_SM_APPROVAL",
      "approvedById": null,
      "approvedBy": null,
      "approvedAt": null,
      "rejectedById": null,
      "rejectedBy": null,
      "rejectedAt": null,
      "rejectionReason": null,
      "approvalBatchId": null
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 25,
  "totalPages": 1
}
```

---

#### 4. Pending Approvals Count
`GET /api/consumables/approvals/pending-count`

**Success Response (200 OK):**
```json
{
  "count": 7
}
```

---

#### 5. Approval Configuration
`GET /api/consumables/approvals/config`

**Success Response (200 OK):**
```json
{
  "mode": "OFF",
  "scope": "ALL"
}
```

---

## 5. Pre-Push Verification Gate Results

| Verification Check | Target Command | Result |
| :--- | :--- | :--- |
| **Backend TypeScript Build** | `npm --prefix backend run build` | **PASS** (Exit code 0, 0 compilation errors) |
| **Compiled Production Boot** | `NODE_ENV=production EMAIL_PROVIDER_TYPE=test PORT=3005 node backend/dist/main.js` | **PASS** (`HTTP 200` from `/api/health`) |
| **Circular Dependency Check** | `npx madge --circular --extensions ts src/` | **PASS** (54 baseline TypeORM cycles, **0 new cycles**) |
| **Unit Test Suite** | `npm --prefix backend test -- src/consumables/` | **PASS** (3 test suites, **54 tests passed**, 0 failures) |
| **TypeORM Schema Diff** | `check-schema-diff.cjs` | **PASS** (0 pending ALTERs for consumable tables) |
| **Frontend TypeScript Build** | `npm --prefix frontend run build` | **PASS** (Built in 3.31s, Exit code 0) |
| **Frontend Linter** | `npm --prefix frontend run lint` | **PASS** (0 errors, 179 non-blocking styling warnings) |

---

## 6. Conclusion & Status

Phase P2 is **COMPLETE**. All backend endpoints, transactional business logic, live stock allocation protections, deletion guards, and tests are implemented and fully verified. 

Per instructions: **No code has been committed, pushed, or deployed**. We are stopped awaiting your review and approval.
