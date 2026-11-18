import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThanOrEqual, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailAlertWatch } from './entities/email-alert-watch.entity.js';
import { SystemSetting } from '../notifications/entities/system-setting.entity.js';
import { DeliveryChallan, DeliveryChallanStatus } from '../delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../delivery-challan/entities/delivery-challan-item.entity.js';
import { ConsumableRequest } from '../consumables/entities/consumable-request.entity.js';
import { ConsumableRequestItem, ConsumableItemStatus } from '../consumables/entities/consumable-request-item.entity.js';
import { RmRequest, RmRequestStatus } from '../rm/entities/rm-request.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { CommunicationService } from '../notifications/communication.service.js';
import { AlertDigestService, AlertDigestItem } from '../email/alert-digest.service.js';

export interface SweepConfigDef {
  eventCode: string;
  label: string;
  category: string;
  switchKey: string;
  thresholdKey: string;
  defaultHours: number;
}

export const SWEEP_CONFIGS: Record<string, SweepConfigDef> = {
  MATERIAL_ISSUE_OVERDUE_24H: {
    eventCode: 'MATERIAL_ISSUE_OVERDUE_24H',
    label: 'Material Issue Overdue (>24h)',
    category: 'Material Issue',
    switchKey: 'MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED',
    thresholdKey: 'MATERIAL_ISSUE_OVERDUE_ALERT_HOURS',
    defaultHours: 24,
  },
  DC_PENDING_2_DAYS: {
    eventCode: 'DC_PENDING_2_DAYS',
    label: 'Delivery Challan Not Returned (>2 Days)',
    category: 'Delivery Challan',
    switchKey: 'DC_PENDING_ALERTS_ENABLED',
    thresholdKey: 'DC_PENDING_ALERT_HOURS',
    defaultHours: 48,
  },
  CONSUMABLE_PENDING_2_DAYS: {
    eventCode: 'CONSUMABLE_PENDING_2_DAYS',
    label: 'Consumable Request Open (>2 Days)',
    category: 'Consumables',
    switchKey: 'CONSUMABLE_PENDING_ALERTS_ENABLED',
    thresholdKey: 'CONSUMABLE_PENDING_ALERT_HOURS',
    defaultHours: 48,
  },
  DC_QC_PENDING_24H: {
    eventCode: 'DC_QC_PENDING_24H',
    label: 'Delivery Challan QC Inspection Pending (>24h)',
    category: 'Delivery Challan',
    switchKey: 'DC_QC_PENDING_ALERTS_ENABLED',
    thresholdKey: 'DC_QC_PENDING_ALERT_HOURS',
    defaultHours: 24,
  },
};

export interface SweepPreviewItem {
  id: string;
  referenceNumber: string;
  hoursPending: number;
  details?: Record<string, any>;
}

export interface SweepPreviewResult {
  matchCount: number;
  sample: SweepPreviewItem[];
  notYetTimedCount?: number;
}

@Injectable()
export class AlertSweepService {
  private readonly logger = new Logger(AlertSweepService.name);

  constructor(
    @InjectRepository(EmailAlertWatch)
    private readonly watchRepo: Repository<EmailAlertWatch>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepo: Repository<SystemSetting>,
    @InjectRepository(DeliveryChallan)
    private readonly dcRepo: Repository<DeliveryChallan>,
    @InjectRepository(DeliveryChallanItem)
    private readonly dcItemRepo: Repository<DeliveryChallanItem>,
    @InjectRepository(ConsumableRequest)
    private readonly consumableRequestRepo: Repository<ConsumableRequest>,
    @InjectRepository(ConsumableRequestItem)
    private readonly consumableItemRepo: Repository<ConsumableRequestItem>,
    @InjectRepository(RmRequest)
    private readonly rmRequestRepo: Repository<RmRequest>,
    @InjectRepository(MaterialIssue)
    private readonly materialIssueRepo: Repository<MaterialIssue>,
    private readonly communicationService: CommunicationService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly alertDigestService?: AlertDigestService,
  ) {}

