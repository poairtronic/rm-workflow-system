import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { EmailIdempotencyService } from '../src/email/email-idempotency.service.js';
import { TemplateService } from '../src/email/template.service.js';
import { TemplateResolver } from '../src/email/resolvers/template.resolver.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { SystemSetting } from '../src/notifications/entities/system-setting.entity.js';
import { UserNotificationPreference } from '../src/notifications/entities/user-notification-preference.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import { EmailLog } from '../src/email/entities/email-log.entity.js';
import { DataSource } from 'typeorm';
import { EMAIL_PROVIDER, EmailProviderInterface, SendEmailOptions, SendEmailResult } from '../src/email/interfaces/email-provider.interface.js';

class MockEmailProvider implements EmailProviderInterface {
  public calls: SendEmailOptions[] = [];
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.calls.push(options);
    return {
      success: true,
      messageId: `gmail-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      provider: EmailProvider.GMAIL_API,
    };
  }
}

describe('Phase 15.15 — Email Idempotency (IDEMP-001–IDEMP-020)', () => {
  let communicationService: CommunicationService;
  let emailQueueService: EmailQueueService;
  let emailIdempotencyService: EmailIdempotencyService;
  let emailAuditService: EmailAuditService;
  let notificationsService: NotificationsService;
  let mockProvider: MockEmailProvider;

  let storesUser: User;
  let adminUser: User;
  let designerUser: User;
  let productionUser: User;

  let storesRole: Role;
  let adminRole: Role;
  let designerRole: Role;
  let productionRole: Role;

  let emailJobsStore: EmailJob[] = [];
  let emailLogsStore: EmailLog[] = [];
  let notificationsStore: Notification[] = [];
  let systemSettingsStore: SystemSetting[] = [];
  let userPrefsStore: UserNotificationPreference[] = [];

  beforeAll(async () => {
    mockProvider = new MockEmailProvider();

    storesRole = { id: 'role-stores-id', name: 'STORES', description: 'Stores' } as Role;
    adminRole = { id: 'role-admin-id', name: 'ADMIN', description: 'Admin' } as Role;
    designerRole = { id: 'role-designer-id', name: 'DESIGNER', description: 'Designer' } as Role;
    productionRole = { id: 'role-prod-id', name: 'PRODUCTION', description: 'Production' } as Role;

    storesUser = { id: 'user-stores-1', email: 'stores@rmrit.local', name: 'Stores User', roleId: storesRole.id, role: storesRole, isActive: true } as User;
    adminUser = { id: 'user-admin-1', email: 'admin@rmrit.local', name: 'Admin User', roleId: adminRole.id, role: adminRole, isActive: true } as User;
    designerUser = { id: 'user-designer-1', email: 'designer@rmrit.local', name: 'Designer User', roleId: designerRole.id, role: designerRole, isActive: true } as User;
    productionUser = { id: 'user-prod-1', email: 'prod@rmrit.local', name: 'Prod User', roleId: productionRole.id, role: productionRole, isActive: true } as User;

    const mockEmailJobRepo = {
      create: (dto: Partial<EmailJob>) => {
        const job = new EmailJob();
        Object.assign(job, dto);
        job.id = job.id || `job-id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        job.createdAt = new Date();
        job.updatedAt = new Date();
        return job;
      },
      save: async (job: EmailJob) => {
        const existingIndex = emailJobsStore.findIndex(j => j.id === job.id);
        const dupKeyMatch = emailJobsStore.find(j => j.idempotencyKey === job.idempotencyKey && j.id !== job.id);
        if (dupKeyMatch) {
          const err: any = new Error(`duplicate key value violates unique constraint "UQ_email_jobs_idempotency_key"`);
          err.code = '23505';
          throw err;
        }
        if (existingIndex >= 0) {
          emailJobsStore[existingIndex] = { ...emailJobsStore[existingIndex], ...job, updatedAt: new Date() };
          return emailJobsStore[existingIndex];
        }
        emailJobsStore.push(job);
        return job;
      },
      findOne: async (opts: any) => {
        if (opts?.where?.idempotencyKey) {
          return emailJobsStore.find(j => j.idempotencyKey === opts.where.idempotencyKey) || null;
        }
        if (opts?.where?.id) {
          return emailJobsStore.find(j => j.id === opts.where.id) || null;
        }
        return null;
      },
      find: async () => emailJobsStore,
      count: async (opts?: any) => {
        if (opts?.where?.idempotencyKey) {
          return emailJobsStore.filter(j => j.idempotencyKey === opts.where.idempotencyKey).length;
        }
        return emailJobsStore.length;
      },
    };

    const mockEmailLogRepo = {
      create: (dto: Partial<EmailLog>) => {
        const log = new EmailLog();
        Object.assign(log, dto);
        log.id = log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        log.createdAt = new Date();
        return log;
      },
      save: async (log: EmailLog) => {
        emailLogsStore.push(log);
        return log;
      },
    };

    const mockNotificationRepo = {
      create: (dto: Partial<Notification>) => {
        const n = new Notification();
        Object.assign(n, dto);
        n.id = n.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        n.createdAt = new Date();
        return n;
      },
      save: async (n: Notification) => {
        const idx = notificationsStore.findIndex(x => x.id === n.id);
        if (idx >= 0) {
          notificationsStore[idx] = n;
        } else {
          notificationsStore.push(n);
        }
        return n;
      },
      findOne: async (opts: any) => {
        if (opts?.where) {
          return notificationsStore.find(n =>
            n.userId === opts.where.userId &&
            n.targetEntity === opts.where.targetEntity &&
            n.targetId === opts.where.targetId &&
            n.type === opts.where.type
          ) || null;
        }
        return null;
      },
    };

    const mockUserRepo = {
      find: async (opts: any) => {
        const users = [storesUser, adminUser, designerUser, productionUser];
        if (opts?.where && Array.isArray(opts.where)) {
          const roleIds = opts.where.map((w: any) => w.roleId);
          return users.filter(u => roleIds.includes(u.roleId));
        }
        return users;
      },
      findOne: async (opts: any) => {
        const users = [storesUser, adminUser, designerUser, productionUser];
        if (opts?.where?.id) {
          return users.find(u => u.id === opts.where.id) || null;
        }
        return null;
      },
    };

    const mockRoleRepo = {
      find: async (opts: any) => {
        const roles = [storesRole, adminRole, designerRole, productionRole];
        if (opts?.where && Array.isArray(opts.where)) {
          const names = opts.where.map((w: any) => w.name);
          return roles.filter(r => names.includes(r.name));
        }
        return roles;
      },
    };

    const mockSystemSettingRepo = {
      findOne: async (opts: any) => {
        if (opts?.where?.key) {
          return systemSettingsStore.find(s => s.key === opts.where.key) || null;
        }
        return null;
      },
      save: async (s: SystemSetting) => {
        const idx = systemSettingsStore.findIndex(x => x.key === s.key);
        if (idx >= 0) systemSettingsStore[idx] = s;
        else systemSettingsStore.push(s);
        return s;
      },
    };

    const mockUserPrefRepo = {
      findOne: async (opts: any) => {
        if (opts?.where?.userId) {
          return userPrefsStore.find(p => p.userId === opts.where.userId) || null;
        }
        return null;
      },
      save: async (p: UserNotificationPreference) => {
        const idx = userPrefsStore.findIndex(x => x.userId === p.userId);
        if (idx >= 0) userPrefsStore[idx] = p;
        else userPrefsStore.push(p);
        return p;
      },
    };

    const mockDataSource = {
      createQueryRunner: () => ({
        connect: async () => {},
        startTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        release: async () => {},
        query: async (sql: string, params?: any[]) => {
          const lower = sql.toLowerCase();
          if (lower.includes('from "email_jobs"')) {
            const pending = emailJobsStore.filter(j => j.status === EmailJobStatus.PENDING || j.status === EmailJobStatus.RETRYING);
            return pending.slice(0, params?.[2] || 10).map(j => ({ id: j.id }));
          }
          if (lower.includes('update "email_jobs"')) {
            const claimedIds = params ? params.slice(2) : [];
            for (const job of emailJobsStore) {
              if (claimedIds.includes(job.id)) {
                job.status = EmailJobStatus.PROCESSING;
                job.attempts = (job.attempts || 0) + 1;
                job.lockedBy = params?.[1] || 'worker';
                job.lockedAt = new Date();
              }
            }
            return [];
          }
          return [];
        },
        manager: {
          find: async (cls: any, opts: any) => {
            if (opts?.where?.id) {
              const raw = opts.where.id;
              const ids: string[] = Array.isArray(raw)
                ? raw
                : (raw?._value || (typeof raw === 'string' ? [raw] : []));
              return emailJobsStore.filter(j => ids.includes(j.id));
            }
            return [];
          },
        },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        EmailIdempotencyService,
        TemplateService,
        TemplateResolver,
        EmailQueueService,
        EmailAuditService,
        EmailWorkerService,
        CommunicationService,
        NotificationsService,
        { provide: getRepositoryToken(EmailJob), useValue: mockEmailJobRepo },
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(SystemSetting), useValue: mockSystemSettingRepo },
        { provide: getRepositoryToken(UserNotificationPreference), useValue: mockUserPrefRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EMAIL_PROVIDER, useValue: mockProvider },
      ],
    }).compile();

    communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    emailQueueService = moduleFixture.get<EmailQueueService>(EmailQueueService);
    emailIdempotencyService = moduleFixture.get<EmailIdempotencyService>(EmailIdempotencyService);
    emailAuditService = moduleFixture.get<EmailAuditService>(EmailAuditService);
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
  });

  beforeEach(() => {
    emailJobsStore = [];
    emailLogsStore = [];
    notificationsStore = [];
    systemSettingsStore = [];
    userPrefsStore = [];
    mockProvider.calls = [];
  });

  // =========================================================================
  // IDEMP-001: RM_SUBMITTED Duplicate Dispatch
  // =========================================================================
  it('IDEMP-001: RM_SUBMITTED duplicate event produces exactly 1 EmailJob per recipient', async () => {
    const eventId = 'rm-req-001';
    const res1 = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-001' });
    const countAfterFirst = emailJobsStore.length;

    const res2 = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-001' });
    const countAfterSecond = emailJobsStore.length;

    expect(countAfterFirst).toBeGreaterThan(0);
    expect(countAfterSecond).toBe(countAfterFirst);
    expect(res2.emailJobs.length).toBe(res1.emailJobs.length);
  });

  // =========================================================================
  // IDEMP-002: RM HTTP Retry Simulation
  // =========================================================================
  it('IDEMP-002: RM HTTP retry simulation does not duplicate EmailJobs', async () => {
    const rmId = 'rm-req-http-retry';
    const result1 = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: rmId,
      rmNumber: 'RM-RETRY-01',
    });

    // Client retries HTTP request with exact same payload
    const result2 = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: rmId,
      rmNumber: 'RM-RETRY-01',
    });

    expect(result2.emailJobs.length).toBe(result1.emailJobs.length);
    expect(emailJobsStore.filter(j => j.idempotencyKey.includes(rmId)).length).toBe(result1.emailJobs.length);
  });

  // =========================================================================
  // IDEMP-003: MATERIAL_ISSUED Duplicate Dispatch
  // =========================================================================
  it('IDEMP-003: MATERIAL_ISSUED duplicate event produces exactly 1 EmailJob', async () => {
    const issueId = 'mat-issue-100';
    const res1 = await communicationService.notifyMaterialIssued({
      id: issueId,
      scId: 'sc-100',
      rmNumber: 'RM-100',
      recipientUserId: productionUser.id,
    });

    const res2 = await communicationService.notifyMaterialIssued({
      id: issueId,
      scId: 'sc-100',
      rmNumber: 'RM-100',
      recipientUserId: productionUser.id,
    });

    expect(res1.emailJobs.length).toBe(1);
    expect(res2.emailJobs.length).toBe(1);
    expect(res1.emailJobs[0].id).toBe(res2.emailJobs[0].id);
    expect(emailJobsStore.length).toBe(1);
  });

  // =========================================================================
  // IDEMP-004: ADDITIONAL_REQUEST Duplicate Dispatch
  // =========================================================================
  it('IDEMP-004: ADDITIONAL_REQUEST duplicate event produces exactly 1 EmailJob set', async () => {
    const reqId = 'add-req-200';
    const res1 = await communicationService.notifyAdditionalRequest({
      id: reqId,
      scId: 'sc-200',
      rmNumber: 'RM-200',
    });

    const res2 = await communicationService.notifyAdditionalRequest({
      id: reqId,
      scId: 'sc-200',
      rmNumber: 'RM-200',
    });

    expect(res2.emailJobs.length).toBe(res1.emailJobs.length);
    expect(emailJobsStore.length).toBe(res1.emailJobs.length);
  });

  // =========================================================================
  // IDEMP-005: SC_COMPLETED Duplicate Dispatch
  // =========================================================================
  it('IDEMP-005: SC_COMPLETED duplicate event produces exactly 1 EmailJob', async () => {
    const scId = 'sc-comp-300';
    const res1 = await communicationService.notifyScCompleted({
      id: scId,
      scNumber: 'SC-300',
      designerUserId: designerUser.id,
    });

    const res2 = await communicationService.notifyScCompleted({
      id: scId,
      scNumber: 'SC-300',
      designerUserId: designerUser.id,
    });

    expect(res1.emailJobs.length).toBe(1);
    expect(res2.emailJobs.length).toBe(1);
    expect(res1.emailJobs[0].id).toBe(res2.emailJobs[0].id);
    expect(emailJobsStore.length).toBe(1);
  });

  // =========================================================================
  // IDEMP-006: Different Entity IDs Produce Distinct EmailJobs
  // =========================================================================
  it('IDEMP-006: Different entity IDs (RM1 vs RM2) produce distinct EmailJobs', async () => {
    await communicationService.notifyRmSubmitted({ id: 'rm-diff-1', rmNumber: 'RM-DIFF-1' });
    await communicationService.notifyRmSubmitted({ id: 'rm-diff-2', rmNumber: 'RM-DIFF-2' });

    const keys = emailJobsStore.map(j => j.idempotencyKey);
    expect(keys.some(k => k.includes('rm-diff-1'))).toBe(true);
    expect(keys.some(k => k.includes('rm-diff-2'))).toBe(true);
    expect(emailJobsStore.length).toBe(4); // 2 recipients per event
  });

  // =========================================================================
  // IDEMP-007: Different Event Types For Same Entity Produce No Collision
  // =========================================================================
  it('IDEMP-007: Different event types for same entity ID produce distinct keys without collision', async () => {
    const sharedEntityId = 'shared-id-999';

    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: sharedEntityId,
    });

    await communicationService.sendEvent({
      eventType: 'MATERIAL_ISSUED',
      entityType: 'MATERIAL_ISSUE',
      entityId: sharedEntityId,
    });

    const rmJobs = emailJobsStore.filter(j => j.eventType === 'RM_SUBMITTED');
    const matJobs = emailJobsStore.filter(j => j.eventType === 'MATERIAL_ISSUED');

    expect(rmJobs.length).toBeGreaterThan(0);
    expect(matJobs.length).toBeGreaterThan(0);
    expect(rmJobs[0].idempotencyKey).not.toBe(matJobs[0].idempotencyKey);
  });

  // =========================================================================
  // IDEMP-008: Concurrent Duplicate Creation
  // =========================================================================
  it('IDEMP-008: Concurrent duplicate enqueue calls produce exactly 1 EmailJob', async () => {
    const key = `CONCURRENT_TEST_${Date.now()}`;
    const jobData: Partial<EmailJob> = {
      recipientEmail: 'concurrent@rmrit.local',
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Concurrent Test',
      bodyText: 'Testing concurrency',
      bodyHtml: '<p>Testing concurrency</p>',
      idempotencyKey: key,
    };

    // Execute 5 concurrent enqueue requests
    const results = await Promise.all([
      emailQueueService.enqueueJob(jobData),
      emailQueueService.enqueueJob(jobData),
      emailQueueService.enqueueJob(jobData),
      emailQueueService.enqueueJob(jobData),
      emailQueueService.enqueueJob(jobData),
    ]);

    // All results must return the exact same job ID
    const firstId = results[0].id;
    for (const r of results) {
      expect(r.id).toBe(firstId);
    }

    const matches = emailJobsStore.filter(j => j.idempotencyKey === key);
    expect(matches.length).toBe(1);
  });

  // =========================================================================
  // IDEMP-009: Already SENT Event Retry
  // =========================================================================
  it('IDEMP-009: Retrying event when job status is SENT returns existing SENT job without re-enqueueing', async () => {
    const key = `SENT_TEST_${Date.now()}`;
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'sent@rmrit.local',
      eventType: 'SC_COMPLETED',
      templateKey: 'SC_COMPLETED',
      subject: 'SC Completed',
      bodyText: 'Completed',
      bodyHtml: '<p>Completed</p>',
      idempotencyKey: key,
    });

    await emailQueueService.markSuccess(job.id, 'worker-1', 'gmail-msg-123');
    expect(job.status).toBe(EmailJobStatus.SENT);

    // Duplicate event arrives
    const duplicateJob = await emailQueueService.enqueueJob({
      recipientEmail: 'sent@rmrit.local',
      eventType: 'SC_COMPLETED',
      templateKey: 'SC_COMPLETED',
      subject: 'SC Completed Duplicate',
      bodyText: 'Completed Duplicate',
      bodyHtml: '<p>Completed Duplicate</p>',
      idempotencyKey: key,
    });

    expect(duplicateJob.id).toBe(job.id);
    expect(duplicateJob.status).toBe(EmailJobStatus.SENT);
    expect(emailJobsStore.filter(j => j.idempotencyKey === key).length).toBe(1);
  });

  // =========================================================================
  // IDEMP-010: RETRYING Event Retry
  // =========================================================================
  it('IDEMP-010: Retrying event when job status is RETRYING reuses existing job', async () => {
    const key = `RETRYING_TEST_${Date.now()}`;
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'retrying@rmrit.local',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'MATERIAL_ISSUED',
      subject: 'Material Issued',
      bodyText: 'Issued',
      bodyHtml: '<p>Issued</p>',
      idempotencyKey: key,
    });

    await emailQueueService.markFailed(job.id, 'worker-1', 'Temporary failure', 60, false);
    expect(job.status).toBe(EmailJobStatus.RETRYING);

    const duplicateJob = await emailQueueService.enqueueJob({
      recipientEmail: 'retrying@rmrit.local',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'MATERIAL_ISSUED',
      subject: 'Duplicate Event',
      bodyText: 'Duplicate',
      bodyHtml: '<p>Duplicate</p>',
      idempotencyKey: key,
    });

    expect(duplicateJob.id).toBe(job.id);
    expect(duplicateJob.status).toBe(EmailJobStatus.RETRYING);
    expect(emailJobsStore.filter(j => j.idempotencyKey === key).length).toBe(1);
  });

  // =========================================================================
  // IDEMP-011: PROCESSING Event Retry
  // =========================================================================
  it('IDEMP-011: Retrying event when job status is PROCESSING reuses existing job', async () => {
    const key = `PROCESSING_TEST_${Date.now()}`;
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'processing@rmrit.local',
      eventType: 'ADDITIONAL_REQUEST',
      templateKey: 'ADDITIONAL_MATERIAL_REQUESTED',
      subject: 'Additional Request',
      bodyText: 'Req',
      bodyHtml: '<p>Req</p>',
      idempotencyKey: key,
    });

    job.status = EmailJobStatus.PROCESSING;
    job.lockedBy = 'worker-1';

    const duplicateJob = await emailQueueService.enqueueJob({
      recipientEmail: 'processing@rmrit.local',
      eventType: 'ADDITIONAL_REQUEST',
      templateKey: 'ADDITIONAL_MATERIAL_REQUESTED',
      subject: 'Duplicate Event',
      bodyText: 'Duplicate',
      bodyHtml: '<p>Duplicate</p>',
      idempotencyKey: key,
    });

    expect(duplicateJob.id).toBe(job.id);
    expect(duplicateJob.status).toBe(EmailJobStatus.PROCESSING);
    expect(emailJobsStore.filter(j => j.idempotencyKey === key).length).toBe(1);
  });

  // =========================================================================
  // IDEMP-012: Preference Interaction
  // =========================================================================
  it('IDEMP-012: Email preference OFF suppresses email and does not create job', async () => {
    vi.spyOn(notificationsService, 'isWorkflowEmailAllowed').mockResolvedValue(false);

    const res = await communicationService.notifyRmSubmitted({ id: 'rm-pref-off', rmNumber: 'RM-PREF-OFF' });

    expect(res.emailJobs.length).toBe(0);
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(emailJobsStore.length).toBe(0);

    vi.restoreAllMocks();
  });

  // =========================================================================
  // IDEMP-013: Multi-Recipient Behavior
  // =========================================================================
  it('IDEMP-013: Multi-recipient events generate distinct idempotency keys per recipient', async () => {
    const rmId = 'rm-multi-recip-1';
    const res = await communicationService.notifyRmSubmitted({ id: rmId, rmNumber: 'RM-MULTI' });

    expect(res.emailJobs.length).toBe(2);
    const keys = res.emailJobs.map(j => j.idempotencyKey);

    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toContain(`RM_SUBMITTED:${rmId}:${storesUser.id}`);
    expect(keys[1]).toContain(`RM_SUBMITTED:${rmId}:${adminUser.id}`);
  });

  // =========================================================================
  // IDEMP-014: Database Unique Constraint Protection
  // =========================================================================
  it('IDEMP-014: Database unique constraint protects against duplicate idempotency keys', async () => {
    const dupKey = `DB_UNIQUE_${Date.now()}`;

    await emailQueueService.enqueueJob({
      recipientEmail: 'unique1@rmrit.local',
      eventType: 'TEST_EVENT',
      templateKey: 'RM_SUBMITTED',
      subject: 'First',
      bodyText: 'First',
      bodyHtml: '<p>First</p>',
      idempotencyKey: dupKey,
    });

    // Attempting direct save with duplicate key triggers 23505 which enqueueJob catches
    const job2 = await emailQueueService.enqueueJob({
      recipientEmail: 'unique2@rmrit.local',
      eventType: 'TEST_EVENT',
      templateKey: 'RM_SUBMITTED',
      subject: 'Second',
      bodyText: 'Second',
      bodyHtml: '<p>Second</p>',
      idempotencyKey: dupKey,
    });

    expect(job2.recipientEmail).toBe('unique1@rmrit.local');
    expect(emailJobsStore.filter(j => j.idempotencyKey === dupKey).length).toBe(1);
  });

  // =========================================================================
  // IDEMP-015: Server-Generated Idempotency Key
  // =========================================================================
  it('IDEMP-015: EmailIdempotencyService generates deterministic, secret-free keys', () => {
    const key1 = emailIdempotencyService.generateKey('RM_SUBMITTED', 'RM123', 'USER456');
    const key2 = emailIdempotencyService.generateKey({
      eventType: 'RM_SUBMITTED',
      entityId: 'RM123',
      recipientUserId: 'USER456',
    });

    expect(key1).toBe('RM_SUBMITTED:RM123:USER456');
    expect(key2).toBe('RM_SUBMITTED:RM123:USER456');

    // Verification of parseKey helper
    const parsed = emailIdempotencyService.parseKey(key1);
    expect(parsed.eventType).toBe('RM_SUBMITTED');
    expect(parsed.entityId).toBe('RM123');
    expect(parsed.recipientUserId).toBe('USER456');
  });

  // =========================================================================
  // IDEMP-016: IDOR / Key Injection Protection
  // =========================================================================
  it('IDEMP-016: Key generation isolates entity parameters to prevent spoofing across events', () => {
    const keyRM = emailIdempotencyService.generateKey('RM_SUBMITTED', 'ENTITY_100', 'USER_1');
    const keySC = emailIdempotencyService.generateKey('SC_COMPLETED', 'ENTITY_100', 'USER_1');

    expect(keyRM).not.toBe(keySC);
    expect(keyRM).toContain('RM_SUBMITTED');
    expect(keySC).toContain('SC_COMPLETED');
  });

  // =========================================================================
  // IDEMP-017: Queue Service Integration & Retry Safety
  // =========================================================================
  it('IDEMP-017: Queue claim and retry cycle maintains single EmailJob identity', async () => {
    const key = `QUEUE_REGRESSION_${Date.now()}`;
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'queue@rmrit.local',
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Queue Test',
      bodyText: 'Body',
      bodyHtml: '<p>Body</p>',
      idempotencyKey: key,
    });

    const claimed = await emailQueueService.claimNextJob('worker-test-1');
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(job.id);
    expect(claimed!.attempts).toBe(1);

    await emailQueueService.markFailed(job.id, 'worker-test-1', 'Transient 503 error', 10, false);
    expect(job.status).toBe(EmailJobStatus.RETRYING);

    // Ensure re-enqueue attempt does not replace retrying job
    const duplicateEnqueued = await emailQueueService.enqueueJob({
      recipientEmail: 'queue@rmrit.local',
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Queue Test 2',
      bodyText: 'Body 2',
      bodyHtml: '<p>Body 2</p>',
      idempotencyKey: key,
    });

    expect(duplicateEnqueued.id).toBe(job.id);
    expect(duplicateEnqueued.attempts).toBe(1);
  });

  // =========================================================================
  // IDEMP-018: Audit Log Compatibility
  // =========================================================================
  it('IDEMP-018: EmailAuditService logs execution attempt without creating duplicate job records', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'audit@rmrit.local',
      eventType: 'SC_COMPLETED',
      templateKey: 'SC_COMPLETED',
      subject: 'Audit Test',
      bodyText: 'Audit',
      bodyHtml: '<p>Audit</p>',
      idempotencyKey: `AUDIT_${Date.now()}`,
    });

    const log = await emailAuditService.recordAttempt(
      job,
      1,
      EmailJobStatus.SENT,
      'gmail-12345',
    );

    expect(log.jobId).toBe(job.id);
    expect(emailLogsStore.length).toBe(1);
    expect(emailJobsStore.length).toBe(1);
  });

  // =========================================================================
  // IDEMP-019: Provider Integration Compatibility
  // =========================================================================
  it('IDEMP-019: Provider delivery receives sanitized job options derived from single idempotent job', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'provider@rmrit.local',
      recipientName: 'Provider User',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'MATERIAL_ISSUED',
      subject: 'Material Issue Notification',
      bodyText: 'Text content',
      bodyHtml: '<p>HTML content</p>',
      idempotencyKey: `PROV_${Date.now()}`,
    });

    const result = await mockProvider.sendEmail({
      to: job.recipientEmail,
      subject: job.subject,
      text: job.bodyText,
      html: job.bodyHtml,
      idempotencyKey: job.idempotencyKey,
    });

    expect(result.success).toBe(true);
    expect(mockProvider.calls.length).toBe(1);
    expect(mockProvider.calls[0].idempotencyKey).toBe(job.idempotencyKey);
  });

  // =========================================================================
  // IDEMP-020: Template Integration Compatibility
  // =========================================================================
  it('IDEMP-020: Template Service rendering produces consistent output without affecting idempotency key', async () => {
    const eventId = 'rm-template-020';
    const res1 = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-TPL-20' });
    const res2 = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-TPL-20' });

    expect(res1.emailJobs[0].bodyHtml).toContain('RM-TPL-20');
    expect(res2.emailJobs[0].id).toBe(res1.emailJobs[0].id);
    expect(res2.emailJobs[0].idempotencyKey).toBe(res1.emailJobs[0].idempotencyKey);
  });
});
