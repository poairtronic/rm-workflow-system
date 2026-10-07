import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { Notification } from './entities/notification.entity.js';
import { EmailQueueService } from '../email/email-queue.service.js';
import { NotificationsService } from './notifications.service.js';
import { EmailJob } from '../email/entities/email-job.entity.js';
import { TemplateService } from '../email/template.service.js';
import { EmailIdempotencyService } from '../email/email-idempotency.service.js';
import {
  RmSubmittedEventPayload,
  MaterialIssuedEventPayload,
  AdditionalRequestEventPayload,
  ScCompletedEventPayload,
  MaterialReceivedEventPayload,
  MaterialReturnedEventPayload,
  ReturnVerifiedEventPayload,
  ExtraMaterialApprovedEventPayload,
  ExtraMaterialRejectedEventPayload,
  ExtraMaterialIssuedEventPayload,
} from './workflow-notification.service.js';

export interface CommunicationEventResult {
  inAppNotifications: Notification[];
  emailJobs: EmailJob[];
}

export interface CommunicationEventInput {
  eventType: 'RM_SUBMITTED' | 'MATERIAL_ISSUED' | 'ADDITIONAL_REQUEST' | 'SC_COMPLETED' | string;
  entityType: string;
  entityId: string;
  rmNumber?: string;
  scNumber?: string;
  scId?: string;
  recipientUserId?: string;
  designerUserId?: string;
  requestedById?: string;
  createdById?: string;
  metadata?: Record<string, any>;
}

