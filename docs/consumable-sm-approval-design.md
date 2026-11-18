# V-SMART RM — Consumables SM Approval Module Architecture & Merged Flow Design

**Document Version:** 2.0.0 (Final Approved Plan)  
**Date:** November 18, 2026  
**System Mode:** Strict Read-Only Design Specification (No Source Code / No Migrations Modified)  
**Default Configuration:** `CONSUMABLE_SM_APPROVAL_MODE=OFF`, `CONSUMABLE_SM_APPROVAL_SCOPE=ALL`  

---

## 1. Executive Decisions & Architectural Principles

Based on executive sign-off, the Senior Manager (SM) Approval Module establishes a mandatory managerial authorization gate across all consumable requisitions.

### 1.1 Final Executive Decisions
1. **Mandatory Scope (`ALL`):** Both In-Stock Store items (`STOCK_ITEM`) and external purchase requisitions (`NON_STOCK_OR_NEW`) require SM approval. No unapproved items can be issued from stock or sent for procurement.
2. **Authorized Approver Roles:** Restricted strictly to **`SENIOR_MANAGER`** and **`ADMIN`** only (`GENERAL_MANAGER` is removed from all approval actions and endpoints).
3. **Universal Queue Policy (No Creator Bypass):** Requisitions raised by a Senior Manager or Admin must also pass through the approval queue (no self-bypass or implicit auto-approval).
4. **Per-Line Independence:** Line items inside the same requisition are evaluated independently. Approving 3 lines and rejecting 2 lines allows the 3 approved lines to proceed immediately into fulfillment.
5. **Rejections are Final & Non-Deletable:** A rejected line item is terminal. Requesters cannot edit in-place; they must use the "Re-raise from Rejected" shortcut. Furthermore, `deleteLineItem` explicitly blocks deletion of rejected lines to preserve complete audit history.
6. **Inward In-Store Auto-Issue Preserved:** When stores receives an approved purchase, the optional `autoIssue` checkbox (issuing directly to the shop-floor machine bay) remains fully operational.
7. **Immediate Consolidated Batch Emails (Anti-Flood Guard):** Bulk approval of $N$ items dispatches **at most 1 email per recipient per batch** at **Priority 1**, eliminating inbox flooding and safeguarding the 400 daily Gmail API limit (preventing any recurrence of the 150-email incident).

---

## 2. Additive Database Schema & Backfill Specification

### 2.1 Additive Schema on `consumable_request_items`

The database schema is extended purely additively. No existing columns or enums are renamed or dropped.

```sql
-- 1. Create approval status enum type
DO $$ BEGIN
    CREATE TYPE consumable_approval_status_enum AS ENUM (
        'PENDING_SM_APPROVAL',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add additive columns to consumable_request_items
ALTER TABLE "consumable_request_items"
    ADD COLUMN IF NOT EXISTS "approval_status" consumable_approval_status_enum DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "approved_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "rejected_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "approval_batch_id" UUID DEFAULT NULL;

-- 3. Composite indexes for queue performance, sweeps, and batch lookups
CREATE INDEX IF NOT EXISTS "idx_cri_approval_status" ON "consumable_request_items" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_cri_approval_batch_id" ON "consumable_request_items" ("approval_batch_id");
CREATE INDEX IF NOT EXISTS "idx_cri_approved_at" ON "consumable_request_items" ("approved_at");
```

### 2.2 Entity Definition (TypeORM)

