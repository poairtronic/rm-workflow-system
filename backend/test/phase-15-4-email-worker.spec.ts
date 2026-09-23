import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { TemplateResolver } from '../src/email/resolvers/template.resolver.js';
import { TestEmailProvider } from '../src/email/providers/test-email.provider.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';

describe('Phase 15.4 Email Worker Specification (W001–W022)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queueService: EmailQueueService;
  let workerService: EmailWorkerService;
  let testProvider: TestEmailProvider;
  let emailJobRepo: Repository<EmailJob>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    queueService = app.get(EmailQueueService);
    workerService = app.get(EmailWorkerService);
    testProvider = app.get<TestEmailProvider>(EMAIL_PROVIDER as any);
    emailJobRepo = dataSource.getRepository(EmailJob);

    workerService.stop();
  });

  afterAll(async () => {
    if (workerService) {
      workerService.stop();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    workerService.stop();
    testProvider.reset();
    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs"`);
  });

  it('W001 — worker starts safely: initializes without crashing when queue is empty', async () => {
    expect(workerService.workerId).toBeDefined();
    expect(workerService.workerId.length).toBeGreaterThan(0);
    workerService.start(false);
    expect(workerService.isWorkerRunning()).toBe(true);
    workerService.stop();
    expect(workerService.isWorkerRunning()).toBe(false);
  });

  it('W002 — empty queue: worker pollTick processes 0 jobs when queue is empty', async () => {
    workerService.start(false);
    const processed = await workerService.pollTick();
    expect(processed).toBe(0);
    expect(testProvider.sentMessages.length).toBe(0);
    workerService.stop();
  });

  it('W003 — pending job processing: processes a PENDING email job via provider', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'w003@rmrit.com',
      recipientName: 'W003 User',
      eventType: 'RM_SUBMITTED',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W003 Subject',
      bodyText: 'Text 003',
      bodyHtml: 'HTML 003',
      idempotencyKey: `WTEST_003_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    expect(processed).toBe(1);

    expect(testProvider.sentMessages.length).toBe(1);
    expect(testProvider.sentMessages[0].to).toBe('w003@rmrit.com');
    expect(testProvider.sentMessages[0].subject).toBe('W003 Subject');
    workerService.stop();
  });

  it('W004 — successful delivery: sets status SENT, sent_at, and clears locks', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'w004@rmrit.com',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'WORKFLOW_MATERIAL_ISSUED',
      subject: 'W004 Subject',
      bodyText: 'Text 004',
      bodyHtml: 'HTML 004',
      idempotencyKey: `WTEST_004_${Date.now()}`,
    });

    workerService.start(false);
    await workerService.pollTick();
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.SENT);
    expect(refreshed?.sentAt).toBeDefined();
    expect(refreshed?.lockedAt).toBeNull();
    expect(refreshed?.lockedBy).toBeNull();
  });

  it('W005 — provider message ID: persists provider_message_id returned by provider', async () => {
    testProvider.customMessageIdPrefix = 'custom-gmail-id';
    const job = await queueService.enqueueJob({
      recipientEmail: 'w005@rmrit.com',
      eventType: 'ADDITIONAL_REQUEST',
      templateKey: 'WORKFLOW_ADDITIONAL_REQUEST',
      subject: 'W005 Subject',
      bodyText: 'Text 005',
      bodyHtml: 'HTML 005',
      idempotencyKey: `WTEST_005_${Date.now()}`,
    });

    workerService.start(false);
    await workerService.pollTick();
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.providerMessageId).toBeDefined();
    expect(refreshed!.providerMessageId!).toContain('custom-gmail-id');
  });

  it('W006 — retryable provider failure: sets status RETRYING, next_retry_at, and last_error', async () => {
    testProvider.shouldFailRetryable = true;
    testProvider.customErrorMessage = 'Temporary 503 Service Unavailable';

    const job = await queueService.enqueueJob({
      recipientEmail: 'w006@rmrit.com',
      eventType: 'SC_COMPLETED',
      templateKey: 'WORKFLOW_SC_COMPLETED',
      subject: 'W006 Subject',
      bodyText: 'Text 006',
      bodyHtml: 'HTML 006',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `WTEST_006_${Date.now()}`,
    });

    workerService.start(false);
    await workerService.pollTick();
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.RETRYING);
    expect(refreshed?.lastError).toContain('Temporary 503 Service Unavailable');
    expect(refreshed?.nextRetryAt).toBeDefined();
    expect(refreshed?.lockedBy).toBeNull();
    expect(refreshed?.lockedAt).toBeNull();
  });

  it('W007 — non-retryable failure: sets status FAILED, last_error, and clears lock', async () => {
    testProvider.shouldFailNonRetryable = true;
    testProvider.customErrorMessage = '400 Bad Request: Invalid recipient format';

    const job = await queueService.enqueueJob({
      recipientEmail: 'w007@rmrit.com',
      eventType: 'RM_SUBMITTED',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W007 Subject',
      bodyText: 'Text 007',
      bodyHtml: 'HTML 007',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `WTEST_007_${Date.now()}`,
    });

    workerService.start(false);
    await workerService.pollTick();
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.FAILED);
    expect(refreshed?.lastError).toContain('400 Bad Request');
    expect(refreshed?.nextRetryAt).toBeNull();
    expect(refreshed?.lockedBy).toBeNull();
  });

  it('W008 — max attempts: moves job to FAILED when attempts reach max_attempts', async () => {
    testProvider.shouldFailRetryable = true;
    testProvider.customErrorMessage = 'Persistent connection error';

    const job = await queueService.enqueueJob({
      recipientEmail: 'w008@rmrit.com',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'WORKFLOW_MATERIAL_ISSUED',
      subject: 'W008 Subject',
      bodyText: 'Text 008',
      bodyHtml: 'HTML 008',
      attempts: 2,
      maxAttempts: 3,
      idempotencyKey: `WTEST_008_${Date.now()}`,
    });

    workerService.start(false);
    await workerService.pollTick();
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.FAILED);
    expect(refreshed?.attempts).toBe(3);
    expect(refreshed?.nextRetryAt).toBeNull();

    workerService.start(false);
    const processedNext = await workerService.pollTick();
    expect(processedNext).toBe(0);
    workerService.stop();
  });

  it('W009 — future retry: RETRYING job with future next_retry_at is NOT processed', async () => {
    const futureDate = new Date(Date.now() + 3600000);
    await queueService.enqueueJob({
      recipientEmail: 'w009@rmrit.com',
      eventType: 'RETRY_FUTURE',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W009 Subject',
      bodyText: 'Text 009',
      bodyHtml: 'HTML 009',
      status: EmailJobStatus.RETRYING,
      nextRetryAt: futureDate,
      idempotencyKey: `WTEST_009_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    expect(processed).toBe(0);
    expect(testProvider.sentMessages.length).toBe(0);
    workerService.stop();
  });

  it('W010 — retry becomes eligible: RETRYING job with past next_retry_at IS processed', async () => {
    const pastDate = new Date(Date.now() - 3600000);
    const job = await queueService.enqueueJob({
      recipientEmail: 'w010@rmrit.com',
      eventType: 'RETRY_DUE',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W010 Subject',
      bodyText: 'Text 010',
      bodyHtml: 'HTML 010',
      status: EmailJobStatus.RETRYING,
      nextRetryAt: pastDate,
      idempotencyKey: `WTEST_010_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    expect(processed).toBe(1);
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.SENT);
  });

  it('W011 — concurrent workers: two worker instances claim exactly 1 job without race', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'w011@rmrit.com',
      eventType: 'CONCURRENT_SINGLE',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W011 Subject',
      bodyText: 'Text 011',
      bodyHtml: 'HTML 011',
      idempotencyKey: `WTEST_011_${Date.now()}`,
    });

    const workerB = new EmailWorkerService(
      queueService,
      app.get(TemplateResolver),
      testProvider,
    );
    workerB.stop();

    workerService.start(false);
    workerB.start(false);

    const [resA, resB] = await Promise.all([
      workerService.pollTick(),
      workerB.pollTick(),
    ]);

    expect(resA + resB).toBe(1);
    expect(testProvider.sentMessages.length).toBe(1);

    workerService.stop();
    workerB.stop();
  });

  it('W012 — multiple workers / multiple jobs: parallel workers distribute jobs without double delivery', async () => {
    const now = Date.now();
    const jobCount = 10;
    for (let i = 0; i < jobCount; i++) {
      await queueService.enqueueJob({
        recipientEmail: `w012.${i}@rmrit.com`,
        eventType: 'CONCURRENT_MULTI',
        templateKey: 'WORKFLOW_RM_SUBMITTED',
        subject: `W012 Job ${i}`,
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: `WTEST_012_${now}_${i}`,
      });
    }

    const workerB = new EmailWorkerService(
      queueService,
      app.get(TemplateResolver),
      testProvider,
    );

    workerService.start(false);
    workerB.start(false);

    await Promise.all([workerService.pollTick(), workerB.pollTick()]);

    workerService.stop();
    workerB.stop();

    expect(testProvider.sentMessages.length).toBe(jobCount);

    const recipientSet = new Set(testProvider.sentMessages.map((m) => m.to));
    expect(recipientSet.size).toBe(jobCount);
  });

  it('W013 — stale processing recovery: recovers stranded PROCESSING job locked > threshold', async () => {
    const staleTime = new Date(Date.now() - 600000);
    const job = await queueService.enqueueJob({
      recipientEmail: 'w013@rmrit.com',
      eventType: 'STALE_TEST',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W013 Subject',
      bodyText: 'Text 013',
      bodyHtml: 'HTML 013',
      status: EmailJobStatus.PROCESSING,
      lockedAt: staleTime,
      lockedBy: 'crashed-worker-77',
      attempts: 1,
      maxAttempts: 3,
      idempotencyKey: `WTEST_013_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    workerService.stop();

    expect(processed).toBe(1);
    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.SENT);
  });

  it('W014 — active processing protection: active non-stale PROCESSING job is NOT picked up or reset', async () => {
    const recentTime = new Date();
    const job = await queueService.enqueueJob({
      recipientEmail: 'w014@rmrit.com',
      eventType: 'ACTIVE_PROC',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W014 Subject',
      bodyText: 'Text 014',
      bodyHtml: 'HTML 014',
      status: EmailJobStatus.PROCESSING,
      lockedAt: recentTime,
      lockedBy: 'active-worker-88',
      idempotencyKey: `WTEST_014_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    workerService.stop();

    expect(processed).toBe(0);
    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.PROCESSING);
    expect(refreshed?.lockedBy).toBe('active-worker-88');
  });

  it('W015 — cancelled job: CANCELLED job is never delivered', async () => {
    await queueService.enqueueJob({
      recipientEmail: 'w015@rmrit.com',
      eventType: 'CANCELLED_TEST',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W015 Subject',
      bodyText: 'Text 015',
      bodyHtml: 'HTML 015',
      status: EmailJobStatus.CANCELLED,
      idempotencyKey: `WTEST_015_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    workerService.stop();

    expect(processed).toBe(0);
    expect(testProvider.sentMessages.length).toBe(0);
  });

  it('W016 — sent job: SENT job is never delivered again', async () => {
    await queueService.enqueueJob({
      recipientEmail: 'w016@rmrit.com',
      eventType: 'SENT_TEST',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W016 Subject',
      bodyText: 'Text 016',
      bodyHtml: 'HTML 016',
      status: EmailJobStatus.SENT,
      idempotencyKey: `WTEST_016_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    workerService.stop();

    expect(processed).toBe(0);
    expect(testProvider.sentMessages.length).toBe(0);
  });

  it('W017 — failed job: terminal FAILED job is not automatically processed again', async () => {
    await queueService.enqueueJob({
      recipientEmail: 'w017@rmrit.com',
      eventType: 'FAILED_TEST',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W017 Subject',
      bodyText: 'Text 017',
      bodyHtml: 'HTML 017',
      status: EmailJobStatus.FAILED,
      idempotencyKey: `WTEST_017_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    workerService.stop();

    expect(processed).toBe(0);
    expect(testProvider.sentMessages.length).toBe(0);
  });

  it('W018 — idempotency: duplicate idempotency keys remain rejected during enqueue', async () => {
    const key = `WTEST_018_DUP_${Date.now()}`;
    await queueService.enqueueJob({
      recipientEmail: 'w018a@rmrit.com',
      eventType: 'IDEMP_TEST',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W018 Subject 1',
      bodyText: 'Text 1',
      bodyHtml: 'HTML 1',
      idempotencyKey: key,
    });

    await expect(
      queueService.enqueueJob({
        recipientEmail: 'w018b@rmrit.com',
        eventType: 'IDEMP_TEST',
        templateKey: 'WORKFLOW_RM_SUBMITTED',
        subject: 'W018 Subject 2',
        bodyText: 'Text 2',
        bodyHtml: 'HTML 2',
        idempotencyKey: key,
      }),
    ).rejects.toThrow();
  });

  it('W019 — graceful shutdown: stops new claims and releases resources cleanly', async () => {
    workerService.start(false);
    expect(workerService.isWorkerRunning()).toBe(true);

    await workerService.onApplicationShutdown('SIGTERM');

    expect(workerService.isWorkerRunning()).toBe(false);
    expect(workerService.isWorkerPolling()).toBe(false);
  });

  it('W020 — provider unavailable: handles provider unavailable safely without losing jobs', async () => {
    testProvider.isUnavailable = true;
    testProvider.customErrorMessage = 'Network connection failed to mail service';

    const job = await queueService.enqueueJob({
      recipientEmail: 'w020@rmrit.com',
      eventType: 'UNAVAIL_TEST',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      subject: 'W020 Subject',
      bodyText: 'Text 020',
      bodyHtml: 'HTML 020',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `WTEST_020_${Date.now()}`,
    });

    workerService.start(false);
    await workerService.pollTick();
    workerService.stop();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.RETRYING);
    expect(refreshed?.lastError).toContain('Network connection failed');
    expect(refreshed?.lockedBy).toBeNull();
  });

  it('W021 — malformed job: invalid recipient email marks job FAILED without crashing worker or backend', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'invalid-email-no-at-sign',
      eventType: 'MALFORMED_TEST',
      templateKey: 'UNKNOWN_TEMPLATE_KEY',
      subject: '',
      bodyText: '',
      bodyHtml: '',
      idempotencyKey: `WTEST_021_${Date.now()}`,
    });

    workerService.start(false);
    const processed = await workerService.pollTick();
    workerService.stop();

    expect(processed).toBe(1);
    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.FAILED);
    expect(refreshed?.lastError).toContain('Invalid or missing recipient email');
  });

  it('W022 — secret logging regression: log sanitizer redacts credentials and tokens', () => {
    const rawMsg =
      'Failed connecting with GMAIL_CLIENT_SECRET=secret123&GMAIL_REFRESH_TOKEN=ref456 and Bearer ya29.token123';
    const sanitized = workerService.sanitizeLog(rawMsg);

    expect(sanitized).not.toContain('secret123');
    expect(sanitized).not.toContain('ref456');
    expect(sanitized).not.toContain('ya29.token123');
    expect(sanitized).toContain('[REDACTED]');
  });
});
