import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { AlertNotificationState } from './entities/alert-notification-state.entity.js';
import { DigestShadowLog } from './entities/digest-shadow-log.entity.js';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailQueueService } from './email-queue.service.js';
import { SystemSetting } from '../notifications/entities/system-setting.entity.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationPreferenceService } from '../notifications/notification-preference.service.js';
import { EmailSkipLogService } from '../notifications/email-skip-log.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PERMITTED_EMAIL_CONFIG } from '../notifications/communication.service.js';

export type AlertDigestMode = 'OFF' | 'SHADOW' | 'ON';

export interface AlertDigestItem {
  entityId: string;
  entityType: string;
  itemRef: string;
  ageOrOverdue: string | number;
  ownerOrVendor?: string | null;
  directLink?: string | null;
  metadata?: Record<string, any>;
}

export interface DigestPreviewItemBreakdown {
  eventCode: string;
  totalEligibleItems: number;
  recipientCount: number;
  digestJobsCount: number;
  maxItemsInSingleDigest: number;
  exceeds50Rows: boolean;
  recipients: Array<{
    recipientId: string;
    recipientEmail: string;
    itemCount: number;
  }>;
}

export interface DigestFirstRunPreviewResult {
  totalJobs: number;
  totalItems: number;
  maxDigestRowCount: number;
  pacingIntervalSeconds: number;
  estimatedDispatchDurationSeconds: number;
  isAcceptable: boolean;
  violations: string[];
  breakdown: DigestPreviewItemBreakdown[];
  shadowLogComparison?: {
    shadowRecordsFound: number;
    differenceNotes: string;
  };
}

export const ALERT_EVENT_LABELS: Record<string, string> = {
  CONSUMABLE_RECEIPT_OVERDUE: 'Consumable Receipt Overdue (>24h)',
  CONSUMABLE_PARTIALLY_ISSUED_OVERDUE: 'Consumable Partially Issued Overdue',
  DC_OVERDUE: 'Delivery Challan Overdue Return',
  DC_APPROACHING_SLA: 'Delivery Challan Return Approaching Deadline',
  MATERIAL_ISSUE_OVERDUE_24H: 'Raw Material Issue Pending (>24h)',
  DC_PENDING_2_DAYS: 'Delivery Challan Not Returned (>2 Days)',
  CONSUMABLE_PENDING_2_DAYS: 'Consumable Request Open (>2 Days)',
  DC_QC_PENDING_24H: 'Delivery Challan QC Inspection Pending (>24h)',
  MSL_LOW_STOCK: 'Low Stock Warning (Below MSL)',
  MSL_OUT_OF_STOCK: 'Out of Stock Alert (Zero Inventory)',
};

@Injectable()
export class AlertDigestService {
  private readonly logger = new Logger(AlertDigestService.name);