File: [consumable-request-item.entity.ts](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/entities/consumable-request-item.entity.ts)
```typescript
export enum ConsumableApprovalStatus {
  PENDING_SM_APPROVAL = 'PENDING_SM_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Additive fields on ConsumableRequestItem entity:
@Index()
@Column({
  name: 'approval_status',
  type: 'enum',
  enum: ConsumableApprovalStatus,
  enumName: 'consumable_approval_status_enum',
  nullable: true,
})
approvalStatus?: ConsumableApprovalStatus | null;

@Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
approvedById?: string | null;

@ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
@JoinColumn({ name: 'approved_by_id' })
approvedBy?: User | null;

@Column({ name: 'approved_at', type: 'timestamp with time zone', nullable: true })
approvedAt?: Date | null;

@Column({ name: 'rejected_by_id', type: 'uuid', nullable: true })
rejectedById?: string | null;

@ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
@JoinColumn({ name: 'rejected_by_id' })
rejectedBy?: User | null;

@Column({ name: 'rejected_at', type: 'timestamp with time zone', nullable: true })
rejectedAt?: Date | null;

@Column({ name: 'rejection_reason', type: 'text', nullable: true })
rejectionReason?: string | null;

@Index()
@Column({ name: 'approval_batch_id', type: 'uuid', nullable: true })
approvalBatchId?: string | null;
```

---

### 2.3 Safe Backfill Specification (Grandfathering Rule)

To guarantee that active in-flight items (~26 open purchase, 15 ready to receive, 17 dispatched) continue without disruption, all existing rows are grandfathered:

```sql
-- Safe Backfill: Exactly set approved_at = created_at
UPDATE "consumable_request_items"
SET 
    "approval_status" = 'APPROVED',
    "approved_at" = "created_at"
WHERE "approval_status" IS NULL;
```

**Backfill Invariant:**
- Every historical and currently active row receives `approval_status = 'APPROVED'`.
- `approved_at` is set to `created_at` so overdue sweep age calculations remain identical to legacy behavior.

---

### 2.4 Header-Level Derived Status

`ConsumableRequest` documents calculate their approval badge dynamically from their constituent lines:

| Constituent Line Item State | Derived Header Status | Badge Color & Label |
| :--- | :--- | :--- |
| All items are `PENDING_SM_APPROVAL` | `PENDING_APPROVAL` | Amber: `"Pending Approval"` |
| Some items `APPROVED`, some `PENDING_SM_APPROVAL` | `PARTIALLY_APPROVED` | Blue: `"Partially Approved"` |
| All items are `APPROVED` | `FULLY_APPROVED` | Green: `"Approved"` |
| All items are `REJECTED` | `REJECTED` | Red: `"Rejected"` |
| Mix of `APPROVED` and `REJECTED` (0 pending) | `PROCESSED_WITH_REJECTIONS` | Purple: `"Approved (Partial Rejections)"` |

---

## 3. Configuration Flags & Phase Evolution

### 3.1 Feature Flags Specification

| Environment Variable | Allowed Values | Default | Runtime Behavior |
| :--- | :--- | :--- | :--- |
| `CONSUMABLE_SM_APPROVAL_MODE` | `OFF`, `ON` | `OFF` | - `OFF`: All new items are auto-approved upon creation (`approval_status = 'APPROVED'`). Legacy zero-friction behavior.<br/>- `ON`: All new items enter `approval_status = 'PENDING_SM_APPROVAL'`. |
| `CONSUMABLE_SM_APPROVAL_SCOPE` | `ALL`, `PURCHASE_ONLY` | `ALL` | Locked to `ALL`: Both In-Stock and Purchase track items require approval. |

### 3.2 Phase Progression of `NULL` Status
- **Prior to Phase P2:** The database column exists, but `NULL` is treated as `APPROVED` everywhere in the codebase. Existing workflows encounter zero friction.
- **In Phase P2:** `createRequest()` is updated to explicitly write `PENDING_SM_APPROVAL` (when `MODE=ON`) or `APPROVED` (when `MODE=OFF`).
- **Post Phase P2:** Legacy items with `NULL` remain safely treated as `APPROVED` via `(cri.approval_status IS NULL OR cri.approval_status = 'APPROVED')`.

---

## 4. Merged Workflow Lifecycle & State Machine

