import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from './email-queue.service.js';
import { EmailAuditService } from './email-audit.service.js';
import { TemplateResolver, MalformedJobException } from './resolvers/template.resolver.js';
import {
  type IEmailProvider,
  EMAIL_PROVIDER,
  EmailDeliveryMessage,
} from './interfaces/email-provider.interface.js';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';
import * as os from 'node:os';

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(EmailWorkerService.name);

  public readonly workerId: string;
  public isEnabled: boolean = true;
  public pollIntervalMs: number = 5000;
  public batchSize: number = 10;
  public staleThresholdSeconds: number = 300;
  public retryBackoffSeconds: number = 60;
  public maxRetryBackoffSeconds: number = 3600;
  public shutdownTimeoutMs: number = 10000;
  public sendIntervalMs: number = 3000;
  public dailyLimit: number = 400;
  public pausedUntil: Date | null = null;

  private isRunning: boolean = false;
  private isPolling: boolean = false;
  private autoLoop: boolean = false;
  private timerHandle: NodeJS.Timeout | null = null;
  private activeProcessingPromise: Promise<void> | null = null;
  private currentPollIntervalMs: number = 5000;
  private lastSendTimestamp: number = 0;

  constructor(
    private readonly emailQueueService: EmailQueueService,
    private readonly templateResolver: TemplateResolver,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,
    @Optional()
    private readonly configService?: ConfigService,
    @Optional()
    private readonly auditService?: EmailAuditService,
  ) {
    const customWorkerId = this.configService?.get<string>('EMAIL_WORKER_ID');
    const hostname = os.hostname() || 'localhost';
    const pid = process.pid || 1;
    const randomHex = Math.random().toString(16).substring(2, 8);
    this.workerId = customWorkerId || `worker-${hostname}-${pid}-${randomHex}`;

    if (this.configService) {
      const enabledConf = this.configService.get<string | boolean>('EMAIL_WORKER_ENABLED');
      if (enabledConf !== undefined) {
        this.isEnabled = String(enabledConf).toLowerCase() !== 'false';
      }
      this.pollIntervalMs = Number(
        this.configService.get('EMAIL_WORKER_POLL_INTERVAL_MS') || this.pollIntervalMs,
      );
      this.batchSize = Number(
        this.configService.get('EMAIL_WORKER_BATCH_SIZE') || this.batchSize,
      );
      this.staleThresholdSeconds = Number(
        this.configService.get('EMAIL_WORKER_STALE_THRESHOLD_SECONDS') ||
          this.staleThresholdSeconds,
      );
      this.retryBackoffSeconds = Number(
        this.configService.get('EMAIL_WORKER_RETRY_BACKOFF_SECONDS') ||
          this.retryBackoffSeconds,
      );
      this.maxRetryBackoffSeconds = Number(
        this.configService.get('EMAIL_RETRY_MAX_DELAY') ||
          this.configService.get('EMAIL_WORKER_MAX_RETRY_BACKOFF_SECONDS') ||
          this.maxRetryBackoffSeconds,
      );
      this.shutdownTimeoutMs = Number(
        this.configService.get('EMAIL_WORKER_SHUTDOWN_TIMEOUT_MS') ||
          this.shutdownTimeoutMs,
      );
      this.sendIntervalMs = Number(
        this.configService.get('EMAIL_SEND_INTERVAL_MS') ||
          process.env.EMAIL_SEND_INTERVAL_MS ||
          this.sendIntervalMs,
      );
      this.dailyLimit = Number(
        this.configService.get('EMAIL_DAILY_LIMIT') ||
          process.env.EMAIL_DAILY_LIMIT ||
          this.dailyLimit,
      );
      this.currentPollIntervalMs = this.pollIntervalMs;
    }
  }

  public getPausedUntil(): Date | null {
    return this.pausedUntil;
  }

  public setPausedUntil(until: Date | null): void {
    this.pausedUntil = until;
  }

  private async enforcePacing(): Promise<void> {
    if (this.sendIntervalMs <= 0) return;
    const now = Date.now();
    const elapsed = now - this.lastSendTimestamp;
    if (this.lastSendTimestamp > 0 && elapsed < this.sendIntervalMs) {
      const waitMs = this.sendIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this.isEnabled = false;
    }

    if (this.isEnabled) {
      this.logger.log(`Initializing EmailWorkerService [ID: ${this.workerId}]`);
      this.start(true);
    } else {
      this.logger.log(`EmailWorkerService [ID: ${this.workerId}] is disabled by configuration.`);
    }
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down EmailWorkerService [ID: ${this.workerId}] (signal: ${signal || 'N/A'})`);
    this.stop();

    if (this.activeProcessingPromise) {
      this.logger.log(`Waiting for active job processing to complete (timeout: ${this.shutdownTimeoutMs}ms)...`);
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, this.shutdownTimeoutMs),
      );
      await Promise.race([this.activeProcessingPromise, timeoutPromise]);
    }

    this.logger.log(`EmailWorkerService [ID: ${this.workerId}] shutdown complete.`);
  }

  public start(autoLoop: boolean = false): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.autoLoop = autoLoop;
    this.currentPollIntervalMs = this.pollIntervalMs;
    if (this.autoLoop) {
      this.scheduleNextTick(0);
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.autoLoop = false;
    this.currentPollIntervalMs = this.pollIntervalMs;
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }

  public isWorkerRunning(): boolean {
    return this.isRunning;
  }

  public isWorkerPolling(): boolean {
    return this.isPolling;
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning || !this.autoLoop) {
      return;
    }
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
    }
    this.timerHandle = setTimeout(() => {
      this.activeProcessingPromise = this.pollTick()
        .then(() => {})
        .finally(() => {
          this.activeProcessingPromise = null;
        });
    }, delayMs);
  }

  /**
   * Executes a single polling cycle.
   */
  public async pollTick(): Promise<number> {
    if (!this.isRunning || this.isPolling) {
      return 0;
    }

    // 1. Check Global Rate-Limit Pause
    if (this.pausedUntil) {
      if (this.pausedUntil.getTime() > Date.now()) {
        this.logger.warn(
          `Worker ${this.workerId} paused due to provider rate limit until ${this.pausedUntil.toISOString()}`,
        );
        return 0;
      } else {
        this.logger.log(
          `Worker ${this.workerId} rate-limit pause expired (${this.pausedUntil.toISOString()}). Resuming normal operations.`,
        );
        this.pausedUntil = null;
      }
    }

    // 2. Check Daily Budget Guard (EMAIL_DAILY_LIMIT, default 400 in last 24h)
    if (this.dailyLimit > 0) {
      try {
        const sentLast24h = await this.emailQueueService.getSentCountLast24Hours();
        if (sentLast24h >= this.dailyLimit) {
          const earliest = await this.emailQueueService.getEarliestSentInLast24Hours();
          const resumeAt = earliest
            ? new Date(earliest.getTime() + 24 * 60 * 60 * 1000 + 5000)
            : new Date(Date.now() + 60 * 60 * 1000);
          this.logger.warn(
            `Daily email budget reached (${sentLast24h}/${this.dailyLimit} in 24h). Deferring queue until ${resumeAt.toISOString()}`,
          );
          this.pausedUntil = resumeAt;
          return 0;
        }
      } catch (budgetErr) {
        this.logger.warn(`Failed checking daily email budget: ${this.sanitizeLog(String(budgetErr))}`);
      }
    }

    this.isPolling = true;
    let processedCount = 0;
    let hasClaimedJobs = false;

    try {
      // 3. Recover stale jobs locked by crashed workers
      try {
        const recoveredCount = await this.emailQueueService.recoverStaleJobs(
          this.staleThresholdSeconds,
        );
        if (recoveredCount > 0) {
          this.logger.log(
            `Recovered ${recoveredCount} stale email job(s) locked > ${this.staleThresholdSeconds}s`,
          );
        }
      } catch (staleErr) {
        this.logger.warn(`Stale job recovery failed: ${this.sanitizeLog(String(staleErr))}`);
      }

      // 4. Claim batch of eligible jobs via FOR UPDATE SKIP LOCKED
      const claimedJobs = await this.emailQueueService.claimJobs(
        this.batchSize,
        this.workerId,
      );

      if (!claimedJobs || claimedJobs.length === 0) {
        return 0;
      }

      hasClaimedJobs = true;
      this.currentPollIntervalMs = this.pollIntervalMs;
      this.logger.log(`Claimed ${claimedJobs.length} email job(s) for worker ${this.workerId}`);

      // 5. Process claimed jobs sequentially with pacing delay
      for (let i = 0; i < claimedJobs.length; i++) {
        const job = claimedJobs[i];
        if (!this.isRunning) {
          await this.emailQueueService.releaseClaim(job.id, this.workerId);
          continue;
        }

        // Pacing delay (EMAIL_SEND_INTERVAL_MS, default 3000ms)
        await this.enforcePacing();

        const processResult = await this.processSingleJob(job);
        processedCount++;

        if (processResult?.isRateLimited) {
          const retryAfter = processResult.retryAfterDate || new Date(Date.now() + 15 * 60 * 1000);
          const pauseDate = new Date(retryAfter.getTime() + 5000);
          this.pausedUntil = pauseDate;
          this.logger.warn(
            `Rate limit hit on EmailJob ${job.id}. Global worker pause activated until ${pauseDate.toISOString()}`,
          );

          // Release remaining jobs in this batch back to PENDING (no attempt consumed)
          const remainingJobs = claimedJobs.slice(i + 1);
          if (remainingJobs.length > 0) {
            const remainingIds = remainingJobs.map((j) => j.id);
            try {
              await this.emailQueueService.releaseClaimBatchAfterRateLimit(
                remainingIds,
                this.workerId,
                pauseDate,
              );
              this.logger.log(
                `Released ${remainingIds.length} claimed job(s) back to PENDING deferred until ${pauseDate.toISOString()}`,
              );
            } catch (releaseErr) {
              this.logger.error(`Failed releasing claimed jobs on rate limit: ${releaseErr}`);
            }
          }
          break; // Stop processing current batch immediately
        }
      }
    } catch (err) {
      this.logger.error(`Error in worker pollTick cycle: ${this.sanitizeLog(String(err))}`);
    } finally {
      this.isPolling = false;
      if (this.isRunning && this.autoLoop) {
        this.scheduleNextTick(this.currentPollIntervalMs);
        if (!hasClaimedJobs) {
          this.currentPollIntervalMs = Math.min(
            this.currentPollIntervalMs * 2,
            60000,
          );
        }
      }
    }

    return processedCount;
  }

  public async processSingleJob(job: EmailJob): Promise<{
    success: boolean;
    isRateLimited?: boolean;
    retryAfterDate?: Date | null;
  }> {
    this.logger.log(`Processing EmailJob ${job.id} (attempt ${job.attempts}/${job.maxAttempts}) to ${job.recipientEmail}`);

    try {
      // Step A: Load/resolve email content
      const resolved = this.templateResolver.resolveContent(job);

      // Step B: Build delivery message
      const deliveryMessage: EmailDeliveryMessage = {
        to: job.recipientEmail,
        recipientName: job.recipientName,
        subject: resolved.subject,
        bodyText: resolved.bodyText,
        bodyHtml: resolved.bodyHtml,
        eventType: job.eventType,
        templateKey: job.templateKey,
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
      };

      // Step C: Invoke provider abstraction (NO DB transaction held during external call)
      const result = await this.emailProvider.send(deliveryMessage);
      this.lastSendTimestamp = Date.now();

      // Step D: Record result in PostgreSQL
      if (result.success) {
        await this.emailQueueService.markSuccess(
          job.id,
          this.workerId,
          result.providerMessageId,
        );
        if (this.auditService) {
          await this.auditService.recordAttempt(
            job,
            job.attempts,
            EmailJobStatus.SENT,
            result.providerMessageId,
            null,
            null,
          );
        }
        this.logger.log(`Successfully sent EmailJob ${job.id} (providerMsgId: ${result.providerMessageId || 'N/A'})`);
        return { success: true };
      } else {
        const isRetryable = result.retryable !== false;
        const errorMsg = this.sanitizeLog(result.error || 'Provider delivery failed');
        const isTerminal = !isRetryable;
        const isRateLimited = Boolean(
          result.isRateLimited ||
          /rate limit/i.test(errorMsg) ||
          /user-rate limit/i.test(errorMsg) ||
          /429/i.test(errorMsg),
        );

        await this.emailQueueService.markFailed(
          job.id,
          this.workerId,
          errorMsg,
          this.retryBackoffSeconds,
          isTerminal,
          this.maxRetryBackoffSeconds,
          isRateLimited,
          result.retryAfterDate,
        );

        if (this.auditService) {
          const auditStatus = (isTerminal || job.attempts >= job.maxAttempts) && !isRateLimited
            ? EmailJobStatus.FAILED
            : EmailJobStatus.RETRYING;
          await this.auditService.recordAttempt(
            job,
            job.attempts,
            auditStatus,
            null,
            errorMsg,
            isRateLimited ? 'RATE_LIMITED' : null,
          );
        }

        if (isTerminal) {
          this.logger.warn(`EmailJob ${job.id} permanently failed: ${errorMsg}`);
        } else if (isRateLimited) {
          this.logger.warn(`EmailJob ${job.id} deferred due to rate limit: ${errorMsg}`);
        } else {
          this.logger.warn(`EmailJob ${job.id} delivery failed (retryable): ${errorMsg}`);
        }

        return {
          success: false,
          isRateLimited,
          retryAfterDate: result.retryAfterDate,
        };
      }
    } catch (err) {
      this.lastSendTimestamp = Date.now();
      const isMalformed = err instanceof MalformedJobException;
      const errorMsg = this.sanitizeLog(
        err instanceof Error ? err.message : String(err),
      );
      const isRateLimited = /rate limit/i.test(errorMsg) || /429/i.test(errorMsg);

      await this.emailQueueService.markFailed(
        job.id,
        this.workerId,
        errorMsg,
        this.retryBackoffSeconds,
        isMalformed,
        this.maxRetryBackoffSeconds,
        isRateLimited,
      );

      if (this.auditService) {
        const auditStatus = (isMalformed || job.attempts >= job.maxAttempts) && !isRateLimited
          ? EmailJobStatus.FAILED
          : EmailJobStatus.RETRYING;
        await this.auditService.recordAttempt(
          job,
          job.attempts,
          auditStatus,
          null,
          errorMsg,
          isMalformed ? 'MALFORMED_JOB' : isRateLimited ? 'RATE_LIMITED' : 'RUNTIME_ERROR',
        );
      }

      this.logger.error(
        `Failed processing EmailJob ${job.id} (${isMalformed ? 'MALFORMED/TERMINAL' : 'RUNTIME_ERROR'}): ${errorMsg}`,
      );

      return {
        success: false,
        isRateLimited,
      };
    }
  }

  /**
   * Sanitizes sensitive values (OAuth credentials, tokens, secrets) from log messages.
   */
  public sanitizeLog(msg: string): string {
    if (!msg) return '';
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
}