  constructor(
    @InjectRepository(AlertNotificationState)
    private readonly alertStateRepo: Repository<AlertNotificationState>,
    @InjectRepository(DigestShadowLog)
    private readonly shadowLogRepo: Repository<DigestShadowLog>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepo: Repository<SystemSetting>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailQueueService: EmailQueueService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly notificationPreferenceService?: NotificationPreferenceService,
    @Optional()
    private readonly emailSkipLogService?: EmailSkipLogService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Retrieves the current ALERT_DIGEST_MODE (OFF | SHADOW | ON).
   * Checks system_settings first, then process.env.ALERT_DIGEST_MODE, defaulting to OFF.
   */
  async getMode(): Promise<AlertDigestMode> {
    try {
      const setting = await this.systemSettingRepo.findOne({
        where: { key: 'ALERT_DIGEST_MODE' },
      });
      if (setting && setting.value) {
        const val = String(setting.value).trim().toUpperCase();
        if (val === 'ON' || val === 'SHADOW' || val === 'OFF') {
          return val as AlertDigestMode;
        }
      }
    } catch {
      // Fallback to env
    }

    const envVal = process.env.ALERT_DIGEST_MODE?.trim().toUpperCase();
    if (envVal === 'ON' || envVal === 'SHADOW' || envVal === 'OFF') {
      return envVal as AlertDigestMode;
    }

    return 'OFF';
  }

  /**
   * Resolves configured cooldown hours for an event.
   * Checks ALERT_REALERT_COOLDOWN_HOURS_<EVENT_CODE>, then ALERT_REALERT_COOLDOWN_HOURS, defaulting to 24.
   */
  getCooldownHours(eventCode: string): number {
    const eventSpecific = process.env[`ALERT_REALERT_COOLDOWN_HOURS_${eventCode}`];
    if (eventSpecific) {
      const parsed = parseInt(eventSpecific, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const globalVal = process.env.ALERT_REALERT_COOLDOWN_HOURS;
    if (globalVal) {
      const parsed = parseInt(globalVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 24;
  }

  /**
   * Builds and dispatches/logs consolidated alert digests for a given event code and items array.
   * 1. Evaluates user preferences BEFORE grouping (excludes users with event OFF -> logs skip).
   * 2. Evaluates re-alert cooldown per (item, recipient) (excludes items in cooldown -> logs skip).
   * 3. Groups eligible items per recipient -> 1 digest job per recipient with priority 9.
   * 4. Enforces idempotency per hour bucket (DIGEST:<eventCode>:<recipientId>:<hourBucket>).
   */
  async buildDigests(eventCode: string, items: AlertDigestItem[]): Promise<EmailJob[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const mode = await this.getMode();
    const eventLabel = ALERT_EVENT_LABELS[eventCode] || eventCode.replace(/_/g, ' ');

    // Check global email enabled
    if (this.notificationsService) {
      const globalEnabled = await this.notificationsService.getGlobalWorkflowEmailEnabled();
      if (!globalEnabled) {
        this.logger.log(`Global workflow email disabled. Skipping alert digest for "${eventCode}".`);
        await this.emailSkipLogService?.logSkips([
          { eventCode, reason: 'GLOBAL_OFF', mode },
        ]);
        return [];
      }

      // Check consumable gate
      if (
        eventCode === 'CONSUMABLE_RECEIPT_OVERDUE' ||
        eventCode === 'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE' ||
        eventCode === 'CONSUMABLE_PENDING_2_DAYS'
      ) {
        const consumableEnabled = await this.notificationsService.getConsumableEmailAlertsEnabled();
        if (!consumableEnabled) {
          this.logger.log(`Consumable email alerts disabled by Admin. Skipping digest for "${eventCode}".`);
          await this.emailSkipLogService?.logSkips([
            { eventCode, reason: 'CONSUMABLE_GATE_OFF', mode },
          ]);
          return [];
        }
      }
    }

    // Step 1: Resolve recipients with preferences applied BEFORE grouping
    let eligibleRecipients: User[] = [];
    if (this.notificationPreferenceService) {
      const detailed = await this.notificationPreferenceService.resolveRecipientsDetailed(eventCode);
      if (detailed) {
        eligibleRecipients = detailed.recipients;

        // Log users who have the event OFF
        if (detailed.skipped && detailed.skipped.length > 0) {
          const skipRows = detailed.skipped.map((s) => ({
            eventCode,
            recipientUserId: s.user.id,
            recipientName: s.user.name,
            recipientEmail: s.user.email,
            reason: 'PREF_OFF',
            mode,
          }));
          await this.emailSkipLogService?.logSkips(skipRows);
        }
      } else {
        eligibleRecipients = await this.resolveFallbackRecipients(eventCode);
      }
    } else {
      eligibleRecipients = await this.resolveFallbackRecipients(eventCode);
    }

    if (eligibleRecipients.length === 0) {
      this.logger.log(`No active recipients found for digest event "${eventCode}".`);
      await this.emailSkipLogService?.logSkips([
        { eventCode, reason: 'NO_RECIPIENT', mode },
      ]);
      return [];
    }

    const cooldownHours = this.getCooldownHours(eventCode);
    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
    const hourBucket = now.toISOString().slice(0, 13); // e.g. "2026-11-18T12"

    const enqueuedJobs: EmailJob[] = [];

    // Step 2: For each recipient, check cooldown per item and build digest
    for (const recipient of eligibleRecipients) {
      const recipientItemStates = await this.alertStateRepo.find({
        where: {
          eventCode,
          recipientUserId: recipient.id,
        },
      });

      const stateMap = new Map<string, AlertNotificationState>();
      for (const st of recipientItemStates) {
        stateMap.set(`${st.entityType}:${st.entityId}`, st);
      }

      const eligibleItems: AlertDigestItem[] = [];
      const suppressedItems: AlertDigestItem[] = [];

      for (const item of items) {
        const stateKey = `${item.entityType}:${item.entityId}`;
        const existingState = stateMap.get(stateKey);

        if (existingState && new Date(existingState.lastAlertedAt).getTime() > cooldownCutoff.getTime()) {
          // Within cooldown: Suppress
          suppressedItems.push(item);
        } else {
          eligibleItems.push(item);
        }
      }

      // Log suppressed items to skip log
      if (suppressedItems.length > 0) {
        const skipRows = suppressedItems.map((item) => ({
          eventCode,
          recipientUserId: recipient.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          entityId: item.entityId,
          reason: 'COOLDOWN',
          mode,
        }));
        await this.emailSkipLogService?.logSkips(skipRows);
      }

      if (eligibleItems.length === 0) {
        continue;
      }

      // Format plain-HTML digest table
      const subject = `[V-SMART] ${eventLabel} – ${eligibleItems.length} items`;
      const bodyHtml = this.renderDigestHtml(eventLabel, recipient.name, eligibleItems);
      const bodyText = this.renderDigestText(eventLabel, recipient.name, eligibleItems);
      const idempotencyKey = `DIGEST:${eventCode}:${recipient.id}:${hourBucket}`;

      if (mode === 'SHADOW') {
        // SHADOW Mode: Log what would have been sent, do NOT enqueue email
        try {
          await this.shadowLogRepo.save(
            this.shadowLogRepo.create({
              eventCode,
              recipientUserId: recipient.id,
              recipientEmail: recipient.email,
              itemCount: eligibleItems.length,
              itemIds: eligibleItems.map((i) => i.entityId),
              subject,
            }),
          );
        } catch (err: any) {
          this.logger.warn(`Failed writing digest_shadow_log: ${err?.message || err}`);
        }
      } else if (mode === 'ON') {
        // ON Mode: Enqueue priority-9 digest job & update cooldown state atomically
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Enqueue job with priority 9
          const job = await this.emailQueueService.enqueueJob({
            recipientEmail: recipient.email,
            recipientUserId: recipient.id,
            recipientName: recipient.name,
            eventType: eventCode,
            templateKey: 'ALERT_DIGEST',
            subject,
            bodyHtml,
            bodyText,
            priority: 9,
            idempotencyKey,
            payload: {
              eventCode,
              itemCount: eligibleItems.length,
              itemIds: eligibleItems.map((i) => i.entityId),
            },
          });

          // Upsert alert_notification_state for all included items
          for (const item of eligibleItems) {
            await queryRunner.query(
              `
              INSERT INTO "alert_notification_state" 
                ("event_code", "entity_type", "entity_id", "recipient_user_id", "last_alerted_at", "alert_count", "created_at", "updated_at")
              VALUES 
                ($1, $2, $3, $4, NOW(), 1, NOW(), NOW())
              ON CONFLICT ("event_code", "entity_type", "entity_id", "recipient_user_id")
              DO UPDATE SET 
                "last_alerted_at" = NOW(),
                "alert_count" = "alert_notification_state"."alert_count" + 1,
                "updated_at" = NOW()
              `,
              [eventCode, item.entityType, item.entityId, recipient.id],
            );
          }

          await queryRunner.commitTransaction();

          if (job) {
            enqueuedJobs.push(job);
          }
        } catch (txErr: any) {
          await queryRunner.rollbackTransaction();
          this.logger.error(
            `Failed enqueueing digest job for ${recipient.email} (${eventCode}): ${txErr?.message || txErr}`,
          );
        } finally {
          await queryRunner.release();
        }
      }
    }

    return enqueuedJobs;
  }

  /**
   * Helper: Resolves fallback recipients by role matching PERMITTED_EMAIL_CONFIG.
   */
  private async resolveFallbackRecipients(eventCode: string): Promise<User[]> {
    const config = PERMITTED_EMAIL_CONFIG[eventCode];
    if (!config || !config.allowedRoles || config.allowedRoles.length === 0) {
      return [];
    }

    return this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r')
      .where('u.is_active = true')
      .andWhere('r.name IN (:...roles)', { roles: config.allowedRoles })
      .getMany();
  }

  /**
   * Renders plain-HTML responsive table digest.
   * Caps display at 50 rows, adding "+ M more" if items exceed 50.
   */
  private renderDigestHtml(eventLabel: string, recipientName: string, items: AlertDigestItem[]): string {
    const displayItems = items.slice(0, 50);
    const excessCount = items.length - displayItems.length;

    const rowsHtml = displayItems
      .map((item) => {
        const directLink = item.directLink || '#';
        return `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${this.escapeHtml(item.itemRef)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #dc2626; font-weight: 600;">${this.escapeHtml(String(item.ageOrOverdue))}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${this.escapeHtml(item.ownerOrVendor || 'N/A')}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
              <a href="${directLink}" style="color: #2563eb; text-decoration: none; font-weight: 600;">View &rarr;</a>
            </td>
          </tr>
        `;
      })
      .join('');

    const moreNotice =
      excessCount > 0
        ? `<p style="margin-top: 14px; font-weight: 600; color: #475569; font-size: 13px;">+ ${excessCount} more items, open <a href="/overview" style="color: #2563eb;">V-SMART</a> to view all.</p>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>[V-SMART] ${this.escapeHtml(eventLabel)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; color: #1e293b; margin: 0;">
  <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background: #0f172a; padding: 18px 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.025em;">V-SMART RM Alert Digest</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">${this.escapeHtml(eventLabel)} &bull; ${items.length} item(s) requiring attention</p>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
        Hello <strong>${this.escapeHtml(recipientName)}</strong>, the following <strong>${items.length}</strong> item(s) currently require your attention:
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 10px 12px; font-weight: 600;">Item / Reference</th>
            <th style="padding: 10px 12px; font-weight: 600;">Age / Overdue</th>
            <th style="padding: 10px 12px; font-weight: 600;">Owner / Vendor</th>
            <th style="padding: 10px 12px; font-weight: 600; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${moreNotice}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0;">This is an automated consolidated digest from V-SMART Enterprise Resource Management.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Renders plaintext fallback.
   */
  private renderDigestText(eventLabel: string, recipientName: string, items: AlertDigestItem[]): string {
    const lines = [
      `V-SMART RM Alert Digest: ${eventLabel}`,
      `Hello ${recipientName}, the following ${items.length} items require your review:`,
      '',
    ];

    const displayItems = items.slice(0, 50);
    displayItems.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. [${item.itemRef}] - ${item.ageOrOverdue} - Owner: ${item.ownerOrVendor || 'N/A'}`,
      );
    });

    if (items.length > 50) {
      lines.push(`... and ${items.length - 50} more items. Log in to V-SMART to view all.`);
    }

    return lines.join('\n');
  }

  /**
   * Helper: Resolves eligible recipients for an event, applying preferences or fallback roles.
   * Does NOT write skip logs.
   */
  async resolveEligibleRecipients(eventCode: string): Promise<User[]> {
    if (this.notificationPreferenceService) {
      const detailed = await this.notificationPreferenceService.resolveRecipientsDetailed(eventCode);
      if (detailed && detailed.recipients) {
        return detailed.recipients;
      }
    }
    return this.resolveFallbackRecipients(eventCode);
  }

  /**
   * Read-only surge preview of the first ALERT_DIGEST_MODE=ON run.
   * Computes what the first run would produce with an EMPTY cooldown state across all provided event item sets.
   * STRICTLY READ-ONLY: Does not write to alert_notification_state, email_jobs, and sends no emails.
   */
  async previewFirstRun(
    events: Array<{ eventCode: string; items: AlertDigestItem[] }>,
  ): Promise<DigestFirstRunPreviewResult> {
    const breakdown: DigestPreviewItemBreakdown[] = [];
    let totalJobs = 0;
    let totalItems = 0;
    let maxDigestRowCount = 0;
    const violations: string[] = [];

    for (const evt of events) {
      const { eventCode, items } = evt;
      totalItems += items.length;

      const eligibleUsers = await this.resolveEligibleRecipients(eventCode);

      const recipientBreakdown: Array<{
        recipientId: string;
        recipientEmail: string;
        itemCount: number;
      }> = [];

      for (const user of eligibleUsers) {
        recipientBreakdown.push({
          recipientId: user.id,
          recipientEmail: user.email,
          itemCount: items.length,
        });
      }

      const jobsCount = recipientBreakdown.length;
      totalJobs += jobsCount;
      const maxInDigest = items.length;
      if (maxInDigest > maxDigestRowCount) {
        maxDigestRowCount = maxInDigest;
      }

      breakdown.push({
        eventCode,
        totalEligibleItems: items.length,
        recipientCount: eligibleUsers.length,
        digestJobsCount: jobsCount,
        maxItemsInSingleDigest: maxInDigest,
        exceeds50Rows: maxInDigest > 50,
        recipients: recipientBreakdown,
      });
    }

    if (totalJobs > 15) {
      violations.push(`Total first-run jobs (${totalJobs}) exceeds acceptable limit of 15.`);
    }

    const pacingIntervalSeconds = 3;
    const estimatedDispatchDurationSeconds = totalJobs * pacingIntervalSeconds;

    // Check shadow log comparison
    let shadowComparison: { shadowRecordsFound: number; differenceNotes: string } | undefined;
    try {
      const shadowLogs = await this.shadowLogRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
      });
      shadowComparison = {
        shadowRecordsFound: shadowLogs.length,
        differenceNotes:
          shadowLogs.length > 0
            ? `Shadow mode has logged ${shadowLogs.length} historical digest simulation records. Preview projection mirrors shadow grouping logic.`
            : 'No shadow log entries found in digest_shadow_log (SHADOW mode not yet activated in this environment).',
      };
    } catch {
      // Ignored if table not queried
    }