```mermaid
flowchart TD
    Start([User Submits Consumable Request<br/>Roles: Production, Stores, SM, Admin]) --> FlagCheck{CONSUMABLE_SM_APPROVAL_MODE == ON?}
    
    %% Mode OFF Path
    FlagCheck -- OFF --> OffTrack{Stock Check}
    OffTrack -- In-Stock --> S_READY_OFF[READY_FOR_ISSUE<br/>approval: APPROVED]
    OffTrack -- Out-of-Stock --> S_OPEN_OFF[OPEN<br/>approval: APPROVED]
    
    %% Mode ON Path
    FlagCheck -- ON --> SM_QUEUE[PENDING_SM_APPROVAL<br/>Visible ONLY in SM Approval Workspace]
    
    %% Senior Manager Action
    SM_QUEUE --> SMAction{SM or Admin Decision}
    
    %% Rejection Path
    SMAction -- Bulk / Single Reject<br/>Reason Mandatory --> SM_REJECT[REJECTED<br/>rejected_at = NOW()<br/>approval_batch_id assigned]
    SM_REJECT --> Terminate([TERMINAL STATE<br/>Hidden from Stores & Purchase Queues<br/>deleteLineItem REFUSES deletion<br/>Requester clicks 'Re-raise' to clone])
    
    %% Approval Path
    SMAction -- Bulk / Single Approve<br/>Max 200 IDs --> StockRecheck{Re-check Live Stock<br/>for STOCK_ITEM lines}
    
    StockRecheck -- Sufficient Stock --> KeepStock[Keep Track: STOCK_ITEM<br/>status = READY_FOR_ISSUE]
    StockRecheck -- Stock Depleted --> DynamicSwitch[Switch Track: NON_STOCK_OR_NEW<br/>status = OPEN<br/>Audit log switch recorded]
    
    KeepStock --> S_APPROVED[APPROVED<br/>approved_at = NOW()<br/>approval_batch_id assigned]
    DynamicSwitch --> S_APPROVED
    
    %% Operational Fulfillment
    S_APPROVED --> RouteBranch{itemCategoryTrack}
    RouteBranch -- STOCK_ITEM --> StoreIssue[Stores Issues to Floor<br/>POST /line-items/:id/issue-to-production<br/>Server enforces: approval == APPROVED]
    RouteBranch -- NON_STOCK_OR_NEW --> PrintPR[Stores Prints PR Slip<br/>POST /purchase/print-pr<br/>Server enforces: approval == APPROVED]
    
    PrintPR --> S_PR_REQ[PURCHASE_REQUESTED<br/>PR # Assigned]
    S_PR_REQ --> Receive[Stores Receives Goods<br/>POST /purchase/receive<br/>Server enforces: approval == APPROVED]
    
    Receive -- autoIssue = false --> S_STORE[PURCHASE_RECEIVED<br/>In-Stock Store Queue]
    S_STORE --> StoreIssue
    
    Receive -- autoIssue = true --> S_FLOOR[ISSUED_TO_PRODUCTION<br/>Receipt Queue]
    StoreIssue --> S_FLOOR
    
    %% Final Confirmation
    S_FLOOR --> ProdConfirm[Production Confirms Receipt<br/>PATCH /line-items/:id/production-receive]
    ProdConfirm --> S_CLOSED[RECEIVED_BY_PRODUCTION<br/>UI: 'Closed']
```

---

## 5. Lifecycle Transition Matrix

