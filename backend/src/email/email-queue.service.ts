import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';
import { EmailProvider } from './enums/email-provider.enum.js';

@Injectable()
export class EmailQueueService {
  constructor(
    @InjectRepository(EmailJob)
    private readonly emailJobRepository: Repository<EmailJob>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Enqueues a new email job transactionally into Neon PostgreSQL.
   */
  async enqueueJob(jobData: Partial<EmailJob>): Promise<EmailJob> {
    const job = this.emailJobRepository.create({
      status: EmailJobStatus.PENDING,
      attempts: 0,
      maxAttempts: jobData.maxAttempts ?? 3,
      priority: jobData.priority ?? 100,
      provider: jobData.provider ?? EmailProvider.GMAIL_API,
      ...jobData,
    });

    return await this.emailJobRepository.save(job);
  }

  /**
   * Atomically claims up to batchSize eligible jobs using SELECT ... FOR UPDATE SKIP LOCKED.
   * Increments attempt count upon claim.
   */
  async claimJobs(batchSize: number = 10, workerId: string): Promise<EmailJob[]> {
    if (batchSize <= 0) {
      return [];
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1: Select and lock eligible job IDs atomically using FOR UPDATE SKIP LOCKED
      const selectedRows: Array<{ id: string }> = await queryRunner.query(
        `
        SELECT "id"
        FROM "email_jobs"
        WHERE ("status" = $1 OR "status" = $2)
          AND ("next_retry_at" IS NULL OR "next_retry_at" <= NOW())
        ORDER BY "priority" DESC, "created_at" ASC, "id" ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
        `,
        [EmailJobStatus.PENDING, EmailJobStatus.RETRYING, batchSize],
      );

      if (!selectedRows || selectedRows.length === 0) {
        await queryRunner.commitTransaction();
        return [];
      }

      const claimedIds = selectedRows.map((r) => r.id);
      const placeholders = claimedIds.map((_, i) => `$${i + 3}`).join(', ');

      // Step 2: Update claimed jobs to PROCESSING within the same transaction
      await queryRunner.query(
        `
        UPDATE "email_jobs"
        SET "status" = $1,
            "locked_at" = NOW(),
            "locked_by" = $2,
            "attempts" = "attempts" + 1,
            "updated_at" = NOW()
        WHERE "id" IN (${placeholders})
        `,
        [EmailJobStatus.PROCESSING, workerId, ...claimedIds],
      );

      // Step 3: Retrieve full EmailJob entities within transaction
      const claimedJobs = await queryRunner.manager.find(EmailJob, {
        where: { id: In(claimedIds) },
        order: {
          priority: 'DESC',
          createdAt: 'ASC',
          id: 'ASC',
        },
      });

      await queryRunner.commitTransaction();
      return claimedJobs;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Convenience helper to claim a single next job.
   */
  async claimNextJob(workerId: string): Promise<EmailJob | null> {
    const jobs = await this.claimJobs(1, workerId);
    return jobs.length > 0 ? jobs[0] : null;
  }

  /**
   * Marks a processing job as successfully SENT.
   * Verifies lock ownership by workerId.
   */
  async markSuccess(
    jobId: string,
    workerId: string,
    providerMessageId?: string,
  ): Promise<EmailJob> {
    const job = await this.emailJobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`EmailJob with ID ${jobId} not found`);
    }

    if (job.lockedBy && job.lockedBy !== workerId) {
      throw new ForbiddenException(
        `Worker ${workerId} does not own active lock on job ${jobId} (owned by ${job.lockedBy})`,
      );
    }

    job.status = EmailJobStatus.SENT;
    job.sentAt = new Date();
    job.lockedAt = null;
    job.lockedBy = null;
    if (providerMessageId) {
      job.providerMessageId = providerMessageId;
    }

    return await this.emailJobRepository.save(job);
  }

  /**
   * Sanitizes sensitive information (tokens, secrets, codes) from error messages.
   */
  public sanitizeError(msg: string): string {
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

  /**
   * Marks a processing job failure.
   * Evaluates attempts vs maxAttempts to transition to RETRYING or FAILED.
   * Calculates exponential backoff delay capped by maxBackoffSeconds.
   * Supports explicit terminal failure via isTerminal flag.
   */
  async markFailed(
    jobId: string,
    workerId: string,
    errorMessage: string,
    retryBackoffSeconds: number = 60,
    isTerminal: boolean = false,
    maxBackoffSeconds: number = 3600,
  ): Promise<EmailJob> {
    const job = await this.emailJobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`EmailJob with ID ${jobId} not found`);
    }

    if (job.lockedBy && job.lockedBy !== workerId) {
      throw new ForbiddenException(
        `Worker ${workerId} does not own active lock on job ${jobId} (owned by ${job.lockedBy})`,
      );
    }

    job.lastError = this.sanitizeError(errorMessage);
    job.lockedAt = null;
    job.lockedBy = null;

    if (isTerminal || job.attempts >= job.maxAttempts) {
      job.status = EmailJobStatus.FAILED;
      job.nextRetryAt = null;
    } else {
      job.status = EmailJobStatus.RETRYING;
      const baseDelay = Math.max(1, retryBackoffSeconds);
      const exponent = Math.max(0, job.attempts - 1);
      const calculatedDelay = Math.min(
        Math.max(baseDelay, maxBackoffSeconds),
        baseDelay * Math.pow(2, exponent),
      );
      job.nextRetryAt = new Date(Date.now() + calculatedDelay * 1000);
    }

    return await this.emailJobRepository.save(job);
  }

  /**
   * Atomically recovers stale jobs locked in PROCESSING state beyond staleThresholdSeconds.
   */
  async recoverStaleJobs(staleThresholdSeconds: number = 300): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const recovered: Array<{ id: string }> = await queryRunner.query(
        `
        UPDATE "email_jobs"
        SET "status" = CASE WHEN "attempts" >= "max_attempts" THEN $3 ELSE $4 END,
            "locked_at" = NULL,
            "locked_by" = NULL,
            "last_error" = 'Stale lock recovered after worker timeout',
            "next_retry_at" = CASE WHEN "attempts" >= "max_attempts" THEN NULL ELSE NOW() END,
            "updated_at" = NOW()
        WHERE "id" IN (
          SELECT "id"
          FROM "email_jobs"
          WHERE "status" = $1
            AND "locked_at" IS NOT NULL
            AND "locked_at" < NOW() - ($2 || ' seconds')::INTERVAL
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id"
        `,
        [
          EmailJobStatus.PROCESSING,
          staleThresholdSeconds,
          EmailJobStatus.FAILED,
          EmailJobStatus.RETRYING,
        ],
      );

      await queryRunner.commitTransaction();
      return recovered.length;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Safely releases an active claim by a worker, returning the job to PENDING.
   */
  async releaseClaim(jobId: string, workerId: string): Promise<EmailJob> {
    const job = await this.emailJobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`EmailJob with ID ${jobId} not found`);
    }

    if (job.lockedBy && job.lockedBy !== workerId) {
      throw new ForbiddenException(
        `Worker ${workerId} does not own active lock on job ${jobId} (owned by ${job.lockedBy})`,
      );
    }

    job.status = EmailJobStatus.PENDING;
    job.lockedAt = null;
    job.lockedBy = null;

    return await this.emailJobRepository.save(job);
  }
}