    return {
      totalJobs,
      totalItems,
      maxDigestRowCount,
      pacingIntervalSeconds,
      estimatedDispatchDurationSeconds,
      isAcceptable: violations.length === 0,
      violations,
      breakdown,
      shadowLogComparison: shadowComparison,
    };
  }

  /**
   * Discovers current open items across all system sweeps and evaluates preview.
   * Completely read-only.
   */
  async previewCurrentOpenItemsFirstRun(): Promise<DigestFirstRunPreviewResult> {
    const sweepEvents: Array<{ eventCode: string; items: AlertDigestItem[] }> = [];

    try {
      // 1. Consumable receipt overdue (>24h from creation, not received)
      const consumableReceiptOverdue = await this.dataSource.query(`
        SELECT cri.id, 'CONSUMABLE_REQUEST_ITEM' as "entityType",
               COALESCE(cri.description, cri.id::text) as "itemRef",
               cri.created_at as "createdAt"
        FROM consumable_request_items cri
        WHERE cri.status IN ('OPEN', 'PURCHASE_REQUESTED', 'PARTIALLY_ISSUED', 'READY_FOR_ISSUE')
          AND cri.purchase_received_at IS NULL
          AND cri.created_at <= NOW() - INTERVAL '24 hours'
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'CONSUMABLE_RECEIPT_OVERDUE',
        items: (consumableReceiptOverdue || []).map((row: any) => ({
          entityId: row.id,
          entityType: row.entityType || 'CONSUMABLE_REQUEST_ITEM',
          itemRef: row.itemRef || `Consumable ${String(row.id).slice(0, 8)}`,
          ageOrOverdue: '>24h overdue',
        })),
      });

      // 2. DC Overdue (Crossed expected return date)
      const dcOverdue = await this.dataSource.query(`
        SELECT id, 'DELIVERY_CHALLAN' as "entityType", challan_number as "itemRef", expected_return_date
        FROM delivery_challans
        WHERE status IN ('OPEN', 'DISPATCHED', 'PARTIALLY_RETURNED')
          AND expected_return_date IS NOT NULL
          AND expected_return_date < NOW()
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'DC_OVERDUE',
        items: (dcOverdue || []).map((row: any) => ({
          entityId: row.id,
          entityType: 'DELIVERY_CHALLAN',
          itemRef: row.itemRef || `DC ${String(row.id).slice(0, 8)}`,
          ageOrOverdue: 'Overdue return date',
        })),
      });

      // 3. DC Approaching SLA (within 24h of expected return date)
      const dcApproaching = await this.dataSource.query(`
        SELECT id, 'DELIVERY_CHALLAN' as "entityType", challan_number as "itemRef", expected_return_date
        FROM delivery_challans
        WHERE status IN ('OPEN', 'DISPATCHED', 'PARTIALLY_RETURNED')
          AND expected_return_date IS NOT NULL
          AND expected_return_date >= NOW()
          AND expected_return_date <= NOW() + INTERVAL '24 hours'
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'DC_APPROACHING_SLA',
        items: (dcApproaching || []).map((row: any) => ({
          entityId: row.id,
          entityType: 'DELIVERY_CHALLAN',
          itemRef: row.itemRef || `DC ${String(row.id).slice(0, 8)}`,
          ageOrOverdue: '<24h remaining',
        })),
      });

      // 4. DC Pending > 2 Days (Dispatched or partially returned > 48 hours)
      const dcPending2Days = await this.dataSource.query(`
        SELECT id, 'DELIVERY_CHALLAN' as "entityType", challan_number as "itemRef", created_at
        FROM delivery_challans
        WHERE status IN ('DISPATCHED', 'PARTIALLY_RETURNED')
          AND created_at <= NOW() - INTERVAL '48 hours'
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'DC_PENDING_2_DAYS',
        items: (dcPending2Days || []).map((row: any) => ({
          entityId: row.id,
          entityType: 'DELIVERY_CHALLAN',
          itemRef: row.itemRef || `DC ${String(row.id).slice(0, 8)}`,
          ageOrOverdue: '>48h pending',
        })),
      });

      // 5. Consumable Pending > 2 Days (Open consumable request > 48 hours with active items)
      const consumablePending2Days = await this.dataSource.query(`
        SELECT DISTINCT cr.id, 'CONSUMABLE_REQUEST' as "entityType", cr.request_code as "itemRef"
        FROM consumable_requests cr
        INNER JOIN consumable_request_items cri ON cri.request_id = cr.id
        WHERE cr.created_at <= NOW() - INTERVAL '48 hours'
          AND cri.status IN ('OPEN', 'PURCHASE_REQUESTED', 'PURCHASE_RECEIVED', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED')
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'CONSUMABLE_PENDING_2_DAYS',
        items: (consumablePending2Days || []).map((row: any) => ({
          entityId: row.id,
          entityType: 'CONSUMABLE_REQUEST',
          itemRef: row.itemRef || `CR ${String(row.id).slice(0, 8)}`,
          ageOrOverdue: '>48h pending',
        })),
      });

      // 6. Material Issue Overdue (>24h since reviewed, not issued)
      const miOverdue = await this.dataSource.query(`
        SELECT rm.id, 'MATERIAL_ISSUE' as "entityType", COALESCE(sc.sc_number, rm.id::text) as "itemRef"
        FROM rm_requests rm
        LEFT JOIN sales_order_components sc ON sc.id = rm.sc_id
        LEFT JOIN material_issues mi ON mi.sc_id = rm.sc_id AND mi.issue_type = 'INITIAL_ISSUE'
        WHERE rm.status = 'REVIEWED'
          AND mi.id IS NULL
          AND COALESCE(rm.reviewed_at, rm.created_at) <= NOW() - INTERVAL '24 hours'
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'MATERIAL_ISSUE_OVERDUE_24H',
        items: (miOverdue || []).map((row: any) => ({
          entityId: row.id,
          entityType: 'MATERIAL_ISSUE',
          itemRef: row.itemRef || `RM ${String(row.id).slice(0, 8)}`,
          ageOrOverdue: '>24h overdue',
        })),
      });

      // 7. DC QC Pending (>24h in QC on active DCs)
      const dcQc = await this.dataSource.query(`
        SELECT dci.id, 'DC_ITEM_QC' as "entityType", dc.challan_number as "itemRef"
        FROM delivery_challan_items dci
        INNER JOIN delivery_challans dc ON dc.id = dci.delivery_challan_id
        WHERE dci.qc_pending_qty > 0
          AND dc.status != 'CLOSED'
          AND dci.updated_at <= NOW() - INTERVAL '24 hours'
      `).catch(() => []);

      sweepEvents.push({
        eventCode: 'DC_QC_PENDING_24H',
        items: (dcQc || []).map((row: any) => ({
          entityId: row.id,
          entityType: 'DC_ITEM_QC',
          itemRef: `QC for DC ${row.itemRef || String(row.id).slice(0, 8)}`,
          ageOrOverdue: '>24h in QC',
        })),
      });
    } catch (err: any) {
      this.logger.warn(`Error querying open items for preview: ${err?.message}`);
    }

    return this.previewFirstRun(sweepEvents);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
