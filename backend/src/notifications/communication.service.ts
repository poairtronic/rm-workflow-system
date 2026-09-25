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

    for (const user of uniqueTargetUsers) {
      // 1. In-App Notification (Channel 1 - Always created, authoritative)
      try {
        const notification = await this.createInAppNotification({
          userId: user.id,
          title: params.title,
          message: params.message,
          type: params.eventType,
          targetEntity: params.targetEntity,
          targetId: params.targetId,
        });
        if (notification) {
          inAppNotifications.push(notification);
        }
      } catch (inAppErr: any) {
        this.logger.error(`In-App notification creation failed for recipient ${user.id}: ${inAppErr?.message || inAppErr}`);
      }

      // 2. Email Job (Channel 2 - Optional based on preference)
      try {
        const isAllowed = await this.notificationsService.isWorkflowEmailAllowed(user.id);
        if (isAllowed) {
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
}
