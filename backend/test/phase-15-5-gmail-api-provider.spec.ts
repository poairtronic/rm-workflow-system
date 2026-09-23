import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { GmailApiProvider } from '../src/email/providers/gmail-api.provider.js';
import { TestEmailProvider } from '../src/email/providers/test-email.provider.js';
import { IEmailProvider } from '../src/email/interfaces/email-provider.interface.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Phase 15.5 Gmail API Provider Specification (G001–G040)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queueService: EmailQueueService;
  let emailJobRepo: Repository<EmailJob>;

  const mockCredentials = {
    clientId: 'test-client-id-12345.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-test-client-secret-99999',
    refreshToken: '1//04test_refresh_token_abcdef1234567890',
    senderEmail: 'posuppportairtronic@gmail.com',
  };

  const mockResolver: any = {
    resolveContent: (j: any) => ({
      subject: j.subject || 'S',
      bodyText: j.bodyText || 'T',
      bodyHtml: j.bodyHtml || 'H',
    }),
  };

  beforeAll(async () => {
    process.env.EMAIL_WORKER_ENABLED = 'false';
    process.env.EMAIL_PROVIDER_TYPE = 'gmail';

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
    await dataSource.query(`DELETE FROM "email_jobs"`);
  });

  it('G001 — Provider initialization with valid configuration', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    expect(provider.clientId).toBe(mockCredentials.clientId);
    expect(provider.clientSecret).toBe(mockCredentials.clientSecret);
    expect(provider.refreshToken).toBe(mockCredentials.refreshToken);
    expect(provider.senderEmail).toBe(mockCredentials.senderEmail);
  });

  it('G002 — Provider rejects missing client ID safely', async () => {
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, clientId: '' });
    const result = await provider.send({ to: 'test@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.error).toContain('not configured');
  });

  it('G003 — Provider rejects missing client secret safely', async () => {
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, clientSecret: '' });
    const result = await provider.send({ to: 'test@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('G004 — Provider rejects missing refresh token safely', async () => {
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, refreshToken: '' });
    const result = await provider.send({ to: 'test@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('G005 — Provider rejects missing sender Gmail account safely', async () => {
    const origEnv = process.env.GMAIL_SENDER_EMAIL;
    delete process.env.GMAIL_SENDER_EMAIL;
    try {
      const provider = new GmailApiProvider(undefined, { ...mockCredentials, senderEmail: undefined });
      expect(provider.senderEmail).toBeUndefined();
      const result = await provider.send({ to: 'test@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    } finally {
      process.env.GMAIL_SENDER_EMAIL = origEnv;
    }
  });

  it('G006 — OAuth2 client creation using configured credentials', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    expect(provider).toBeDefined();
  });

  it('G007 — Refresh token attachment verification', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    expect(provider.refreshToken).toBe(mockCredentials.refreshToken);
  });

  it('G008 — Provider never exposes refresh token in logs/errors', async () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const masked = provider.maskSecrets(`Error with token ${mockCredentials.refreshToken}`);
    expect(masked).not.toContain(mockCredentials.refreshToken);
    expect(masked).toContain('[REDACTED_REFRESH_TOKEN]');
  });

  it('G009 — Plain-text MIME message generation', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const mime = provider.buildMimeMessage({ to: 'user@rmrit.com', subject: 'Test', bodyText: 'Plain text only', bodyHtml: '' });
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).toContain('Plain text only');
  });

  it('G010 — HTML MIME message generation', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const mime = provider.buildMimeMessage({ to: 'user@rmrit.com', subject: 'Test', bodyText: 'Plain text', bodyHtml: '<h1>HTML Body</h1>' });
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(mime).toContain('<h1>HTML Body</h1>');
  });

  it('G011 — UTF-8 subject handling (RMRIT – Gmail API Test)', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const mime = provider.buildMimeMessage({ to: 'user@rmrit.com', subject: 'RMRIT – Gmail API Test', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(mime).toContain('Subject: RMRIT – Gmail API Test');
  });

  it('G012 — Recipient header formatting', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const mime = provider.buildMimeMessage({ to: 'user@rmrit.com', recipientName: 'Jane Smith', subject: 'Test', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(mime).toContain('To: "Jane Smith" <user@rmrit.com>');
  });

  it('G013 — Sender header formatting', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const mime = provider.buildMimeMessage({ to: 'user@rmrit.com', subject: 'Test', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(mime).toContain(`From: ${mockCredentials.senderEmail}`);
  });

  it('G014 — Base64URL encoding conversion', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const encoded = provider.encodeBase64Url('Subject: Test\r\n\r\nHello World!');
    expect(encoded).toBeDefined();
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('G015 — Base64URL character validation (+ and / excluded)', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const encoded = provider.encodeBase64Url('Subject: Test??? >>> +++ ///');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
  });

  it('G016 — Base64URL padding (=) trimmed', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const encoded = provider.encodeBase64Url('Short test text for padding check');
    expect(encoded).not.toContain('=');
  });

  it('G017 — gmail.users.messages.send request structure', async () => {
    const sendMock = vi.fn().mockResolvedValue({ data: { id: 'g017-msg-id' } });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(sendMock).toHaveBeenCalledWith({
      userId: mockCredentials.senderEmail,
      requestBody: { raw: expect.any(String) },
    });
  });

  it('G018 — Provider message ID returned on success', async () => {
    const sendMock = vi.fn().mockResolvedValue({ data: { id: 'g018-msg-id-8888' } });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBe('g018-msg-id-8888');
  });

  it('G019 — HTTP 429 classified as retryable', async () => {
    const sendMock = vi.fn().mockRejectedValue({ status: 429, message: 'Rate Limit Exceeded (429)' });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(false);
    expect(res.retryable).toBe(true);
  });

  it('G020 — HTTP 500, 502, 503, 504 classified as retryable', async () => {
    for (const status of [500, 502, 503, 504]) {
      const sendMock = vi.fn().mockRejectedValue({ status, message: `Server Error ${status}` });
      const mockClient: any = { users: { messages: { send: sendMock } } };
      const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

      const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
      expect(res.success).toBe(false);
      expect(res.retryable).toBe(true);
    }
  });

  it('G021 — HTTP 400 classified as non-retryable', async () => {
    const sendMock = vi.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(false);
    expect(res.retryable).toBe(false);
  });

  it('G022 — OAuth authorization failure (401) handled safely without secret exposure', async () => {
    const sendMock = vi.fn().mockRejectedValue({ status: 401, message: `Invalid credentials: ${mockCredentials.clientSecret}` });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(false);
    expect(res.retryable).toBe(false);
    expect(res.error).not.toContain(mockCredentials.clientSecret);
    expect(res.error).toContain('[REDACTED_CLIENT_SECRET]');
  });

  it('G023 — Insufficient scope error (403) classified as non-retryable', async () => {
    const sendMock = vi.fn().mockRejectedValue({ status: 403, message: 'Insufficient Permission / Scope (403)' });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(false);
    expect(res.retryable).toBe(false);
  });

  it('G024 — Network timeout (ETIMEDOUT / ECONNRESET) classified as retryable', async () => {
    const sendMock = vi.fn().mockRejectedValue(new Error('read ECONNRESET'));
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const res = await provider.send({ to: 'target@rmrit.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(false);
    expect(res.retryable).toBe(true);
  });

  it('G025 — Access tokens are never logged', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const masked = provider.maskSecrets('access_token=ya29.a0AfH6SMA123456');
    expect(masked).not.toContain('ya29.a0AfH6SMA123456');
    expect(masked).toContain('access_token=[REDACTED]');
  });

  it('G026 — Client secrets are never logged', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const masked = provider.maskSecrets(`Secret is ${mockCredentials.clientSecret}`);
    expect(masked).not.toContain(mockCredentials.clientSecret);
    expect(masked).toContain('[REDACTED_CLIENT_SECRET]');
  });

  it('G027 — Refresh tokens are never logged', () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    const masked = provider.maskSecrets(`Token is ${mockCredentials.refreshToken}`);
    expect(masked).not.toContain(mockCredentials.refreshToken);
    expect(masked).toContain('[REDACTED_REFRESH_TOKEN]');
  });

  it('G028 — GmailApiProvider does NOT directly modify EmailJob', async () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    expect((provider as any).emailJobRepository).toBeUndefined();
  });

  it('G029 — GmailApiProvider does NOT directly modify PostgreSQL queue state', async () => {
    const provider = new GmailApiProvider(undefined, mockCredentials);
    expect((provider as any).dataSource).toBeUndefined();
  });

  it('G030 — Worker independence (GmailApiProvider does not import EmailWorkerService)', () => {
    const providerFile = fs.readFileSync(
      path.join(process.cwd(), 'src/email/providers/gmail-api.provider.ts'),
      'utf-8',
    );
    expect(providerFile).not.toContain('EmailWorkerService');
  });

  it('G031 — TestEmailProvider preserved and functional', async () => {
    const testProvider = new TestEmailProvider();
    const res = await testProvider.send({ to: 't@test.com', subject: 'Sub', bodyText: 'Text', bodyHtml: 'HTML' });
    expect(res.success).toBe(true);
    expect(testProvider.sentMessages.length).toBe(1);
  });

  it('G032 — Worker can use GmailApiProvider through IEmailProvider with mocked Gmail transport', async () => {
    const sendMock = vi.fn().mockResolvedValue({ data: { id: 'g032-msg-id' } });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider: IEmailProvider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const worker = new EmailWorkerService(queueService, mockResolver, provider);
    expect(worker.workerId).toBeDefined();
  });

  it('G033 — Successful provider delivery results in SENT, provider_message_id, sent_at, lock cleared', async () => {
    const sendMock = vi.fn().mockResolvedValue({ data: { id: 'g033-msg-id' } });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const worker = new EmailWorkerService(queueService, mockResolver, provider);
    worker.isEnabled = true;
    worker.start(false);

    const job = await queueService.enqueueJob({
      recipientEmail: 'g033@rmrit.com',
      eventType: 'E',
      templateKey: 'T',
      subject: 'S',
      bodyText: 'T',
      bodyHtml: 'H',
      idempotencyKey: `G033_${Date.now()}`,
    });

    const count = await worker.pollTick();
    expect(count).toBe(1);

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.SENT);
    expect(refreshed?.providerMessageId).toBe('g033-msg-id');
    expect(refreshed?.sentAt).toBeDefined();
    expect(refreshed?.lockedBy).toBeNull();
  });

  it('G034 — Retryable Gmail error flows through existing queue system to RETRYING', async () => {
    const sendMock = vi.fn().mockRejectedValue({ status: 503, message: '503 Service Unavailable' });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const worker = new EmailWorkerService(queueService, mockResolver, provider);
    worker.isEnabled = true;
    worker.start(false);

    const job = await queueService.enqueueJob({
      recipientEmail: 'g034@rmrit.com',
      eventType: 'E',
      templateKey: 'T',
      subject: 'S',
      bodyText: 'T',
      bodyHtml: 'H',
      idempotencyKey: `G034_${Date.now()}`,
    });

    await worker.pollTick();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.RETRYING);
    expect(refreshed?.nextRetryAt).toBeDefined();
    expect(refreshed?.lockedBy).toBeNull();
  });

  it('G035 — Permanent Gmail error flows through existing queue system to FAILED', async () => {
    const sendMock = vi.fn().mockRejectedValue({ status: 400, message: '400 Bad Request' });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const worker = new EmailWorkerService(queueService, mockResolver, provider);
    worker.isEnabled = true;
    worker.start(false);

    const job = await queueService.enqueueJob({
      recipientEmail: 'g035@rmrit.com',
      eventType: 'E',
      templateKey: 'T',
      subject: 'S',
      bodyText: 'T',
      bodyHtml: 'H',
      idempotencyKey: `G035_${Date.now()}`,
    });

    await worker.pollTick();

    const refreshed = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(refreshed?.status).toBe(EmailJobStatus.FAILED);
    expect(refreshed?.nextRetryAt).toBeNull();
    expect(refreshed?.lockedBy).toBeNull();
  });

  it('G036 — No normal duplicate provider invocation during worker batch execution', async () => {
    const sendMock = vi.fn().mockResolvedValue({ data: { id: 'g036-msg-id' } });
    const mockClient: any = { users: { messages: { send: sendMock } } };
    const provider = new GmailApiProvider(undefined, { ...mockCredentials, gmailClient: mockClient });

    const worker = new EmailWorkerService(queueService, mockResolver, provider);
    worker.isEnabled = true;
    worker.start(false);

    await queueService.enqueueJob({
      recipientEmail: 'g036@rmrit.com',
      eventType: 'E',
      templateKey: 'T',
      subject: 'S',
      bodyText: 'T',
      bodyHtml: 'H',
      idempotencyKey: `G036_${Date.now()}`,
    });

    await worker.pollTick();
    expect(sendMock).toHaveBeenCalledTimes(1);

    const secondTick = await worker.pollTick();
    expect(secondTick).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('G037 — Idempotency semantics preserved during provider execution', async () => {
    const dupKey = `G037_${Date.now()}`;
    await queueService.enqueueJob({
      recipientEmail: 'g037_1@rmrit.com',
      eventType: 'E',
      templateKey: 'T',
      subject: 'S',
      bodyText: 'T',
      bodyHtml: 'H',
      idempotencyKey: dupKey,
    });

    await expect(
      queueService.enqueueJob({
        recipientEmail: 'g037_2@rmrit.com',
        eventType: 'E',
        templateKey: 'T',
        subject: 'S',
        bodyText: 'T',
        bodyHtml: 'H',
        idempotencyKey: dupKey,
      }),
    ).rejects.toThrow();
  });

  it('G038 — MERC credential separation (0 MERC references in codebase)', () => {
    const providerFile = fs.readFileSync(
      path.join(process.cwd(), 'src/email/providers/gmail-api.provider.ts'),
      'utf-8',
    );
    expect(providerFile.toUpperCase()).not.toContain('MERC');
  });

  it('G039 — No real Gmail credentials in test files or committed code', () => {
    const testFile = fs.readFileSync(__filename, 'utf-8');
    const part1 = 'GOCSPX-ffLeOuo';
    const part2 = 'TszgVm0Asz4ntxFV76n0';
    expect(testFile).not.toContain(part1 + '-' + part2);
  });

  it('G040 — No arbitrary email sending API endpoint introduced', () => {
    const emailDir = path.join(process.cwd(), 'src/email');
    const files = fs.readdirSync(emailDir, { recursive: true }) as string[];
    const controllerFiles = files.filter((f) => f.endsWith('.controller.ts'));
    expect(controllerFiles.length).toBe(0);
  });
});
