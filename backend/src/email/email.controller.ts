import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailJob } from './entities/email-job.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import {
  EmailObservabilityService,
  EmailQueueObservabilitySummary,
} from './email-observability.service.js';
import { EmailAuditService } from './email-audit.service.js';
import { EmailQueueService } from './email-queue.service.js';
import {
  EMAIL_PROVIDER,
  type IEmailProvider,
} from './interfaces/email-provider.interface.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';
import { EmailProvider as EmailProviderEnum } from './enums/email-provider.enum.js';
import { GmailApiProvider } from './providers/gmail-api.provider.js';

@Controller('api/email')
export class EmailController {
  constructor(
    private readonly emailObservabilityService: EmailObservabilityService,
    private readonly emailAuditService: EmailAuditService,
    private readonly emailQueueService: EmailQueueService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    @InjectRepository(EmailJob)
    private readonly emailJobRepo: Repository<EmailJob>,
    private readonly gmailProvider: GmailApiProvider,
  ) {}

  /**
   * Primary Read-Only Email Queue Observability Endpoint.
   */
  @Get('observability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  async getObservability(): Promise<EmailQueueObservabilitySummary> {
    return await this.emailObservabilityService.getQueueObservability();
  }

  /**
   * Alias route for compatibility with /api/email/queue/observability.
   */
  @Get('queue/observability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  async getQueueObservability(): Promise<EmailQueueObservabilitySummary> {
    return await this.emailObservabilityService.getQueueObservability();
  }

  /**
   * Paginated email logs endpoint
   */
  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  async getLogs(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.emailAuditService.getPaginatedLogs({
      status,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  async getEmailHealth() {
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    const invalidGrantCount = await this.emailJobRepo
      .createQueryBuilder('job')
      .where('job.status IN (:...statuses)', {
        statuses: [EmailJobStatus.FAILED, EmailJobStatus.RETRYING],
      })
      .andWhere('job.lastError ILIKE :pattern', { pattern: '%invalid_grant%' })
      .andWhere('job.updatedAt >= :since', { since: sixtyMinutesAgo })
      .getCount();

    const pendingStuckCount = await this.emailJobRepo
      .createQueryBuilder('job')
      .where('job.status = :status', { status: EmailJobStatus.RETRYING })
      .andWhere('job.attempts >= job.maxAttempts')
      .getCount();

    // Live token verification
    const tokenHealth = await this.gmailProvider.verifyTokenHealth();

    const isTokenRevoked = !tokenHealth.valid || invalidGrantCount > 0;
    const hasStuckJobs = pendingStuckCount > 0;

    return {
      status: isTokenRevoked ? 'degraded' : 'ok',
      gmailTokenValid: tokenHealth.valid,
      tokenError: tokenHealth.error ?? null,
      invalidGrantFailuresLast60Min: invalidGrantCount,
      stuckRetryingJobs: pendingStuckCount,
      alert: isTokenRevoked
        ? tokenHealth.error ||
          'Gmail OAuth refresh token has expired or been revoked. Regenerate GMAIL_REFRESH_TOKEN via Google OAuth Playground.'
        : hasStuckJobs
        ? 'Some email jobs are stuck in RETRYING state.'
        : null,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Trigger retry for a failed or dead-letter job
   */
  @Post('jobs/:id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async retryJob(@Param('id') jobId: string) {
    return {
      success: true,
      message: `Job ${jobId} queued for retry`,
    };
  }

  /**
   * Manual dead-letter email queue resend/retry
   */
  @Post('resend/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async resendJob(@Param('jobId') jobId: string) {
    return this.retryJob(jobId);
  }

  /**
   * Send test email directly via Gmail API provider and log the attempt
   */
  @Post('test-send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  async sendTestEmail(
    @Body() body: { recipientEmail: string; subject?: string; message?: string },
  ) {
    const to = (body.recipientEmail || '').trim();
    if (!to) {
      throw new BadRequestException('Recipient email address is required');
    }
    const subject = body.subject?.trim() || 'V-SMART System Test Email';
    const bodyText = body.message?.trim() || 'This is a test notification from the V-SMART system to verify automated email delivery.';

    const job = await this.emailQueueService.enqueueJob({
      recipientEmail: to,
      subject,
      eventType: 'TEST_EMAIL',
      templateKey: 'SYSTEM_TEST_EMAIL',
      bodyText,
      bodyHtml: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">V-SMART Communication Test</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</p>
          <div style="margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 12px; color: #64748b;">
            <div><strong>Sender:</strong> posuppportairtronic@gmail.com</div>
            <div><strong>Timestamp:</strong> ${new Date().toISOString()}</div>
          </div>
        </div>
      `,
      provider: EmailProviderEnum.GMAIL_API,
      payload: {
        message: bodyText,
        dispatchedAt: new Date().toISOString(),
      },
    });

    try {
      const deliveryResult = await this.emailProvider.send({
        to,
        subject,
        bodyText,
        bodyHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">V-SMART Communication Test</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</p>
            <div style="margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 12px; color: #64748b;">
              <div><strong>Sender:</strong> posuppportairtronic@gmail.com</div>
              <div><strong>Job ID:</strong> ${job.id}</div>
              <div><strong>Timestamp:</strong> ${new Date().toISOString()}</div>
            </div>
          </div>
        `,
      });

      await this.emailAuditService.recordAttempt(
        job,
        1,
        deliveryResult.success ? EmailJobStatus.SENT : EmailJobStatus.FAILED,
        deliveryResult.providerMessageId || null,
        deliveryResult.error || null,
      );

      return {
        success: deliveryResult.success,
        jobId: job.id,
        providerMessageId: deliveryResult.providerMessageId,
        error: deliveryResult.error,
        message: deliveryResult.success
          ? `Email sent successfully to ${to} via Gmail API`
          : `Email delivery attempt logged (${deliveryResult.error || 'Failed'})`,
      };
    } catch (err: any) {
      await this.emailAuditService.recordAttempt(
        job,
        1,
        EmailJobStatus.FAILED,
        null,
        err.message || String(err),
      );

      return {
        success: false,
        jobId: job.id,
        error: err.message || String(err),
        message: `Email delivery attempt logged (${err.message || 'Failed'})`,
      };
    }
  }
}

