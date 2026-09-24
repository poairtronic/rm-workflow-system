import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailLog } from './entities/email-log.entity.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';
import { EmailAuditService } from './email-audit.service.js';

export interface EmailQueueObservabilitySummary {
  pending: number;
  processing: number;
  retrying: number;
  failed: number;
  sent: number;
  total: number;
  lastSuccessfulSend: {
    timestamp: string | null;
    eventType?: string | null;
    recipientEmail?: string | null;
  } | null;
  lastFailure: {
    timestamp: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    eventType?: string | null;
  } | null;
  timestamp: string;
}

@Injectable()
export class EmailObservabilityService {
  private readonly auditService: EmailAuditService;

  constructor(
    @InjectRepository(EmailJob)
    private readonly emailJobRepository: Repository<EmailJob>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @Optional() auditService?: EmailAuditService,
  ) {
    this.auditService = auditService || new EmailAuditService(this.emailLogRepository);
  }

  /**
   * Retrieves high-performance database-aggregated metrics for the email queue.
   * Completely read-only with database-side COUNT and ORDER BY LIMIT 1 queries.
   */
  async getQueueObservability(): Promise<EmailQueueObservabilitySummary> {
    // 1. Single database-side aggregation query for status counts
    const statusCounts = await this.emailJobRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(job.id)', 'count')
      .groupBy('job.status')
      .getRawMany<{ status: string; count: string }>();

    const summaryMap: Record<string, number> = {
      pending: 0,
      processing: 0,
      retrying: 0,
      failed: 0,
      sent: 0,
    };

    let totalJobs = 0;
    for (const row of statusCounts) {
      const cnt = parseInt(row.count, 10) || 0;
      totalJobs += cnt;
      const statusKey = (row.status || '').toLowerCase();
      if (statusKey in summaryMap) {
        summaryMap[statusKey] = cnt;
      }
    }

    // 2. Fetch Last Successful Send (Prefer EmailLog, fallback to EmailJob)
    let lastSuccessfulSend: EmailQueueObservabilitySummary['lastSuccessfulSend'] = null;
    try {
      const lastSuccessLog = await this.emailLogRepository.findOne({
        where: { status: EmailJobStatus.SENT },
        order: { attemptedAt: 'DESC' },
      });

      if (lastSuccessLog) {
        lastSuccessfulSend = {
          timestamp: lastSuccessLog.attemptedAt
            ? new Date(lastSuccessLog.attemptedAt).toISOString()
            : null,
          eventType: lastSuccessLog.eventType || null,
          recipientEmail: lastSuccessLog.recipientEmail || null,
        };
      } else {
        const lastSuccessJob = await this.emailJobRepository.findOne({
          where: { status: EmailJobStatus.SENT },
          order: { sentAt: 'DESC' },
        });
        if (lastSuccessJob && lastSuccessJob.sentAt) {
          lastSuccessfulSend = {
            timestamp: new Date(lastSuccessJob.sentAt).toISOString(),
            eventType: lastSuccessJob.eventType || null,
            recipientEmail: lastSuccessJob.recipientEmail || null,
          };
        }
      }
    } catch {
      // Graceful fallback if log table is inaccessible
    }

    // 3. Fetch Last Failure (Prefer EmailLog, fallback to EmailJob)
    let lastFailure: EmailQueueObservabilitySummary['lastFailure'] = null;
    try {
      const lastFailedLog = await this.emailLogRepository.findOne({
        where: { status: EmailJobStatus.FAILED },
        order: { attemptedAt: 'DESC' },
      });

      if (lastFailedLog) {
        lastFailure = {
          timestamp: lastFailedLog.attemptedAt
            ? new Date(lastFailedLog.attemptedAt).toISOString()
            : null,
          errorCode: lastFailedLog.errorCode || null,
          errorMessage: this.auditService.sanitizeError(lastFailedLog.errorMessage) || null,
          eventType: lastFailedLog.eventType || null,
        };
      } else {
        const lastFailedJob = await this.emailJobRepository.findOne({
          where: { status: EmailJobStatus.FAILED },
          order: { updatedAt: 'DESC' },
        });
        if (lastFailedJob) {
          lastFailure = {
            timestamp: lastFailedJob.updatedAt
              ? new Date(lastFailedJob.updatedAt).toISOString()
              : null,
            errorCode: null,
            errorMessage: this.auditService.sanitizeError(lastFailedJob.lastError) || null,
            eventType: lastFailedJob.eventType || null,
          };
        }
      }
    } catch {
      // Graceful fallback
    }

    return {
      pending: summaryMap.pending,
      processing: summaryMap.processing,
      retrying: summaryMap.retrying,
      failed: summaryMap.failed,
      sent: summaryMap.sent,
      total: totalJobs,
      lastSuccessfulSend,
      lastFailure,
      timestamp: new Date().toISOString(),
    };
  }
}
