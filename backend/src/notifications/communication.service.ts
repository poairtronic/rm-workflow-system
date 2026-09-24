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

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private readonly templateService: TemplateService;
  private readonly emailIdempotencyService: EmailIdempotencyService;

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
  ) {
    this.templateService = templateService || new TemplateService();
    this.emailIdempotencyService = emailIdempotencyService || new EmailIdempotencyService();
  }

  /**
   * Resolves active users matching specific role names (e.g., STORES, PRODUCTION, DESIGNER).
   */
  async findUsersByRoles(roleNames: string[]): Promise<User[]> {
    const roles = await this.roleRepository.find({
      where: roleNames.map((name) => ({ name })),
    });
    if (!roles || roles.length === 0) {
      return [];
    }
    const roleIds = roles.map((r) => r.id);
    return await this.userRepository.find({
      where: roleIds.map((roleId) => ({ roleId, isActive: true })),
      relations: { role: true },
    });
  }

  /**
   * Creates an in-app notification idempotently.
   */
  async createInAppNotification(params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    targetEntity?: string;
    targetId?: string;
  }): Promise<Notification> {
    if (params.targetEntity && params.targetId && params.type) {
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

    const notification = this.notificationRepository.create({
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      targetEntity: params.targetEntity,
      targetId: params.targetId,
      isRead: false,
    });

    return await this.notificationRepository.save(notification);
  }

  /**
   * Central Orchestration Entry Point for Business Events.
   */
  async sendEvent(input: CommunicationEventInput): Promise<CommunicationEventResult> {
    this.logger.log(`Orchestrating event "${input.eventType}" for entity "${input.entityType}" (ID: ${input.entityId})`);

    let targetUsers: User[] = [];

    switch (input.eventType) {
      case 'RM_SUBMITTED':
        targetUsers = await this.findUsersByRoles(['STORES', 'ADMIN']);
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
        if (input.recipientUserId) {
          const specificUser = await this.userRepository.findOne({
            where: { id: input.recipientUserId, isActive: true },
          });
          if (specificUser) {
            targetUsers.push(specificUser);
          }
        }
        if (targetUsers.length === 0) {
          targetUsers = await this.findUsersByRoles(['PRODUCTION', 'ADMIN']);
        }
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

      case 'ADDITIONAL_REQUEST':
        targetUsers = await this.findUsersByRoles(['STORES', 'ADMIN']);
        return this.orchestrateChannelDelivery({
          eventType: 'ADDITIONAL_REQUEST',
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
        if (input.designerUserId) {
          const specificUser = await this.userRepository.findOne({
            where: { id: input.designerUserId, isActive: true },
          });
          if (specificUser) {
            targetUsers.push(specificUser);
          }
        }
        if (targetUsers.length === 0) {
          targetUsers = await this.findUsersByRoles(['DESIGNER', 'ADMIN']);
        }
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
        throw new Error(`Unsupported communication event type: ${input.eventType}`);
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

    for (const user of params.targetUsers) {
      // 1. In-App Notification (Channel 1 - Always created, authoritative)
      const notification = await this.createInAppNotification({
        userId: user.id,
        title: params.title,
        message: params.message,
        type: params.eventType,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
      });
      inAppNotifications.push(notification);

      // 2. Email Job (Channel 2 - Optional based on preference)
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
        emailJobs.push(job);
      } else {
        this.logger.log(`Workflow email suppressed for recipient ${user.id} (${user.email}) due to preferences.`);
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