| Operational Status (`status`) | Approval Status (`approval_status`) | Authorized Actor | Action & API Route | Next State & Resulting Track | Visibility & Placement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `OPEN` / `READY_FOR_ISSUE` | `PENDING_SM_APPROVAL` | **`SENIOR_MANAGER`**, **`ADMIN`** | `POST /api/consumables/approvals/bulk-approve`<br/>*(Capped at 200 IDs)* | `approval_status = APPROVED`<br/>`approved_at = NOW()`<br/>*(If stock depleted: track $\rightarrow$ `NON_STOCK_OR_NEW`)* | **SM Approvals Workspace** (Pending tab). Completely hidden from Purchase and In-Stock queues. |
| `OPEN` / `READY_FOR_ISSUE` | `PENDING_SM_APPROVAL` | **`SENIOR_MANAGER`**, **`ADMIN`** | `POST /api/consumables/approvals/bulk-reject`<br/>*(Reason mandatory, $\ge 5$ chars)* | `approval_status = REJECTED`<br/>`rejected_at = NOW()` | **SM Approvals Workspace** (Rejected tab) & Requester View. **Never reaches Stores or Purchase**. |
| `OPEN` | `APPROVED` | **`STORES`**, **`ADMIN`** | `POST /api/consumables/purchase/print-pr` | `status = PURCHASE_REQUESTED`<br/>PR slip printed, `prNumber` assigned | **Purchase Queue** (Open filter). |
| `PURCHASE_REQUESTED` | `APPROVED` | **`STORES`**, **`ADMIN`** | `POST /api/consumables/purchase/receive`<br/>*(Supports `autoIssue: true/false`)* | `status = PURCHASE_RECEIVED`<br/>*(or `ISSUED_TO_PRODUCTION` if autoIssue)* | **Purchase Queue** (Awaiting Delivery). Atomic `STOCK_IN`. |
| `READY_FOR_ISSUE` / `PURCHASE_RECEIVED` | `APPROVED` | **`STORES`**, **`ADMIN`** | `POST /api/consumables/line-items/:id/issue-to-production` | `status = ISSUED_TO_PRODUCTION`<br/>*(or `PARTIALLY_ISSUED` if partial)* | **In-Stock Store Queue**. Atomic `STOCK_OUT`. |
| `ISSUED_TO_PRODUCTION` | `APPROVED` | **`PRODUCTION`**, **`ADMIN`** | `PATCH /api/consumables/line-items/:id/production-receive` | `status = RECEIVED_BY_PRODUCTION` | **Production Receipt Queue** (Ready to Receive filter). |
| Any | `REJECTED` | **Requester** | Click **"Re-raise from Rejected"**<br/>`POST /api/consumables/requests` | Creates new clone request in `PENDING_SM_APPROVAL` | Requester Workspace. **`deleteLineItem` rejects deletion**. |

---

## 6. Detailed Backend Core Specification (Phase P2 Hardening)

### 6.1 Bulk API Endpoints & Request Payload Constraints
File: `backend/src/consumables/consumables.controller.ts`

1. **Bulk Approve:**
   - **Route:** `POST /api/consumables/approvals/bulk-approve`
   - **Guards:** `@UseGuards(JwtAuthGuard, RolesGuard)`
   - **Roles:** `@Roles(UserRole.SENIOR_MANAGER, UserRole.ADMIN)` *(Strictly no GENERAL_MANAGER)*
   - **Payload DTO:**
     ```typescript
     export class BulkApproveConsumableItemsDto {
       @IsArray()
       @ArrayNotEmpty()
       @ArrayMaxSize(200, { message: 'Cannot approve more than 200 items in a single batch.' })
       @IsUUID('4', { each: true })
       itemIds!: string[];
     }
     ```
2. **Bulk Reject:**
   - **Route:** `POST /api/consumables/approvals/bulk-reject`
   - **Guards:** `@UseGuards(JwtAuthGuard, RolesGuard)`
   - **Roles:** `@Roles(UserRole.SENIOR_MANAGER, UserRole.ADMIN)` *(Strictly no GENERAL_MANAGER)*
   - **Payload DTO:**
     ```typescript
     export class BulkRejectConsumableItemsDto {
       @IsArray()
       @ArrayNotEmpty()
       @ArrayMaxSize(200, { message: 'Cannot reject more than 200 items in a single batch.' })
       @IsUUID('4', { each: true })
       itemIds!: string[];

       @IsString()
       @IsNotEmpty({ message: 'Rejection reason is mandatory.' })
       @MinLength(5, { message: 'Rejection reason must be at least 5 characters long.' })
       rejectionReason!: string;
     }
     ```
3. **Pending Count (Sidebar Badge Endpoint):**
   - **Route:** `GET /api/consumables/approvals/pending-count`
   - **Roles:** `SENIOR_MANAGER`, `ADMIN`
   - **Output:** `{ count: number }`
   - **Query:** `SELECT COUNT(*) FROM consumable_request_items WHERE approval_status = 'PENDING_SM_APPROVAL'`

