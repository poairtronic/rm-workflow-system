import { Injectable, Optional, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailLog } from './entities/email-log.entity.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';
import { EmailAuditService } from './email-audit.service.js';
import { EmailWorkerService } from './email-worker.service.js';

export interface EmailQueueObservabilitySummary {
  pending: number;
  processing: number;
  retrying: number;
  failed: number;
  sent: number;
  sentToday: number;
  sentLast24h: number;
  dailyLimit: number;
  priorityReserve?: number;
  queueByPriority?: {
    workflowPriority1: number;
    standardPriority5: number;
    digestPriority9: number;
  };
  digestsSentLast24h?: number;
  cooldownSuppressedCount?: number;
  successRate: number;
  pausedUntil: string | null;
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
  systemHealth: 'HEALTHY' | 'DEGRADED';
  providerStatus: string;
  providerIdentityLabel?: string;
  testProviderInProduction?: boolean;
  timestamp: string;
}

@Injectable()
export class EmailObservabilityService {
  private readonly logger = new Logger(EmailObservabilityService.name);
  private readonly auditService: EmailAuditService;

  constructor(
    @InjectRepository(EmailJob)
    private readonly emailJobRepository: Repository<EmailJob>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @Optional() auditService?: EmailAuditService,
    @Optional()
    @Inject(forwardRef(() => EmailWorkerService))
    private readonly emailWorkerService?: EmailWorkerService,
  ) {
    this.auditService = auditService || new EmailAuditService(this.emailLogRepository);
  }

  /**
   * Retrieves high-performance database-aggregated metrics for the email queue.
   * Completely read-only with database-side COUNT and ORDER BY LIMIT 1 queries.
   */
  async getQueueObservability(clientTimezone?: string): Promise<EmailQueueObservabilitySummary> {
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

    // 2. Calculate emails sent today (from 12:00 AM today to 12:00 AM next day, resetting at midnight)
    let sentToday = 0;
    const tz =
      clientTimezone && typeof clientTimezone === 'string' && /^[a-zA-Z0-9_\/+\-]+$/.test(clientTimezone)
        ? clientTimezone
        : 'Asia/Kolkata';

    try {
      const qb = this.emailJobRepository.createQueryBuilder('job');
      if (typeof qb?.where === 'function' && typeof qb?.getCount === 'function') {
        sentToday = await qb
          .where('job.status = :status', { status: EmailJobStatus.SENT })
          .andWhere(
            `COALESCE(job.sent_at, job.created_at) >= (((now() AT TIME ZONE :tz)::date)::timestamp AT TIME ZONE :tz)`,
            { tz },
          )
          .getCount();
      }
    } catch {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        sentToday = await this.emailJobRepository.count({
          where: {
            status: EmailJobStatus.SENT,
          },
        });
      } catch {
        sentToday = 0;
      }
    }

    // 2b. Calculate emails sent in the last 24 hours
    let sentLast24h = 0;
    try {
      sentLast24h = await this.emailJobRepository.count({
        where: {
          status: EmailJobStatus.SENT,
          sentAt: MoreThanOrEqual(new Date(Date.now() - 24 * 60 * 60 * 1000)),
        },
      });
    } catch {
      sentLast24h = summaryMap.sent || 0;
    }

    // 3. Fetch Latest Log (Any Status) to determine true real-time operational state
    let latestLogStatus: EmailJobStatus | null = null;
    try {
      const latestLog = await this.emailLogRepository.findOne({
        order: { createdAt: 'DESC' },
      });
      if (latestLog) {
        latestLogStatus = latestLog.status;
      }
    } catch {
      // Graceful fallback
    }