import { NotificationRecipientService } from './notification-recipient.service.js';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private readonly templateService: TemplateService;
  private readonly emailIdempotencyService: EmailIdempotencyService;
  private readonly recipientService: NotificationRecipientService;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly emailQueueService: EmailQueueService,
    private readonly notificationsService: NotificationsService,
    @Optional() templateService?: TemplateService,
    @Optional() emailIdempotencyService?: EmailIdempotencyService,
    @Optional() recipientService?: NotificationRecipientService,
  ) {
    this.templateService = templateService || new TemplateService();
    this.emailIdempotencyService = emailIdempotencyService || new EmailIdempotencyService();
    this.recipientService =
      recipientService ||
      new NotificationRecipientService(userRepository, roleRepository);
  }

  /**
   * Resolves active users matching specific role names (e.g., STORES, PRODUCTION, DESIGNER).
   */
  async findUsersByRoles(roleNames: string[]): Promise<User[]> {
    return this.recipientService.findActiveUsersByRoles(roleNames);
  }

  /**
   * Creates an in-app notification idempotently with database-level duplicate protection.
   */
  async createInAppNotification(params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    targetEntity?: string;
    targetId?: string;
    idempotencyKey?: string;
  }): Promise<Notification> {
    const key =
      params.idempotencyKey ||
      (params.type && params.targetId && params.userId
        ? this.emailIdempotencyService.generateKey({
            eventType: params.type,
            entityId: params.targetId,
            recipientUserId: params.userId,
          })
        : undefined);

    if (key) {
      const existing = await this.notificationRepository.findOne({
        where: { idempotencyKey: key },
      });
      if (existing) {
        return existing;
      }
    }

    if (params.targetEntity && params.targetId && params.type && params.userId) {
      const existing = await this.notificationRepository.findOne({
        where: {
          userId: params.userId,
          targetEntity: params.targetEntity,
          targetId: params.targetId,
          type: params.type,
        },
      });
      if (existing) {
        return existing;
      }
    }

    try {
      const notification = this.notificationRepository.create({
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        idempotencyKey: key,
        isRead: false,
      });

      return await this.notificationRepository.save(notification);
    } catch (error: any) {
      const errCode = error?.code || error?.driverError?.code;
      const errMsg = String(error?.message || '');
      const isDuplicate =
        errCode === '23505' ||
        errMsg.toLowerCase().includes('duplicate key') ||
        errMsg.includes('UQ_notifications_idempotency_key');

      if (isDuplicate) {
        this.logger.warn(
          `Duplicate in-app notification insertion prevented for key "${key}"`,
        );
        if (key) {
          const existing = await this.notificationRepository.findOne({
            where: { idempotencyKey: key },
          });
          if (existing) {
            return existing;
          }
        }
        if (params.userId && params.targetEntity && params.targetId && params.type) {
          const existing = await this.notificationRepository.findOne({
            where: {
              userId: params.userId,
              targetEntity: params.targetEntity,
              targetId: params.targetId,
              type: params.type,
            },
          });
          if (existing) {
            return existing;
          }
        }
      }
      throw error;
    }
  }


  /**
   * Central Orchestration Entry Point for Business Events.
   */
  async sendEvent(input: CommunicationEventInput): Promise<CommunicationEventResult> {
    this.logger.log(`Orchestrating event "${input.eventType}" for entity "${input.entityType}" (ID: ${input.entityId})`);

    const actorUserId =
      input.createdById || input.requestedById || input.metadata?.actorUserId;
    const specificTargetUserId =
      input.recipientUserId || input.designerUserId;

    let targetUsers: User[] = [];
    try {
      targetUsers = await this.recipientService.resolveRecipients({
        eventType: input.eventType,
        actorUserId,
        specificTargetUserId,
      });
    } catch (recipientErr: any) {
      this.logger.error(`Recipient resolution failed for event "${input.eventType}": ${recipientErr?.message || recipientErr}`);
      return { inAppNotifications: [], emailJobs: [] };
    }

    switch (input.eventType) {
      case 'RM_SUBMITTED':
        return this.orchestrateChannelDelivery({
          eventType: 'RM_SUBMITTED',
          targetUsers,
          targetEntity: 'RM_REQUEST',
          targetId: input.entityId,
          title: `RM Request Submitted: ${input.rmNumber || input.entityId}`,
          message: `RM Request ${input.rmNumber || input.entityId} was submitted.`,
          templateKey: 'RM_SUBMITTED',
          subject: `[RMRIT Notification] RM Request Submitted: ${input.rmNumber || input.entityId}`,
          payload: { rmNumber: input.rmNumber || input.entityId, rmRequestId: input.entityId },
        });

      case 'MATERIAL_ISSUED':
        return this.orchestrateChannelDelivery({
          eventType: 'MATERIAL_ISSUED',
          targetUsers,
          targetEntity: 'MATERIAL_ISSUE',
          targetId: input.entityId,
          title: `Material Issued for RM: ${input.rmNumber || input.entityId}`,
          message: `Material has been issued for RM Request ${input.rmNumber || input.entityId}.`,
          templateKey: 'MATERIAL_ISSUED',
          subject: `[RMRIT Notification] Material Issued for RM: ${input.rmNumber || input.entityId}`,
          payload: { rmNumber: input.rmNumber || input.entityId, scId: input.scId },
        });

      case 'ADDITIONAL_MATERIAL_REQUESTED':
      case 'ADDITIONAL_REQUEST':
        return this.orchestrateChannelDelivery({
          eventType: input.eventType,
          targetUsers,
          targetEntity: 'ADDITIONAL_REQUEST',
          targetId: input.entityId,
          title: `Additional Material Request: ${input.rmNumber || input.entityId}`,
          message: `Additional material request has been created for RM Request ${input.rmNumber || input.entityId}.`,
          templateKey: 'ADDITIONAL_MATERIAL_REQUESTED',
          subject: `[RMRIT Notification] Additional Material Request: ${input.rmNumber || input.entityId}`,
          payload: { rmNumber: input.rmNumber || input.entityId, scId: input.scId },
        });

      case 'SC_COMPLETED':
        return this.orchestrateChannelDelivery({
          eventType: 'SC_COMPLETED',
          targetUsers,
          targetEntity: 'SC',
          targetId: input.entityId,
          title: `SC Completed: ${input.scNumber || input.entityId}`,
          message: `Sales Order Component ${input.scNumber || input.entityId} has been completed.`,
          templateKey: 'SC_COMPLETED',
          subject: `[RMRIT Notification] SC Completed: ${input.scNumber || input.entityId}`,
          payload: { scNumber: input.scNumber || input.entityId, scId: input.entityId },
        });

      // Phase 17 B3.3 — Material Receipt, Return & Extra Material Events
      case 'MATERIAL_RECEIVED':
        return this.orchestrateChannelDelivery({
          eventType: 'MATERIAL_RECEIVED',
          targetUsers,
          targetEntity: 'MATERIAL_RECEIPT',
          targetId: input.entityId,
          title: `Material Received for SC: ${input.rmNumber || input.entityId}`,
          message: `Material receipt has been confirmed for SC ${input.rmNumber || input.entityId}.`,
          templateKey: 'MATERIAL_RECEIVED',
          subject: `[RMRIT Notification] Material Received: ${input.rmNumber || input.entityId}`,
          payload: { scNumber: input.rmNumber || input.entityId, scId: input.scId, receiptId: input.entityId },
        });

      case 'MATERIAL_RETURNED':
        return this.orchestrateChannelDelivery({
          eventType: 'MATERIAL_RETURNED',
          targetUsers,
          targetEntity: 'MATERIAL_RETURN',
          targetId: input.entityId,
          title: `Material Return Submitted: ${input.rmNumber || input.entityId}`,
          message: `Material return has been submitted for SC ${input.rmNumber || input.entityId} and awaits Stores acknowledgment.`,
          templateKey: 'MATERIAL_RETURNED',
          subject: `[RMRIT Notification] Material Return Submitted: ${input.rmNumber || input.entityId}`,
          payload: { scNumber: input.rmNumber || input.entityId, scId: input.scId, returnId: input.entityId },
        });

      case 'RETURN_VERIFIED':
        return this.orchestrateChannelDelivery({
          eventType: 'RETURN_VERIFIED',
          targetUsers,
          targetEntity: 'MATERIAL_RETURN',
          targetId: input.entityId,
          title: `Material Return Acknowledged: ${input.rmNumber || input.entityId}`,
          message: `Material return for SC ${input.rmNumber || input.entityId} has been verified and acknowledged by Stores.`,
          templateKey: 'RETURN_VERIFIED',
          subject: `[RMRIT Notification] Material Return Acknowledged: ${input.rmNumber || input.entityId}`,
          payload: { scNumber: input.rmNumber || input.entityId, scId: input.scId, returnId: input.entityId },
        });

      case 'EXTRA_MATERIAL_APPROVED':
        return this.orchestrateChannelDelivery({
          eventType: 'EXTRA_MATERIAL_APPROVED',
          targetUsers,
          targetEntity: 'ADDITIONAL_REQUEST',
          targetId: input.entityId,
          title: `Additional Material Approved: ${input.rmNumber || input.entityId}`,
          message: `Additional material request for SC ${input.rmNumber || input.entityId} has been APPROVED by Stores.`,
          templateKey: 'EXTRA_MATERIAL_APPROVED',
          subject: `[RMRIT Notification] Additional Material Approved: ${input.rmNumber || input.entityId}`,
          payload: { scNumber: input.rmNumber || input.entityId, scId: input.scId, requestId: input.entityId },
        });

      case 'EXTRA_MATERIAL_REJECTED':
        return this.orchestrateChannelDelivery({
          eventType: 'EXTRA_MATERIAL_REJECTED',
          targetUsers,
          targetEntity: 'ADDITIONAL_REQUEST',
          targetId: input.entityId,
          title: `Additional Material Rejected: ${input.rmNumber || input.entityId}`,
          message: `Additional material request for SC ${input.rmNumber || input.entityId} has been REJECTED by Stores.`,
          templateKey: 'EXTRA_MATERIAL_REJECTED',
          subject: `[RMRIT Notification] Additional Material Rejected: ${input.rmNumber || input.entityId}`,
          payload: { scNumber: input.rmNumber || input.entityId, scId: input.scId, requestId: input.entityId },
        });

      case 'EXTRA_MATERIAL_ISSUED':
        return this.orchestrateChannelDelivery({
          eventType: 'EXTRA_MATERIAL_ISSUED',
          targetUsers,
          targetEntity: 'MATERIAL_ISSUE',
          targetId: input.entityId,
          title: `Additional Material Issued: ${input.rmNumber || input.entityId}`,
          message: `Additional material has been issued by Stores for SC ${input.rmNumber || input.entityId}.`,
          templateKey: 'EXTRA_MATERIAL_ISSUED',
          subject: `[RMRIT Notification] Additional Material Issued: ${input.rmNumber || input.entityId}`,
          payload: { scNumber: input.rmNumber || input.entityId, scId: input.scId, issueId: input.entityId },
        });

      case 'MSL_LOW_STOCK':
        return this.orchestrateChannelDelivery({
          eventType: 'MSL_LOW_STOCK',
          targetUsers,
          targetEntity: 'PRODUCT',
          targetId: input.entityId,
          title: `Low Stock Alert: ${input.metadata?.productName || input.entityId}`,
          message: `Product ${input.metadata?.productName || input.entityId} has dropped below Minimum Stock Level (${input.metadata?.currentStock ?? 0} / ${input.metadata?.minimumInventory ?? 0}). Deficit: ${input.metadata?.deficit ?? 0}.`,
          templateKey: 'MSL_LOW_STOCK',
          subject: `[RMRIT Alert] Low Stock Warning: ${input.metadata?.productName || input.entityId}`,
          payload: {
            productName: input.metadata?.productName || input.entityId,
            productId: input.entityId,
            currentStock: input.metadata?.currentStock,
            minimumInventory: input.metadata?.minimumInventory,
            deficit: input.metadata?.deficit,
          },
        });

      case 'MSL_OUT_OF_STOCK':
        return this.orchestrateChannelDelivery({
          eventType: 'MSL_OUT_OF_STOCK',
          targetUsers,
          targetEntity: 'PRODUCT',
          targetId: input.entityId,
          title: `OUT OF STOCK: ${input.metadata?.productName || input.entityId}`,
          message: `Product ${input.metadata?.productName || input.entityId} is completely OUT OF STOCK (0 / ${input.metadata?.minimumInventory ?? 0}). Immediate replenishment required.`,
          templateKey: 'MSL_OUT_OF_STOCK',
          subject: `[RMRIT Alert] CRITICAL: OUT OF STOCK: ${input.metadata?.productName || input.entityId}`,
          payload: {
            productName: input.metadata?.productName || input.entityId,
            productId: input.entityId,
            currentStock: 0,
            minimumInventory: input.metadata?.minimumInventory,
            deficit: input.metadata?.deficit,
          },
        });

      case 'MSL_RESOLVED':
        return this.orchestrateChannelDelivery({
          eventType: 'MSL_RESOLVED',
          targetUsers,
          targetEntity: 'PRODUCT',
          targetId: input.entityId,
          title: `Stock Restored: ${input.metadata?.productName || input.entityId}`,
          message: `Stock for product ${input.metadata?.productName || input.entityId} has been restored to or above Minimum Stock Level (${input.metadata?.currentStock ?? 0} / ${input.metadata?.minimumInventory ?? 0}).`,
          templateKey: 'MSL_RESOLVED',
          subject: `[RMRIT Notice] Stock Restored: ${input.metadata?.productName || input.entityId}`,
          payload: {
            productName: input.metadata?.productName || input.entityId,
            productId: input.entityId,
            currentStock: input.metadata?.currentStock,
            minimumInventory: input.metadata?.minimumInventory,
          },
        });

      // Phase 19.8 — Delivery Challan Events
      case 'DC_CREATED':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_CREATED',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `Delivery Challan Created: ${input.metadata?.challanNumber || input.entityId}`,
          message: `A new Delivery Challan ${input.metadata?.challanNumber || input.entityId} has been created for vendor ${input.metadata?.vendorName || 'N/A'}.`,
          templateKey: 'DC_CREATED',
          subject: `[RMRIT] Delivery Challan Created: ${input.metadata?.challanNumber || input.entityId}`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
            dispatchDate: input.metadata?.dispatchDate,
            expectedReturnDate: input.metadata?.expectedReturnDate,
          },
        });

      case 'DC_DISPATCHED':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_DISPATCHED',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `Delivery Challan Dispatched: ${input.metadata?.challanNumber || input.entityId}`,
          message: `Delivery Challan ${input.metadata?.challanNumber || input.entityId} dispatched to ${input.metadata?.vendorName || 'N/A'}.`,
          templateKey: 'DC_DISPATCHED',
          subject: `[RMRIT] Delivery Challan Dispatched: ${input.metadata?.challanNumber || input.entityId}`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
            dispatchDate: input.metadata?.dispatchDate,
            expectedReturnDate: input.metadata?.expectedReturnDate,
          },
        });

      case 'DC_APPROACHING_SLA':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_APPROACHING_SLA',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `SLA Alert: Challan ${input.metadata?.challanNumber || input.entityId} approaching deadline`,
          message: `Delivery Challan ${input.metadata?.challanNumber || input.entityId} is approaching its return deadline. Hours remaining: ${input.metadata?.hoursRemaining ?? 'N/A'}.`,
          templateKey: 'DC_APPROACHING_SLA',
          subject: `[RMRIT] SLA Alert: Challan ${input.metadata?.challanNumber || input.entityId} approaching deadline`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
            expectedReturnDate: input.metadata?.expectedReturnDate,
            hoursRemaining: input.metadata?.hoursRemaining,
          },
        });

      case 'DC_OVERDUE':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_OVERDUE',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `OVERDUE: Challan ${input.metadata?.challanNumber || input.entityId} not returned`,
          message: `Delivery Challan ${input.metadata?.challanNumber || input.entityId} is OVERDUE. Days overdue: ${input.metadata?.daysOverdue ?? 'N/A'}.`,
          templateKey: 'DC_OVERDUE',
          subject: `[RMRIT] OVERDUE: Delivery Challan ${input.metadata?.challanNumber || input.entityId} not returned`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
            expectedReturnDate: input.metadata?.expectedReturnDate,
            daysOverdue: input.metadata?.daysOverdue,
          },
        });

      case 'DC_PARTIALLY_RETURNED':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_PARTIALLY_RETURNED',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `Partial Return Received: Challan ${input.metadata?.challanNumber || input.entityId}`,
          message: `Partial return received for Delivery Challan ${input.metadata?.challanNumber || input.entityId}.`,
          templateKey: 'DC_PARTIALLY_RETURNED',
          subject: `[RMRIT] Partial Return Received: Challan ${input.metadata?.challanNumber || input.entityId}`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
            returnedQty: input.metadata?.returnedQty,
            pendingQty: input.metadata?.pendingQty,
          },
        });

      case 'DC_RETURNED':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_RETURNED',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `Challan Fully Returned: ${input.metadata?.challanNumber || input.entityId}`,
          message: `All items from Delivery Challan ${input.metadata?.challanNumber || input.entityId} have been returned.`,
          templateKey: 'DC_RETURNED',
          subject: `[RMRIT] Challan Fully Returned: ${input.metadata?.challanNumber || input.entityId}`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
            actualReturnDate: input.metadata?.actualReturnDate,
          },
        });

      case 'DC_CLOSED':
        return this.orchestrateChannelDelivery({
          eventType: 'DC_CLOSED',
          targetUsers,
          targetEntity: 'DELIVERY_CHALLAN',
          targetId: input.entityId,
          title: `Delivery Challan Closed: ${input.metadata?.challanNumber || input.entityId}`,
          message: `Delivery Challan ${input.metadata?.challanNumber || input.entityId} has been administratively closed.`,
          templateKey: 'DC_CLOSED',
          subject: `[RMRIT] Delivery Challan Closed: ${input.metadata?.challanNumber || input.entityId}`,
          payload: {
            challanNumber: input.metadata?.challanNumber,
            vendorName: input.metadata?.vendorName,
          },
        });

      default:
        this.logger.warn(`Unsupported communication event type: ${input.eventType}`);
        return { inAppNotifications: [], emailJobs: [] };
    }
  }

  /**
   * Helper to perform dual-channel orchestration for a set of target users.
   */
  private async orchestrateChannelDelivery(params: {
    eventType: string;
    targetUsers: User[];
    targetEntity: string;
    targetId: string;
    title: string;
    message: string;
    templateKey: string;
    subject: string;
    payload: any;
  }): Promise<CommunicationEventResult> {
    const inAppNotifications: Notification[] = [];
    const emailJobs: EmailJob[] = [];

    // Deduplicate target recipients by ID to satisfy Section 19 (DUPLICATE RECIPIENT PROTECTION)
    const userMap = new Map<string, User>();
    for (const u of params.targetUsers) {
      if (u && u.id && u.isActive) {
        userMap.set(u.id, u);
      }
    }
    const uniqueTargetUsers = Array.from(userMap.values());
    if (uniqueTargetUsers.length === 0) return { inAppNotifications, emailJobs };

    // 1. In-App Notification (Channel 1 - Always created, authoritative)
    const notificationValues = uniqueTargetUsers.map(user => {
      const idempotencyKey = this.emailIdempotencyService.generateKey({
        eventType: params.eventType,
        entityId: params.targetId,
        recipientUserId: user.id,
      });
      return this.notificationRepository.create({
        userId: user.id,
        title: params.title,
        message: params.message,
        type: params.eventType,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        idempotencyKey,
        isRead: false,
      });
    });

    if (notificationValues.length > 0) {
      try {
        await this.notificationRepository.createQueryBuilder()
          .insert()
          .values(notificationValues)
          .orIgnore()
          .execute();
        inAppNotifications.push(...notificationValues);
      } catch (err: any) {
        this.logger.error(`Failed bulk insert of in-app notifications: ${err?.message}`);
      }
    }

    // 2. Email Job (Channel 2 - Optional based on preference)
    const globalEmailEnabled = await this.notificationsService.getGlobalWorkflowEmailEnabled();
    if (globalEmailEnabled) {
      await Promise.all(
        uniqueTargetUsers.map(async (user) => {
          try {
            const isUserAllowed = await this.notificationsService.getUserWorkflowEmailEnabled(user.id);
            if (isUserAllowed) {
              // Use TemplateService to render template content safely
              const rendered = this.templateService.render(params.templateKey, {
                recipientName: user.name,
                ...params.payload,
              });

              const idempotencyKey = this.emailIdempotencyService.generateKey({
                eventType: params.eventType,
                entityId: params.targetId,
                recipientUserId: user.id,
              });
              const job = await this.emailQueueService.enqueueJob({
                recipientEmail: user.email,
                recipientUserId: user.id,
                recipientName: user.name,
                eventType: params.eventType,
                templateKey: rendered.templateKey,
                subject: rendered.subject,
                bodyText: rendered.text,
                bodyHtml: rendered.html,
                payload: params.payload,
                idempotencyKey,
              });
              if (job) {
                emailJobs.push(job);
              }
            } else {
              this.logger.log(`Workflow email suppressed for recipient ${user.id} (${user.email}) due to preferences.`);
            }
          } catch (emailErr: any) {
            this.logger.error(`Email job enqueuing failed for recipient ${user.id}: ${emailErr?.message || emailErr}`);
          }
        }),
      );
    } else {
      this.logger.log(`Global workflow email is disabled. Skipping email jobs.`);
    }

    return { inAppNotifications, emailJobs };
  }

  async notifyRmSubmitted(event: RmSubmittedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: event.id,
      rmNumber: event.rmNumber,
      createdById: event.createdById,
    });
  }

  async notifyMaterialIssued(event: MaterialIssuedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'MATERIAL_ISSUED',
      entityType: 'MATERIAL_ISSUE',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      recipientUserId: event.recipientUserId,
    });
  }

  async notifyAdditionalRequest(event: AdditionalRequestEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'ADDITIONAL_REQUEST',
      entityType: 'ADDITIONAL_REQUEST',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      requestedById: event.requestedById,
    });
  }

  async notifyScCompleted(event: ScCompletedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'SC_COMPLETED',
      entityType: 'SC',
      entityId: event.id,
      scNumber: event.scNumber,
      designerUserId: event.designerUserId,
    });
  }

  async notifyMaterialReceived(event: MaterialReceivedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'MATERIAL_RECEIVED',
      entityType: 'MATERIAL_RECEIPT',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      specificTargetUserId: event.recipientUserId,
    });
  }

  async notifyMaterialReturned(event: MaterialReturnedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'MATERIAL_RETURNED',
      entityType: 'MATERIAL_RETURN',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      actorUserId: event.returnedById,
    });
  }

  async notifyReturnVerified(event: ReturnVerifiedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'RETURN_VERIFIED',
      entityType: 'MATERIAL_RETURN',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      specificTargetUserId: event.recipientUserId,
    });
  }

  async notifyExtraMaterialApproved(event: ExtraMaterialApprovedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'EXTRA_MATERIAL_APPROVED',
      entityType: 'ADDITIONAL_REQUEST',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      specificTargetUserId: event.recipientUserId,
    });
  }

  async notifyExtraMaterialRejected(event: ExtraMaterialRejectedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'EXTRA_MATERIAL_REJECTED',
      entityType: 'ADDITIONAL_REQUEST',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      specificTargetUserId: event.recipientUserId,
    });
  }

  async notifyExtraMaterialIssued(event: ExtraMaterialIssuedEventPayload): Promise<CommunicationEventResult> {
    return this.sendEvent({
      eventType: 'EXTRA_MATERIAL_ISSUED',
      entityType: 'MATERIAL_ISSUE',
      entityId: event.id,
      scId: event.scId,
      rmNumber: event.rmNumber,
      specificTargetUserId: event.recipientUserId,
      metadata: { additionalRequestId: event.additionalRequestId },
    });
  }
}
