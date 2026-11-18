# V-SMART RM – Alert Sweep & Notification Audit (Read-Only)

**Document Type:** Technical Audit & Baseline Verification  
**Scope:** Automated Sweeps, Schedulers, Alert Event Dispatchers, and Recipient Resolution  
**Date:** 2026-11-18  
**Status:** Step 0 Complete (Read-Only, Zero Code Changes)  

---

## 1. Executive Summary

An exhaustive codebase audit was conducted across all background sweeps and scheduled jobs in the V-SMART RM system. 

### Core Problem Identified
All alert sweeps currently:
1. **Send discrete, individual email jobs per item per recipient**:
   - For example, 30 overdue consumable items $\times$ 5 recipients = **150 email jobs** in a single sweep run.
   - Across all active sweeps in a burst, this generates up to **274 email jobs** per sweep cycle.
2. **Depend on daily string date buckets (`todayStr = now.toISOString().split('T')[0]`)**:
   - Intra-day (within the same UTC calendar day), idempotency keys containing `todayStr` prevent duplicate sends on subsequent hourly runs.
   - Cross-day (at 00:00 UTC), `todayStr` resets. Every unchanged, still-pending item is treated as a new entity and **re-alerted to every recipient again**, consuming daily email quotas (400 emails/day) and delaying transactional workflow emails.

---

## 2. Comprehensive Audit of All Alert Sweeps

### Sweep 1: Consumables SLA and Fulfillment Alert Sweep
- **Service & Method:** `ConsumablesService.checkAndAlertConsumableSlas()` (`backend/src/consumables/consumables.service.ts#L1446-1550`)
- **Schedule:** `@Cron(process.env.CONSUMABLE_SLA_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` (Default: Hourly, `0 * * * *`)
- **Database Query:**
  ```typescript
  this.itemRepo.find({
    where: {
      status: In([
        ConsumableItemStatus.OPEN,
        ConsumableItemStatus.PURCHASE_REQUESTED,
        ConsumableItemStatus.PARTIALLY_ISSUED,
        ConsumableItemStatus.READY_FOR_ISSUE,
      ]),
    },
    relations: { request: true, product: true, vendor: true },
  });
  ```
- **Events Generated:**
  1. `CONSUMABLE_RECEIPT_OVERDUE`: Triggered when item is not received within 24 hours of creation.
     - Entity ID: `${item.id}_${todayStr}`
  2. `CONSUMABLE_PARTIALLY_ISSUED_OVERDUE`: Triggered when `issuedQty > 0` but `< requestedQty`.
     - Entity ID: `${item.id}_part_${todayStr}`
- **Re-alerted on Every Run:**
  - **Intra-Day (Hourly runs on same UTC day): NO.**  
    *Code Evidence:* In `CommunicationService.orchestrateChannelDelivery` (L757 & L949), idempotency keys are generated as `<EVENT>:<ENTITY_ID>:<RECIPIENT_USER_ID>`. In `EmailQueueService.enqueueJob` (L99-L105):
    ```typescript
    const existing = await this.emailJobRepository.findOne({ where: { idempotencyKey } });
    if (existing) return existing;
    ```
    Existing same-day jobs prevent duplicate enqueueing within the same calendar date.
  - **Cross-Day (Next UTC day at 00:00 UTC): YES.**  
    *Code Evidence:* Because `entityId` embeds `${todayStr}`, the string changes each UTC day (e.g. `item123_2026-11-18` $\to$ `item123_2026-11-19`), generating new idempotency keys and enqueueing another full set of per-item, per-recipient emails for unchanged items.
- **Recipient Resolution:**
  - `PERMITTED_EMAIL_CONFIG['CONSUMABLE_RECEIPT_OVERDUE']`: Roles `['STORES', 'ADMIN']`
  - `PERMITTED_EMAIL_CONFIG['CONSUMABLE_PARTIALLY_ISSUED_OVERDUE']`: Roles `['STORES', 'ADMIN', 'PRODUCTION']`
  - Evaluated via `NotificationPreferenceService.resolveRecipients()` if `EMAIL_PREFS_V2_MODE=ON`, or `resolveLegacyEmailRecipients` querying active users by role.