    // 3. Fetch Last Successful Send (Prefer EmailLog, fallback to EmailJob)
    let lastSuccessfulSend: EmailQueueObservabilitySummary['lastSuccessfulSend'] = null;
    try {
      const lastSuccessLog = await this.emailLogRepository.findOne({
        where: { status: EmailJobStatus.SENT },
        order: { createdAt: 'DESC' },
      });

      if (lastSuccessLog) {
        lastSuccessfulSend = {
          timestamp: lastSuccessLog.createdAt
            ? new Date(lastSuccessLog.createdAt).toISOString()
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

    // 4. Fetch Last Failure (Prefer EmailLog, fallback to EmailJob)
    let lastFailure: EmailQueueObservabilitySummary['lastFailure'] = null;
    try {
      const lastFailedLog = await this.emailLogRepository.findOne({
        where: { status: EmailJobStatus.FAILED },
        order: { createdAt: 'DESC' },
      });

      if (lastFailedLog) {
        lastFailure = {
          timestamp: lastFailedLog.createdAt
            ? new Date(lastFailedLog.createdAt).toISOString()
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

    // Real-Time Health Assessment:
    // If the latest send attempt succeeded, the provider is working right now -> HEALTHY
    // If last successful send is newer than or equal to last failure -> HEALTHY
    // If there are zero failed jobs -> HEALTHY
    // Otherwise -> DEGRADED
    const lastSuccessMs = lastSuccessfulSend?.timestamp
      ? new Date(lastSuccessfulSend.timestamp).getTime()
      : 0;
    const lastFailureMs = lastFailure?.timestamp
      ? new Date(lastFailure.timestamp).getTime()
      : 0;

    const isHealthy =
      latestLogStatus === EmailJobStatus.SENT ||
      (lastSuccessMs > 0 && lastSuccessMs >= lastFailureMs) ||
      summaryMap.failed === 0;

    const workerPausedUntil = this.emailWorkerService?.getPausedUntil() || null;
    const isPaused = Boolean(workerPausedUntil && workerPausedUntil.getTime() > Date.now());
    const pausedUntilStr = workerPausedUntil ? workerPausedUntil.toISOString() : null;

    let systemHealth: 'HEALTHY' | 'DEGRADED' = isHealthy ? 'HEALTHY' : 'DEGRADED';
    let providerStatus: string;

    if (isPaused) {
      providerStatus = `RATE_LIMITED (until ${workerPausedUntil!.toISOString()})`;
      systemHealth = 'DEGRADED';
    } else {
      providerStatus = isHealthy ? 'operational' : 'degraded';
    }

    // Success rate: sent / (sent + failed) from database-aggregated counts
    const totalDecided = summaryMap.sent + summaryMap.failed;
    const successRate = totalDecided > 0
      ? Math.round((summaryMap.sent / totalDecided) * 100)
      : (isHealthy ? 100 : 0);

    // 5. Queue breakdown by priority (active queue: pending, processing, retrying)
    let queueByPriority = { workflowPriority1: 0, standardPriority5: 0, digestPriority9: 0 };
    try {
      const qb = this.emailJobRepository.createQueryBuilder('job');
      if (typeof qb?.select === 'function') {
        const pRows = await qb
          .select('COUNT(CASE WHEN COALESCE(job.priority, 5) <= 1 THEN 1 END)', 'p1')
          .addSelect('COUNT(CASE WHEN COALESCE(job.priority, 5) > 1 AND COALESCE(job.priority, 5) <= 5 THEN 1 END)', 'p5')
          .addSelect('COUNT(CASE WHEN COALESCE(job.priority, 5) >= 9 THEN 1 END)', 'p9')
          .where('job.status IN (:...statuses)', {
            statuses: [EmailJobStatus.PENDING, EmailJobStatus.RETRYING, EmailJobStatus.PROCESSING],
          })
          .getRawOne<{ p1: string; p5: string; p9: string }>();
        if (pRows) {
          queueByPriority = {
            workflowPriority1: parseInt(pRows.p1, 10) || 0,
            standardPriority5: parseInt(pRows.p5, 10) || 0,
            digestPriority9: parseInt(pRows.p9, 10) || 0,
          };
        }
      }
    } catch {
      // Fallback
    }

    // 6. Digests sent in last 24h
    let digestsSentLast24h = 0;
    try {
      const qb = this.emailJobRepository.createQueryBuilder('job');
      if (typeof qb?.where === 'function' && typeof qb?.getCount === 'function') {
        digestsSentLast24h = await qb
          .where('job.status = :status', { status: EmailJobStatus.SENT })
          .andWhere('(job.template_key = :templateKey OR job.priority = 9)', { templateKey: 'ALERT_DIGEST' })
          .andWhere('COALESCE(job.sent_at, job.created_at) >= :since', {
            since: new Date(Date.now() - 24 * 60 * 60 * 1000),
          })
          .getCount();
      }
    } catch {
      // Fallback
    }

    // 7. Items suppressed by cooldown in last 24h
    let cooldownSuppressedCount = 0;
    try {
      if (typeof this.emailJobRepository.query === 'function') {
        const skipResult = await this.emailJobRepository.query(`
          SELECT COUNT(*)::int as count 
          FROM "email_skip_log" 
          WHERE "reason" = 'COOLDOWN' 
            AND "created_at" >= NOW() - INTERVAL '24 hours'
        `);
        if (skipResult && skipResult[0]) {
          cooldownSuppressedCount = parseInt(skipResult[0].count, 10) || 0;
        }
      }
    } catch {
      // Fallback
    }

    return {
      pending: summaryMap.pending,
      processing: summaryMap.processing,
      retrying: summaryMap.retrying,
      failed: summaryMap.failed,
      sent: summaryMap.sent,
      sentToday,
      sentLast24h,
      dailyLimit: this.emailWorkerService?.dailyLimit || 400,
      priorityReserve: this.emailWorkerService?.priorityReserve ?? 100,
      queueByPriority,
      digestsSentLast24h,
      cooldownSuppressedCount,
      successRate,
      pausedUntil: pausedUntilStr,
      total: totalJobs,
      systemHealth,
      providerStatus,
      testProviderInProduction: (() => {
        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isTestProvider =
          (process.env.EMAIL_PROVIDER_TYPE || '').toLowerCase() === 'test' ||
          !process.env.GMAIL_CLIENT_ID;
        return nodeEnv === 'production' && isTestProvider;
      })(),
      providerIdentityLabel: (() => {
        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isTestProvider =
          (process.env.EMAIL_PROVIDER_TYPE || '').toLowerCase() === 'test' ||
          !process.env.GMAIL_CLIENT_ID;
        if (nodeEnv === 'production' && isTestProvider) {
          this.logger.error(
            '[CRITICAL CONFIG ERROR] TEST PROVIDER ACTIVE IN PRODUCTION! Real emails are NOT being dispatched!',
          );
          return 'TEST PROVIDER ACTIVE IN PRODUCTION';
        }
        return isTestProvider
          ? 'TEST-PROVIDER (mock)'
          : (process.env.GMAIL_SENDER_EMAIL
              ? `GMAIL-API (${process.env.GMAIL_SENDER_EMAIL})`
              : 'GMAIL-API');
      })(),
      lastSuccessfulSend,
      lastFailure,
      timestamp: new Date().toISOString(),
    };
  }
}