---

### 6.2 Live Stock Re-Check at Approval (Dynamic Track Switching with Running Per-Product Tally)

When a Senior Manager approves items marked `STOCK_ITEM`, stock could have been depleted between request time and approval time. Furthermore, if a single approval batch contains multiple lines requesting the same product, a running per-product tally is maintained across the batch so two lines cannot claim the same stock.

**Service Logic in `bulkApproveLineItems()`:**
```typescript
// Running per-product allocation tally across the approval batch
const productAllocatedTally = new Map<string, number>();

for (const item of itemsToApprove) {
  if (item.itemCategoryTrack === ConsumableItemTrack.STOCK_ITEM) {
    const liveStock = await this.getAvailableStock(item.productId);
    const alreadyAllocated = productAllocatedTally.get(item.productId) || 0;
    const remainingStock = Math.max(0, liveStock - alreadyAllocated);

    if (remainingStock >= Number(item.requestedQty || 0) && Number(item.requestedQty || 0) > 0) {
      // Allocate stock from running tally for this batch
      productAllocatedTally.set(item.productId, alreadyAllocated + Number(item.requestedQty));
    } else {
      // Stock depleted or exhausted by preceding line in this batch: dynamically switch to Purchase Track
      item.itemCategoryTrack = ConsumableItemTrack.NON_STOCK_OR_NEW;
      item.status = ConsumableItemStatus.OPEN;
      this.logger.warn(
        `[STOCK DEPLETED AT APPROVAL] Item "${item.description}" switched from STOCK_ITEM to NON_STOCK_OR_NEW. Available: ${liveStock}, Already Allocated in Batch: ${alreadyAllocated}, Requested: ${item.requestedQty}. Routed to Purchase Queue.`,
      );
      await this.auditService.logAction({
        action: 'CONSUMABLE_TRACK_SWITCHED_STOCK_DEPLETED',
        entityType: 'CONSUMABLE_REQUEST_ITEM',
        entityId: item.id,
        userId: actorId,
        details: { liveStock, alreadyAllocated, requestedQty: item.requestedQty },
      });
    }
  }
}
```

---

### 6.3 Deletion Refusal for Rejected Lines

In [consumables.service.ts](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/consumables.service.ts), `deleteLineItem()` and `bulkDeleteLineItems()` are hardened:

```typescript
if (item.approvalStatus === ConsumableApprovalStatus.REJECTED) {
  throw new BadRequestException(
    `Cannot delete line item "${item.description}": Rejected consumable items cannot be deleted. They are preserved for governance audit trails and requester history.`,
  );
}
```

---

### 6.4 Server-Side Gate Enforcements

Every downstream operational endpoint validates `approvalStatus`:
```typescript
// Enforced in: printPurchaseRequisition(), receivePurchase(), issueToProduction()
if (item.approvalStatus && item.approvalStatus !== ConsumableApprovalStatus.APPROVED) {
  throw new BadRequestException(
    `Operational action blocked: Line item "${item.description}" has approval status "${item.approvalStatus}". Only APPROVED items may be processed.`,
  );
}
```

---

## 7. Alert Sweeps & Overdue Clocks Adaptation

### 7.1 Sweep Predicate Hardening

All sweeps and digest preview SQL are updated to use `COALESCE(cri.approved_at, cri.created_at)` and safely treat `NULL` as `APPROVED`:

#### 1. `CONSUMABLE_RECEIPT_OVERDUE` (ConsumablesService & AlertDigestService)
- **Live Sweep Predicate:**
  ```typescript
  // In ConsumablesService:
  const isApproved = !item.approvalStatus || item.approvalStatus === ConsumableApprovalStatus.APPROVED;
  if (!isApproved) continue; // Exclude PENDING_SM_APPROVAL and REJECTED

  const referenceDate = item.approvedAt || item.createdAt;
  const elapsedHours = Math.floor((now.getTime() - new Date(referenceDate).getTime()) / (1000 * 60 * 60));
  ```
