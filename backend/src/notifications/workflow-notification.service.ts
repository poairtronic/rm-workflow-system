import { Injectable, Logger } from '@nestjs/common';
import { EmailJob } from '../email/entities/email-job.entity.js';
import { CommunicationService } from './communication.service.js';

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
    private readonly communicationService: CommunicationService,
  ) {}

  /**
   * Resolves active users matching specific role names (e.g., STORES, PRODUCTION, DESIGNER).
   */
  async findUsersByRoles(roleNames: string[]) {
    return this.communicationService.findUsersByRoles(roleNames);
  }

  /**
   * Event Handler 1: RM_SUBMITTED
   * Triggers dual-channel orchestration for RM submission.
   */
  async notifyRmSubmitted(event: RmSubmittedEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing RM_SUBMITTED event for RM "${event.rmNumber}" (ID: ${event.id})`);
    const result = await this.communicationService.notifyRmSubmitted(event);
    return result.emailJobs;
  }

  /**
   * Event Handler 2: MATERIAL_ISSUED
   * Triggers dual-channel orchestration for Material Issue.
   */
  async notifyMaterialIssued(event: MaterialIssuedEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing MATERIAL_ISSUED event for RM "${event.rmNumber}" (Issue ID: ${event.id})`);
    const result = await this.communicationService.notifyMaterialIssued(event);
    return result.emailJobs;
  }

  /**
   * Event Handler 3: ADDITIONAL_REQUEST
   * Triggers dual-channel orchestration for Additional Request creation.
   */
  async notifyAdditionalRequest(event: AdditionalRequestEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing ADDITIONAL_REQUEST event for RM "${event.rmNumber}" (Request ID: ${event.id})`);
    const result = await this.communicationService.notifyAdditionalRequest(event);
    return result.emailJobs;
  }

  /**
   * Event Handler 4: SC_COMPLETED
   * Triggers dual-channel orchestration for SC completion.
   */
  async notifyScCompleted(event: ScCompletedEventPayload): Promise<EmailJob[]> {
    this.logger.log(`Processing SC_COMPLETED event for SC "${event.scNumber}" (ID: ${event.id})`);
    const result = await this.communicationService.notifyScCompleted(event);
    return result.emailJobs;
  }
}