---

### Sweep 2: Delivery Challan Expected Return Date Reconciliation
- **Service & Method:** `DeliveryChallanService.checkAndAlertExpectedReturnDates()` (`backend/src/delivery-challan/delivery-challan.service.ts#L3782-3849`)
- **Schedule:** `@Cron(process.env.DC_SLA_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` (Default: Hourly, `0 * * * *`)
- **Database Query:**
  ```typescript
  this.challanRepo.find({
    where: {
      status: In([
        DeliveryChallanStatus.OPEN,
        DeliveryChallanStatus.DISPATCHED,
        DeliveryChallanStatus.PARTIALLY_RETURNED,
      ]),
    },
    relations: { vendor: true },
  });
  ```
- **Events Generated:**
  1. `DC_OVERDUE`: Triggered when `now > expectedReturnDate`.
     - Entity ID: `${dc.id}_overdue_${todayStr}`
  2. `DC_APPROACHING_SLA`: Triggered when `expectedReturnDate - now <= 24h`.
     - Entity ID: `${dc.id}_reached_${todayStr}`
- **Re-alerted on Every Run:**
  - **Intra-Day:** **NO** (same-day idempotency key deduplicates within same UTC day).
  - **Cross-Day:** **YES.**  
    *Code Evidence:* `${dc.id}_overdue_${todayStr}` resets daily, re-alerting STORES for every overdue challan every 24 hours until returned or closed.
- **Recipient Resolution:**
  - `PERMITTED_EMAIL_CONFIG['DC_OVERDUE']`: Roles `['STORES']`
  - `PERMITTED_EMAIL_CONFIG['DC_APPROACHING_SLA']`: Roles `['STORES']`
  - Evaluated via `NotificationPreferenceService` or active users with role `STORES`.

---

### Sweep 3: Material Issue Overdue (>24h) (Phase 5 Sweep 1)
- **Service & Method:** `AlertSweepService.sweepMaterialIssueOverdue()` (`backend/src/alert-sweeps/alert-sweeps.service.ts#L182-232`)
- **Schedule:** `@Cron(process.env.ALERT_SWEEP_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` via `runAllSweeps()`
- **Database Query:**
  ```typescript
  this.rmRequestRepo
    .createQueryBuilder('rm')
    .leftJoinAndSelect('rm.createdBy', 'creator')
    .leftJoinAndSelect('rm.salesOrderComponent', 'sc')
    .leftJoin('material_issues', 'mi', "mi.sc_id = rm.sc_id AND mi.issue_type = 'INITIAL_ISSUE'")
    .where('rm.status = :status', { status: RmRequestStatus.REVIEWED })
    .andWhere('mi.id IS NULL')
    .andWhere('COALESCE(rm.reviewed_at, rm.created_at) <= :cutoff', { cutoff })
    .orderBy('COALESCE(rm.reviewed_at, rm.created_at)', 'ASC')
    .take(20)
    .getMany();
  ```
- **Events Generated:**
  - `MATERIAL_ISSUE_OVERDUE_24H`
  - Entity ID: `${rm.id}_issue_${todayStr}`
- **Re-alerted on Every Run:**
  - **Intra-Day:** **NO** (same-day idempotency key).
  - **Cross-Day:** **YES.**  
    *Code Evidence:* `${rm.id}_issue_${todayStr}` changes daily, re-alerting STORES and GENERAL_MANAGER every 24 hours.
- **Recipient Resolution:**
  - `PERMITTED_EMAIL_CONFIG['MATERIAL_ISSUE_OVERDUE_24H']`: Roles `['STORES', 'GENERAL_MANAGER']`

---