- **Raw SQL Predicate (AlertDigestService First-Run Preview):**
  ```sql
  SELECT cri.id, 'CONSUMABLE_REQUEST_ITEM' as "entityType",
         COALESCE(cri.description, cri.id::text) as "itemRef",
         COALESCE(cri.approved_at, cri.created_at) as "createdAt"
  FROM consumable_request_items cri
  WHERE cri.status IN ('OPEN', 'PURCHASE_REQUESTED', 'PARTIALLY_ISSUED', 'READY_FOR_ISSUE')
    AND cri.purchase_received_at IS NULL
    AND (cri.approval_status IS NULL OR cri.approval_status = 'APPROVED')
    AND COALESCE(cri.approved_at, cri.created_at) <= NOW() - INTERVAL '24 hours'
  ```

#### 2. `CONSUMABLE_PENDING_2_DAYS` (AlertSweepService & AlertDigestService)
- **Raw SQL Predicate:**
  ```sql
  SELECT DISTINCT cr.id, 'CONSUMABLE_REQUEST' as "entityType", cr.request_code as "itemRef"
  FROM consumable_requests cr
  INNER JOIN consumable_request_items cri ON cri.request_id = cr.id
  WHERE cr.created_at <= NOW() - INTERVAL '48 hours'
    AND cri.status IN ('OPEN', 'PURCHASE_REQUESTED', 'PURCHASE_RECEIVED', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED')
    AND (cri.approval_status IS NULL OR cri.approval_status = 'APPROVED')
  ```

### 7.2 Queue Integration, KPI Counters & Report/Export Hardening (Phase P4 Scope)

In Phase P4, all queue queries, KPI summary strips, and export routines are synchronized to reflect approval state:

1. **Production Receipt Queue "Open" Filter:**
   In [ConsumableRequestsWorkspace.tsx](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/pages/ConsumableRequestsWorkspace.tsx), the active `"Open"` filter (`statusFilter === 'OPEN'`) must only match approved items:
   ```typescript
   if (statusFilter === 'OPEN') {
     const isApproved = !item.approvalStatus || item.approvalStatus === 'APPROVED';
     return isApproved && item.status !== 'RECEIVED_BY_PRODUCTION' && item.status !== 'ISSUED_TO_PRODUCTION';
   }
   ```
   Items in `PENDING_SM_APPROVAL` and `REJECTED` are completely excluded from the operational "Open" view.
2. **KPI Counters Hardening:**
   - In [ConsumablePurchaseStoreWorkspace.tsx](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/pages/ConsumablePurchaseStoreWorkspace.tsx), the 4 KPI metrics (`Ready for issue`, `Open purchase`, `Partially issued`, `Dispatched`) strictly include only approved items: `(i.approvalStatus === 'APPROVED' || !i.approvalStatus)`. Unapproved items never distort store inventory counts.
   - In [ConsumableRequestsWorkspace.tsx](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/pages/ConsumableRequestsWorkspace.tsx), KPIs accurately segment lines by approval and fulfillment stage.
3. **Report Generation & Export Endpoints:**
   - The filter-wise Excel/CSV export dropdown in `ConsumablePurchaseStoreWorkspace` (`data={purchaseQueueItems}`) and any cross-module report generating consumable line summaries strictly filter:
     `WHERE (cri.approval_status IS NULL OR cri.approval_status = 'APPROVED')`.
   - Rejection audit logs and pending queue data are exportable only from the dedicated Senior Manager Approvals module.

---

## 8. Batch Email Notification Architecture

### 8.1 Anti-Flood Rule & Event Classifications

To protect Gmail daily quotas (400 emails/day), bulk approvals and rejections dispatch **exactly one consolidated email per recipient per batch**:

$$\text{Dispatched Emails} \le \text{Count}(\text{Unique Target Users in Batch})$$

