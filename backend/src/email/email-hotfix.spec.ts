import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmailQueueService } from './email-queue.service';
import { EmailWorkerService } from './email-worker.service';
import { EmailJob } from './entities/email-job.entity';
import { EmailJobStatus } from './enums/email-job-status.enum';
import { TestEmailProvider } from './providers/test-email.provider';
import { TemplateResolver } from './resolvers/template.resolver';
import { GmailApiProvider } from './providers/gmail-api.provider';

describe('Email Queue Hotfix (Production-Safe Rate Limiting & Throttling)', () => {
  describe('1. Retry-After Parsing & Attempt Preservation in EmailQueueService.markFailed', () => {
    let queueService: EmailQueueService;
    let mockJobRepo: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockJobRepo = {
        findOne: vi.fn(),
        save: vi.fn((job) => Promise.resolve(job)),
        count: vi.fn(),
      };
      mockDataSource = {
        createQueryRunner: vi.fn(() => ({
          connect: vi.fn(),
          startTransaction: vi.fn(),
          commitTransaction: vi.fn(),
          rollbackTransaction: vi.fn(),
          release: vi.fn(),
          query: vi.fn().mockResolvedValue([]),
        })),
      };
      queueService = new EmailQueueService(mockJobRepo as any, mockDataSource as any);
    });

    it('should parse ISO timestamp from "Retry after <ISO>" and set next_retry_at = parsedTime + 5s', async () => {
      const now = new Date();
      const retryIso = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      const errorMsg = `User-rate limit exceeded. Retry after ${retryIso} (Mail sending)`;

      const existingJob: Partial<EmailJob> = {
        id: 'job-1',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
        status: EmailJobStatus.PROCESSING,
        lockedBy: 'worker-1',
      };
      mockJobRepo.findOne.mockResolvedValue(existingJob);

      const result = await queueService.markFailed(
        'job-1',
        'worker-1',
        errorMsg,
        60,
        false,
        3600,
      );

      expect(result.status).toBe(EmailJobStatus.RETRYING);
      // Rate limit must NOT consume an attempt: attempts was 1 upon claim, now rolled back to 0
      expect(result.attempts).toBe(0);
      expect(result.nextRetryAt).toBeDefined();
      const expectedTime = new Date(new Date(retryIso).getTime() + 5000);
      expect(result.nextRetryAt!.getTime()).toBe(expectedTime.getTime());
    });

    it('should fallback to now + 15 min if Retry after ISO string is unparseable', async () => {
      const errorMsg = 'User-rate limit exceeded. Please wait.';

      const existingJob: Partial<EmailJob> = {
        id: 'job-2',
        attempts: 2,
        maxAttempts: 3,
        createdAt: new Date(),
        status: EmailJobStatus.PROCESSING,
        lockedBy: 'worker-1',
      };
      mockJobRepo.findOne.mockResolvedValue(existingJob);

      const before = Date.now();
      const result = await queueService.markFailed(
        'job-2',
        'worker-1',
        errorMsg,
        60,
        false,
        3600,
        true, // explicitly rate limited
      );

      const after = Date.now();
      expect(result.status).toBe(EmailJobStatus.RETRYING);
      expect(result.attempts).toBe(1); // 2 - 1 = 1 (no attempt consumed)
      expect(result.nextRetryAt).toBeDefined();
      const diffMinutes = (result.nextRetryAt!.getTime() - before) / (60 * 1000);
      expect(diffMinutes).toBeGreaterThanOrEqual(14.9);
      expect(diffMinutes).toBeLessThanOrEqual(15.1);
    });

    it('should fail job permanently if job age exceeds EMAIL_MAX_JOB_AGE_HOURS (default 24h)', async () => {
      const oldCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours old
      const existingJob: Partial<EmailJob> = {
        id: 'job-old',
        attempts: 1,
        maxAttempts: 3,
        createdAt: oldCreatedAt,
        status: EmailJobStatus.PROCESSING,
        lockedBy: 'worker-1',
      };
      mockJobRepo.findOne.mockResolvedValue(existingJob);

      const result = await queueService.markFailed(
        'job-old',
        'worker-1',
        'User-rate limit exceeded. Retry after 2026-11-18T12:00:00Z',
        60,
        false,
      );

      expect(result.status).toBe(EmailJobStatus.FAILED);
      expect(result.nextRetryAt).toBeNull();
      expect(result.lastError).toContain('exceeded maximum age');
    });

    it('should consume normal attempts and calculate standard backoff on non-rate-limit errors', async () => {
      const existingJob: Partial<EmailJob> = {
        id: 'job-normal-fail',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
        status: EmailJobStatus.PROCESSING,
        lockedBy: 'worker-1',
      };
      mockJobRepo.findOne.mockResolvedValue(existingJob);

      const result = await queueService.markFailed(
        'job-normal-fail',
        'worker-1',
        'ETIMEDOUT: Connection refused',
        60,
        false,
        3600,
      );

      expect(result.status).toBe(EmailJobStatus.RETRYING);
      expect(result.attempts).toBe(1); // not decremented
      const delaySec = Math.round((result.nextRetryAt!.getTime() - Date.now()) / 1000);
      expect(delaySec).toBeGreaterThanOrEqual(58);
      expect(delaySec).toBeLessThanOrEqual(62);
    });
  });

  describe('2. GmailApiProvider rate-limit detection and parsing', () => {
    it('should extract isRateLimited and retryAfterDate from Google 429 response', async () => {
      const provider = new GmailApiProvider(undefined, {
        clientId: 'fake',
        clientSecret: 'fake',
        refreshToken: 'fake',
        senderEmail: 'test@example.com',
        gmailClient: {
          users: {
            messages: {
              send: vi.fn().mockRejectedValue({
                status: 429,
                message:
                  'User-rate limit exceeded. Retry after 2026-11-18T06:00:00.000Z (Mail sending)',
              }),
            },
          },
        } as any,
      });

      const res = await provider.send({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        bodyText: 'Hello',
        bodyHtml: '<p>Hello</p>',
      });

      expect(res.success).toBe(false);
      expect(res.retryable).toBe(true);
      expect(res.isRateLimited).toBe(true);
      expect(res.retryAfterDate).toBeDefined();
      expect(res.retryAfterDate!.toISOString()).toBe('2026-11-18T06:00:00.000Z');
    });
  });

  describe('3. Global Worker Pause & Release Claimed Batch on Rate Limit', () => {
    let worker: EmailWorkerService;
    let mockQueueService: any;
    let testProvider: TestEmailProvider;

    beforeEach(() => {
      testProvider = new TestEmailProvider();
      mockQueueService = {
        recoverStaleJobs: vi.fn().mockResolvedValue(0),
        claimJobs: vi.fn(),
        markSuccess: vi.fn().mockResolvedValue({}),
        markFailed: vi.fn().mockResolvedValue({}),
        releaseClaim: vi.fn().mockResolvedValue({}),
        releaseClaimBatchAfterRateLimit: vi.fn().mockResolvedValue(undefined),
        getSentCountLast24Hours: vi.fn().mockResolvedValue(10),
        getEarliestSentInLast24Hours: vi.fn().mockResolvedValue(new Date()),
      };

      worker = new EmailWorkerService(
        mockQueueService,
        new TemplateResolver(),
        testProvider,
        {
          get: (key: string) => {
            if (key === 'EMAIL_WORKER_ENABLED') return true;
            if (key === 'EMAIL_SEND_INTERVAL_MS') return 10; // short pacing for fast test
            if (key === 'EMAIL_DAILY_LIMIT') return 400;
            return undefined;
          },
        } as any,
      );
      worker.start(false);
    });

    afterEach(() => {
      worker.stop();
    });

    it('should pause worker on rate limit and release remaining claimed jobs back to PENDING', async () => {
      const retryDate = new Date(Date.now() + 10 * 60 * 1000);
      testProvider.shouldSimulateRateLimit = true;
      testProvider.rateLimitRetryAfterDate = retryDate;

      const job1: any = {
        id: 'job-1',
        recipientEmail: 'user1@example.com',
        subject: 'Sub 1',
        bodyText: 'Text 1',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
      };
      const job2: any = {
        id: 'job-2',
        recipientEmail: 'user2@example.com',
        subject: 'Sub 2',
        bodyText: 'Text 2',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
      };
      const job3: any = {
        id: 'job-3',
        recipientEmail: 'user3@example.com',
        subject: 'Sub 3',
        bodyText: 'Text 3',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
      };

      // Claim a batch of 3 jobs
      mockQueueService.claimJobs.mockResolvedValue([job1, job2, job3]);

      await worker.pollTick();

      // Job 1 failed due to rate limit
      expect(mockQueueService.markFailed).toHaveBeenCalledTimes(1);
      // Worker should now be paused until retryDate + 5s
      const pausedUntil = worker.getPausedUntil();
      expect(pausedUntil).toBeDefined();
      expect(pausedUntil!.getTime()).toBe(retryDate.getTime() + 5000);

      // Remaining jobs (job2, job3) should be released back via releaseClaimBatchAfterRateLimit
      expect(mockQueueService.releaseClaimBatchAfterRateLimit).toHaveBeenCalledWith(
        ['job-2', 'job-3'],
        worker.workerId,
        pausedUntil,
      );

      // Subsequent pollTick while paused should claim NOTHING
      mockQueueService.claimJobs.mockClear();
      const countWhilePaused = await worker.pollTick();
      expect(countWhilePaused).toBe(0);
      expect(mockQueueService.claimJobs).not.toHaveBeenCalled();

      // Fast forward time past pausedUntil -> worker should resume claiming
      worker.setPausedUntil(new Date(Date.now() - 1000)); // expired
      mockQueueService.claimJobs.mockResolvedValue([]);
      await worker.pollTick();
      expect(mockQueueService.claimJobs).toHaveBeenCalledTimes(1);
      expect(worker.getPausedUntil()).toBeNull();
    });
  });

  describe('4. Pacing: Send Delay Enforcement', () => {
    it('should enforce delay between consecutive sends (send rate <= 20/min at 3000ms)', async () => {
      const testProvider = new TestEmailProvider();
      const mockQueue = {
        recoverStaleJobs: vi.fn().mockResolvedValue(0),
        claimJobs: vi.fn(),
        markSuccess: vi.fn().mockResolvedValue({}),
        markFailed: vi.fn().mockResolvedValue({}),
        releaseClaim: vi.fn(),
        getSentCountLast24Hours: vi.fn().mockResolvedValue(0),
      };

      // Set pacing to 50ms for realistic fast unit testing
      const worker = new EmailWorkerService(
        mockQueue as any,
        new TemplateResolver(),
        testProvider,
        {
          get: (key: string) => {
            if (key === 'EMAIL_SEND_INTERVAL_MS') return 50;
            if (key === 'EMAIL_DAILY_LIMIT') return 1000;
            return undefined;
          },
        } as any,
      );
      worker.start(false);

      const jobA: any = {
        id: 'job-a',
        recipientEmail: 'a@example.com',
        subject: 'A',
        bodyText: 'A',
        attempts: 1,
        maxAttempts: 3,
      };
      const jobB: any = {
        id: 'job-b',
        recipientEmail: 'b@example.com',
        subject: 'B',
        bodyText: 'B',
        attempts: 1,
        maxAttempts: 3,
      };

      mockQueue.claimJobs.mockResolvedValue([jobA, jobB]);

      const t0 = Date.now();
      await worker.pollTick();
      const elapsed = Date.now() - t0;

      // Between 2 jobs with 50ms pacing, total elapsed time must be at least 45ms
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(mockQueue.markSuccess).toHaveBeenCalledTimes(2);

      worker.stop();
    });
  });

  describe('5. Daily Budget Guard: EMAIL_DAILY_LIMIT', () => {
    it('should defer queue without claiming or failing jobs when 24h sent count reaches limit', async () => {
      const testProvider = new TestEmailProvider();
      const mockQueue = {
        recoverStaleJobs: vi.fn().mockResolvedValue(0),
        claimJobs: vi.fn(),
        markSuccess: vi.fn(),
        markFailed: vi.fn(),
        releaseClaim: vi.fn(),
        getSentCountLast24Hours: vi.fn().mockResolvedValue(400), // budget exhausted!
        getEarliestSentInLast24Hours: vi.fn().mockResolvedValue(new Date(Date.now() - 23 * 3600 * 1000)),
      };

      const worker = new EmailWorkerService(
        mockQueue as any,
        new TemplateResolver(),
        testProvider,
        {
          get: (key: string) => {
            if (key === 'EMAIL_DAILY_LIMIT') return 400;
            return undefined;
          },
        } as any,
      );
      worker.start(false);

      const processed = await worker.pollTick();
      expect(processed).toBe(0);
      // No jobs claimed, no jobs failed
      expect(mockQueue.claimJobs).not.toHaveBeenCalled();
      expect(mockQueue.markFailed).not.toHaveBeenCalled();
      // Worker entered budget deferral
      expect(worker.getPausedUntil()).toBeDefined();

      worker.stop();
    });
  });

  describe('6. Simulation: 274-Job Burst with Rate Limit and Resumption', () => {
    it('should process burst without any job reaching FAILED status on 429', async () => {
      const testProvider = new TestEmailProvider();
      let sentCount = 0;
      const allJobs: any[] = [];
      for (let i = 1; i <= 30; i++) {
        allJobs.push({
          id: `burst-job-${i}`,
          recipientEmail: `dest${i}@example.com`,
          subject: `Alert ${i}`,
          bodyText: `Body ${i}`,
          status: EmailJobStatus.PENDING,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
        });
      }

      // Simulate rate limit at job #11 with Retry-After +200ms
      testProvider.send = vi.fn(async (msg) => {
        sentCount++;
        if (sentCount >= 11 && sentCount < 15) {
          const retryDate = new Date(Date.now() + 200);
          return {
            success: false,
            error: `User-rate limit exceeded. Retry after ${retryDate.toISOString()} (Mail sending)`,
            retryable: true,
            isRateLimited: true,
            retryAfterDate: retryDate,
          };
        }
        return { success: true, providerMessageId: `msg-${sentCount}` };
      });

      const queueService = new EmailQueueService(
        {
          findOne: vi.fn((opts) => allJobs.find((j) => j.id === opts.where.id)),
          save: vi.fn((j) => {
            const idx = allJobs.findIndex((x) => x.id === j.id);
            if (idx >= 0) allJobs[idx] = j;
            return Promise.resolve(j);
          }),
          count: vi.fn().mockResolvedValue(0),
        } as any,
        {
          createQueryRunner: vi.fn(() => ({
            connect: vi.fn(),
            startTransaction: vi.fn(),
            commitTransaction: vi.fn(),
            rollbackTransaction: vi.fn(),
            release: vi.fn(),
            query: vi.fn((q, params) => {
              if (params && params[0] === EmailJobStatus.PENDING) {
                // Batch release query
                const ids = params[2];
                ids.forEach((id: string) => {
                  const job = allJobs.find((x) => x.id === id);
                  if (job) {
                    job.status = EmailJobStatus.PENDING;
                    job.nextRetryAt = params[1];
                  }
                });
              }
              return Promise.resolve([]);
            }),
          })),
        } as any,
      );

      const worker = new EmailWorkerService(
        queueService,
        new TemplateResolver(),
        testProvider,
        {
          get: (key: string) => {
            if (key === 'EMAIL_SEND_INTERVAL_MS') return 5;
            if (key === 'EMAIL_DAILY_LIMIT') return 1000;
            return undefined;
          },
        } as any,
      );
      worker.start(false);

      // Simulate worker claiming in batches of 10
      // Batch 1 (jobs 0-9): All succeed
      const batch1 = allJobs.slice(0, 10).map((j) => {
        j.status = EmailJobStatus.PROCESSING;
        j.attempts++;
        return j;
      });
      queueService.claimJobs = vi.fn().mockResolvedValueOnce(batch1);
      await worker.pollTick();

      expect(allJobs.slice(0, 10).every((j) => j.status === EmailJobStatus.SENT)).toBe(true);

      // Batch 2 (jobs 10-19): Job 10 (11th overall) hits 429
      const batch2 = allJobs.slice(10, 20).map((j) => {
        j.status = EmailJobStatus.PROCESSING;
        j.attempts++;
        return j;
      });
      queueService.claimJobs.mockResolvedValueOnce(batch2);
      await worker.pollTick();

      // Job 10 should be RETRYING with attempts = 0 (no attempt consumed)
      expect(allJobs[10].status).toBe(EmailJobStatus.RETRYING);
      expect(allJobs[10].attempts).toBe(0);
      // Zero jobs should be FAILED
      expect(allJobs.filter((j) => j.status === EmailJobStatus.FAILED).length).toBe(0);
      // Remaining jobs in batch2 (11-19) released to PENDING
      expect(allJobs[11].status).toBe(EmailJobStatus.PENDING);

      worker.stop();
    });
  });
});
