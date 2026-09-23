import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity.js';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';
import { EmailProvider } from './enums/email-provider.enum.js';

@Injectable()
export class EmailAuditService {
  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {}

  /**
   * Sanitizes sensitive information (tokens, secrets, codes) from error messages.
   */
  public sanitizeError(msg?: string | null): string | null {
    if (!msg) return null;
    return msg
      .replace(/GMAIL_CLIENT_SECRET=[^\s&"]+/gi, 'GMAIL_CLIENT_SECRET=[REDACTED]')
      .replace(/GMAIL_REFRESH_TOKEN=[^\s&"]+/gi, 'GMAIL_REFRESH_TOKEN=[REDACTED]')
      .replace(/client_secret=[^\s&"]+/gi, 'client_secret=[REDACTED]')
      .replace(/refresh_token=[^\s&"]+/gi, 'refresh_token=[REDACTED]')
      .replace(/access_token=[^\s&"]+/gi, 'access_token=[REDACTED]')
      .replace(/code=[^\s&"]+/gi, 'code=[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9-._~+/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/Authorization:\s*[^\s,]+/gi, 'Authorization: [REDACTED]')
      .replace(/password=[^\s&"]+/gi, 'password=[REDACTED]');
  }

  /**
   * Extracts safe error code string from message or status code.
   */
  public deriveErrorCode(errorMsg?: string | null): string | null {
    if (!errorMsg) return null;
    if (errorMsg.includes('429')) return 'GMAIL_HTTP_429';
    if (errorMsg.includes('503')) return 'GMAIL_HTTP_503';
    if (errorMsg.includes('500')) return 'GMAIL_HTTP_500';
    if (errorMsg.includes('502')) return 'GMAIL_HTTP_502';
    if (errorMsg.includes('504')) return 'GMAIL_HTTP_504';
    if (errorMsg.includes('400')) return 'GMAIL_HTTP_400';
    if (errorMsg.includes('401')) return 'OAUTH_AUTH_FAILURE';
    if (errorMsg.includes('403')) return 'INSUFFICIENT_PERMISSION';
    if (errorMsg.includes('ECONNRESET') || errorMsg.includes('ETIMEDOUT')) return 'NETWORK_TIMEOUT';
    if (errorMsg.includes('recipient')) return 'INVALID_RECIPIENT';
    return 'PROVIDER_ERROR';
  }

  /**
   * Appends an immutable EmailLog entry for a provider delivery attempt.
   */
  async recordAttempt(
    job: EmailJob,
    attempt: number,
    status: EmailJobStatus,
    providerMessageId?: string | null,
    errorMessage?: string | null,
    errorCode?: string | null,
  ): Promise<EmailLog> {
    const sanitizedError = this.sanitizeError(errorMessage);
    const derivedCode = errorCode || this.deriveErrorCode(sanitizedError);

    const logEntry = this.emailLogRepository.create({
      jobId: job.id,
      eventType: job.eventType,
      recipientEmail: job.recipientEmail,
      recipientUserId: job.recipientUserId || null,
      recipientName: job.recipientName || null,
      subject: job.subject,
      provider: job.provider || EmailProvider.GMAIL_API,
      attempt: attempt > 0 ? attempt : job.attempts || 1,
      status,
      providerMessageId: providerMessageId || null,
      errorCode: derivedCode,
      errorMessage: sanitizedError,
      attemptedAt: new Date(),
    });

    return await this.emailLogRepository.save(logEntry);
  }

  /**
   * Returns all historical attempts for a job ordered deterministically by attempted_at ASC, id ASC.
   */
  async getLogsForJob(jobId: string): Promise<EmailLog[]> {
    return await this.emailLogRepository.find({
      where: { jobId },
      order: {
        attemptedAt: 'ASC',
        id: 'ASC',
      },
    });
  }

  /**
   * Finds an audit log by Gmail provider message ID.
   */
  async findLogByProviderMessageId(providerMessageId: string): Promise<EmailLog | null> {
    return await this.emailLogRepository.findOne({
      where: { providerMessageId },
    });
  }

  /**
   * Returns failed delivery attempt audit records.
   */
  async getFailedLogs(provider?: EmailProvider): Promise<EmailLog[]> {
    const whereCondition: any = { status: EmailJobStatus.FAILED };
    if (provider) {
      whereCondition.provider = provider;
    }
    return await this.emailLogRepository.find({
      where: whereCondition,
      order: { attemptedAt: 'DESC' },
    });
  }

  async logAttempt(params: {
    emailJobId: string;
    recipientEmail: string;
    subject: string;
    provider: EmailProvider;
    status: any;
    providerMessageId?: string;
    errorMessage?: string;
  }): Promise<EmailLog> {
    const logEntry = this.emailLogRepository.create({
      jobId: params.emailJobId,
      eventType: 'LOG_ATTEMPT',
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      provider: params.provider,
      attempt: 1,
      status: params.status,
      providerMessageId: params.providerMessageId,
      errorMessage: params.errorMessage,
      attemptedAt: new Date(),
    });
    return await this.emailLogRepository.save(logEntry);
  }
}