| Event Code | Priority | Target Audience | Trigger Event | Payload Structure |
| :--- | :--- | :--- | :--- | :--- |
| `CONSUMABLE_APPROVAL_REQUESTED` | **Priority 1** | `SENIOR_MANAGER`, `ADMIN` | Requisition created with $\ge 1$ item in `PENDING_SM_APPROVAL` | Single email to approvers summarizing request code, total lines, and link to approval module. |
| `CONSUMABLE_APPROVED` | **Priority 1** | `STORES` + **Requester** | SM approves batch of $N$ items | Single tabular email listing all $N$ approved items, quantities, and end-user bays. |
| `CONSUMABLE_REJECTED` | **Priority 1** | **Requester** | SM rejects batch of $K$ items | Single email to requester listing rejected items and specific reasons. |

### 8.2 Subsystem Registrations
1. **`EVENT_PRIORITY_MAP`:** File [email-priorities.ts](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/email/constants/email-priorities.ts)
   ```typescript
   CONSUMABLE_APPROVAL_REQUESTED: 1,
   CONSUMABLE_APPROVED: 1,
   CONSUMABLE_REJECTED: 1,
   ```
2. **`PERMITTED_EMAIL_EVENT_TYPES`:** File [email-queue.service.ts](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/email/email-queue.service.ts)
   - Add all 3 events to the whitelist Set.
3. **`PERMITTED_EMAIL_CONFIG`:** File [communication.service.ts](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/communication.service.ts)
   ```typescript
   CONSUMABLE_APPROVAL_REQUESTED: { allowedRoles: ['SENIOR_MANAGER', 'ADMIN'], recipientType: 'ROLES' },
   CONSUMABLE_APPROVED: { allowedRoles: ['STORES'], recipientType: 'ROLES' }, // Plus explicit requester user
   CONSUMABLE_REJECTED: { allowedRoles: [], recipientType: 'USER' },
   ```
4. **Seed Migration:** Seed entries in `notification_event_roles` for `SENIOR_MANAGER`, `ADMIN`, `STORES`.
5. **Preference Resolver:** Checks `RecipientPreferenceService` before creating jobs.

---

## 9. Senior Manager UI Module Specification

### 9.1 Route & Sidebar Registration
- **Route:** `/consumables/approvals`
- **Module Key:** `consumables_approval`
- **Sidebar Group:** `CONSUMABLES`
- **Sidebar Label:** `SM Approvals`
- **Authorized Roles:** `SENIOR_MANAGER`, `ADMIN` *(No GENERAL_MANAGER)*
- **Live Counter Badge:** Powered by `GET /api/consumables/approvals/pending-count`.

### 9.2 Workspace Components
- **Tabs:**
  - `Pending Approvals` (Default, table with checkboxes, bulk actions).
  - `Approved History` (Historical batch log with batch ID and timestamps).
  - `Rejected Items` (Audit log with mandatory rejection reasons).
- **Sticky Bulk Action Bar:**
  - Appears whenever $\ge 1$ item is selected (up to 200 items).
  - Displays selected count and aggregate estimated cost.
  - Buttons: **"Approve Selected (N)"** (Emerald) & **"Reject Selected (N)"** (Red).
- **Rejection Modal:** Textarea requiring reason ($\ge 5$ chars).
- **Requester Workspace Integration:**
  - `/consumables/requests` displays status badges (`Pending Approval`, `Approved`, `Rejected`).
  - Rejected items feature a **"Re-raise"** shortcut that pre-populates the Request Builder.

---

## 10. Decide Later (Future Deferred Scope)

The following capabilities are deliberately deferred to maintain rapid, zero-risk rollout:

1. **Pending Approval Reminder Sweep:**
   - A scheduled hourly digest notifying Senior Managers if items have lingered in `PENDING_SM_APPROVAL` for $>24$ or $>48$ hours.
   - *Status:* Deferred to Phase 7.
2. **Senior Manager / Admin Skip-Queue Option:**
   - Whether requests raised directly by a Senior Manager or Admin should have a checkbox: `"Auto-approve my request"`.
   - *Status:* Deferred. All requests currently enter the queue unconditionally to enforce organizational transparency.