### Sweep 4: Delivery Challan Not Returned (>2 Days) (Phase 5 Sweep 2)
- **Service & Method:** `AlertSweepService.sweepDcPending()` (`backend/src/alert-sweeps/alert-sweeps.service.ts#L238-285`)
- **Schedule:** `@Cron(process.env.ALERT_SWEEP_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` via `runAllSweeps()`
- **Database Query:**
  ```typescript
  this.dcRepo.find({
    where: {
      status: In([DeliveryChallanStatus.DISPATCHED, DeliveryChallanStatus.PARTIALLY_RETURNED]),
      createdAt: LessThanOrEqual(cutoff), // threshold: default 48h
    },
    relations: { vendor: true },
    order: { createdAt: 'ASC' },
    take: 20,
  });
  ```
- **Events Generated:**
  - `DC_PENDING_2_DAYS`
  - Entity ID: `${dc.id}_pending_${todayStr}`
- **Re-alerted on Every Run:**
  - **Intra-Day:** **NO** (same-day idempotency key).
  - **Cross-Day:** **YES.**  
    *Code Evidence:* `${dc.id}_pending_${todayStr}` changes daily, re-alerting STORES and SENIOR_MANAGER every 24 hours.
- **Recipient Resolution:**
  - `PERMITTED_EMAIL_CONFIG['DC_PENDING_2_DAYS']`: Roles `['STORES', 'SENIOR_MANAGER']`

---

### Sweep 5: Consumable Request Open (>2 Days) (Phase 5 Sweep 3)
- **Service & Method:** `AlertSweepService.sweepConsumablePending()` (`backend/src/alert-sweeps/alert-sweeps.service.ts#L291-347`)
- **Schedule:** `@Cron(process.env.ALERT_SWEEP_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` via `runAllSweeps()`
- **Database Query:**
  ```typescript
  this.consumableRequestRepo
    .createQueryBuilder('req')
    .innerJoinAndSelect('req.items', 'item')
    .where('req.created_at <= :cutoff', { cutoff }) // threshold: default 48h
    .andWhere('item.status IN (:...statuses)', { statuses: nonTerminalStatuses })
    .orderBy('req.created_at', 'ASC')
    .take(20)
    .getMany();
  ```
- **Events Generated:**
  - `CONSUMABLE_PENDING_2_DAYS`
  - Entity ID: `${req.id}_pending_${todayStr}`
- **Re-alerted on Every Run:**
  - **Intra-Day:** **NO** (same-day idempotency key).
  - **Cross-Day:** **YES.**  
    *Code Evidence:* `${req.id}_pending_${todayStr}` changes daily, re-alerting STORES and ADMIN every 24 hours.
- **Recipient Resolution:**
  - `PERMITTED_EMAIL_CONFIG['CONSUMABLE_PENDING_2_DAYS']`: Roles `['STORES', 'ADMIN']`

---

### Sweep 6: Delivery Challan QC Pending (>24h) (Phase 5 Sweep 4)
- **Service & Method:** `AlertSweepService.sweepDcQcPending()` (`backend/src/alert-sweeps/alert-sweeps.service.ts#L355-500`)
- **Schedule:** `@Cron(process.env.ALERT_SWEEP_CRON_SCHEDULE || CronExpression.EVERY_HOUR)` via `runAllSweeps()`
- **Database Query:**
  ```typescript
  this.dcItemRepo
    .createQueryBuilder('dci')
    .innerJoinAndSelect('dci.challan', 'dc')
    .leftJoinAndSelect('dci.product', 'p')
    .where('dci.qc_pending_qty > 0')
    .andWhere('dc.status != :closedStatus', { closedStatus: DeliveryChallanStatus.CLOSED })
    .getMany();
  ```
- **Events Generated:**
  - `DC_QC_PENDING_24H`
  - Entity ID: `${dc.id}_qc_${todayStr}` (already aggregates items per DC in HTML, but sends 1 email per DC per recipient).
- **Re-alerted on Every Run:**
  - **Intra-Day:** **NO** (same-day idempotency key).
  - **Cross-Day:** **YES.**  
    *Code Evidence:* The watch table (`email_alert_watch`) records `firstSeenAt` but has no last-alerted tracking. `${dc.id}_qc_${todayStr}` changes daily, triggering re-alerts every 24 hours.
