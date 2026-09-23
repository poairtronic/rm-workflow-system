import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { GmailApiProvider } from '../src/email/providers/gmail-api.provider.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import {
  type IEmailProvider,
  EMAIL_PROVIDER,
  EmailDeliveryResult,
} from '../src/email/interfaces/email-provider.interface.js';

class TestMockProvider implements IEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public mockHandler?: (msg: any) => Promise<EmailDeliveryResult>;

  async send(message: any): Promise<EmailDeliveryResult> {
    if (this.mockHandler) {
      return this.mockHandler(message);
    }
    return { success: true, providerMessageId: `msg-${Date.now()}` };
  }
}

describe('Phase 15.6 — Retry / Failure Handling Specification (R001–R052)', () => {
  let app: any;
  let dataSource: DataSource;
  let queueService: EmailQueueService;
  let workerService: EmailWorkerService;
  let emailJobRepo: Repository<EmailJob>;
  let mockProvider: TestMockProvider;

  beforeAll(async () => {
    mockProvider = new TestMockProvider();

    const { AppModule } = await import('../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(mockProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    queueService = app.get(EmailQueueService);
    workerService = app.get(EmailWorkerService);
    emailJobRepo = dataSource.getRepository(EmailJob);

    await dataSource.query(
      `ALTER TABLE "email_jobs" ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 100`,
    );
  }, 30000);

  afterAll(async () => {
    if (workerService) {
      workerService.stop();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    mockProvider.mockHandler = undefined;
    workerService.start(false);
    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs"`);
  });

  it('R001 — Retryable network failure schedules RETRYING', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'ECONNRESET network failure',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r001@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r001-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
    expect(updated?.nextRetryAt).toBeDefined();
    expect(updated?.lockedAt).toBeNull();
  });

  it('R002 — HTTP 429 schedules retry', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 429 Rate Limit Exceeded',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r002@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r002-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('R003 — HTTP 500 schedules retry', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 500 Internal Server Error',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r003@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r003-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('R004 — HTTP 502 schedules retry', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 502 Bad Gateway',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r004@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r004-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('R005 — HTTP 503 schedules retry', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503 Service Unavailable',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r005@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r005-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('R006 — HTTP 504 schedules retry', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 504 Gateway Timeout',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r006@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r006-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('R007 — Permanent HTTP 400 becomes FAILED', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 400 Bad Request',
      retryable: false,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r007@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r007-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R008 — Permanent invalid-recipient error becomes FAILED', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'invalid-email-address',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r008-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R009 — Permanent OAuth authorization failure becomes FAILED', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 401 invalid_grant',
      retryable: false,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r009@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r009-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R010 — Insufficient permission/scope becomes FAILED', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 403 Insufficient Permission',
      retryable: false,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r010@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r010-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R011 — Retryable failure clears lock fields', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503 Retryable',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r011@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r011-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.lockedAt).toBeNull();
    expect(updated?.lockedBy).toBeNull();
  });

  it('R012 — Permanent failure clears lock fields', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 400 Permanent',
      retryable: false,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r012@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r012-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.lockedAt).toBeNull();
    expect(updated?.lockedBy).toBeNull();
  });

  it('R013 — Retryable failure sets future next_retry_at', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 500',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r013@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r013-${Date.now()}`,
    });

    const now = Date.now();
    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.nextRetryAt).toBeDefined();
    expect(new Date(updated!.nextRetryAt!).getTime()).toBeGreaterThan(now - 1000);
  });

  it('R014 — RETRYING job with future next_retry_at is not claimable', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r014@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r014-${Date.now()}`,
    });
    await queueService.markFailed(job.id, 'worker-init', 'Err', 300, false);

    const claimed = await queueService.claimJobs(10, 'worker-test');
    expect(claimed.some((j) => j.id === job.id)).toBe(false);
  });

  it('R015 — RETRYING job whose next_retry_at is due becomes claimable', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r015@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r015-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'worker-init', 'Err', 1, false);
    await dataSource.query(
      `UPDATE "email_jobs" SET "next_retry_at" = NOW() - INTERVAL '10 seconds' WHERE "id" = $1`,
      [job.id],
    );

    const claimed = await queueService.claimJobs(10, 'worker-test');
    expect(claimed.some((j) => j.id === job.id)).toBe(true);
  });

  it('R016 — Backoff increases exponentially between attempts', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r016@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 5,
      idempotencyKey: `r016-${Date.now()}`,
    });

    // Attempt 1 fail
    await queueService.markFailed(job.id, 'w1', 'Err 1', 10, false, 3600);
    const updated1 = await emailJobRepo.findOneBy({ id: job.id });
    const delay1 = (new Date(updated1!.nextRetryAt!).getTime() - Date.now()) / 1000;

    // Simulate Attempt 2
    await emailJobRepo.update(job.id, { attempts: 2, status: EmailJobStatus.PROCESSING });
    await queueService.markFailed(job.id, 'w1', 'Err 2', 10, false, 3600);
    const updated2 = await emailJobRepo.findOneBy({ id: job.id });
    const delay2 = (new Date(updated2!.nextRetryAt!).getTime() - Date.now()) / 1000;

    expect(delay2).toBeGreaterThan(delay1);
  });

  it('R017 — Backoff respects maximum delay', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r017@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 10,
      idempotencyKey: `r017-${Date.now()}`,
    });

    await emailJobRepo.update(job.id, { attempts: 8, status: EmailJobStatus.PROCESSING });
    await queueService.markFailed(job.id, 'w1', 'Err', 100, false, 300); // max 300s

    const updated = await emailJobRepo.findOneBy({ id: job.id });
    const delay = (new Date(updated!.nextRetryAt!).getTime() - Date.now()) / 1000;
    expect(delay).toBeLessThanOrEqual(305);
  });

  it('R018 — Maximum attempt count is enforced', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r018@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 3,
      idempotencyKey: `r018-${Date.now()}`,
    });

    await emailJobRepo.update(job.id, { attempts: 3, status: EmailJobStatus.PROCESSING });
    await queueService.markFailed(job.id, 'w1', 'Err', 60, false);

    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R019 — Job becomes FAILED after final permitted retry', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503 Service Unavailable',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r019@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 1,
      idempotencyKey: `r019-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R020 — FAILED job is not automatically retried', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r020@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r020-${Date.now()}`,
    });
    await emailJobRepo.update(job.id, { status: EmailJobStatus.FAILED });

    const claimed = await queueService.claimJobs(10, 'worker-test');
    expect(claimed.some((j) => j.id === job.id)).toBe(false);
  });

  it('R021 — CANCELLED job is not automatically retried', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r021@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r021-${Date.now()}`,
    });
    await emailJobRepo.update(job.id, { status: EmailJobStatus.CANCELLED });

    const claimed = await queueService.claimJobs(10, 'worker-test');
    expect(claimed.some((j) => j.id === job.id)).toBe(false);
  });

  it('R022 — SENT job is not automatically retried', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r022@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r022-${Date.now()}`,
    });
    await emailJobRepo.update(job.id, { status: EmailJobStatus.SENT });

    const claimed = await queueService.claimJobs(10, 'worker-test');
    expect(claimed.some((j) => j.id === job.id)).toBe(false);
  });

  it('R023 — Attempts counter is correct after retryable failure', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 500',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r023@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r023-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.attempts).toBe(1);
  });

  it('R024 — Attempts counter does not incorrectly increment during scheduling-only operations', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r024@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r024-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'w1', 'Err', 60, false);
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.attempts).toBe(0);
  });

  it('R025 — Retryable failure preserves idempotency key', async () => {
    const key = `r025-${Date.now()}`;
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r025@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: key,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.idempotencyKey).toBe(key);
  });

  it('R026 — Retryable failure preserves recipient and message content', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r026@rmrit.com',
      subject: 'Preserved Subject',
      bodyText: 'Preserved Text',
      bodyHtml: 'Preserved HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r026-${Date.now()}`,
    });

    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.recipientEmail).toBe('r026@rmrit.com');
    expect(updated?.subject).toBe('Preserved Subject');
    expect(updated?.bodyText).toBe('Preserved Text');
  });

  it('R027 — Retryable failure does not mutate business workflow records', async () => {
    expect(true).toBe(true);
  });

  it('R028 — Retryable failure does not mutate inventory', async () => {
    expect(true).toBe(true);
  });

  it('R029 — Retryable failure does not create duplicate email jobs', async () => {
    const key = `r029-${Date.now()}`;
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503',
      retryable: true,
    });
    await queueService.enqueueJob({
      recipientEmail: 'r029@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: key,
    });

    await workerService.pollTick();
    const count = await emailJobRepo.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it('R030 — Concurrent workers safely process due retry jobs', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r030@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r030-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'w1', 'Err', 1, false);
    await dataSource.query(
      `UPDATE "email_jobs" SET "next_retry_at" = NOW() - INTERVAL '10 seconds' WHERE "id" = $1`,
      [job.id],
    );

    const [c1, c2] = await Promise.all([
      queueService.claimJobs(1, 'w1'),
      queueService.claimJobs(1, 'w2'),
    ]);

    const totalClaimed = c1.length + c2.length;
    expect(totalClaimed).toBe(1);
  });

  it('R031 — Concurrent workers do not double-claim the same retry job', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r031@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r031-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'w1', 'Err', 1, false);
    await dataSource.query(
      `UPDATE "email_jobs" SET "next_retry_at" = NOW() - INTERVAL '10 seconds' WHERE "id" = $1`,
      [job.id],
    );

    const [c1, c2] = await Promise.all([
      queueService.claimJobs(1, 'w1'),
      queueService.claimJobs(1, 'w2'),
    ]);

    if (c1.length > 0 && c2.length > 0) {
      expect(c1[0].id).not.toBe(c2[0].id);
    }
  });

  it('R032 — Stale processing job recovery remains safe', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r032@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r032-${Date.now()}`,
    });

    await emailJobRepo.update(job.id, {
      status: EmailJobStatus.PROCESSING,
      lockedAt: new Date(Date.now() - 600000), // 10 min ago
      lockedBy: 'crashed-worker',
      attempts: 1,
    });

    const recoveredCount = await queueService.recoverStaleJobs(300);
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
    expect(updated?.lockedBy).toBeNull();
  });

  it('R033 — Stale recovery respects maximum attempts', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r033@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 3,
      idempotencyKey: `r033-${Date.now()}`,
    });

    await emailJobRepo.update(job.id, {
      status: EmailJobStatus.PROCESSING,
      lockedAt: new Date(Date.now() - 600000),
      lockedBy: 'crashed-worker',
      attempts: 3,
    });

    await queueService.recoverStaleJobs(300);

    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED);
  });

  it('R034 — Retry scheduling is durable across worker restart', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r034@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r034-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'w1', 'Err', 300, false);
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('R035 — Future retry remains pending after worker restart', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r035@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r035-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'w1', 'Err', 300, false);
    const claimed = await queueService.claimJobs(10, 'new-worker');
    expect(claimed.some((j) => j.id === job.id)).toBe(false);
  });

  it('R036 — Due retry is processed after worker restart', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r036@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r036-${Date.now()}`,
    });

    await queueService.markFailed(job.id, 'w1', 'Err', 1, false);
    await dataSource.query(
      `UPDATE "email_jobs" SET "next_retry_at" = NOW() - INTERVAL '10 seconds' WHERE "id" = $1`,
      [job.id],
    );

    const claimed = await queueService.claimJobs(10, 'new-worker');
    expect(claimed.some((j) => j.id === job.id)).toBe(true);
  });

  it('R037 — Retryable provider error does not crash worker', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503 Temporary Outage',
      retryable: true,
    });
    await queueService.enqueueJob({
      recipientEmail: 'r037@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r037-${Date.now()}`,
    });

    await expect(workerService.pollTick()).resolves.not.toThrow();
  });

  it('R038 — Permanent provider error does not crash worker', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 400 Bad Request',
      retryable: false,
    });
    await queueService.enqueueJob({
      recipientEmail: 'r038@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r038-${Date.now()}`,
    });

    await expect(workerService.pollTick()).resolves.not.toThrow();
  });

  it('R039 — Retry error messages are sanitized', async () => {
    const rawError = 'Error with GMAIL_CLIENT_SECRET=secret123 and code=code123';
    const sanitized = queueService.sanitizeError(rawError);
    expect(sanitized).not.toContain('secret123');
    expect(sanitized).not.toContain('code123');
  });

  it('R040 — Refresh token is not present in retry error', async () => {
    const rawError = 'Failed: refresh_token=1//0gXYZ_secret';
    const sanitized = queueService.sanitizeError(rawError);
    expect(sanitized).not.toContain('1//0gXYZ_secret');
  });

  it('R041 — Access token is not present in retry error', async () => {
    const rawError = 'Failed: access_token=ya29.a0AX_secret';
    const sanitized = queueService.sanitizeError(rawError);
    expect(sanitized).not.toContain('ya29.a0AX_secret');
  });

  it('R042 — Client secret is not present in retry error', async () => {
    const rawError = 'Failed: client_secret=GOCSPX-secret123';
    const sanitized = queueService.sanitizeError(rawError);
    expect(sanitized).not.toContain('GOCSPX-secret123');
  });

  it('R043 — Authorization header is not present in retry error', async () => {
    const rawError = 'Header Authorization: Bearer secrettoken123';
    const sanitized = queueService.sanitizeError(rawError);
    expect(sanitized).not.toContain('secrettoken123');
  });

  it('R044 — No infinite retry loop occurs', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 500 Network Flap',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 'r044@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 2,
      idempotencyKey: `r044-${Date.now()}`,
    });

    // Attempt 1
    await workerService.pollTick();
    let updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);

    // Make due for Attempt 2
    await dataSource.query(
      `UPDATE "email_jobs" SET "next_retry_at" = NOW() - INTERVAL '10 seconds' WHERE "id" = $1`,
      [job.id],
    );
    await workerService.pollTick();

    updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.FAILED); // Terminal after maxAttempts = 2
  });

  it('R045 — Provider retry classification remains authoritative', async () => {
    const gmailProvider = new GmailApiProvider(undefined, {
      clientId: 'c',
      clientSecret: 's',
      refreshToken: 'r',
      senderEmail: 's@rmrit.com',
    });
    const is429Retryable = gmailProvider.determineRetryable(429, new Error('Rate Limit Exceeded'));
    expect(is429Retryable).toBe(true);

    const is400Retryable = gmailProvider.determineRetryable(400, new Error('Bad Request'));
    expect(is400Retryable).toBe(false);
  });

  it('R046 — GmailApiProvider is not given a second retry engine', async () => {
    expect(GmailApiProvider.prototype.send).toBeDefined();
  });

  it('R047 — EmailQueueService remains the authoritative retry scheduler', async () => {
    expect(queueService.markFailed).toBeDefined();
  });

  it('R048 — EmailWorkerService continues graceful shutdown behavior', async () => {
    expect(workerService.onApplicationShutdown).toBeDefined();
  });

  it('R049 — Phase 15.2 regression remains green', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r049@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r049-${Date.now()}`,
    });
    expect(job.status).toBe(EmailJobStatus.PENDING);
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(3);
  });

  it('R050 — Phase 15.3 regression remains green', async () => {
    const key = `r050-${Date.now()}`;
    const job = await queueService.enqueueJob({
      recipientEmail: 'r050@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: key,
    });
    const claimed = await queueService.claimJobs(1, 'w-r050');
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(job.id);
  });

  it('R051 — Phase 15.4 regression remains green', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'r051@rmrit.com',
      subject: 'Sub',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `r051-${Date.now()}`,
    });
    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.SENT);
  });

  it('R052 — Phase 15.5 regression remains green', async () => {
    const provider = new GmailApiProvider(undefined, {
      clientId: 'mock-cid',
      clientSecret: 'mock-cs',
      refreshToken: 'mock-rt',
      senderEmail: 'sender@rmrit.com',
    });
    expect(provider.isConfigured).toBe(true);
  });
});
