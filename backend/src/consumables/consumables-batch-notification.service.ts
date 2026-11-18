import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ConsumableRequest } from './entities/consumable-request.entity.js';
import { ConsumableRequestItem, ConsumableApprovalStatus } from './entities/consumable-request-item.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { EmailQueueService } from '../email/email-queue.service.js';
import { TemplateService } from '../email/template.service.js';
import { NotificationPreferenceService } from '../notifications/notification-preference.service.js';
import { EmailSkipLogService } from '../notifications/email-skip-log.service.js';
import { resolveEventPriority } from '../email/constants/email-priorities.js';

export interface BatchItemSummary {
  requestCode?: string;
  description?: string;
  requestedQty?: number | string;
  uom?: string;
  endUserInVelan?: string;
  itemCategoryTrack?: string;
  isSwitchedToPurchase?: boolean;
  rejectionReason?: string;
}

@Injectable()
export class ConsumablesBatchNotificationService {
  private readonly logger = new Logger(ConsumablesBatchNotificationService.name);

  constructor(
    @InjectRepository(ConsumableRequestItem)
    private readonly itemRepo: Repository<ConsumableRequestItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @Optional() private readonly emailQueueService?: EmailQueueService,
    @Optional() private readonly templateService?: TemplateService,
    @Optional() private readonly preferenceService?: NotificationPreferenceService,
    @Optional() private readonly skipLogService?: EmailSkipLogService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Helper: checks if CONSUMABLE_SM_APPROVAL_MODE is ON.
   */
  isApprovalModeOn(): boolean {
    const rawMode = (
      this.configService?.get<string>('CONSUMABLE_SM_APPROVAL_MODE') ||
      process.env.CONSUMABLE_SM_APPROVAL_MODE ||
      'OFF'
    ).trim().toUpperCase();
    return rawMode === 'ON';
  }

  /**
   * Trigger 1: Requisition created with MODE ON and >= 1 pending line.
   * Dispatches ONE email per request to each eligible approver (SENIOR_MANAGER and ADMIN).
   */
  async notifyApprovalRequested(
    request: ConsumableRequest,
    items: ConsumableRequestItem[],
    actorUserId?: string,
  ): Promise<void> {
    if (!this.isApprovalModeOn()) {
      return;
    }

    const pendingItems = items.filter(
      (i) => i.approvalStatus === ConsumableApprovalStatus.PENDING_SM_APPROVAL,
    );
    if (pendingItems.length === 0) {
      return;
    }

    try {
      // 1. Resolve Approver roles (SENIOR_MANAGER and ADMIN)
      const approverRoles = await this.roleRepo.find({
        where: [{ name: 'SENIOR_MANAGER' }, { name: 'ADMIN' }],
      });
      if (!approverRoles || approverRoles.length === 0) return;

      const approverRoleIds = approverRoles.map((r) => r.id);
      const candidates = await this.userRepo.find({
        where: { roleId: In(approverRoleIds), isActive: true },
        relations: { role: true },
      });

      const mode = this.preferenceService ? await this.preferenceService.getMode() : 'OFF';

      const itemSummaries: BatchItemSummary[] = pendingItems.map((item) => ({
        requestCode: request.requestCode,
        description: item.description,
        requestedQty: item.requestedQty,
        uom: item.uom,
        endUserInVelan: item.endUserInVelan || request.endUserInVelan || 'Plant Floor',
      }));

      for (const approver of candidates) {
        // Exclude actor if creator is also manager/admin (no self-spam)
        if (actorUserId && approver.id === actorUserId) {
          continue;
        }

        // Apply preference resolver BEFORE creating email job
        if (this.preferenceService) {
          const evalResult = await this.preferenceService.isUserEligibleForEvent(
            approver,
            'CONSUMABLE_APPROVAL_REQUESTED',
          );
          if (!evalResult.eligible) {
            await this.skipLogService?.logSkips([
              {
                eventCode: 'CONSUMABLE_APPROVAL_REQUESTED',
                recipientUserId: approver.id,
                recipientName: approver.name,
                recipientEmail: approver.email,
                reason: 'PREF_OFF',
                entityId: request.id,
                mode,
              },
            ]);
            continue;
          }
        }

        const template = this.templateService || new TemplateService();
        const rendered = template.render('CONSUMABLE_APPROVAL_REQUESTED', {
          recipientName: approver.name,
          requestCode: request.requestCode,
          requestedBy: request.requestedBy,
          pendingLinesCount: pendingItems.length,
          items: itemSummaries,
        });

        const idempotencyKey = `consumable-approval-requested:${request.id}:${approver.id}`;

        if (this.emailQueueService) {
          await this.emailQueueService.enqueueJob({
            recipientEmail: approver.email,
            recipientUserId: approver.id,
            recipientName: approver.name,
            eventType: 'CONSUMABLE_APPROVAL_REQUESTED',
            templateKey: rendered.templateKey,
            subject: rendered.subject,
            bodyText: rendered.text,
            bodyHtml: rendered.html,
            payload: {
              requestId: request.id,
              requestCode: request.requestCode,
              pendingCount: pendingItems.length,
            },
            idempotencyKey,
            priority: resolveEventPriority('CONSUMABLE_APPROVAL_REQUESTED'),
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`[NOTIFY-APPROVAL-REQUESTED] Error: ${err?.message || err}`);
    }
  }

  /**
   * Trigger 2: Bulk approval of items.
   * Dispatches ONE email per recipient per batch at Priority 1:
   * - STORES users get ALL approved lines in the batch (with tracks).
   * - Each requester gets ONLY their own approved lines.
   * - Clearly highlights lines switched to the purchase track.
   */
  async notifyBulkApproved(
    batchId: string,
    approvedItemIds: string[],
    options: {
      approverId?: string;
      switchedToPurchase?: Array<{ id: string; description: string }>;
    } = {},
  ): Promise<void> {
    if (!this.isApprovalModeOn() || !approvedItemIds || approvedItemIds.length === 0) {
      return;
    }

    try {
      // 1. Retrieve full item records with associated requests and creators
      const items = await this.itemRepo.find({
        where: { id: In(approvedItemIds) },
        relations: { request: { createdByUser: true } },
      });

      if (items.length === 0) return;

      const switchedIds = new Set((options.switchedToPurchase || []).map((s) => s.id));
      const mode = this.preferenceService ? await this.preferenceService.getMode() : 'OFF';
      const template = this.templateService || new TemplateService();

      // Convert items to summaries
      const allItemSummaries: BatchItemSummary[] = items.map((i) => ({
        requestCode: i.request?.requestCode || 'N/A',
        description: i.description,
        requestedQty: i.requestedQty,
        uom: i.uom,
        endUserInVelan: i.endUserInVelan || i.request?.endUserInVelan || 'Plant Floor',
        itemCategoryTrack: i.itemCategoryTrack,
        isSwitchedToPurchase: switchedIds.has(i.id),
      }));

      const notifiedUserIds = new Set<string>();

      // 2. STORES recipients: receive ALL approved lines in the batch
      const storesRoles = await this.roleRepo.find({ where: { name: 'STORES' } });
      let storesUsers: User[] = [];
      if (storesRoles.length > 0) {
        storesUsers = await this.userRepo.find({
          where: { roleId: In(storesRoles.map((r) => r.id)), isActive: true },
          relations: { role: true },
        });
      }

      for (const storeUser of storesUsers) {
        if (this.preferenceService) {
          const evalResult = await this.preferenceService.isUserEligibleForEvent(
            storeUser,
            'CONSUMABLE_APPROVED',
          );
          if (!evalResult.eligible) {
            await this.skipLogService?.logSkips([
              {
                eventCode: 'CONSUMABLE_APPROVED',
                recipientUserId: storeUser.id,
                recipientName: storeUser.name,
                recipientEmail: storeUser.email,
                reason: 'PREF_OFF',
                entityId: batchId,
                mode,
              },
            ]);
            continue;
          }
        }

        notifiedUserIds.add(storeUser.id);
        const idempotencyKey = `consumable-approved:${batchId}:${storeUser.id}`;

        const rendered = template.render('CONSUMABLE_APPROVED', {
          recipientName: storeUser.name,
          batchId,
          itemsCount: items.length,
          items: allItemSummaries,
          switchedCount: switchedIds.size,
          recipientRole: 'STORES',
        });

        if (this.emailQueueService) {
          await this.emailQueueService.enqueueJob({
            recipientEmail: storeUser.email,
            recipientUserId: storeUser.id,
            recipientName: storeUser.name,
            eventType: 'CONSUMABLE_APPROVED',
            templateKey: rendered.templateKey,
            subject: rendered.subject,
            bodyText: rendered.text,
            bodyHtml: rendered.html,
            payload: { batchId, itemsCount: items.length, switchedCount: switchedIds.size },
            idempotencyKey,
            priority: resolveEventPriority('CONSUMABLE_APPROVED'),
          });
        }
      }

      // 3. Requesters: each gets ONLY their own approved lines
      const requesterItemMap = new Map<string, { user: User; items: BatchItemSummary[] }>();

      for (const item of items) {
        const creator = item.request?.createdByUser;
        const creatorId = item.request?.createdByUserId || creator?.id;
        if (!creatorId) continue;

        let entry = requesterItemMap.get(creatorId);
        if (!entry) {
          let userObj = creator;
          if (!userObj) {
            userObj = (await this.userRepo.findOne({
              where: { id: creatorId, isActive: true },
              relations: { role: true },
            })) || undefined;
          }
          if (userObj && userObj.isActive !== false) {
            entry = { user: userObj, items: [] };
            requesterItemMap.set(creatorId, entry);
          }
        }

        if (entry) {
          entry.items.push({
            requestCode: item.request?.requestCode || 'N/A',
            description: item.description,
            requestedQty: item.requestedQty,
            uom: item.uom,
            endUserInVelan: item.endUserInVelan || item.request?.endUserInVelan || 'Plant Floor',
            itemCategoryTrack: item.itemCategoryTrack,
            isSwitchedToPurchase: switchedIds.has(item.id),
          });
        }
      }

      for (const [requesterId, entry] of requesterItemMap.entries()) {
        // If requester is also stores and already got all lines, avoid duplicate email
        if (notifiedUserIds.has(requesterId)) {
          continue;
        }

        const requester = entry.user;

        // Apply preference check
        if (this.preferenceService) {
          const evalResult = await this.preferenceService.isUserEligibleForEvent(
            requester,
            'CONSUMABLE_APPROVED',
          );
          if (!evalResult.eligible) {
            await this.skipLogService?.logSkips([
              {
                eventCode: 'CONSUMABLE_APPROVED',
                recipientUserId: requester.id,
                recipientName: requester.name,
                recipientEmail: requester.email,
                reason: 'PREF_OFF',
                entityId: batchId,
                mode,
              },
            ]);
            continue;
          }
        }

        notifiedUserIds.add(requester.id);
        const idempotencyKey = `consumable-approved:${batchId}:${requester.id}`;

        const requesterSwitchedCount = entry.items.filter((i) => i.isSwitchedToPurchase).length;

        const rendered = template.render('CONSUMABLE_APPROVED', {
          recipientName: requester.name,
          batchId,
          itemsCount: entry.items.length,
          items: entry.items,
          switchedCount: requesterSwitchedCount,
          recipientRole: 'REQUESTER',
        });

        if (this.emailQueueService) {
          await this.emailQueueService.enqueueJob({
            recipientEmail: requester.email,
            recipientUserId: requester.id,
            recipientName: requester.name,
            eventType: 'CONSUMABLE_APPROVED',
            templateKey: rendered.templateKey,
            subject: rendered.subject,
            bodyText: rendered.text,
            bodyHtml: rendered.html,
            payload: { batchId, itemsCount: entry.items.length, switchedCount: requesterSwitchedCount },
            idempotencyKey,
            priority: resolveEventPriority('CONSUMABLE_APPROVED'),
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`[NOTIFY-BULK-APPROVED] Error: ${err?.message || err}`);
    }
  }

  /**
   * Trigger 3: Bulk rejection of items.
   * Dispatches ONE email per requester listing their rejected lines with reasons at Priority 1.
   */
  async notifyBulkRejected(
    batchId: string,
    rejectedItemIds: string[],
    options: {
      rejecterId?: string;
      rejectionReason: string;
    },
  ): Promise<void> {
    if (!this.isApprovalModeOn() || !rejectedItemIds || rejectedItemIds.length === 0) {
      return;
    }

    try {
      const items = await this.itemRepo.find({
        where: { id: In(rejectedItemIds) },
        relations: { request: { createdByUser: true } },
      });

      if (items.length === 0) return;

      const mode = this.preferenceService ? await this.preferenceService.getMode() : 'OFF';
      const template = this.templateService || new TemplateService();

      // Group rejected lines by requester
      const requesterItemMap = new Map<string, { user: User; items: BatchItemSummary[] }>();

      for (const item of items) {
        const creator = item.request?.createdByUser;
        const creatorId = item.request?.createdByUserId || creator?.id;
        if (!creatorId) continue;

        let entry = requesterItemMap.get(creatorId);
        if (!entry) {
          let userObj = creator;
          if (!userObj) {
            userObj = (await this.userRepo.findOne({
              where: { id: creatorId, isActive: true },
              relations: { role: true },
            })) || undefined;
          }
          if (userObj && userObj.isActive !== false) {
            entry = { user: userObj, items: [] };
            requesterItemMap.set(creatorId, entry);
          }
        }

        if (entry) {
          entry.items.push({
            requestCode: item.request?.requestCode || 'N/A',
            description: item.description,
            requestedQty: item.requestedQty,
            uom: item.uom,
            endUserInVelan: item.endUserInVelan || item.request?.endUserInVelan || 'Plant Floor',
            rejectionReason: item.rejectionReason || options.rejectionReason,
          });
        }
      }

      for (const [requesterId, entry] of requesterItemMap.entries()) {
        const requester = entry.user;

        // Apply preference check
        if (this.preferenceService) {
          const evalResult = await this.preferenceService.isUserEligibleForEvent(
            requester,
            'CONSUMABLE_REJECTED',
          );
          if (!evalResult.eligible) {
            await this.skipLogService?.logSkips([
              {
                eventCode: 'CONSUMABLE_REJECTED',
                recipientUserId: requester.id,
                recipientName: requester.name,
                recipientEmail: requester.email,
                reason: 'PREF_OFF',
                entityId: batchId,
                mode,
              },
            ]);
            continue;
          }
        }

        const idempotencyKey = `consumable-rejected:${batchId}:${requester.id}`;

        const rendered = template.render('CONSUMABLE_REJECTED', {
          recipientName: requester.name,
          batchId,
          itemsCount: entry.items.length,
          items: entry.items,
          rejectionReason: options.rejectionReason,
        });

        if (this.emailQueueService) {
          await this.emailQueueService.enqueueJob({
            recipientEmail: requester.email,
            recipientUserId: requester.id,
            recipientName: requester.name,
            eventType: 'CONSUMABLE_REJECTED',
            templateKey: rendered.templateKey,
            subject: rendered.subject,
            bodyText: rendered.text,
            bodyHtml: rendered.html,
            payload: {
              batchId,
              itemsCount: entry.items.length,
              rejectionReason: options.rejectionReason,
            },
            idempotencyKey,
            priority: resolveEventPriority('CONSUMABLE_REJECTED'),
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`[NOTIFY-BULK-REJECTED] Error: ${err?.message || err}`);
    }
  }
}