- **Recipient Resolution:**
  - `PERMITTED_EMAIL_CONFIG['DC_QC_PENDING_24H']`: Roles `['STORES', 'SENIOR_MANAGER']`

---

### Sweep 7: Inventory MSL Reconciliation Sweep (For Reference)
- **Service & Method:** `MslTriggerService.handleScheduledCron()` -> `MslAlertService.evaluateAllAndAlert()` (`backend/src/inventory/msl-alert.service.ts#L58-82`)
- **Schedule:** `@Cron(process.env.MSL_CRON_SCHEDULE || CronExpression.EVERY_HOUR)`
- **Events Generated:** `MSL_LOW_STOCK`, `MSL_CRITICAL`, `MSL_OUT_OF_STOCK`, `MSL_RESOLVED`.
- **Re-alerted on Every Run:** **NO.**  
  *Code Evidence:* `msl-alert.service.ts#L58-82` checks for an existing `MslAlert` with `status: ACTIVE`. If present, it logs `[DUPLICATE SUPPRESSION]` and skips dispatching communication events.

---

## 3. Summary of Sweep Behavior & Root Cause of Queue Flood

| Sweep Name | Cron Schedule | Query Scope | Event Code(s) | Recipient Roles | Same Unchanged Item Re-alerted? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Consumables SLA** | Hourly | Pending items $>24$h / Partial | `CONSUMABLE_RECEIPT_OVERDUE`<br>`CONSUMABLE_PARTIALLY_ISSUED_OVERDUE` | STORES, ADMIN<br>STORES, ADMIN, PROD | **YES** (Daily re-alert at 00:00 UTC) |
| **DC Return SLA** | Hourly | Open/Dispatched/Partial DCs | `DC_OVERDUE`<br>`DC_APPROACHING_SLA` | STORES | **YES** (Daily re-alert at 00:00 UTC) |
| **Material Issue Overdue** | Hourly | Reviewed RMs $>24$h unissued | `MATERIAL_ISSUE_OVERDUE_24H` | STORES, GM | **YES** (Daily re-alert at 00:00 UTC) |
| **DC Pending 2 Days** | Hourly | Dispatched DCs $>48$h | `DC_PENDING_2_DAYS` | STORES, SM | **YES** (Daily re-alert at 00:00 UTC) |
| **Consumable Pending 2 Days** | Hourly | Consumable requests $>48$h | `CONSUMABLE_PENDING_2_DAYS` | STORES, ADMIN | **YES** (Daily re-alert at 00:00 UTC) |
| **DC QC Pending 24H** | Hourly | Dock inwarded items $>24$h in QC | `DC_QC_PENDING_24H` | STORES, SM | **YES** (Daily re-alert at 00:00 UTC) |
| **MSL Stock Reconciliation** | Hourly | All inventory products below MSL | `MSL_LOW_STOCK`, `MSL_OUT_OF_STOCK` | STORES | **NO** (Suppressed by Active Alert record) |

### Key Takeaways for Solution Design
1. **Discrete Item Multiplication**:
   When 30 consumable items breach SLA and 5 users are assigned to STORES/ADMIN, $30 \times 5 = 150$ jobs are created. Combining this with 4 Phase 5 sweeps and DC sweeps creates bursts of over 270 individual emails.
2. **Missing Digest Grouping**:
   Users receive 30 separate emails in their inbox for the same event category instead of 1 comprehensive digest table.
3. **No Dynamic Cooldown Tracking**:
   Cooldown currently depends solely on UTC date string boundaries (`YYYY-MM-DD`). There is no persistent per-recipient, per-entity alert state tracking (`alert_notification_state`) with configurable hour cooldowns (`ALERT_REALERT_COOLDOWN_HOURS`).
4. **No Priority Lanes**:
   All jobs (both critical workflow transactional emails like RM approvals and background sweep alerts) are enqueued into a flat FIFO queue with equal priority, causing critical transactional emails to get blocked behind large batches of alert sweep emails.
