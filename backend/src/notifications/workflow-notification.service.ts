import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { EmailQueueService } from '../email/email-queue.service.js';
import { NotificationsService } from './notifications.service.js';
import { EmailJob } from '../email/entities/email-job.entity.js';

export interface RmSubmittedEventPayload {
  id: string;
  rmNumber: string;
  createdById?: string;
}

export interface MaterialIssuedEventPayload {
  id: string;
  scId: string;
  rmNumber: string;
  recipientUserId?: string;
}

export interface AdditionalRequestEventPayload {
  id: string;
  scId: string;
  rmNumber: string;
  requestedById?: string;
}

export interface ScCompletedEventPayload {
  id: string;
  scNumber: string;
  designerUserId?: string;
}

@Injectable()
export class WorkflowNotificationService {
  private readonly logger = new Logger(WorkflowNotificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly emailQueueService: EmailQueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
   * Event Handler 1: RM_SUBMITTED
   * Triggers workflow email notification to Stores users upon successful RM submission.
   */
  async notifyRmSubmitted(event: RmSubmittedEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing RM_SUBMITTED event for RM "${event.rmNumber}" (ID: ${event.id})`);

    const targetUsers = await this.findUsersByRoles(['STORES', 'ADMIN']);
    const enqueuedJobs: EmailJob[] = [];

    for (const user of targetUsers) {
      const isAllowed = await this.notificationsService.isWorkflowEmailAllowed(user.id);
      if (!isAllowed) {
        this.logger.log(`Workflow email suppressed for user ${user.id} (${user.email}) due to preferences.`);
        continue;
      }

      const idempotencyKey = `RM_SUBMITTED:${event.id}:${user.id}`;
      const job = await this.emailQueueService.enqueueJob({
        recipientEmail: user.email,
        recipientUserId: user.id,
        recipientName: user.name,
        eventType: 'RM_SUBMITTED',
        templateKey: 'WORKFLOW_RM_SUBMITTED',
        subject: `[RMRIT Notification] RM Request Submitted: ${event.rmNumber}`,
        payload: { rmNumber: event.rmNumber, rmRequestId: event.id },
        idempotencyKey,
      });
      enqueuedJobs.push(job);
    }

    return enqueuedJobs;
  }

  /**
   * Event Handler 2: MATERIAL_ISSUED
   * Triggers workflow email notification to Production users upon successful Material Issue.
   */
  async notifyMaterialIssued(event: MaterialIssuedEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing MATERIAL_ISSUED event for RM "${event.rmNumber}" (Issue ID: ${event.id})`);

    let targetUsers: User[] = [];
    if (event.recipientUserId) {
      const specificUser = await this.userRepository.findOne({
        where: { id: event.recipientUserId, isActive: true },
      });
      if (specificUser) {
        targetUsers.push(specificUser);
      }
    }

    if (targetUsers.length === 0) {
      targetUsers = await this.findUsersByRoles(['PRODUCTION', 'ADMIN']);
    }

    const enqueuedJobs: EmailJob[] = [];

    for (const user of targetUsers) {
      const isAllowed = await this.notificationsService.isWorkflowEmailAllowed(user.id);
      if (!isAllowed) {
        this.logger.log(`Workflow email suppressed for user ${user.id} (${user.email}) due to preferences.`);
        continue;
      }

      const idempotencyKey = `MATERIAL_ISSUED:${event.id}:${user.id}`;
      const job = await this.emailQueueService.enqueueJob({
        recipientEmail: user.email,
        recipientUserId: user.id,
        recipientName: user.name,
        eventType: 'MATERIAL_ISSUED',
        templateKey: 'WORKFLOW_MATERIAL_ISSUED',
        subject: `[RMRIT Notification] Material Issued for RM: ${event.rmNumber}`,
        payload: { rmNumber: event.rmNumber, scId: event.scId },
        idempotencyKey,
      });
      enqueuedJobs.push(job);
    }

    return enqueuedJobs;
  }

  /**
   * Event Handler 3: ADDITIONAL_REQUEST
   * Triggers workflow email notification to Stores users upon Additional Material Request creation.
   */
  async notifyAdditionalRequest(event: AdditionalRequestEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing ADDITIONAL_REQUEST event for RM "${event.rmNumber}" (Request ID: ${event.id})`);

    const targetUsers = await this.findUsersByRoles(['STORES', 'ADMIN']);
    const enqueuedJobs: EmailJob[] = [];

    for (const user of targetUsers) {
      const isAllowed = await this.notificationsService.isWorkflowEmailAllowed(user.id);
      if (!isAllowed) {
        this.logger.log(`Workflow email suppressed for user ${user.id} (${user.email}) due to preferences.`);
        continue;
      }

      const idempotencyKey = `ADDITIONAL_REQUEST:${event.id}:${user.id}`;
      const job = await this.emailQueueService.enqueueJob({
        recipientEmail: user.email,
        recipientUserId: user.id,
        recipientName: user.name,
        eventType: 'ADDITIONAL_REQUEST',
        templateKey: 'WORKFLOW_ADDITIONAL_REQUEST',
        subject: `[RMRIT Notification] Additional Material Request: ${event.rmNumber}`,
        payload: { rmNumber: event.rmNumber, scId: event.scId },
        idempotencyKey,
      });
      enqueuedJobs.push(job);
    }

    return enqueuedJobs;
  }

  /**
   * Event Handler 4: SC_COMPLETED
   * Triggers workflow email notification to Designer users upon SC completion.
   */
  async notifyScCompleted(event: ScCompletedEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing SC_COMPLETED event for SC "${event.scNumber}" (ID: ${event.id})`);

    let targetUsers: User[] = [];
    if (event.designerUserId) {
      const specificUser = await this.userRepository.findOne({
        where: { id: event.designerUserId, isActive: true },
      });
      if (specificUser) {
        targetUsers.push(specificUser);
      }
    }

    if (targetUsers.length === 0) {
      targetUsers = await this.findUsersByRoles(['DESIGNER', 'ADMIN']);
    }

    const enqueuedJobs: EmailJob[] = [];

    for (const user of targetUsers) {
      const isAllowed = await this.notificationsService.isWorkflowEmailAllowed(user.id);
      if (!isAllowed) {
        this.logger.log(`Workflow email suppressed for user ${user.id} (${user.email}) due to preferences.`);
        continue;
      }

      const idempotencyKey = `SC_COMPLETED:${event.id}:${user.id}`;
      const job = await this.emailQueueService.enqueueJob({
        recipientEmail: user.email,
        recipientUserId: user.id,
        recipientName: user.name,
        eventType: 'SC_COMPLETED',
        templateKey: 'WORKFLOW_SC_COMPLETED',
        subject: `[RMRIT Notification] SC Completed: ${event.scNumber}`,
        payload: { scNumber: event.scNumber, scId: event.id },
        idempotencyKey,
      });
      enqueuedJobs.push(job);
    }

    return enqueuedJobs;
  }
}
