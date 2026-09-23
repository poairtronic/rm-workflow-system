import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';

describe('Phase 15.3 PostgreSQL Email Queue Specification (Q001–Q022)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queueService: EmailQueueService;
  let emailJobRepo: Repository<EmailJob>;

  beforeAll(async () => {
    process.env.EMAIL_WORKER_ENABLED = 'false';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailWorkerService)
      .useValue({
        onModuleInit: () => {},
        onApplicationShutdown: () => {},
        start: () => {},
        stop: () => {},
        isEnabled: false,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    queueService = app.get(EmailQueueService);
    emailJobRepo = dataSource.getRepository(EmailJob);

    await dataSource.query(
      `ALTER TABLE "email_jobs" ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 100`,
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up email_logs and email_jobs table to avoid cross-test contamination
    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs"`);
  });

  it('Q001 — enqueue eligibility: PENDING job should be claimable', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'q001@rmrit.com',
      eventType: 'RM_SUBMITTED',
      templateKey: 'template_1',
      subject: 'Q001 Subject',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `QTEST_001_${Date.now()}`,
    });

    expect(job.status).toBe(EmailJobStatus.PENDING);

    const claimed = await queueService.claimNextJob('worker-q001');
    expect(claimed).toBeDefined();
    expect(claimed?.id).toBe(job.id);
  });

  it('Q002 — claim one job: verifies status, locked_at, locked_by, and attempt increment', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'q002@rmrit.com',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'template_2',
      subject: 'Q002 Subject',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `QTEST_002_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q002');
    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe(EmailJobStatus.PROCESSING);
    expect(claimed?.lockedBy).toBe('worker-q002');
    expect(claimed?.lockedAt).toBeDefined();
    expect(claimed?.attempts).toBe(1);
  });

  it('Q003 — priority ordering: higher priority job is claimed first', async () => {
    const now = Date.now();
    await queueService.enqueueJob({
      recipientEmail: 'low.priority@rmrit.com',
      eventType: 'EVENT_LOW',
      templateKey: 't1',
      subject: 'Low Priority',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      priority: 10,
      idempotencyKey: `QTEST_003_LOW_${now}`,
    });

    const highJob = await queueService.enqueueJob({
      recipientEmail: 'high.priority@rmrit.com',
      eventType: 'EVENT_HIGH',
      templateKey: 't2',
      subject: 'High Priority',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      priority: 200,
      idempotencyKey: `QTEST_003_HIGH_${now}`,
    });

    const claimed = await queueService.claimNextJob('worker-q003');
    expect(claimed).toBeDefined();
    expect(claimed?.id).toBe(highJob.id);
    expect(claimed?.priority).toBe(200);
  });

  it('Q004 — FIFO tie-break: created_at ASC is used when priorities match', async () => {
    const now = Date.now();
    const firstJob = await queueService.enqueueJob({
      recipientEmail: 'first@rmrit.com',
      eventType: 'FIFO_EVENT',
      templateKey: 't1',
      subject: 'First Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      priority: 100,
      idempotencyKey: `QTEST_004_FIRST_${now}`,
    });

    // Small delay to ensure timestamp separation
    await new Promise((r) => setTimeout(r, 50));

    await queueService.enqueueJob({
      recipientEmail: 'second@rmrit.com',
      eventType: 'FIFO_EVENT',
      templateKey: 't2',
      subject: 'Second Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      priority: 100,
      idempotencyKey: `QTEST_004_SECOND_${now}`,
    });

    const claimed = await queueService.claimNextJob('worker-q004');
    expect(claimed?.id).toBe(firstJob.id);
  });

  it('Q005 — SKIP LOCKED concurrency: exactly 1 worker claims single job', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'q005@rmrit.com',
      eventType: 'CONCURRENCY_TEST',
      templateKey: 't1',
      subject: 'Q005 Subject',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `QTEST_005_${Date.now()}`,
    });

    // Run 2 concurrent claim operations
    const [resA, resB] = await Promise.all([
      queueService.claimNextJob('worker-A'),
      queueService.claimNextJob('worker-B'),
    ]);

    const claimedCount = [resA, resB].filter((r) => r !== null).length;
    expect(claimedCount).toBe(1);

    const winner = resA || resB;
    expect(winner?.id).toBe(job.id);
  });

  it('Q006 — multiple concurrent jobs: zero duplicate claims across parallel workers', async () => {
    const now = Date.now();
    const jobCount = 10;
    for (let i = 0; i < jobCount; i++) {
      await queueService.enqueueJob({
        recipientEmail: `multi.${i}@rmrit.com`,
        eventType: 'MULTI_CONCURRENCY',
        templateKey: 't1',
        subject: `Multi Job ${i}`,
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: `QTEST_006_${now}_${i}`,
      });
    }

    // Run 10 parallel worker claims
    const claimPromises = Array.from({ length: jobCount }, (_, idx) =>
      queueService.claimNextJob(`worker-parallel-${idx}`)
    );

    const results = await Promise.all(claimPromises);
    const claimedJobs = results.filter((j): j is EmailJob => j !== null);

    expect(claimedJobs.length).toBe(jobCount);

    // Verify all claimed job IDs are unique
    const uniqueIds = new Set(claimedJobs.map((j) => j.id));
    expect(uniqueIds.size).toBe(jobCount);
  });

  it('Q007 — batch claiming: respects batchSize limit', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await queueService.enqueueJob({
        recipientEmail: `batch.${i}@rmrit.com`,
        eventType: 'BATCH_TEST',
        templateKey: 't1',
        subject: `Batch Job ${i}`,
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: `QTEST_007_${now}_${i}`,
      });
    }

    const batch = await queueService.claimJobs(3, 'worker-batch');
    expect(batch.length).toBe(3);
    batch.forEach((job) => expect(job.status).toBe(EmailJobStatus.PROCESSING));
  });

  it('Q008 — retry eligibility: future next_retry_at is NOT claimable', async () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour in future
    const job = await queueService.enqueueJob({
      recipientEmail: 'future.retry@rmrit.com',
      eventType: 'RETRY_TEST',
      templateKey: 't1',
      subject: 'Future Retry',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.RETRYING,
      nextRetryAt: futureDate,
      idempotencyKey: `QTEST_008_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q008');
    expect(claimed).toBeNull();
  });

  it('Q009 — retry becomes eligible: past/due next_retry_at IS claimable', async () => {
    const pastDate = new Date(Date.now() - 60000); // 60s in past for clock margin
    const job = await queueService.enqueueJob({
      recipientEmail: 'due.retry@rmrit.com',
      eventType: 'RETRY_TEST',
      templateKey: 't1',
      subject: 'Due Retry',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.RETRYING,
      nextRetryAt: pastDate,
      idempotencyKey: `QTEST_009_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q009');
    expect(claimed).toBeDefined();
    expect(claimed?.id).toBe(job.id);
  });

  it('Q010 — SENT exclusion: SENT jobs are never claimed', async () => {
    await queueService.enqueueJob({
      recipientEmail: 'sent@rmrit.com',
      eventType: 'SENT_TEST',
      templateKey: 't1',
      subject: 'Sent Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.SENT,
      idempotencyKey: `QTEST_010_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q010');
    expect(claimed).toBeNull();
  });

  it('Q011 — FAILED exclusion: FAILED jobs are not claimed', async () => {
    await queueService.enqueueJob({
      recipientEmail: 'failed@rmrit.com',
      eventType: 'FAILED_TEST',
      templateKey: 't1',
      subject: 'Failed Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.FAILED,
      idempotencyKey: `QTEST_011_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q011');
    expect(claimed).toBeNull();
  });

  it('Q012 — CANCELLED exclusion: CANCELLED jobs are not claimed', async () => {
    await queueService.enqueueJob({
      recipientEmail: 'cancelled@rmrit.com',
      eventType: 'CANCELLED_TEST',
      templateKey: 't1',
      subject: 'Cancelled Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.CANCELLED,
      idempotencyKey: `QTEST_012_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q012');
    expect(claimed).toBeNull();
  });

  it('Q013 — PROCESSING exclusion: actively locked PROCESSING jobs are not claimed', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'processing@rmrit.com',
      eventType: 'PROC_TEST',
      templateKey: 't1',
      subject: 'Processing Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.PROCESSING,
      lockedAt: new Date(),
      lockedBy: 'worker-active',
      idempotencyKey: `QTEST_013_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q013');
    expect(claimed).toBeNull();
  });

  it('Q014 — stale job recovery: recovers stranded PROCESSING job locked > threshold', async () => {
    const staleTime = new Date(Date.now() - 600000); // 10 minutes in past
    const job = await queueService.enqueueJob({
      recipientEmail: 'stale@rmrit.com',
      eventType: 'STALE_TEST',
      templateKey: 't1',
      subject: 'Stale Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.PROCESSING,
      lockedAt: staleTime,
      lockedBy: 'crashed-worker-1',
      attempts: 1,
      maxAttempts: 3,
      idempotencyKey: `QTEST_014_${Date.now()}`,
    });

    const recoveredCount = await queueService.recoverStaleJobs(300); // 5 minute threshold
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.RETRYING);
    expect(refreshed?.lockedAt).toBeNull();
    expect(refreshed?.lockedBy).toBeNull();
    expect(refreshed?.attempts).toBe(1); // attempt history preserved
  });

  it('Q015 — non-stale processing job: active processing job is NOT recovered', async () => {
    const recentTime = new Date(); // now
    const job = await queueService.enqueueJob({
      recipientEmail: 'active@rmrit.com',
      eventType: 'ACTIVE_TEST',
      templateKey: 't1',
      subject: 'Active Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.PROCESSING,
      lockedAt: recentTime,
      lockedBy: 'active-worker-2',
      idempotencyKey: `QTEST_015_${Date.now()}`,
    });

    const recoveredCount = await queueService.recoverStaleJobs(300);
    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });

    expect(refreshed?.status).toBe(EmailJobStatus.PROCESSING);
    expect(refreshed?.lockedBy).toBe('active-worker-2');
  });

  it('Q016 — concurrent stale recovery: handles parallel stale recovery safely', async () => {
    const staleTime = new Date(Date.now() - 600000);
    const job = await queueService.enqueueJob({
      recipientEmail: 'conc.stale@rmrit.com',
      eventType: 'CONC_STALE',
      templateKey: 't1',
      subject: 'Conc Stale Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      status: EmailJobStatus.PROCESSING,
      lockedAt: staleTime,
      lockedBy: 'crashed-worker-99',
      idempotencyKey: `QTEST_016_${Date.now()}`,
    });

    // Execute two concurrent recovery calls
    const [cntA, cntB] = await Promise.all([
      queueService.recoverStaleJobs(300),
      queueService.recoverStaleJobs(300),
    ]);

    const totalRecovered = cntA + cntB;
    expect(totalRecovered).toBeGreaterThanOrEqual(1);

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('Q017 — retry transition: markFailed moves job to RETRYING when attempts < max_attempts', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'retry.fail@rmrit.com',
      eventType: 'FAIL_RETRY',
      templateKey: 't1',
      subject: 'Fail Retry',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `QTEST_017_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q017');
    expect(claimed?.attempts).toBe(1);

    const failed = await queueService.markFailed(
      claimed!.id,
      'worker-q017',
      'Temporary network failure',
      120
    );

    expect(failed.status).toBe(EmailJobStatus.RETRYING);
    expect(failed.lastError).toBe('Temporary network failure');
    expect(failed.nextRetryAt).toBeDefined();
    expect(failed.lockedBy).toBeNull();
  });

  it('Q018 — max attempts: markFailed moves job to FAILED when attempts >= max_attempts', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'max.fail@rmrit.com',
      eventType: 'MAX_FAIL',
      templateKey: 't1',
      subject: 'Max Fail',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      attempts: 2,
      maxAttempts: 3,
      idempotencyKey: `QTEST_018_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q018');
    expect(claimed?.attempts).toBe(3); // 2 + 1 = 3

    const failed = await queueService.markFailed(
      claimed!.id,
      'worker-q018',
      'Permanent delivery failure'
    );

    expect(failed.status).toBe(EmailJobStatus.FAILED);
    expect(failed.nextRetryAt).toBeNull();
    expect(failed.lastError).toBe('Permanent delivery failure');
  });

  it('Q019 — success transition: markSuccess sets status SENT, sent_at, and clears locks', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'success@rmrit.com',
      eventType: 'SUCCESS_TEST',
      templateKey: 't1',
      subject: 'Success Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `QTEST_019_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-q019');
    const sent = await queueService.markSuccess(
      claimed!.id,
      'worker-q019',
      'gmail-msg-id-9999'
    );

    expect(sent.status).toBe(EmailJobStatus.SENT);
    expect(sent.sentAt).toBeDefined();
    expect(sent.providerMessageId).toBe('gmail-msg-id-9999');
    expect(sent.lockedBy).toBeNull();
    expect(sent.lockedAt).toBeNull();
  });

  it('Q020 — worker ownership: Worker A cannot release or mutate Worker B active claim', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'ownership@rmrit.com',
      eventType: 'OWNERSHIP_TEST',
      templateKey: 't1',
      subject: 'Ownership Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `QTEST_020_${Date.now()}`,
    });

    const claimed = await queueService.claimNextJob('worker-B-owner');

    // Worker A tries to mark success on Worker B's job
    await expect(
      queueService.markSuccess(claimed!.id, 'worker-A-intruder', 'fake-msg-id')
    ).rejects.toThrow();

    // Worker A tries to mark failure on Worker B's job
    await expect(
      queueService.markFailed(claimed!.id, 'worker-A-intruder', 'fake error')
    ).rejects.toThrow();

    // Worker A tries to release claim on Worker B's job
    await expect(
      queueService.releaseClaim(claimed!.id, 'worker-A-intruder')
    ).rejects.toThrow();
  });

  it('Q021 — idempotency: duplicate idempotency keys remain rejected during enqueue', async () => {
    const dupKey = `QTEST_021_DUP_${Date.now()}`;
    await queueService.enqueueJob({
      recipientEmail: 'idempotent1@rmrit.com',
      eventType: 'IDEMP_TEST',
      templateKey: 't1',
      subject: 'Job 1',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: dupKey,
    });

    await expect(
      queueService.enqueueJob({
        recipientEmail: 'idempotent2@rmrit.com',
        eventType: 'IDEMP_TEST',
        templateKey: 't1',
        subject: 'Job 2',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: dupKey,
      })
    ).rejects.toThrow();
  });

  it('Q022 — rollback safety: transaction failure during claim preserves original job state', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'rollback@rmrit.com',
      eventType: 'ROLLBACK_TEST',
      templateKey: 't1',
      subject: 'Rollback Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `QTEST_022_${Date.now()}`,
    });

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock row
      await queryRunner.query(
        `SELECT * FROM "email_jobs" WHERE id = $1 FOR UPDATE`,
        [job.id]
      );
      // Intentional error inside transaction
      await queryRunner.query(`SELECT * FROM "non_existent_table_cause_error"`);
      await queryRunner.commitTransaction();
    } catch {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }

    // Verify job remains PENDING in database
    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.PENDING);
    expect(refreshed?.lockedBy).toBeNull();
  });
});
