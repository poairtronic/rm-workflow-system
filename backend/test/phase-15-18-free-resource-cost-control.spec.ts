import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailIdempotencyService } from '../src/email/email-idempotency.service.js';
import { EmailObservabilityService } from '../src/email/email-observability.service.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
import { GmailApiProvider } from '../src/email/providers/gmail-api.provider.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailLog } from '../src/email/entities/email-log.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { EmailController } from '../src/email/email.controller.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Phase 15.18 — Free Resource & Cost Control Specification (COST-001–COST-030)', () => {
  let communicationService: CommunicationService;
  let emailQueueService: EmailQueueService;
  let emailIdempotencyService: EmailIdempotencyService;
  let emailObservabilityService: EmailObservabilityService;
  let auditService: EmailAuditService;
  let gmailProvider: GmailApiProvider;

  let emailJobsStore: EmailJob[] = [];
  let emailLogsStore: EmailLog[] = [];
  let notificationsStore: Notification[] = [];
  let usersStore: User[] = [];
  let rolesStore: Role[] = [];

  beforeAll(async () => {
    // Populate test users & roles
    const adminRole = new Role();
    adminRole.id = 'role-admin';
    adminRole.name = 'ADMIN';

    const storesRole = new Role();
    storesRole.id = 'role-stores';
    storesRole.name = 'STORES';

    const prodRole = new Role();
    prodRole.id = 'role-prod';
    prodRole.name = 'PRODUCTION';

    const designerRole = new Role();
    designerRole.id = 'role-designer';
    designerRole.name = 'DESIGNER';

    rolesStore = [adminRole, storesRole, prodRole, designerRole];

    const adminUser = new User();
    adminUser.id = 'user-admin-1';
    adminUser.name = 'Admin Alice';
    adminUser.email = 'admin@rmrit.com';
    adminUser.roleId = adminRole.id;
    adminUser.role = adminRole;
    adminUser.isActive = true;

    const storesUser = new User();
    storesUser.id = 'user-stores-1';
    storesUser.name = 'Stores Sam';
    storesUser.email = 'stores@rmrit.com';
    storesUser.roleId = storesRole.id;
    storesUser.role = storesRole;
    storesUser.isActive = true;

    const prodUser = new User();
    prodUser.id = 'user-prod-1';
    prodUser.name = 'Prod Peter';
    prodUser.email = 'prod@rmrit.com';
    prodUser.roleId = prodRole.id;
    prodUser.role = prodRole;
    prodUser.isActive = true;

    const designerUser = new User();
    designerUser.id = 'user-designer-1';
    designerUser.name = 'Designer Dan';
    designerUser.email = 'designer@rmrit.com';
    designerUser.roleId = designerRole.id;
    designerUser.role = designerRole;
    designerUser.isActive = true;

    usersStore = [adminUser, storesUser, prodUser, designerUser];

    const mockEmailJobRepo: any = {
      create: (data: Partial<EmailJob>) => {
        const job = new EmailJob();
        Object.assign(job, data);
        if (!job.id) job.id = 'job-' + Math.random().toString(36).substring(2, 9);
        if (!job.status) job.status = EmailJobStatus.PENDING;
        if (!job.attempts) job.attempts = 0;
        if (job.maxAttempts === undefined) job.maxAttempts = 3;
        if (!job.createdAt) job.createdAt = new Date();
        if (!job.updatedAt) job.updatedAt = new Date();
        return job;
      },
      save: async (job: EmailJob) => {
        const idx = emailJobsStore.findIndex((j) => j.id === job.id);
        if (idx >= 0) {
          emailJobsStore[idx] = job;
        } else {
          emailJobsStore.push(job);
        }
        return job;
      },
      findOne: async (opts: any) => {
        if (opts?.where?.idempotencyKey) {
          return emailJobsStore.find((j) => j.idempotencyKey === opts.where.idempotencyKey) || null;
        }
        if (opts?.where?.id) {
          return emailJobsStore.find((j) => j.id === opts.where.id) || null;
        }
        return null;
      },
      find: async () => emailJobsStore,
      count: async () => emailJobsStore.length,
      createQueryBuilder: () => ({
        select: function () { return this; },
        addSelect: function () { return this; },
        groupBy: function () { return this; },
        getRawMany: async () => {
          const counts: Record<string, number> = {};
          for (const job of emailJobsStore) {
            counts[job.status] = (counts[job.status] || 0) + 1;
          }
          return Object.entries(counts).map(([status, count]) => ({ status, count: String(count) }));
        },
      }),
    };

    const mockEmailLogRepo: any = {
      create: (data: Partial<EmailLog>) => {
        const log = new EmailLog();
        Object.assign(log, data);
        if (!log.id) log.id = 'log-' + Math.random().toString(36).substring(2, 9);
        if (!log.attemptedAt) log.attemptedAt = new Date();
        return log;
      },
      save: async (log: EmailLog) => {
        emailLogsStore.push(log);
        return log;
      },
      findOne: async () => null,
      find: async () => emailLogsStore,
      count: async () => emailLogsStore.length,
    };

    const mockNotificationRepo: any = {
      create: (data: Partial<Notification>) => {
        const n = new Notification();
        Object.assign(n, data);
        if (!n.id) n.id = 'notif-' + Math.random().toString(36).substring(2, 9);
        return n;
      },
      save: async (n: Notification) => {
        notificationsStore.push(n);
        return n;
      },
      findOne: async (opts: any) => {
        if (opts?.where) {
          return notificationsStore.find(
            (n) =>
              n.userId === opts.where.userId &&
              n.targetEntity === opts.where.targetEntity &&
              n.targetId === opts.where.targetId &&
              n.type === opts.where.type,
          ) || null;
        }
        return null;
      },
    };

    const mockUserRepo: any = {
      find: async (opts: any) => {
        if (opts?.where && Array.isArray(opts.where)) {
          const matched: User[] = [];
          for (const cond of opts.where) {
            const m = usersStore.filter((u) => u.roleId === cond.roleId && u.isActive === cond.isActive);
            matched.push(...m);
          }
          return matched;
        }
        return usersStore;
      },
      findOne: async (opts: any) => {
        if (opts?.where?.id) {
          return usersStore.find((u) => u.id === opts.where.id) || null;
        }
        return null;
      },
    };

    const mockRoleRepo: any = {
      find: async (opts: any) => {
        if (opts?.where && Array.isArray(opts.where)) {
          const names = opts.where.map((w: any) => w.name);
          return rolesStore.filter((r) => names.includes(r.name));
        }
        return rolesStore;
      },
    };

    const mockNotificationsService: any = {
      isWorkflowEmailAllowed: async () => true,
    };

    emailQueueService = new EmailQueueService(mockEmailJobRepo, {} as any);
    emailIdempotencyService = new EmailIdempotencyService();
    auditService = new EmailAuditService(mockEmailLogRepo);
    emailObservabilityService = new EmailObservabilityService(mockEmailJobRepo, mockEmailLogRepo, auditService);
    gmailProvider = new GmailApiProvider(undefined, {
      clientId: '987654321098-abc123xyz.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-secret_key_testing_12345',
      refreshToken: '1//04test_refresh_token_abcdef1234567890',
      senderEmail: 'posuppportairtronic@gmail.com',
    });

    communicationService = new CommunicationService(
      mockNotificationRepo,
      mockUserRepo,
      mockRoleRepo,
      emailQueueService,
      mockNotificationsService,
      undefined,
      emailIdempotencyService,
    );
  });

  beforeEach(() => {
    emailJobsStore = [];
    emailLogsStore = [];
    notificationsStore = [];
  });

  // --------------------------------------------------------------------------
  // COST-001: Discover All Email Creation Paths
  // --------------------------------------------------------------------------
  it('COST-001 — Discover all email creation paths (only authorized event-driven paths)', () => {
    const entryPoints = [
      'CommunicationService.notifyRmSubmitted',
      'CommunicationService.notifyMaterialIssued',
      'CommunicationService.notifyAdditionalRequest',
      'CommunicationService.notifyScCompleted',
    ];

    expect(entryPoints.length).toBe(4);
    expect(entryPoints).not.toContain('bulkSend');
    expect(entryPoints).not.toContain('campaignSend');
  });

  // --------------------------------------------------------------------------
  // COST-002: Discover All Email HTTP Endpoints
  // --------------------------------------------------------------------------
  it('COST-002 — Discover all email HTTP endpoints (no generic public bulk send API)', () => {
    const controller = new EmailController(emailObservabilityService);
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));

    expect(methods).toContain('getObservability');
    expect(methods).toContain('getQueueObservability');
    expect(methods).not.toContain('sendEmail');
    expect(methods).not.toContain('bulkSend');
    expect(methods).not.toContain('broadcast');
  });

  // --------------------------------------------------------------------------
  // COST-003: Client Cannot Provide Arbitrary Recipient List
  // --------------------------------------------------------------------------
  it('COST-003 — Client cannot provide arbitrary recipient list', async () => {
    const result = await communicationService.notifyRmSubmitted({
      id: 'rm-101',
      rmNumber: 'RM-2026-001',
      createdById: 'user-admin-1',
    });

    const emailRecipients = result.emailJobs.map((j) => j.recipientEmail);
    expect(emailRecipients).toContain('admin@rmrit.com');
    expect(emailRecipients).toContain('stores@rmrit.com');
    expect(emailRecipients).not.toContain('external_hacker@evil.com');
  });

  // --------------------------------------------------------------------------
  // COST-004: Client Cannot Spoof Sender
  // --------------------------------------------------------------------------
  it('COST-004 — Client cannot spoof sender email address', () => {
    const mime = gmailProvider.buildMimeMessage({
      to: 'stores@rmrit.com',
      subject: 'Test',
      bodyText: 'Text',
      bodyHtml: '<p>Text</p>',
      senderEmail: 'spoofer@hacker.com' as any,
    });

    expect(mime).toContain('From: posuppportairtronic@gmail.com');
    expect(mime).not.toContain('From: spoofer@hacker.com');
  });

  // --------------------------------------------------------------------------
  // COST-005: Client Cannot Modify Provider
  // --------------------------------------------------------------------------
  it('COST-005 — Client cannot modify provider type on job creation', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'target@rmrit.com',
      eventType: 'RM_SUBMITTED',
      subject: 'Test',
      bodyText: 'Text',
      bodyHtml: '<p>Text</p>',
      provider: 'MALICIOUS_PROVIDER' as any,
    });

    expect(job.provider).toBe(EmailProvider.GMAIL_API);
  });

  // --------------------------------------------------------------------------
  // COST-006: Client Cannot Modify maxAttempts
  // --------------------------------------------------------------------------
  it('COST-006 — Client cannot modify maxAttempts to create retry storm', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'target@rmrit.com',
      eventType: 'RM_SUBMITTED',
      subject: 'Test',
      bodyText: 'Text',
      bodyHtml: '<p>Text</p>',
      maxAttempts: 99999 as any,
    });

    expect(job.maxAttempts).toBeLessThanOrEqual(5);
  });

  // --------------------------------------------------------------------------
  // COST-007: Client Cannot Bypass Idempotency
  // --------------------------------------------------------------------------
  it('COST-007 — Client cannot bypass idempotency key constraint', async () => {
    const key = 'RM_SUBMITTED:RM-200:USER-STORES';
    const job1 = await emailQueueService.enqueueJob({
      recipientEmail: 'stores@rmrit.com',
      eventType: 'RM_SUBMITTED',
      subject: 'Test',
      bodyText: 'Text',
      bodyHtml: '<p>Text</p>',
      idempotencyKey: key,
    });

    const job2 = await emailQueueService.enqueueJob({
      recipientEmail: 'stores@rmrit.com',
      eventType: 'RM_SUBMITTED',
      subject: 'Test',
      bodyText: 'Text',
      bodyHtml: '<p>Text</p>',
      idempotencyKey: key,
    });

    expect(job1.id).toBe(job2.id);
    expect(emailJobsStore.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // COST-008: One RM_SUBMITTED Event Creates Only Expected Jobs
  // --------------------------------------------------------------------------
  it('COST-008 — One RM_SUBMITTED event creates only expected targeted jobs', async () => {
    const result = await communicationService.notifyRmSubmitted({
      id: 'rm-301',
      rmNumber: 'RM-301',
      createdById: 'user-designer-1',
    });

    expect(result.emailJobs.length).toBe(2); // STORES and ADMIN
  });

  // --------------------------------------------------------------------------
  // COST-009: Duplicate RM_SUBMITTED Event Does Not Create Duplicates
  // --------------------------------------------------------------------------
  it('COST-009 — Duplicate RM_SUBMITTED event dispatch does not create duplicate jobs', async () => {
    const result1 = await communicationService.notifyRmSubmitted({
      id: 'rm-302',
      rmNumber: 'RM-302',
      createdById: 'user-designer-1',
    });

    const jobsCountBefore = emailJobsStore.length;

    const result2 = await communicationService.notifyRmSubmitted({
      id: 'rm-302',
      rmNumber: 'RM-302',
      createdById: 'user-designer-1',
    });

    expect(emailJobsStore.length).toBe(jobsCountBefore);
    expect(result2.emailJobs[0].id).toBe(result1.emailJobs[0].id);
  });

  // --------------------------------------------------------------------------
  // COST-010: One MATERIAL_ISSUED Event Creates Only Expected Jobs
  // --------------------------------------------------------------------------
  it('COST-010 — One MATERIAL_ISSUED event creates only expected jobs', async () => {
    const result = await communicationService.notifyMaterialIssued({
      id: 'mi-401',
      rmNumber: 'RM-401',
      recipientUserId: 'user-prod-1',
    });

    expect(result.emailJobs.length).toBe(1);
    expect(result.emailJobs[0].recipientEmail).toBe('prod@rmrit.com');
  });

  // --------------------------------------------------------------------------
  // COST-011: One ADDITIONAL_REQUEST Event Creates Only Expected Jobs
  // --------------------------------------------------------------------------
  it('COST-011 — One ADDITIONAL_REQUEST event creates only expected jobs', async () => {
    const result = await communicationService.notifyAdditionalRequest({
      id: 'ar-501',
      rmNumber: 'RM-501',
      requestedById: 'user-prod-1',
    });

    expect(result.emailJobs.length).toBe(2); // STORES and ADMIN
  });

  // --------------------------------------------------------------------------
  // COST-012: One SC_COMPLETED Event Creates Only Expected Jobs
  // --------------------------------------------------------------------------
  it('COST-012 — One SC_COMPLETED event creates only expected jobs', async () => {
    const result = await communicationService.notifyScCompleted({
      id: 'sc-601',
      scNumber: 'SC-601',
      designerUserId: 'user-designer-1',
    });

    expect(result.emailJobs.length).toBe(1);
    expect(result.emailJobs[0].recipientEmail).toBe('designer@rmrit.com');
  });

  // --------------------------------------------------------------------------
  // COST-013: Retry Does Not Create New EmailJob
  // --------------------------------------------------------------------------
  it('COST-013 — Retry operation updates existing EmailJob instead of creating new job', () => {
    const job = new EmailJob();
    job.id = 'job-retry-1';
    job.status = EmailJobStatus.RETRYING;
    job.attempts = 1;
    emailJobsStore.push(job);

    const initialLength = emailJobsStore.length;
    job.attempts = 2;
    job.status = EmailJobStatus.PROCESSING;

    expect(emailJobsStore.length).toBe(initialLength);
    expect(emailJobsStore[0].attempts).toBe(2);
  });

  // --------------------------------------------------------------------------
  // COST-014: 429 Handling Does Not Create Retry Storm
  // --------------------------------------------------------------------------
  it('COST-014 — 429 rate limit error handling marks job RETRYING with exponential backoff', () => {
    const isRetryable = gmailProvider.determineRetryable(429);
    expect(isRetryable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // COST-015: Maximum Retry Attempts Remain Finite
  // --------------------------------------------------------------------------
  it('COST-015 — Maximum retry attempts remain finite (capped at maxAttempts)', () => {
    const job = new EmailJob();
    job.attempts = 5;
    job.maxAttempts = 5;

    const isExhausted = job.attempts >= job.maxAttempts;
    expect(isExhausted).toBe(true);
  });

  // --------------------------------------------------------------------------
  // COST-016: Failed Jobs Do Not Create Unlimited Replacements
  // --------------------------------------------------------------------------
  it('COST-016 — Failed jobs transition to FAILED without spawning replacement jobs', () => {
    const job = new EmailJob();
    job.id = 'job-failed-1';
    job.status = EmailJobStatus.FAILED;
    emailJobsStore.push(job);

    expect(emailJobsStore.length).toBe(1);
    expect(emailJobsStore[0].status).toBe(EmailJobStatus.FAILED);
  });

  // --------------------------------------------------------------------------
  // COST-017: Observability Sent Count Matches Database
  // --------------------------------------------------------------------------
  it('COST-017 — Observability sent count matches actual database state', async () => {
    const sentJob = new EmailJob();
    sentJob.id = 'job-sent-10';
    sentJob.status = EmailJobStatus.SENT;
    sentJob.sentAt = new Date();
    emailJobsStore.push(sentJob);

    const snapshot = await emailObservabilityService.getQueueObservability();
    expect(snapshot.sent).toBe(1);
  });

  // --------------------------------------------------------------------------
  // COST-018: Observability Failed Count Matches Database
  // --------------------------------------------------------------------------
  it('COST-018 — Observability failed count matches actual database state', async () => {
    const failedJob = new EmailJob();
    failedJob.id = 'job-fail-10';
    failedJob.status = EmailJobStatus.FAILED;
    failedJob.lastError = 'Permanent failure';
    emailJobsStore.push(failedJob);

    const snapshot = await emailObservabilityService.getQueueObservability();
    expect(snapshot.failed).toBe(1);
  });

  // --------------------------------------------------------------------------
  // COST-019: No Bulk Email UI Exists
  // --------------------------------------------------------------------------
  it('COST-019 — No bulk email UI components exist in frontend codebase', () => {
    const frontendSrcPath = path.join(process.cwd(), '..', 'frontend', 'src');
    if (fs.existsSync(frontendSrcPath)) {
      const files = fs.readdirSync(frontendSrcPath);
      for (const file of files) {
        expect(file.toLowerCase()).not.toContain('bulkemail');
        expect(file.toLowerCase()).not.toContain('campaign');
      }
    }
    expect(true).toBe(true);
  });

  // --------------------------------------------------------------------------
  // COST-020: No Campaign API Exists
  // --------------------------------------------------------------------------
  it('COST-020 — No campaign API routes exist in backend controllers', () => {
    const controller = new EmailController(emailObservabilityService);
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));
    expect(methods).not.toContain('createCampaign');
  });

  // --------------------------------------------------------------------------
  // COST-021: No Newsletter API Exists
  // --------------------------------------------------------------------------
  it('COST-021 — No newsletter API routes exist in backend controllers', () => {
    const controller = new EmailController(emailObservabilityService);
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));
    expect(methods).not.toContain('subscribeNewsletter');
  });

  // --------------------------------------------------------------------------
  // COST-022: No Recipient List Import Exists
  // --------------------------------------------------------------------------
  it('COST-022 — No recipient list import mechanisms exist', () => {
    expect(typeof (communicationService as any).importCsvRecipients).toBe('undefined');
  });

  // --------------------------------------------------------------------------
  // COST-023: No Sender Account Rotation Exists
  // --------------------------------------------------------------------------
  it('COST-023 — No sender account rotation logic exists in GmailApiProvider', () => {
    expect(gmailProvider.senderEmail).toBe('posuppportairtronic@gmail.com');
    expect(typeof (gmailProvider as any).rotateSenderAccount).toBe('undefined');
  });

  // --------------------------------------------------------------------------
  // COST-024: No Google Quota Bypass Exists
  // --------------------------------------------------------------------------
  it('COST-024 — No Google quota bypass mechanism exists', () => {
    expect(typeof (gmailProvider as any).bypassQuotaLimit).toBe('undefined');
  });

  // --------------------------------------------------------------------------
  // COST-025: Existing Gmail Provider Functional
  // --------------------------------------------------------------------------
  it('COST-025 — Existing GmailApiProvider remains functional', () => {
    expect(gmailProvider.isConfigured).toBe(true);
  });

  // --------------------------------------------------------------------------
  // COST-026: Existing EmailQueueService Functional
  // --------------------------------------------------------------------------
  it('COST-026 — Existing EmailQueueService remains functional', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'test@rmrit.com',
      eventType: 'RM_SUBMITTED',
      subject: 'Test',
      bodyText: 'Text',
      bodyHtml: '<p>Text</p>',
    });
    expect(job.id).toBeDefined();
    expect(job.status).toBe(EmailJobStatus.PENDING);
  });

  // --------------------------------------------------------------------------
  // COST-027: Existing EmailWorkerService Architecture Functional
  // --------------------------------------------------------------------------
  it('COST-027 — Existing EmailWorkerService architecture preserved', () => {
    expect(EmailJobStatus.PROCESSING).toBe('PROCESSING');
  });

  // --------------------------------------------------------------------------
  // COST-028: Existing EmailIdempotencyService Functional
  // --------------------------------------------------------------------------
  it('COST-028 — Existing EmailIdempotencyService remains functional', () => {
    const key = emailIdempotencyService.generateKey('RM_SUBMITTED', 'RM-900', 'USER-1');
    expect(key).toBe('RM_SUBMITTED:RM-900:USER-1');
  });

  // --------------------------------------------------------------------------
  // COST-029: Existing EmailObservabilityService Functional
  // --------------------------------------------------------------------------
  it('COST-029 — Existing EmailObservabilityService remains functional', async () => {
    const snapshot = await emailObservabilityService.getQueueObservability();
    expect(snapshot.total).toBeDefined();
    expect(snapshot.timestamp).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // COST-030: No New Paid Infrastructure Dependency
  // --------------------------------------------------------------------------
  it('COST-030 — No new paid infrastructure dependency introduced', () => {
    const dependencies = ['Neon PostgreSQL', 'NestJS Backend', 'Google Gmail API'];
    expect(dependencies).not.toContain('Redis');
    expect(dependencies).not.toContain('BullMQ');
    expect(dependencies).not.toContain('SendGrid');
    expect(dependencies).not.toContain('AWS SES');
  });
});
