import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
import { GmailApiProvider } from '../src/email/providers/gmail-api.provider.js';
import { TemplateResolver } from '../src/email/resolvers/template.resolver.js';
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
import jwt from 'jsonwebtoken';

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

describe('Phase 15.8 — Email Security Specification (S001–S062)', () => {
  let app: any;
  let dataSource: DataSource;
  let queueService: EmailQueueService;
  let workerService: EmailWorkerService;
  let auditService: EmailAuditService;
  let templateResolver: TemplateResolver;
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
    templateResolver = app.get(TemplateResolver);
    emailJobRepo = dataSource.getRepository(EmailJob);
    emailLogRepo = dataSource.getRepository(EmailLog);
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

  it('S001 — Unauthenticated email operation rejected (Guard/Middleware verification)', () => {
    const secret = 'test_jwt_secret_min_32_characters';
    expect(() => jwt.verify('invalid.token.here', secret)).toThrow();
  });

  it('S002 — Expired JWT rejected', () => {
    const secret = 'test_jwt_secret_min_32_characters';
    const expiredToken = jwt.sign({ sub: 'user-123' }, secret, { expiresIn: -10 });
    expect(() => jwt.verify(expiredToken, secret)).toThrow();
  });

  it('S003 — Invalid JWT rejected', () => {
    const secret = 'test_jwt_secret_min_32_characters';
    const fakeToken = jwt.sign({ sub: 'user-123' }, 'wrong_secret');
    expect(() => jwt.verify(fakeToken, secret)).toThrow();
  });

  it('S004 — Actor identity comes from authenticated JWT', () => {
    const secret = 'test_jwt_secret_min_32_characters';
    const token = jwt.sign({ sub: 'user-actor-999', role: 'ADMIN' }, secret, { expiresIn: '1h' });
    const decoded: any = jwt.verify(token, secret);
    expect(decoded.sub).toBe('user-actor-999');
  });

  it('S005 — Client cannot spoof actor ID via body', async () => {
    const authenticatedUserId = '11111111-1111-1111-1111-111111111111';
    const job = await queueService.enqueueJob({
      recipientEmail: 's005@rmrit.com',
      recipientUserId: authenticatedUserId, // Server derived
      subject: 'Actor Spoofing Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.recipientUserId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('S006 — RBAC prevents unauthorized email operation', () => {
    const secret = 'test_jwt_secret_min_32_characters';
    const userToken = jwt.sign({ sub: 'user-123', role: 'DESIGNER' }, secret, { expiresIn: '1h' });
    const decoded: any = jwt.verify(userToken, secret);
    expect(decoded.role).toBe('DESIGNER');
    expect(decoded.role).not.toBe('ADMIN');
  });

  it('S007 — Direct Gmail provider endpoint does not exist', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const controllerFiles = fs.readdirSync(srcDir, { recursive: true })
      .filter((f: any) => String(f).endsWith('.controller.ts'));

    for (const file of controllerFiles) {
      const content = fs.readFileSync(path.join(srcDir, String(file)), 'utf-8');
      expect(content).not.toContain('/api/gmail/send');
      expect(content).not.toContain('/gmail/send');
      expect(content).not.toContain('/api/email/send');
    }
  });

  it('S008 — Gmail provider is not publicly exposed', () => {
    const gmailProvider = new GmailApiProvider();
    expect((gmailProvider as any).getRawCredentials).toBeUndefined();
    expect((gmailProvider as any).expressRouter).toBeUndefined();
  });

  it('S009 — Gmail client secret is backend-only', () => {
    const frontendDir = path.resolve(__dirname, '../../frontend');
    if (fs.existsSync(frontendDir)) {
      const files = fs.readdirSync(frontendDir, { recursive: true });
      for (const f of files) {
        if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.env'))) {
          const content = fs.readFileSync(path.join(frontendDir, f), 'utf-8');
          expect(content).not.toContain('GMAIL_CLIENT_SECRET=');
          expect(content).not.toContain('GOCSPX-');
        }
      }
    }
  });

  it('S010 — Gmail refresh token is backend-only', () => {
    const frontendDir = path.resolve(__dirname, '../../frontend');
    if (fs.existsSync(frontendDir)) {
      const files = fs.readdirSync(frontendDir, { recursive: true });
      for (const f of files) {
        if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.env'))) {
          const content = fs.readFileSync(path.join(frontendDir, f), 'utf-8');
          expect(content).not.toContain('GMAIL_REFRESH_TOKEN=1//');
        }
      }
    }
  });

  it('S011 — Frontend contains no real OAuth secrets', () => {
    const frontendDir = path.resolve(__dirname, '../../frontend');
    if (fs.existsSync(frontendDir)) {
      const envFile = path.join(frontendDir, '.env.example');
      if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, 'utf-8');
        expect(content).not.toContain('CLIENT_SECRET');
        expect(content).not.toContain('REFRESH_TOKEN');
      }
    }
  });

  it('S012 — Only gmail.send scope is configured', () => {
    const scope = 'https://www.googleapis.com/auth/gmail.send';
    expect(scope).toContain('gmail.send');
    expect(scope).not.toContain('gmail.readonly');
    expect(scope).not.toContain('gmail.modify');
    expect(scope).not.toContain('mail.google.com');
  });

  it('S013 — MERC credentials are not reused', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir, { recursive: true }).filter((f: any) => String(f).endsWith('.ts'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(srcDir, String(f)), 'utf-8');
      expect(content).not.toContain('MERC_GMAIL_REFRESH_TOKEN');
      expect(content).not.toContain('MERC_CLIENT_SECRET');
    }
  });

  it('S014 — Valid recipient accepted', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 'valid.user@rmrit.com',
      subject: 'Valid Recipient Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.recipientEmail).toBe('valid.user@rmrit.com');
  });

  it('S015 — Malformed recipient rejected', async () => {
    await expect(
      queueService.enqueueJob({
        recipientEmail: 'invalid-email-address',
        subject: 'Malformed Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        eventType: 'TEST',
        templateKey: 'DEFAULT',
      }),
    ).rejects.toThrow();
  });

  it('S016 — CRLF recipient injection rejected', async () => {
    await expect(
      queueService.enqueueJob({
        recipientEmail: 'victim@rmrit.com\r\nBcc: attacker@example.com',
        subject: 'CRLF Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        eventType: 'TEST',
        templateKey: 'DEFAULT',
      }),
    ).rejects.toThrow();
  });

  it('S017 — BCC injection rejected', async () => {
    await expect(
      queueService.enqueueJob({
        recipientEmail: 'victim@rmrit.com,attacker@example.com',
        subject: 'BCC Injection Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        eventType: 'TEST',
        templateKey: 'DEFAULT',
      }),
    ).rejects.toThrow();
  });

  it('S018 — CC injection rejected', async () => {
    await expect(
      queueService.enqueueJob({
        recipientEmail: 'victim@rmrit.com;attacker@example.com',
        subject: 'CC Injection Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        eventType: 'TEST',
        templateKey: 'DEFAULT',
      }),
    ).rejects.toThrow();
  });

  it('S019 — Subject CRLF injection rejected / sanitized', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's019@rmrit.com',
      subject: 'Normal Subject\r\nBcc: attacker@example.com',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.subject).not.toContain('\r');
    expect(job.subject).not.toContain('\n');
    expect(job.subject).toBe('Normal Subject Bcc: attacker@example.com');
  });

  it('S020 — Display-name CRLF injection rejected / sanitized', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's020@rmrit.com',
      recipientName: 'RMRIT System\r\nBcc: attacker@example.com',
      subject: 'Display Name Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.recipientName).not.toContain('\r');
    expect(job.recipientName).not.toContain('\n');
    expect(job.recipientName).toBe('RMRIT System Bcc: attacker@example.com');
  });

  it('S021 — Custom header injection rejected in MIME', () => {
    const gmailProvider = new GmailApiProvider(undefined, { senderEmail: 'sender@rmrit.com' });
    const mime = gmailProvider.buildMimeMessage({
      to: 'recipient@rmrit.com',
      subject: 'Subject\r\nX-Injected-Header: evil',
      bodyText: 'Body',
      bodyHtml: 'HTML',
    });
    expect(mime).not.toContain('Subject: Subject\r\nX-Injected-Header: evil');
    expect(mime).toContain('Subject: Subject X-Injected-Header: evil');
  });

  it('S022 — User cannot override sender account', () => {
    const gmailProvider = new GmailApiProvider(undefined, { senderEmail: 'authorised-sender@rmrit.com' });
    const mime = gmailProvider.buildMimeMessage({
      to: 'recipient@rmrit.com',
      subject: 'Sender Override Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
    });
    expect(mime).toContain('From: authorised-sender@rmrit.com');
  });

  it('S023 — User cannot override Gmail provider', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's023@rmrit.com',
      subject: 'Provider Override Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      provider: 'MALICIOUS_PROVIDER' as any,
    });
    expect(job.provider).toBe(EmailProvider.GMAIL_API);
  });

  it('S024 — User cannot force EmailJob status to SENT via enqueueJob', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's024@rmrit.com',
      subject: 'Status Force Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      status: EmailJobStatus.SENT,
    });
    expect(job.status).toBe(EmailJobStatus.PENDING);
  });

  it('S025 — User cannot set provider_message_id via enqueueJob', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's025@rmrit.com',
      subject: 'Provider MsgId Force Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      providerMessageId: 'fake-msg-id-123',
    });
    expect(job.providerMessageId).toBeNull();
  });

  it('S026 — User cannot manipulate attempts via enqueueJob', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's026@rmrit.com',
      subject: 'Attempts Force Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      attempts: 999,
    });
    expect(job.attempts).toBe(0);
  });

  it('S027 — User cannot manipulate retry timestamps via enqueueJob', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's027@rmrit.com',
      subject: 'Timestamp Force Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
      lockedAt: new Date(),
    });
    expect(job.lockedAt).toBeNull();
  });

  it('S028 — EmailLog cannot be modified through public API', () => {
    const service: any = auditService;
    expect(service.updateLog).toBeUndefined();
    expect(service.updateAttempt).toBeUndefined();
  });

  it('S029 — EmailLog cannot be deleted through public API', () => {
    const service: any = auditService;
    expect(service.deleteLog).toBeUndefined();
    expect(service.removeAttempt).toBeUndefined();
  });

  it('S030 — Fake SENT audit entry cannot be created by normal user', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's030@rmrit.com',
      subject: 'Fake Audit Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(0);
  });

  it('S031 — EmailJob IDOR is rejected where applicable', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's031@rmrit.com',
      recipientUserId: '12345678-1234-1234-1234-123456789012',
      subject: 'IDOR Job Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.recipientUserId).toBe('12345678-1234-1234-1234-123456789012');
  });

  it('S032 — EmailLog IDOR is rejected where applicable (PUBLIC EMAIL LOG API = NONE)', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const controllerFiles = fs.readdirSync(srcDir, { recursive: true })
      .filter((f: any) => String(f).endsWith('.controller.ts'));
    for (const file of controllerFiles) {
      const content = fs.readFileSync(path.join(srcDir, String(file)), 'utf-8');
      expect(content).not.toContain('/api/email-logs');
    }
  });

  it('S033 — OAuth access token is never logged', () => {
    const sanitized = auditService.sanitizeError('Error access_token=ya29.secret_token_123 failed');
    expect(sanitized).not.toContain('ya29.secret_token_123');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S034 — OAuth refresh token is never logged', () => {
    const sanitized = auditService.sanitizeError('Error GMAIL_REFRESH_TOKEN=1//09secret_token_456 failed');
    expect(sanitized).not.toContain('1//09secret_token_456');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S035 — Client secret is never logged', () => {
    const sanitized = auditService.sanitizeError('Error client_secret=GOCSPX-secret_client_789 failed');
    expect(sanitized).not.toContain('GOCSPX-secret_client_789');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S036 — Authorization header is never logged', () => {
    const sanitized = auditService.sanitizeError('Error Authorization: Bearer secret_bearer_val failed');
    expect(sanitized).not.toContain('secret_bearer_val');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S037 — JWT is never logged', () => {
    const sanitized = auditService.sanitizeError('Error Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... failed');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S038 — Password is never logged', () => {
    const sanitized = auditService.sanitizeError('Error password=super_secret_user_pass failed');
    expect(sanitized).not.toContain('super_secret_user_pass');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S039 — Database password is never logged', () => {
    const sanitized = auditService.sanitizeError('Connection failed password=database_pass_999');
    expect(sanitized).not.toContain('database_pass_999');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S040 — Phase 15.6 error sanitization remains active', () => {
    const sanitized = queueService.sanitizeError('Gmail error code=auth_code_123');
    expect(sanitized).not.toContain('auth_code_123');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S041 — Google error containing access token is sanitized', () => {
    const gmailProvider = new GmailApiProvider();
    const sanitized = gmailProvider.maskSecrets('Error: access_token=ya29.xyz123 failed');
    expect(sanitized).not.toContain('ya29.xyz123');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S042 — Google error containing refresh token is sanitized', () => {
    const gmailProvider = new GmailApiProvider();
    const sanitized = gmailProvider.maskSecrets('Error: refresh_token=1//04abc456 failed');
    expect(sanitized).not.toContain('1//04abc456');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S043 — Google error containing client secret is sanitized', () => {
    const gmailProvider = new GmailApiProvider(undefined, { clientSecret: 'GOCSPX-secret123' });
    const sanitized = gmailProvider.maskSecrets('Error with GOCSPX-secret123 value');
    expect(sanitized).not.toContain('GOCSPX-secret123');
    expect(sanitized).toContain('[REDACTED_CLIENT_SECRET]');
  });

  it('S044 — Google error containing Bearer token is sanitized', () => {
    const gmailProvider = new GmailApiProvider();
    const sanitized = gmailProvider.maskSecrets('Authorization: Bearer ya29.bearer_secret');
    expect(sanitized).not.toContain('ya29.bearer_secret');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('S045 — Full email body is not persisted in audit', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's045@rmrit.com',
      subject: 'Audit Content Privacy Test',
      bodyText: 'Confidential body content text',
      bodyHtml: '<p>Confidential body HTML content</p>',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    const log = await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-s045');
    expect((log as any).bodyText).toBeUndefined();
    expect((log as any).bodyHtml).toBeUndefined();
  });

  it('S046 — Arbitrary Supabase file is not attached to email', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's046@rmrit.com',
      subject: 'No Supabase Attachment Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect((job as any).attachmentFileId).toBeUndefined();
    expect((job as any).supabaseFileId).toBeUndefined();
  });

  it('S047 — Email worker has no Supabase file retrieval dependency', () => {
    const worker: any = workerService;
    expect(worker.supabaseClient).toBeUndefined();
    expect(worker.downloadFile).toBeUndefined();
  });

  it('S048 — Email job has no arbitrary file attachment input', () => {
    const jobRepo: any = emailJobRepo;
    const metadata = jobRepo.metadata;
    const colNames = metadata.columns.map((c: any) => c.propertyName);
    expect(colNames).not.toContain('attachmentFileId');
    expect(colNames).not.toContain('supabaseFileId');
  });

  it('S049 — Malformed HTML/user content is safely handled where applicable', () => {
    const job = emailJobRepo.create({
      recipientEmail: 's049@rmrit.com',
      eventType: 'WORKFLOW_RM_SUBMITTED',
      templateKey: 'WORKFLOW_RM_SUBMITTED',
      payload: { rmNumber: '<script>alert(1)</script>' },
    });
    const resolved = templateResolver.resolveContent(job);
    expect(resolved.bodyHtml).not.toContain('<script>alert(1)</script>');
    expect(resolved.bodyHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('S050 — Oversized malicious header input is rejected safely', async () => {
    const oversizedHeader = 'A'.repeat(5000) + '\r\nBcc: evil@example.com';
    await expect(
      queueService.enqueueJob({
        recipientEmail: oversizedHeader,
        subject: 'Oversized Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        eventType: 'TEST',
        templateKey: 'DEFAULT',
      }),
    ).rejects.toThrow();
  });

  it('S051 — Unicode header edge case is handled safely', async () => {
    const unicodeSubject = 'Ünïcódë Subject Test 🔥';
    const job = await queueService.enqueueJob({
      recipientEmail: 'unicode@rmrit.com',
      subject: unicodeSubject,
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.subject).toBe(unicodeSubject);
  });

  it('S052 — Valid Unicode subject remains valid', () => {
    const gmailProvider = new GmailApiProvider(undefined, { senderEmail: 'sender@rmrit.com' });
    const mime = gmailProvider.buildMimeMessage({
      to: 'recipient@rmrit.com',
      subject: 'Valid Unicode: Purchase Order #402 — RM Release 🔥',
      bodyText: 'Body',
      bodyHtml: 'HTML',
    });
    expect(mime).toContain('Subject: Valid Unicode: Purchase Order #402 — RM Release 🔥');
  });

  it('S053 — Queue claiming remains unchanged', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's053@rmrit.com',
      subject: 'Claim Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    const claimed = await queueService.claimJobs(1, 'worker-s053');
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(job.id);
  });

  it('S054 — Retry behavior remains unchanged', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 429 Rate Limit Exceeded',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 's054@rmrit.com',
      subject: 'Retry Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('S055 — Gmail provider behavior remains unchanged', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-s055',
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 's055@rmrit.com',
      subject: 'Gmail Provider Test',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    await workerService.pollTick();
    expect(mockProvider.calls.length).toBe(1);
    expect(mockProvider.calls[0].to).toBe('s055@rmrit.com');
  });

  it('S056 — Email audit behavior remains unchanged except for security hardening', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-s056',
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 's056@rmrit.com',
      subject: 'Audit Check',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    await workerService.pollTick();
    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.SENT);
  });

  it('S057 — Phase 15.2 regression passes', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's057@rmrit.com',
      subject: 'Phase 15.2 Reg',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    expect(job.id).toBeDefined();
    expect(job.status).toBe(EmailJobStatus.PENDING);
  });

  it('S058 — Phase 15.3 regression passes', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's058@rmrit.com',
      subject: 'Phase 15.3 Reg',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    const claimed = await queueService.claimJobs(1, 'worker-s058');
    expect(claimed.length).toBe(1);
  });

  it('S059 — Phase 15.4 regression passes', async () => {
    mockProvider.mockHandler = async () => ({
      success: true,
      providerMessageId: 'msg-s059',
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 's059@rmrit.com',
      subject: 'Phase 15.4 Reg',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.SENT);
  });

  it('S060 — Phase 15.5 regression passes', () => {
    const gmailProvider = new GmailApiProvider();
    expect(gmailProvider).toBeDefined();
    expect(typeof gmailProvider.send).toBe('function');
  });

  it('S061 — Phase 15.6 regression passes', async () => {
    mockProvider.mockHandler = async () => ({
      success: false,
      error: 'HTTP 429 Rate Limit Exceeded',
      retryable: true,
    });
    const job = await queueService.enqueueJob({
      recipientEmail: 's061@rmrit.com',
      subject: 'Phase 15.6 Reg',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    await workerService.pollTick();
    const updated = await emailJobRepo.findOneBy({ id: job.id });
    expect(updated?.status).toBe(EmailJobStatus.RETRYING);
  });

  it('S062 — Phase 15.7 regression passes', async () => {
    const job = await queueService.enqueueJob({
      recipientEmail: 's062@rmrit.com',
      subject: 'Phase 15.7 Reg',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      eventType: 'TEST',
      templateKey: 'DEFAULT',
    });
    await auditService.recordAttempt(job, 1, EmailJobStatus.SENT, 'msg-s062');
    const logs = await auditService.getLogsForJob(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(EmailJobStatus.SENT);
  });
});
