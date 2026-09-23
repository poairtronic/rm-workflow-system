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
  public shutdownTimeoutMs: number = 10000;

  private isRunning: boolean = false;
  private isPolling: boolean = false;
  private autoLoop: boolean = false;
  private timerHandle: NodeJS.Timeout | null = null;
  private activeProcessingPromise: Promise<void> | null = null;

  constructor(
    private readonly emailQueueService: EmailQueueService,
    private readonly templateResolver: TemplateResolver,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,
    @Optional()
    private readonly configService?: ConfigService,
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
      this.shutdownTimeoutMs = Number(
        this.configService.get('EMAIL_WORKER_SHUTDOWN_TIMEOUT_MS') ||
          this.shutdownTimeoutMs,
      );
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
    if (this.autoLoop) {
      this.scheduleNextTick(0);
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.autoLoop = false;
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

    this.isPolling = true;
    let processedCount = 0;

    try {
      // 1. Recover stale jobs locked by crashed workers
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

      // 2. Claim batch of eligible jobs via FOR UPDATE SKIP LOCKED
      const claimedJobs = await this.emailQueueService.claimJobs(
        this.batchSize,
        this.workerId,
      );

      if (!claimedJobs || claimedJobs.length === 0) {
        return 0;
      }

      this.logger.log(`Claimed ${claimedJobs.length} email job(s) for worker ${this.workerId}`);

      // 3. Process claimed jobs sequentially within batch
      for (const job of claimedJobs) {
        if (!this.isRunning) {
          await this.emailQueueService.releaseClaim(job.id, this.workerId);
          continue;
        }

        await this.processSingleJob(job);
        processedCount++;
      }
    } catch (err) {
      this.logger.error(`Error in worker pollTick cycle: ${this.sanitizeLog(String(err))}`);
    } finally {
      this.isPolling = false;
      if (this.isRunning && this.autoLoop) {
        this.scheduleNextTick(this.pollIntervalMs);
      }
    }

    return processedCount;
  }

  private async processSingleJob(job: EmailJob): Promise<void> {
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

      // Step D: Record result in PostgreSQL
      if (result.success) {
        await this.emailQueueService.markSuccess(
          job.id,
          this.workerId,
          result.providerMessageId,
        );
        this.logger.log(`Successfully sent EmailJob ${job.id} (providerMsgId: ${result.providerMessageId || 'N/A'})`);
      } else {
        const isRetryable = result.retryable !== false;
        const errorMsg = this.sanitizeLog(result.error || 'Provider delivery failed');
        const isTerminal = !isRetryable;

        await this.emailQueueService.markFailed(
          job.id,
          this.workerId,
          errorMsg,
          this.retryBackoffSeconds,
          isTerminal,
        );

        if (isTerminal) {
          this.logger.warn(`EmailJob ${job.id} permanently failed: ${errorMsg}`);
        } else {
          this.logger.warn(`EmailJob ${job.id} delivery failed (retryable): ${errorMsg}`);
        }
      }
    } catch (err) {
      const isMalformed = err instanceof MalformedJobException;
      const errorMsg = this.sanitizeLog(
        err instanceof Error ? err.message : String(err),
      );

      await this.emailQueueService.markFailed(
        job.id,
        this.workerId,
        errorMsg,
        this.retryBackoffSeconds,
        isMalformed,
      );

      this.logger.error(
        `Failed processing EmailJob ${job.id} (${isMalformed ? 'MALFORMED/TERMINAL' : 'RUNTIME_ERROR'}): ${errorMsg}`,
      );
    }
  }

  /**
   * Sanitizes sensitive values (OAuth credentials, tokens, secrets) from log messages.
   */
  public sanitizeLog(msg: string): string {
    if (!msg) return '';
    return msg
      .replace(/GMAIL_CLIENT_SECRET=[^\s&]+/gi, 'GMAIL_CLIENT_SECRET=[REDACTED]')
      .replace(/GMAIL_REFRESH_TOKEN=[^\s&]+/gi, 'GMAIL_REFRESH_TOKEN=[REDACTED]')
      .replace(/client_secret=[^\s&]+/gi, 'client_secret=[REDACTED]')
      .replace(/refresh_token=[^\s&]+/gi, 'refresh_token=[REDACTED]')
      .replace(/access_token=[^\s&]+/gi, 'access_token=[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/password=[^\s&]+/gi, 'password=[REDACTED]');
  }
}
