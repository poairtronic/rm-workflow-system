# Phase 5: Overdue Alert Sweeps Architecture & Specification

**Date**: November 17, 2026  
**Module**: Email Notification Management — Phase 5 Overdue Sweeps  
**Status**: Approved & Authoritative  

---

## 1. Alert Definitions & Status Mappings

### Alert 1: `MATERIAL_ISSUE_OVERDUE_24H`
- **Business Description**: Approved RM request not issued to production for >24 hours (or configured threshold).
- **Primary Entity / Table**: `RmRequest` / `rm_requests` ([backend/src/rm/entities/rm-request.entity.ts#L31-L121](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/entities/rm-request.entity.ts#L31-L121))
- **Real Status Enum**: `RmRequestStatus` ([backend/src/rm/entities/rm-request.entity.ts#L23-L29](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/entities/rm-request.entity.ts#L23-L29)):
  - `DRAFT = 'DRAFT'`
  - `SUBMITTED = 'SUBMITTED'`
  - `REVIEWED = 'REVIEWED'`
  - `COMPLETED = 'COMPLETED'`
  - `REJECTED = 'REJECTED'`
- **Pending Condition**:
  - `rm.status = RmRequestStatus.REVIEWED` ('REVIEWED')
  - `rm.salesOrderComponent.status = ScStatus.STORES_PENDING` (or no `INITIAL_ISSUE` in `material_issues` where `sc_id = rm.sc_id`)
- **Terminal / Excluded Statuses**:
  - `DRAFT`: Not yet submitted.
  - `SUBMITTED`: Under designer/submission review, not yet approved by stores.
  - `COMPLETED`: Fully issued to production.
  - `REJECTED`: Cancelled/rejected request.
- **Timestamp Column**:
  - `rm_requests.reviewed_at` (`reviewedAt: Date`, timestamptz, set in [backend/src/rm/rm.service.ts#L355](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/rm.service.ts#L355)).
  - Fallback: `email_alert_watch.first_seen_at` if `reviewed_at` is null on historical records.
- **Entity ID for SendEvent**: `${request.id}_issue_${todayStr}`
- **Default Threshold**: 24 hours.

---

### Alert 2: `DC_PENDING_2_DAYS`
- **Business Description**: Delivery Challan created >2 days ago (or configured threshold) and still not fully returned from vendor.
- **Primary Entity / Table**: `DeliveryChallan` / `delivery_challans` ([backend/src/delivery-challan/entities/delivery-challan.entity.ts#L35-L133](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan.entity.ts#L35-L133))
- **Real Status Enum**: `DeliveryChallanStatus` ([backend/src/delivery-challan/entities/delivery-challan.entity.ts#L27-L33](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan.entity.ts#L27-L33)):
  - `OPEN = 'OPEN'`
  - `DISPATCHED = 'DISPATCHED'`
  - `PARTIALLY_RETURNED = 'PARTIALLY_RETURNED'`
  - `RETURNED = 'RETURNED'`
  - `CLOSED = 'CLOSED'`
- **Pending Condition**:
  - Statuses meaning "dispatched, material still out or partly out": `DeliveryChallanStatus.DISPATCHED`, `DeliveryChallanStatus.PARTIALLY_RETURNED`.
- **Terminal / Excluded Statuses**:
  - `OPEN`: Created/draft, not yet dispatched to vendor.
  - `RETURNED`: Fully returned by vendor.
  - `CLOSED`: Formally closed.
  - *(Cancelled does not exist in `DeliveryChallanStatus`).*
- **Timestamp Column**:
  - `delivery_challans.created_at` (`createdAt: Date`, timestamptz, [delivery-challan.entity.ts#L319](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan.entity.ts#L319)). The 2 days are strictly counted from the DC creation date, not dispatch date.
- **Entity ID for SendEvent**: `${dc.id}_pending_${todayStr}`
- **Default Threshold**: 48 hours.

---

### Alert 3: `CONSUMABLE_PENDING_2_DAYS`
- **Business Description**: Consumable request created >2 days ago (or configured threshold) and not completed at any stage.
- **Primary Entity / Table**: `ConsumableRequest` / `consumable_requests` ([backend/src/consumables/entities/consumable-request.entity.ts#L17-L69](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/entities/consumable-request.entity.ts#L17-L69)) joined with `ConsumableRequestItem` / `consumable_request_items` ([backend/src/consumables/entities/consumable-request-item.entity.ts#L31-L209](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/entities/consumable-request-item.entity.ts#L31-L209)).
- **Real Status Enum**: `ConsumableItemStatus` ([backend/src/consumables/entities/consumable-request-item.entity.ts#L21-L29](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/entities/consumable-request-item.entity.ts#L21-L29)):
  - `READY_FOR_ISSUE = 'READY_FOR_ISSUE'`
  - `OPEN = 'OPEN'`
  - `PURCHASE_REQUESTED = 'PURCHASE_REQUESTED'`
  - `PURCHASE_RECEIVED = 'PURCHASE_RECEIVED'`
  - `PARTIALLY_ISSUED = 'PARTIALLY_ISSUED'`
  - `ISSUED_TO_PRODUCTION = 'ISSUED_TO_PRODUCTION'`
  - `RECEIVED_BY_PRODUCTION = 'RECEIVED_BY_PRODUCTION'`
- **Pending Condition**:
  - Request has at least one item in non-terminal status:
    `OPEN`, `PURCHASE_REQUESTED`, `PURCHASE_RECEIVED`, `READY_FOR_ISSUE`, `PARTIALLY_ISSUED`.
- **Terminal / Excluded Statuses**:
  - `ISSUED_TO_PRODUCTION`: Fully issued to production.
  - `RECEIVED_BY_PRODUCTION`: Received by production (complete fulfillment).
  - *(Closed, cancelled, and rejected do not exist in the consumable schema; if all items reach `ISSUED_TO_PRODUCTION` or `RECEIVED_BY_PRODUCTION`, the request is terminal and excluded).*
- **Timestamp Column**:
  - `consumable_requests.created_at` (`createdAt: Date`, timestamptz, [consumable-request.entity.ts#L64](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/entities/consumable-request.entity.ts#L64)).
- **Entity ID for SendEvent**: `${req.id}_pending_${todayStr}`
- **Default Threshold**: 48 hours.

---

### Alert 4: `DC_QC_PENDING_24H`
- **Business Description**: DC items inwarded at dock and still pending QC inspection for >24 hours (or configured threshold).
- **Primary Entity / Table**: `DeliveryChallanItem` / `delivery_challan_items` ([backend/src/delivery-challan/entities/delivery-challan-item.entity.ts#L76-L209](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan-item.entity.ts#L76-L209)) joined with `DeliveryChallan` / `delivery_challans`.
- **Pending Condition**:
  - `delivery_challan_items.qc_pending_qty > 0`
  - DC status is not `DeliveryChallanStatus.CLOSED` ('CLOSED').
- **Terminal / Excluded Statuses**:
  - Items with `qc_pending_qty = 0`.
  - Delivery Challans with status `CLOSED`.
- **Timestamp Column**:
  - `email_alert_watch.first_seen_at` (`first_seen_at: timestamptz`).
  - Items currently in QC (`qc_pending_qty > 0`) are registered in `email_alert_watch` on first sight with `alert_code = 'DC_QC_PENDING_24H'`, `entity_type = 'DC_ITEM'`, `entity_id = item.id`.
  - Watch row is deleted when `qc_pending_qty` reaches 0.
- **Aggregation**:
  - One email per Delivery Challan, aggregating all overdue line items into an HTML table (Part Number / Description, Pending QC Quantity, Hours in QC).
- **Entity ID for SendEvent**: `${dc.id}_qc_${todayStr}`
- **Default Threshold**: 24 hours.

---

## 2. Existing System Configuration Switch for Material Issue Overdue

- **Storage Location**: Table `system_settings`
- **Existing Key Name**: `'MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED'`
- **Existing Code Reference**:
  - [backend/src/notifications/notifications.service.ts#L401](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/notifications.service.ts#L401):
    ```typescript
    materialIssueOverdueAlertsEnabled: parseBool('MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED', true),
    ```
  - [backend/src/notifications/notifications.service.ts#L446](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/notifications.service.ts#L446):
    ```typescript
    toSave['MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED'] = String(payload.notifications.materialIssueOverdueAlertsEnabled);
    ```
  - Threshold hours key: `'MATERIAL_ISSUE_OVERDUE_HOURS'` ([notifications.service.ts#L415](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/notifications.service.ts#L415), [notifications.service.ts#L461](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/notifications.service.ts#L461)).
- **Reuse Decision**:
  - We **REUSE** `'MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED'` as the switch key for `MATERIAL_ISSUE_OVERDUE_24H`.
  - For threshold hours, we support `'MATERIAL_ISSUE_OVERDUE_ALERT_HOURS'` (fallback to `'MATERIAL_ISSUE_OVERDUE_HOURS'`, default 24h).
  - If missing in `system_settings`, it evaluates to `false` (OFF by default for Phase 5 safety rules).

---

## 3. Consumable Event Gating in `communication.service.ts`

- **Existing Mechanism**:
  In [backend/src/notifications/communication.service.ts#L724-L730](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/communication.service.ts#L724-L730):
  ```typescript
  if (params.eventType === 'CONSUMABLE_RECEIPT_OVERDUE' || params.eventType === 'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE') {
    const consumableEmailEnabled = await this.notificationsService.getConsumableEmailAlertsEnabled();
    if (!consumableEmailEnabled) {
      this.logger.log(`Consumable email alerts are turned OFF by Admin. Skipping email dispatch for "${params.eventType}".`);
      return { inAppNotifications, emailJobs };
    }
  }
  ```
- **Phase 5 Extension**:
  Add `|| params.eventType === 'CONSUMABLE_PENDING_2_DAYS'` to that check so that `CONSUMABLE_PENDING_2_DAYS` is gated by the master consumable email switch (`CONSUMABLE_EMAIL_ALERTS_KEY`) identically to the existing consumable events.

---

## 4. In-App Notification Handling in `sendEvent` for New Events

- **Existing Behavior**:
  In [backend/src/notifications/communication.service.ts#L625-L628](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/communication.service.ts#L625-L628):
  ```typescript
  default:
    this.logger.warn(`Unsupported communication event type: ${input.eventType}`);
    return { inAppNotifications: [], emailJobs: [] };
  ```
  Unknown event types are rejected before entering `orchestrateChannelDelivery`, meaning **neither in-app nor email** is created.
- **Phase 5 Implementation**:
  We add cases for the 4 new event types inside `communication.service.ts`:
  1. `MATERIAL_ISSUE_OVERDUE_24H` -> calls `orchestrateChannelDelivery` (Target Entity: `MATERIAL_ISSUE`, Template: `MATERIAL_ISSUE_OVERDUE_24H`).
  2. `DC_PENDING_2_DAYS` -> calls `orchestrateChannelDelivery` (Target Entity: `DELIVERY_CHALLAN`, Template: `DC_PENDING_2_DAYS`).
  3. `CONSUMABLE_PENDING_2_DAYS` -> calls `orchestrateChannelDelivery` (Target Entity: `CONSUMABLE_REQUEST`, Template: `CONSUMABLE_PENDING_2_DAYS`).
  4. `DC_QC_PENDING_24H` -> calls `orchestrateChannelDelivery` (Target Entity: `DELIVERY_CHALLAN`, Template: `DC_QC_PENDING_24H`).
  - Fallback recipient population: If `this.recipientService.resolveRecipients` returns empty for these new events, `communication.service.ts` queries active users using `PERMITTED_EMAIL_CONFIG[input.eventType].allowedRoles`, ensuring target users receive both in-app and email notifications.

---

## 5. Scheduling Mechanism and Timezone Alignment

- **Existing Sweeps**:
  1. Delivery Challan SLA sweep:
     [backend/src/delivery-challan/delivery-challan.service.ts#L3776](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/delivery-challan.service.ts#L3776)
     `@Cron(process.env.DC_SLA_CRON_SCHEDULE || CronExpression.EVERY_HOUR)`
  2. Consumables SLA sweep:
     [backend/src/consumables/consumables.service.ts#L1222](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/consumables/consumables.service.ts#L1222)
     `@Cron(process.env.CONSUMABLE_SLA_CRON_SCHEDULE || CronExpression.EVERY_HOUR)`
- **Mechanism**:
  Scheduled via NestJS `@Cron` from `@nestjs/schedule` using `CronExpression.EVERY_HOUR` (`0 0 * * * *`).
- **Timezone Logic**:
  Both sweeps construct their daily idempotency keys using:
  ```typescript
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // UTC date format: YYYY-MM-DD
  ```
  The new `AlertSweepService` uses the identical `@Cron(process.env.ALERT_SWEEP_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` decorator and `new Date().toISOString().split('T')[0]` date key formatting for seamless consistency.
