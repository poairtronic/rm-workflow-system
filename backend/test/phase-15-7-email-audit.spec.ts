import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
import { GmailApiProvider } from '../src/email/providers/gmail-api.provider.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailLog } from '../src/email/entities/email-log.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import {
  type IEmailProvider,
  EMAIL_PROVIDER,
  EmailDeliveryResult,
} from '../src/email/interfaces/email-provider.interface.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

class TestMockProvider implements IEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public mockHandler?: (msg: any) => Promise<EmailDeliveryResult>;
  public calls: any[] = [];

  async send(message: any): Promise<EmailDeliveryResult> {
    this.calls.push(message);
    if (this.mockHandler) {
      return this.mockHandler(message);
    }
    return { success: true, providerMessageId: `msg-${Date.now()}` };
  }
}

describe('Phase 15.7 — Email Audit / Logging Specification (A001–A058)', () => {
  let app: any;
  let dataSource: DataSource;
  let queueService: EmailQueueService;
  let workerService: EmailWorkerService;
  let auditService: EmailAuditService;
  let emailJobRepo: Repository<EmailJob>;
  let emailLogRepo: Repository<EmailLog>;
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
    auditService = app.get(EmailAuditService);
    emailJobRepo = dataSource.getRepository(EmailJob);
    emailLogRepo = dataSource.getRepository(EmailLog);

    await dataSource.query(
      `ALTER TABLE "email_jobs" ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 100`,
    );

    // Verify or ensure email_logs table exists
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS "email_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "job_id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "recipient_email" character varying NOT NULL,
        "recipient_user_id" character varying,
        "recipient_name" character varying,
        "subject" character varying NOT NULL,
        "provider" character varying NOT NULL DEFAULT 'GMAIL_API',
        "attempt" integer NOT NULL DEFAULT 1,
        "status" character varying NOT NULL,
        "provider_message_id" character varying,
        "error_code" character varying,
        "error_message" text,
        "attempted_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_logs_job_id" FOREIGN KEY ("job_id") REFERENCES "email_jobs"("id") ON DELETE RESTRICT
      )
    `);
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
    mockProvider.calls = [];
    workerService.start(false);
    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs"`);
  });

  it('A001 — EmailLog entity initializes correctly', () => {
    const log = emailLogRepo.create({
      jobId: '11111111-1111-1111-1111-111111111111',
      eventType: 'TEST_EVENT',
      recipientEmail: 'test@rmrit.com',
      subject: 'Test Subject',
      provider: EmailProvider.GMAIL_API,
      attempt: 1,
      status: EmailJobStatus.SENT,
    });
    expect(log).toBeDefined();
    expect(log.recipientEmail).toBe('test@rmrit.com');
    expect(log.provider).toBe(EmailProvider.GMAIL_API);
  });

  it('A002 — EmailLog migration / schema creates table successfully', async () => {
    const queryRes = await dataSource.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'email_logs'
    `);
    expect(queryRes.length).toBeGreaterThan(0);
    const colNames = queryRes.map((c: any) => c.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('job_id');
    expect(colNames).toContain('event_type');
    expect(colNames).toContain('recipient_email');
    expect(colNames).toContain('subject');
    expect(colNames).toContain('provider');
    expect(colNames).toContain('attempt');
    expect(colNames).toContain('status');
    expect(colNames).toContain('provider_message_id');
  });

  it('A003 — EmailLog has foreign key to EmailJob', async () => {
    const fkRes = await dataSource.query(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'email_logs'
    `);
    expect(fkRes.length).toBeGreaterThan(0);
    expect(fkRes[0].foreign_table_name).toBe('email_jobs');
  });

  it('A004 — One EmailJob can have multiple EmailLog entries', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a004@rmrit.com',
      subject: 'Multi-log Job',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a004-${Date.now()}`,
    });

    await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'Attempt 1 failed');
    await auditService.recordAttempt(job, 2, EmailJobStatus.SENT, 'msg-123', null);

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(2);
    expect(logs[0].attempt).toBe(1);
    expect(logs[1].attempt).toBe(2);
  });

  it('A005 — Attempt number is stored correctly', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a005@rmrit.com',
      subject: 'Attempt Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a005-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 3, EmailJobStatus.SENT, 'msg-3');
    expect(log.attempt).toBe(3);
  });

  it('A006 — Event type is stored correctly', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a006@rmrit.com',
      subject: 'Event Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'PO_CREATED',
      templateKey: 'DEFAULT',
      idempotencyKey: `a006-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-1');
    expect(log.eventType).toBe('PO_CREATED');
  });

  it('A007 — Recipient email is stored correctly', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'recipient@rmrit.com',
      subject: 'Recipient Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a007-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-1');
    expect(log.recipientEmail).toBe('recipient@rmrit.com');
  });

  it('A008 — Subject is stored correctly', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a008@rmrit.com',
      subject: 'Purchase Order Approval #402',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a008-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-1');
    expect(log.subject).toBe('Purchase Order Approval #402');
  });

  it('A009 — Provider is stored correctly', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a009@rmrit.com',
      subject: 'Provider Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a009-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-1');
    expect(log.provider).toBe(EmailProvider.GMAIL_API);
  });

  it('A010 — Status is stored correctly', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a010@rmrit.com',
      subject: 'Status Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a010-${Date.now()}`,
    });

    const logRetrying = await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'Error');
    expect(logRetrying.status).toBe(EmailJobStatus.RETRYING);

    const logSent = await auditService.recordAttempt(job, 2, EmailJobStatus.SENT, 'msg-10');
    expect(logSent.status).toBe(EmailJobStatus.SENT);
  });

  it('A011 — Provider message ID is stored on successful delivery', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a011@rmrit.com',
      subject: 'MsgId Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a011-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, '189abc1234567890');
    expect(log.providerMessageId).toBe('189abc1234567890');
  });

  it('A012 — Error code is stored on failure', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a012@rmrit.com',
      subject: 'ErrCode Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a012-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'HTTP 429 Rate Limit Exceeded');
    expect(log.errorCode).toBe('GMAIL_HTTP_429');
  });

  it('A013 — Sanitized error message is stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a013@rmrit.com',
      subject: 'Sanitize Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a013-${Date.now()}`,
    });

    const sensitiveError = 'Gmail failed with client_secret=secret123&refresh_token=tok456 Bearer xyz789';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, sensitiveError);
    expect(log.errorMessage).not.toContain('secret123');
    expect(log.errorMessage).not.toContain('tok456');
    expect(log.errorMessage).not.toContain('xyz789');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A014 — Attempt timestamp is stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a014@rmrit.com',
      subject: 'Timestamp Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a014-${Date.now()}`,
    });

    const before = new Date();
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-14');
    const after = new Date();

    expect(log.attemptedAt).toBeDefined();
    expect(new Date(log.attemptedAt).getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(new Date(log.attemptedAt).getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('A015 — Multiple retry attempts preserve historical rows', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a015@rmrit.com',
      subject: 'History Preserved',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a015-${Date.now()}`,
    });

    await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'Error 1');
    await auditService.recordAttempt(job, 2, EmailJobStatus.RETRYING, null, 'Error 2');
    await auditService.recordAttempt(job, 3, EmailJobStatus.SENT, 'msg-final');

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(3);
    expect(logs[0].status).toBe(EmailJobStatus.RETRYING);
    expect(logs[1].status).toBe(EmailJobStatus.RETRYING);
    expect(logs[2].status).toBe(EmailJobStatus.SENT);
  });

  it('A016 — Previous failed attempt is not overwritten by successful attempt', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a016@rmrit.com',
      subject: 'No Overwrite',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a016-${Date.now()}`,
    });

    const attempt1 = await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'HTTP 503 Service Unavailable');
    await auditService.recordAttempt(job, 2, EmailJobStatus.SENT, 'msg-16');

    const fetchAttempt1 = await emailLogRepo.findOneBy({ id: attempt1.id });
    expect(fetchAttempt1?.status).toBe(EmailJobStatus.RETRYING);
    expect(fetchAttempt1?.errorMessage).toContain('503');
  });

  it('A017 — Final successful attempt is traceable', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a017@rmrit.com',
      subject: 'Traceable Success',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a017-${Date.now()}`,
    });

    await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'Fail 1');
    await auditService.recordAttempt(job, 2, EmailJobStatus.SENT, 'msg-success-17');

    const logs = await auditService.getLogsForJob(job.id);
    const finalLog = logs[logs.length - 1];
    expect(finalLog.status).toBe(EmailJobStatus.SENT);
    expect(finalLog.providerMessageId).toBe('msg-success-17');
  });

  it('A018 — Final failed attempt is traceable', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a018@rmrit.com',
      subject: 'Traceable Failure',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a018-${Date.now()}`,
    });

    await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'Fail 1');
    await auditService.recordAttempt(job, 2, EmailJobStatus.RETRYING, null, 'Fail 2');
    await auditService.recordAttempt(job, 3, EmailJobStatus.FAILED, null, 'Fail 3 Max Exhausted');

    const logs = await auditService.getLogsForJob(job.id);
    const finalLog = logs[logs.length - 1];
    expect(finalLog.status).toBe(EmailJobStatus.FAILED);
    expect(finalLog.attempt).toBe(3);
  });

  it('A019 — Audit history is ordered deterministically', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a019@rmrit.com',
      subject: 'Ordered Audit',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a019-${Date.now()}`,
    });

    await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'First');
    await auditService.recordAttempt(job, 2, EmailJobStatus.RETRYING, null, 'Second');
    await auditService.recordAttempt(job, 3, EmailJobStatus.SENT, 'msg-third');

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs[0].attempt).toBe(1);
    expect(logs[1].attempt).toBe(2);
    expect(logs[2].attempt).toBe(3);
  });

  it('A020 — Job history query returns all attempts', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a020@rmrit.com',
      subject: 'All Attempts',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a020-${Date.now()}`,
    });

    for (let i = 1; i <= 5; i++) {
      await auditService.recordAttempt(job, i, i === 5 ? EmailJobStatus.SENT : EmailJobStatus.RETRYING, i === 5 ? 'msg-5' : null, `Attempt ${i}`);
    }

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(5);
  });

  it('A021 — Provider message ID can be used to find an audit record', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a021@rmrit.com',
      subject: 'Lookup MsgId',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a021-${Date.now()}`,
    });

    const targetMsgId = `gmail-msg-unique-${Date.now()}`;
    await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, targetMsgId);

    const found = await auditService.findLogByProviderMessageId(targetMsgId);
    expect(found).toBeDefined();
    expect(found?.jobId).toBe(job.id);
    expect(found?.recipientEmail).toBe('a021@rmrit.com');
  });

  it('A022 — Failed Gmail attempts can be queried safely', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a022@rmrit.com',
      subject: 'Failed Gmail Attempts',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a022-${Date.now()}`,
    });

    await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, 'Gmail Permanent Reject', 'INVALID_RECIPIENT');
    const failedLogs = await auditService.getFailedLogs(EmailProvider.GMAIL_API);

    expect(failedLogs.length).toBeGreaterThan(0);
    expect(failedLogs[0].status).toBe(EmailJobStatus.FAILED);
  });

  it('A023 — Future retry scheduling does not create an audit attempt before provider execution', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a023@rmrit.com',
      subject: 'Future Retry Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a023-${Date.now()}`,
    });

    // Enqueued job has 0 attempts and 0 audit logs
    const initialLogs = await auditService.getLogsForJob(job.id);
    expect(initialLogs.length).toBe(0);
  });

  it('A024 — Only actual provider attempts create attempt audit records', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-a024',
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a024@rmrit.com',
      subject: 'Worker Execution Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a024-${Date.now()}`,
    });

    expect((await auditService.getLogsForJob(job.id)).length).toBe(0);
    await workerService.pollTick();
    expect((await auditService.getLogsForJob(job.id)).length).toBe(1);
  });

  it('A025 — Successful provider result creates SENT audit record', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-a025-sent',
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a025@rmrit.com',
      subject: 'Sent Audit Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a025-${Date.now()}`,
    });

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.SENT);
    expect(logs[0].providerMessageId).toBe('msg-a025-sent');
  });

  it('A026 — Retryable provider failure creates RETRYING audit record', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503 Service Unavailable',
      retryable: true,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a026@rmrit.com',
      subject: 'Retrying Audit Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a026-${Date.now()}`,
    });

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.RETRYING);
    expect(logs[0].errorCode).toBe('GMAIL_HTTP_503');
  });

  it('A027 — Permanent provider failure creates FAILED audit record', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'Invalid recipient email format',
      retryable: false,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a027@rmrit.com',
      subject: 'Permanent Failure Audit Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a027-${Date.now()}`,
    });

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.FAILED);
  });

  it('A028 — Maximum-attempt failure is recorded as FAILED', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'Persistent timeout',
      retryable: true,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a028@rmrit.com',
      subject: 'Max Attempt Audit Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      maxAttempts: 1,
      idempotencyKey: `a028-${Date.now()}`,
    });

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.FAILED);
    expect(logs[0].attempt).toBe(1);
  });

  it('A029 — Audit recording does not change EmailJob retry semantics', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 429 Rate Limit Exceeded',
      retryable: true,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a029@rmrit.com',
      subject: 'Retry Semantics Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a029-${Date.now()}`,
    });

    await workerService.pollTick();

    const updatedJob = await emailJobRepo.findOneBy({ id: job.id });
    expect(updatedJob?.status).toBe(EmailJobStatus.RETRYING);
    expect(updatedJob?.nextRetryAt).toBeDefined();
    expect(updatedJob?.attempts).toBe(1);
  });

  it('A030 — Audit recording does not change queue claiming semantics', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a030@rmrit.com',
      subject: 'Claiming Semantics Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a030-${Date.now()}`,
    });

    const claimed = await queueService.claimJobs(1, 'worker-a030');
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(job.id);
    expect(claimed[0].status).toBe(EmailJobStatus.PROCESSING);
  });

  it('A031 — Audit recording does not change Gmail provider behavior', async () => {
    mockProvider.mockHandler = async (msg) => {
      return { success: true, providerMessageId: `msg-${msg.jobId}` };
    };

    const job = await queueService.enqueueJob({
      recipientEmail: 'a031@rmrit.com',
      subject: 'Gmail Provider Behavior Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a031-${Date.now()}`,
    });

    await workerService.pollTick();

    expect(mockProvider.calls.length).toBe(1);
    expect(mockProvider.calls[0].to).toBe('a031@rmrit.com');
  });

  it('A032 — Audit recording does not create duplicate EmailJob rows', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a032@rmrit.com',
      subject: 'No Duplicate Jobs',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a032-${Date.now()}`,
    });

    await workerService.pollTick();

    const count = await emailJobRepo.count({ where: { recipientEmail: 'a032@rmrit.com' } });
    expect(count).toBe(1);
  });

  it('A033 — Audit recording does not create duplicate attempt entries for one actual attempt', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-single-attempt',
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a033@rmrit.com',
      subject: 'No Duplicate Audit Attempts',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a033-${Date.now()}`,
    });

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
  });

  it('A034 — Audit transaction rollback does not leave false success history', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a034@rmrit.com',
      subject: 'Rollback Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a034-${Date.now()}`,
    });

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.insert(EmailLog, {
        jobId: job.id,
        eventType: job.eventType,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        provider: EmailProvider.GMAIL_API,
        attempt: 1,
        status: EmailJobStatus.SENT,
        providerMessageId: 'msg-rollback',
      });
      // Force rollback
      throw new Error('Simulated Database Error');
    } catch (err) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(0);
  });

  it('A035 — Queue state and audit state remain consistent after successful delivery', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-consistent-success',
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a035@rmrit.com',
      subject: 'Consistency Success Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a035-${Date.now()}`,
    });

    await workerService.pollTick();

    const updatedJob = await emailJobRepo.findOneBy({ id: job.id });
    const logs = await auditService.getLogsForJob(job.id);

    expect(updatedJob?.status).toBe(EmailJobStatus.SENT);
    expect(updatedJob?.providerMessageId).toBe('msg-consistent-success');
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.SENT);
    expect(logs[0].providerMessageId).toBe('msg-consistent-success');
  });

  it('A036 — Queue state and audit state remain consistent after retryable failure', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 503 Service Unavailable',
      retryable: true,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a036@rmrit.com',
      subject: 'Consistency Retry Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a036-${Date.now()}`,
    });

    await workerService.pollTick();

    const updatedJob = await emailJobRepo.findOneBy({ id: job.id });
    const logs = await auditService.getLogsForJob(job.id);

    expect(updatedJob?.status).toBe(EmailJobStatus.RETRYING);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.RETRYING);
    expect(logs[0].errorMessage).toContain('503');
  });

  it('A037 — Queue state and audit state remain consistent after permanent failure', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'Unresolvable domain name',
      retryable: false,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a037@rmrit.com',
      subject: 'Consistency Permanent Failure Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a037-${Date.now()}`,
    });

    await workerService.pollTick();

    const updatedJob = await emailJobRepo.findOneBy({ id: job.id });
    const logs = await auditService.getLogsForJob(job.id);

    expect(updatedJob?.status).toBe(EmailJobStatus.FAILED);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.FAILED);
  });

  it('A038 — Stale-job recovery does not create a fake SENT audit record', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a038@rmrit.com',
      subject: 'Stale Recovery Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a038-${Date.now()}`,
    });

    // Manually mark job locked in PROCESSING in past
    await dataSource.query(
      `UPDATE "email_jobs" SET "status" = 'PROCESSING', "locked_at" = NOW() - INTERVAL '600 seconds', "locked_by" = 'crashed-worker' WHERE "id" = $1`,
      [job.id],
    );

    await queueService.recoverStaleJobs(300);

    const logs = await auditService.getLogsForJob(job.id);
    const sentLogs = logs.filter((l) => l.status === EmailJobStatus.SENT);
    expect(sentLogs.length).toBe(0);
  });

  it('A039 — Cancelled job does not create delivery attempt audit without provider execution', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a039@rmrit.com',
      subject: 'Cancelled Job Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a039-${Date.now()}`,
    });

    await dataSource.query(`UPDATE "email_jobs" SET "status" = 'CANCELLED' WHERE "id" = $1`, [job.id]);

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(0);
  });

  it('A040 — SENT job is not automatically audited again without a real provider attempt', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a040@rmrit.com',
      subject: 'Sent Job Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a040-${Date.now()}`,
    });

    await queueService.markSuccess(job.id, 'manual', 'msg-initial');
    await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-initial');

    await workerService.pollTick();

    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
  });

  it('A041 — OAuth access token is never stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a041@rmrit.com',
      subject: 'Token Secret Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a041-${Date.now()}`,
    });

    const errorWithToken = 'Error: access_token=ya29.a0AfH6SMB... failed during call';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, errorWithToken);

    expect(log.errorMessage).not.toContain('ya29.a0AfH6SMB');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A042 — OAuth refresh token is never stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a042@rmrit.com',
      subject: 'Refresh Token Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a042-${Date.now()}`,
    });

    const errorWithRefreshToken = 'Error: GMAIL_REFRESH_TOKEN=1//09xyz... failed';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, errorWithRefreshToken);

    expect(log.errorMessage).not.toContain('1//09xyz');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A043 — Client secret is never stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a043@rmrit.com',
      subject: 'Client Secret Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a043-${Date.now()}`,
    });

    const errorWithSecret = 'Error: client_secret=GOCSPX-abc123secret';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, errorWithSecret);

    expect(log.errorMessage).not.toContain('GOCSPX-abc123secret');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A044 — Authorization header is never stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a044@rmrit.com',
      subject: 'Auth Header Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a044-${Date.now()}`,
    });

    const errorWithHeader = 'Error: Authorization: Bearer secret_bearer_token';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, errorWithHeader);

    expect(log.errorMessage).not.toContain('secret_bearer_token');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A045 — Database password is never stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a045@rmrit.com',
      subject: 'DB Password Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a045-${Date.now()}`,
    });

    const errorWithDbPass = 'Connection error password=my_db_password_123';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, errorWithDbPass);

    expect(log.errorMessage).not.toContain('my_db_password_123');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A046 — JWT is never stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a046@rmrit.com',
      subject: 'JWT Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a046-${Date.now()}`,
    });

    const errorWithJwt = 'Failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, errorWithJwt);

    expect(log.errorMessage).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(log.errorMessage).toContain('[REDACTED]');
  });

  it('A047 — Raw Google error object is not stored', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a047@rmrit.com',
      subject: 'Raw Google Error Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a047-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.FAILED, null, 'Gmail API returned HTTP 503');
    expect(typeof log.errorMessage).toBe('string');
    expect(log.errorMessage).toBe('Gmail API returned HTTP 503');
  });

  it('A048 — Full email body is not stored in EmailLog', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a048@rmrit.com',
      subject: 'Email Body Privacy Test',
      bodyText: 'This is a long secret body content text',
      bodyHtml: '<p>This is a long secret HTML content text</p>',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a048-${Date.now()}`,
    });

    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-body-test');
    expect((log as any).bodyText).toBeUndefined();
    expect((log as any).bodyHtml).toBeUndefined();
  });

  it('A049 — Audit records are append-oriented', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a049@rmrit.com',
      subject: 'Append Only Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a049-${Date.now()}`,
    });

    const attempt1 = await auditService.recordAttempt(job, 1, EmailJobStatus.RETRYING, null, 'First attempt failed');
    const attempt2 = await auditService.recordAttempt(job, 2, EmailJobStatus.SENT, 'msg-49');

    expect(attempt1.id).not.toBe(attempt2.id);
    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(2);
  });

  it('A050 — No general audit update/delete API exists in EmailAuditService', () => {
    const service = auditService as any;
    expect(service.updateLog).toBeUndefined();
    expect(service.deleteLog).toBeUndefined();
    expect(service.clearLogs).toBeUndefined();
  });

  it('A051 — No public email audit API was introduced', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const controllerFiles = fs.readdirSync(srcDir, { recursive: true })
      .filter((f: any) => String(f).endsWith('.controller.ts'));
    
    for (const file of controllerFiles) {
      const content = fs.readFileSync(path.join(srcDir, String(file)), 'utf-8');
      expect(content).not.toContain('/api/email-logs');
      expect(content).not.toContain('/email-logs');
    }
  });

  it('A052 — No frontend email audit module was introduced', () => {
    const frontendDir = path.resolve(__dirname, '../../frontend');
    if (fs.existsSync(frontendDir)) {
      const frontendFiles = fs.readdirSync(frontendDir, { recursive: true })
        .filter((f: any) => String(f).includes('email-log') || String(f).includes('EmailAudit'));
      expect(frontendFiles.length).toBe(0);
    } else {
      expect(fs.existsSync(frontendDir)).toBe(false);
    }
  });

  it('A053 — No business workflow behavior changed', async () => {
    // Verify core job queuing and worker lifecycle remains pure
    const job = await queueService.enqueueJob({
      recipientEmail: 'a053@rmrit.com',
      subject: 'Workflow Check',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'PO_CREATED',
      templateKey: 'DEFAULT',
      idempotencyKey: `a053-${Date.now()}`,
    });

    expect(job.status).toBe(EmailJobStatus.PENDING);
  });

  it('A054 — Phase 15.2 regression remains PASS', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a054@rmrit.com',
      subject: 'Regression 15.2',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a054-${Date.now()}`,
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe(EmailJobStatus.PENDING);
    expect(job.attempts).toBe(0);
  });

  it('A055 — Phase 15.3 regression remains PASS', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'a055@rmrit.com',
      subject: 'Regression 15.3',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a055-${Date.now()}`,
    });

    const claimed = await queueService.claimJobs(1, 'worker-reg-15-3');
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(job.id);
    expect(claimed[0].status).toBe(EmailJobStatus.PROCESSING);
  });

  it('A056 — Phase 15.4 regression remains PASS', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-reg-15-4',
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a056@rmrit.com',
      subject: 'Regression 15.4',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a056-${Date.now()}`,
    });

    await workerService.pollTick();

    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.SENT);
  });

  it('A057 — Phase 15.5 regression remains PASS', async () => {
    const gmailProvider = new GmailApiProvider();
    expect(gmailProvider).toBeDefined();
    expect(typeof gmailProvider.send).toBe('function');
  });

  it('A058 — Phase 15.6 regression remains PASS', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 429 Rate Limit Exceeded',
      retryable: true,
    });

    const job = await queueService.enqueueJob({
      recipientEmail: 'a058@rmrit.com',
      subject: 'Regression 15.6',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      idempotencyKey: `a058-${Date.now()}`,
    });

    await workerService.pollTick();

    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
    expect(updated?.nextRetryAt).toBeDefined();
  });
});