  /**
   * Helper: reads setting value from system_settings table.
   */
  async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.systemSettingRepo.findOne({ where: { key } });
    return setting && setting.value ? String(setting.value).trim() : null;
  }

  /**
   * Helper: checks if sweep is enabled (default false). Missing row means OFF.
   */
  async isSweepEnabled(config: SweepConfigDef): Promise<boolean> {
    const val = await this.getSettingValue(config.switchKey);
    if (!val) return false;
    return val.toLowerCase() === 'true' || val === '1';
  }

  /**
   * Helper: reads threshold hours from system_settings (or default).
   */
  async getThresholdHours(config: SweepConfigDef): Promise<number> {
    let val = await this.getSettingValue(config.thresholdKey);
    // Fallback for MATERIAL_ISSUE_OVERDUE_HOURS if MATERIAL_ISSUE_OVERDUE_ALERT_HOURS is not set
    if (!val && config.eventCode === 'MATERIAL_ISSUE_OVERDUE_24H') {
      val = await this.getSettingValue('MATERIAL_ISSUE_OVERDUE_HOURS');
    }
    if (!val) return config.defaultHours;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 1 || parsed > 720 ? config.defaultHours : parsed;
  }

  /**
   * Enterprise Automated Sweep runner: scheduled hourly via NestJS @Cron.
   * Runs all 4 sweeps. Each sweep is fully isolated with try-catch.
   */
  @Cron(process.env.ALERT_SWEEP_CRON_SCHEDULE || CronExpression.EVERY_HOUR)
  async runAllSweeps(): Promise<{
    materialIssueAlerts: number;
    dcPendingAlerts: number;
    consumablePendingAlerts: number;
    dcQcAlerts: number;
  }> {
    this.logger.log('Executing automated hourly overdue alert sweeps...');

    let materialIssueAlerts = 0;
    let dcPendingAlerts = 0;
    let consumablePendingAlerts = 0;
    let dcQcAlerts = 0;

    try {
      materialIssueAlerts = await this.sweepMaterialIssueOverdue();
    } catch (err: any) {
      this.logger.error(`[MATERIAL_ISSUE_OVERDUE_24H] Sweep error: ${err?.message || err}`);
    }

    try {
      dcPendingAlerts = await this.sweepDcPending();
    } catch (err: any) {
      this.logger.error(`[DC_PENDING_2_DAYS] Sweep error: ${err?.message || err}`);
    }

    try {
      consumablePendingAlerts = await this.sweepConsumablePending();
    } catch (err: any) {
      this.logger.error(`[CONSUMABLE_PENDING_2_DAYS] Sweep error: ${err?.message || err}`);
    }

    try {
      dcQcAlerts = await this.sweepDcQcPending();
    } catch (err: any) {
      this.logger.error(`[DC_QC_PENDING_24H] Sweep error: ${err?.message || err}`);
    }

    return {
      materialIssueAlerts,
      dcPendingAlerts,
      consumablePendingAlerts,
      dcQcAlerts,
    };
  }

  /**
   * 1. MATERIAL_ISSUE_OVERDUE_24H Sweep
   * Approved RM request not issued to production for > threshold hours.
   */
  async sweepMaterialIssueOverdue(): Promise<number> {
    const config = SWEEP_CONFIGS.MATERIAL_ISSUE_OVERDUE_24H;
    const isEnabled = await this.isSweepEnabled(config);
    if (!isEnabled) {
      return 0; // Switch OFF: immediate return with zero DB queries on business tables
    }

    const thresholdHours = await this.getThresholdHours(config);
    const now = new Date();
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    // Find RM requests in REVIEWED status where no INITIAL_ISSUE material_issues record exists yet
    const overdueRmList = await this.rmRequestRepo
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

    const digestMode = this.alertDigestService ? await this.alertDigestService.getMode() : 'OFF';
    const digestItems: AlertDigestItem[] = [];

    let dispatchedCount = 0;
    for (const rm of overdueRmList) {
      const refTime = rm.reviewedAt ? new Date(rm.reviewedAt).getTime() : new Date(rm.createdAt).getTime();
      const hoursOverdue = Math.max(thresholdHours, Math.floor((now.getTime() - refTime) / (1000 * 60 * 60)));
      const rmNumber = rm.salesOrderComponent?.scNumber || rm.id.slice(0, 8);

      digestItems.push({
        entityId: rm.id,
        entityType: 'MATERIAL_ISSUE',
        itemRef: rmNumber,
        ageOrOverdue: `${hoursOverdue}h overdue`,
        ownerOrVendor: rm.createdBy?.name || 'Designer',
        directLink: '/stores/issue',
        metadata: {
          rmNumber,
          hoursOverdue,
          reviewedAt: rm.reviewedAt ? rm.reviewedAt.toISOString() : rm.createdAt.toISOString(),
          designerName: rm.createdBy?.name || 'Designer',
        },
      });

      if (digestMode === 'OFF' || digestMode === 'SHADOW') {
        try {
          await this.communicationService.sendEvent({
            eventType: 'MATERIAL_ISSUE_OVERDUE_24H',
            entityType: 'MATERIAL_ISSUE',
            entityId: `${rm.id}_issue_${todayStr}`,
            metadata: {
              rmNumber,
              hoursOverdue,
              reviewedAt: rm.reviewedAt ? rm.reviewedAt.toISOString() : rm.createdAt.toISOString(),
              designerName: rm.createdBy?.name || 'Designer',
            },
          });
          dispatchedCount++;
        } catch (err: any) {
          this.logger.error(`Failed to dispatch MATERIAL_ISSUE_OVERDUE_24H for RM "${rm.id}": ${err?.message || err}`);
        }
      }
    }

    if ((digestMode === 'SHADOW' || digestMode === 'ON') && this.alertDigestService && digestItems.length > 0) {
      const digestJobs = await this.alertDigestService.buildDigests('MATERIAL_ISSUE_OVERDUE_24H', digestItems);
      if (digestMode === 'ON') {
        dispatchedCount = digestJobs.length;
      }
    }

    return dispatchedCount;
  }

  /**
   * 2. DC_PENDING_2_DAYS Sweep
   * DC created > threshold hours ago and status is DISPATCHED or PARTIALLY_RETURNED.
   */
  async sweepDcPending(): Promise<number> {
    const config = SWEEP_CONFIGS.DC_PENDING_2_DAYS;
    const isEnabled = await this.isSweepEnabled(config);
    if (!isEnabled) {
      return 0; // Switch OFF: immediate return
    }

    const thresholdHours = await this.getThresholdHours(config);
    const now = new Date();
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    const overdueDcs = await this.dcRepo.find({
      where: {
        status: In([DeliveryChallanStatus.DISPATCHED, DeliveryChallanStatus.PARTIALLY_RETURNED]),
        createdAt: LessThanOrEqual(cutoff),
      },
      relations: { vendor: true },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    const digestMode = this.alertDigestService ? await this.alertDigestService.getMode() : 'OFF';
    const digestItems: AlertDigestItem[] = [];

    let dispatchedCount = 0;
    for (const dc of overdueDcs) {
      const elapsedMs = now.getTime() - new Date(dc.createdAt).getTime();
      const daysPending = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

      digestItems.push({
        entityId: dc.id,
        entityType: 'DELIVERY_CHALLAN',
        itemRef: dc.challanNumber,
        ageOrOverdue: `${daysPending} days pending`,
        ownerOrVendor: dc.vendor?.name || 'N/A',
        directLink: '/dispatch/delivery-challan',
        metadata: {
          challanNumber: dc.challanNumber,
          vendorName: dc.vendor?.name || 'N/A',
          dispatchDate: dc.dispatchDate ? new Date(dc.dispatchDate).toISOString().split('T')[0] : 'N/A',
          createdAt: dc.createdAt ? new Date(dc.createdAt).toISOString().split('T')[0] : 'N/A',
          daysPending,
        },
      });

      if (digestMode === 'OFF' || digestMode === 'SHADOW') {
        try {
          await this.communicationService.sendEvent({
            eventType: 'DC_PENDING_2_DAYS',
            entityType: 'DELIVERY_CHALLAN',
            entityId: `${dc.id}_pending_${todayStr}`,
            metadata: {
              challanNumber: dc.challanNumber,
              vendorName: dc.vendor?.name || 'N/A',
              dispatchDate: dc.dispatchDate ? new Date(dc.dispatchDate).toISOString().split('T')[0] : 'N/A',
              createdAt: dc.createdAt ? new Date(dc.createdAt).toISOString().split('T')[0] : 'N/A',
              daysPending,
            },
          });
          dispatchedCount++;
        } catch (err: any) {
          this.logger.error(`Failed to dispatch DC_PENDING_2_DAYS for DC "${dc.challanNumber}": ${err?.message || err}`);
        }
      }
    }

    if ((digestMode === 'SHADOW' || digestMode === 'ON') && this.alertDigestService && digestItems.length > 0) {
      const digestJobs = await this.alertDigestService.buildDigests('DC_PENDING_2_DAYS', digestItems);
      if (digestMode === 'ON') {
        dispatchedCount = digestJobs.length;
      }
    }

    return dispatchedCount;
  }

  /**
   * 3. CONSUMABLE_PENDING_2_DAYS Sweep
   * Consumable request created > threshold hours ago and has non-terminal items.
   */
  async sweepConsumablePending(): Promise<number> {
    const config = SWEEP_CONFIGS.CONSUMABLE_PENDING_2_DAYS;
    const isEnabled = await this.isSweepEnabled(config);
    if (!isEnabled) {
      return 0; // Switch OFF: immediate return
    }

    const thresholdHours = await this.getThresholdHours(config);
    const now = new Date();
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    // Non-terminal statuses for consumable items
    const nonTerminalStatuses = [
      ConsumableItemStatus.OPEN,
      ConsumableItemStatus.PURCHASE_REQUESTED,
      ConsumableItemStatus.PURCHASE_RECEIVED,
      ConsumableItemStatus.READY_FOR_ISSUE,
      ConsumableItemStatus.PARTIALLY_ISSUED,
    ];

    const pendingRequests = await this.consumableRequestRepo
      .createQueryBuilder('req')
      .innerJoinAndSelect('req.items', 'item')
      .where('req.created_at <= :cutoff', { cutoff })
      .andWhere('item.status IN (:...statuses)', { statuses: nonTerminalStatuses })
      .orderBy('req.created_at', 'ASC')
      .take(20)
      .getMany();

    const digestMode = this.alertDigestService ? await this.alertDigestService.getMode() : 'OFF';
    const digestItems: AlertDigestItem[] = [];

    let dispatchedCount = 0;
    for (const req of pendingRequests) {
      const elapsedMs = now.getTime() - new Date(req.createdAt).getTime();
      const daysPending = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
      const pendingItemsCount = req.items.filter((i) => nonTerminalStatuses.includes(i.status)).length;

      digestItems.push({
        entityId: req.id,
        entityType: 'CONSUMABLE_REQUEST',
        itemRef: req.requestCode,
        ageOrOverdue: `${daysPending} days pending (${pendingItemsCount} items)`,
        ownerOrVendor: req.requestedBy || 'N/A',
        directLink: '/consumables/requests',
        metadata: {
          requestCode: req.requestCode,
          requestedBy: req.requestedBy || 'N/A',
          createdAt: req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : 'N/A',
          daysPending,
          itemsCount: pendingItemsCount,
        },
      });

      if (digestMode === 'OFF' || digestMode === 'SHADOW') {
        try {
          await this.communicationService.sendEvent({
            eventType: 'CONSUMABLE_PENDING_2_DAYS',
            entityType: 'CONSUMABLE_REQUEST',
            entityId: `${req.id}_pending_${todayStr}`,
            metadata: {
              requestCode: req.requestCode,
              requestedBy: req.requestedBy || 'N/A',
              createdAt: req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : 'N/A',
              daysPending,
              itemsCount: pendingItemsCount,
            },
          });
          dispatchedCount++;
        } catch (err: any) {
          this.logger.error(`Failed to dispatch CONSUMABLE_PENDING_2_DAYS for request "${req.requestCode}": ${err?.message || err}`);
        }
      }
    }

    if ((digestMode === 'SHADOW' || digestMode === 'ON') && this.alertDigestService && digestItems.length > 0) {
      const digestJobs = await this.alertDigestService.buildDigests('CONSUMABLE_PENDING_2_DAYS', digestItems);
      if (digestMode === 'ON') {
        dispatchedCount = digestJobs.length;
      }
    }

    return dispatchedCount;
  }

  /**
   * 4. DC_QC_PENDING_24H Sweep
   * Items inwarded at dock with qc_pending_qty > 0 on non-CLOSED DCs.
   * Uses email_alert_watch to track elapsed duration since item first entered QC.
   * Aggregates all overdue items for one DC into a single email notification.
   */
  async sweepDcQcPending(): Promise<number> {
    const config = SWEEP_CONFIGS.DC_QC_PENDING_24H;
    const isEnabled = await this.isSweepEnabled(config);
    if (!isEnabled) {
      return 0; // Switch OFF: immediate return
    }

    const thresholdHours = await this.getThresholdHours(config);
    const now = new Date();
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    // 1. Reconcile Watch Table:
    // a) Find all active items in QC (qc_pending_qty > 0 and DC status != CLOSED)
    const activeQcItems = await this.dcItemRepo
      .createQueryBuilder('dci')
      .innerJoinAndSelect('dci.challan', 'dc')
      .leftJoinAndSelect('dci.product', 'p')
      .where('dci.qc_pending_qty > 0')
      .andWhere('dc.status != :closedStatus', { closedStatus: DeliveryChallanStatus.CLOSED })
      .getMany();

    const activeItemIds = new Set(activeQcItems.map((i) => i.id));

    // b) Read existing watch records for DC_QC_PENDING_24H
    const existingWatches = await this.watchRepo.find({
      where: { alertCode: 'DC_QC_PENDING_24H' },
    });
    const watchMap = new Map<string, EmailAlertWatch>();
    for (const w of existingWatches) {
      watchMap.set(w.entityId, w);
    }

    // c) Delete watch rows whose items are no longer active in QC
    const watchesToDelete = existingWatches.filter((w) => !activeItemIds.has(w.entityId));
    if (watchesToDelete.length > 0) {
      await this.watchRepo.delete({ id: In(watchesToDelete.map((w) => w.id)) });
    }

    // d) Insert newly seen items into email_alert_watch
    const newItemsToWatch = activeQcItems.filter((i) => !watchMap.has(i.id));
    for (const item of newItemsToWatch) {
      try {
        const created = await this.watchRepo.save(
          this.watchRepo.create({
            alertCode: 'DC_QC_PENDING_24H',
            entityType: 'DC_ITEM',
            entityId: item.id,
            firstSeenAt: now,
          }),
        );
        watchMap.set(item.id, created);
      } catch (err: any) {
        // Unique conflict is safe to ignore
      }
    }

    // 2. Identify Overdue Items:
    // Filter items where watch.firstSeenAt <= cutoff
    const overdueItems = activeQcItems.filter((item) => {
      const watch = watchMap.get(item.id);
      return watch && new Date(watch.firstSeenAt).getTime() <= cutoff.getTime();
    });

    if (overdueItems.length === 0) {
      return 0;
    }

    // 3. Aggregate by Delivery Challan:
    const dcMap = new Map<string, { dc: DeliveryChallan; items: DeliveryChallanItem[]; oldestFirstSeenAt: number }>();
    for (const item of overdueItems) {
      const challanId = item.challanId;
      const watch = watchMap.get(item.id)!;
      const firstSeenTime = new Date(watch.firstSeenAt).getTime();

      if (!dcMap.has(challanId)) {
        dcMap.set(challanId, {
          dc: item.challan,
          items: [],
          oldestFirstSeenAt: firstSeenTime,
        });
      }
      const entry = dcMap.get(challanId)!;
      entry.items.push(item);
      if (firstSeenTime < entry.oldestFirstSeenAt) {
        entry.oldestFirstSeenAt = firstSeenTime;
      }
    }

    // Sort challans oldest first, cap at 20
    const sortedChallans = Array.from(dcMap.values())
      .sort((a, b) => a.oldestFirstSeenAt - b.oldestFirstSeenAt)
      .slice(0, 20);

    const digestMode = this.alertDigestService ? await this.alertDigestService.getMode() : 'OFF';
    const digestItems: AlertDigestItem[] = [];

    let dispatchedCount = 0;
    for (const { dc, items } of sortedChallans) {
      digestItems.push({
        entityId: dc.id,
        entityType: 'DELIVERY_CHALLAN',
        itemRef: dc.challanNumber,
        ageOrOverdue: `${items.length} item(s) in QC (>24h)`,
        ownerOrVendor: dc.vendor?.name || 'N/A',
        directLink: '/dock/receipt',
        metadata: {
          challanNumber: dc.challanNumber,
          itemsCount: items.length,
        },
      });

      if (digestMode === 'OFF' || digestMode === 'SHADOW') {
        // Build HTML table for aggregated items
        const rowsHtml = items
          .map((it) => {
            const watch = watchMap.get(it.id);
            const hours = watch
              ? Math.max(thresholdHours, Math.floor((now.getTime() - new Date(watch.firstSeenAt).getTime()) / (1000 * 60 * 60)))
              : thresholdHours;
            const name = it.partName || it.product?.name || it.partNumber || 'DC Part';
            return `
              <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${it.partNumber || 'N/A'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${name}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #7c3aed;">${it.qcPendingQty}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626; font-weight: 600;">${hours}h</td>
              </tr>
            `;
          })
          .join('');

        const itemsTableHtml = `
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
            <thead>
              <tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 8px 12px;">Part Number</th>
                <th style="padding: 8px 12px;">Description</th>
                <th style="padding: 8px 12px; text-align: right;">Pending QC Qty</th>
                <th style="padding: 8px 12px; text-align: right;">Time in QC</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;

        try {
          await this.communicationService.sendEvent({
            eventType: 'DC_QC_PENDING_24H',
            entityType: 'DELIVERY_CHALLAN',
            entityId: `${dc.id}_qc_${todayStr}`,
            metadata: {
              challanNumber: dc.challanNumber,
              vendorName: dc.vendor?.name || 'N/A',
              itemsTableHtml,
              itemsCount: items.length,
              hoursPending: thresholdHours,
            },
          });
          dispatchedCount++;
        } catch (err: any) {
          this.logger.error(`Failed to dispatch DC_QC_PENDING_24H for DC "${dc.challanNumber}": ${err?.message || err}`);
        }
      }
    }

    if ((digestMode === 'SHADOW' || digestMode === 'ON') && this.alertDigestService && digestItems.length > 0) {
      const digestJobs = await this.alertDigestService.buildDigests('DC_QC_PENDING_24H', digestItems);
      if (digestMode === 'ON') {
        dispatchedCount = digestJobs.length;
      }
    }

    return dispatchedCount;
  }

  /**
   * Read-only Preview Method for Admin UI:
   * Returns matching items without sending any email or modifying the watch table.
   * Works regardless of switch ON/OFF status.
   */
  async previewSweep(eventCode: string): Promise<SweepPreviewResult> {
    const config = SWEEP_CONFIGS[eventCode];
    if (!config) {
      return { matchCount: 0, sample: [] };
    }

    const thresholdHours = await this.getThresholdHours(config);
    const now = new Date();
    const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);

    switch (eventCode) {
      case 'MATERIAL_ISSUE_OVERDUE_24H': {
        const qb = this.rmRequestRepo
          .createQueryBuilder('rm')
          .leftJoinAndSelect('rm.createdBy', 'creator')
          .leftJoinAndSelect('rm.salesOrderComponent', 'sc')
          .leftJoin('material_issues', 'mi', "mi.sc_id = rm.sc_id AND mi.issue_type = 'INITIAL_ISSUE'")
          .where('rm.status = :status', { status: RmRequestStatus.REVIEWED })
          .andWhere('mi.id IS NULL')
          .andWhere('COALESCE(rm.reviewed_at, rm.created_at) <= :cutoff', { cutoff })
          .orderBy('COALESCE(rm.reviewed_at, rm.created_at)', 'ASC');

        const totalCount = await qb.getCount();
        const sampleRecords = await qb.take(20).getMany();

        const sample: SweepPreviewItem[] = sampleRecords.map((rm) => {
          const refTime = rm.reviewedAt ? new Date(rm.reviewedAt).getTime() : new Date(rm.createdAt).getTime();
          const hoursPending = Math.floor((now.getTime() - refTime) / (1000 * 60 * 60));
          return {
            id: rm.id,
            referenceNumber: rm.salesOrderComponent?.scNumber || rm.id.slice(0, 8),
            hoursPending,
            details: {
              approvedAt: rm.reviewedAt ? rm.reviewedAt.toISOString() : rm.createdAt.toISOString(),
              designer: rm.createdBy?.name || 'Designer',
            },
          };
        });

        return { matchCount: totalCount, sample };
      }

      case 'DC_PENDING_2_DAYS': {
        const qb = this.dcRepo
          .createQueryBuilder('dc')
          .leftJoinAndSelect('dc.vendor', 'vendor')
          .where('dc.status IN (:...statuses)', {
            statuses: [DeliveryChallanStatus.DISPATCHED, DeliveryChallanStatus.PARTIALLY_RETURNED],
          })
          .andWhere('dc.created_at <= :cutoff', { cutoff })
          .orderBy('dc.created_at', 'ASC');

        const totalCount = await qb.getCount();
        const sampleRecords = await qb.take(20).getMany();

        const sample: SweepPreviewItem[] = sampleRecords.map((dc) => {
          const hoursPending = Math.floor((now.getTime() - new Date(dc.createdAt).getTime()) / (1000 * 60 * 60));
          return {
            id: dc.id,
            referenceNumber: dc.challanNumber,
            hoursPending,
            details: {
              vendor: dc.vendor?.name || 'N/A',
              status: dc.status,
              createdAt: dc.createdAt.toISOString(),
            },
          };
        });

        return { matchCount: totalCount, sample };
      }

      case 'CONSUMABLE_PENDING_2_DAYS': {
        const nonTerminalStatuses = [
          ConsumableItemStatus.OPEN,
          ConsumableItemStatus.PURCHASE_REQUESTED,
          ConsumableItemStatus.PURCHASE_RECEIVED,
          ConsumableItemStatus.READY_FOR_ISSUE,
          ConsumableItemStatus.PARTIALLY_ISSUED,
        ];

        const qb = this.consumableRequestRepo
          .createQueryBuilder('req')
          .innerJoin('req.items', 'item')
          .where('req.created_at <= :cutoff', { cutoff })
          .andWhere('item.status IN (:...statuses)', { statuses: nonTerminalStatuses })
          .groupBy('req.id')
          .orderBy('req.created_at', 'ASC');

        const totalCount = await qb.getCount();
        const sampleRecords = await this.consumableRequestRepo
          .createQueryBuilder('req')
          .innerJoinAndSelect('req.items', 'item')
          .where('req.created_at <= :cutoff', { cutoff })
          .andWhere('item.status IN (:...statuses)', { statuses: nonTerminalStatuses })
          .orderBy('req.created_at', 'ASC')
          .take(20)
          .getMany();

        const sample: SweepPreviewItem[] = sampleRecords.map((req) => {
          const hoursPending = Math.floor((now.getTime() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60));
          return {
            id: req.id,
            referenceNumber: req.requestCode,
            hoursPending,
            details: {
              requestedBy: req.requestedBy || 'N/A',
              createdAt: req.createdAt.toISOString(),
              pendingItemsCount: req.items.filter((i) => nonTerminalStatuses.includes(i.status)).length,
            },
          };
        });

        return { matchCount: totalCount, sample };
      }

      case 'DC_QC_PENDING_24H': {
        // Find items currently in QC
        const activeItems = await this.dcItemRepo
          .createQueryBuilder('dci')
          .innerJoinAndSelect('dci.challan', 'dc')
          .leftJoinAndSelect('dci.product', 'p')
          .where('dci.qc_pending_qty > 0')
          .andWhere('dc.status != :closedStatus', { closedStatus: DeliveryChallanStatus.CLOSED })
          .getMany();

        // Read watch table strictly read-only
        const watched = await this.watchRepo.find({
          where: { alertCode: 'DC_QC_PENDING_24H' },
        });
        const watchMap = new Map<string, EmailAlertWatch>();
        for (const w of watched) {
          watchMap.set(w.entityId, w);
        }

        let notYetTimedCount = 0;
        const overdueDcsMap = new Map<string, { dc: DeliveryChallan; items: DeliveryChallanItem[]; oldestTime: number }>();

        for (const item of activeItems) {
          const watch = watchMap.get(item.id);
          if (!watch) {
            notYetTimedCount++;
            continue;
          }
          const watchTime = new Date(watch.firstSeenAt).getTime();
          if (watchTime <= cutoff.getTime()) {
            if (!overdueDcsMap.has(item.challanId)) {
              overdueDcsMap.set(item.challanId, {
                dc: item.challan,
                items: [],
                oldestTime: watchTime,
              });
            }
            overdueDcsMap.get(item.challanId)!.items.push(item);
          }
        }

        const sortedDcs = Array.from(overdueDcsMap.values())
          .sort((a, b) => a.oldestTime - b.oldestTime);

        const sample: SweepPreviewItem[] = sortedDcs.slice(0, 20).map(({ dc, items, oldestTime }) => {
          const hoursPending = Math.floor((now.getTime() - oldestTime) / (1000 * 60 * 60));
          return {
            id: dc.id,
            referenceNumber: dc.challanNumber,
            hoursPending,
            details: {
              vendor: dc.vendor?.name || 'N/A',
              itemCount: items.length,
            },
          };
        });

        return {
          matchCount: sortedDcs.length,
          sample,
          notYetTimedCount,
        };
      }

      default:
        return { matchCount: 0, sample: [] };
    }
  }

  /**
   * Returns configuration status for all 4 sweeps.
   */
  async getAllSweepConfigs(): Promise<Array<{
    eventCode: string;
    label: string;
    category: string;
    enabled: boolean;
    thresholdHours: number;
    defaultHours: number;
    switchKey: string;
    thresholdKey: string;
  }>> {
    const results = [];
    for (const config of Object.values(SWEEP_CONFIGS)) {
      const enabled = await this.isSweepEnabled(config);
      const thresholdHours = await this.getThresholdHours(config);
      results.push({
        eventCode: config.eventCode,
        label: config.label,
        category: config.category,
        enabled,
        thresholdHours,
        defaultHours: config.defaultHours,
        switchKey: config.switchKey,
        thresholdKey: config.thresholdKey,
      });
    }
    return results;
  }

  /**
   * Updates configuration for a sweep.
   */
  async updateSweepConfig(
    eventCode: string,
    enabled: boolean,
    thresholdHours: number,
    actorUserId: string,
  ): Promise<{
    eventCode: string;
    enabled: boolean;
    thresholdHours: number;
  }> {
    const config = SWEEP_CONFIGS[eventCode];
    if (!config) {
      throw new Error(`Unknown sweep eventCode "${eventCode}".`);
    }

    if (thresholdHours < 1 || thresholdHours > 720) {
      throw new Error(`Threshold hours must be an integer between 1 and 720.`);
    }

    await this.dataSource.transaction(async (manager) => {
      const settingRepo = manager.getRepository(SystemSetting);

      // 1. Save switch key
      let switchSetting = await settingRepo.findOne({ where: { key: config.switchKey } });
      if (switchSetting) {
        switchSetting.value = String(enabled);
        switchSetting.updatedBy = actorUserId;
        switchSetting.updatedAt = new Date();
        await settingRepo.save(switchSetting);
      } else {
        await settingRepo.save(
          settingRepo.create({
            key: config.switchKey,
            value: String(enabled),
            updatedBy: actorUserId,
          }),
        );
      }

      // 2. Save threshold key
      let thresholdSetting = await settingRepo.findOne({ where: { key: config.thresholdKey } });
      if (thresholdSetting) {
        thresholdSetting.value = String(thresholdHours);
        thresholdSetting.updatedBy = actorUserId;
        thresholdSetting.updatedAt = new Date();
        await settingRepo.save(thresholdSetting);
      } else {
        await settingRepo.save(
          settingRepo.create({
            key: config.thresholdKey,
            value: String(thresholdHours),
            updatedBy: actorUserId,
          }),
        );
      }

      // If Material Issue, sync with legacy key MATERIAL_ISSUE_OVERDUE_HOURS too
      if (eventCode === 'MATERIAL_ISSUE_OVERDUE_24H') {
        let legacySetting = await settingRepo.findOne({ where: { key: 'MATERIAL_ISSUE_OVERDUE_HOURS' } });
        if (legacySetting) {
          legacySetting.value = String(thresholdHours);
          legacySetting.updatedBy = actorUserId;
          legacySetting.updatedAt = new Date();
          await settingRepo.save(legacySetting);
        } else {
          await settingRepo.save(
            settingRepo.create({
              key: 'MATERIAL_ISSUE_OVERDUE_HOURS',
              value: String(thresholdHours),
              updatedBy: actorUserId,
            }),
          );
        }
      }
    });

    this.logger.log(
      `[AlertSweepService] Sweep "${eventCode}" updated: enabled=${enabled}, thresholdHours=${thresholdHours} by user "${actorUserId}"`,
    );

    return {
      eventCode,
      enabled,
      thresholdHours,
    };
  }
}
