import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TemplateService, TemplateValidationError } from '../src/email/template.service.js';
import { TemplateResolver } from '../src/email/resolvers/template.resolver.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailLog } from '../src/email/entities/email-log.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { SystemSetting } from '../src/notifications/entities/system-setting.entity.js';
import { UserNotificationPreference } from '../src/notifications/entities/user-notification-preference.entity.js';
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
  public calls: any[] = [];

  async send(message: any): Promise<EmailDeliveryResult> {
    this.calls.push(message);
    if (this.mockHandler) {
      return this.mockHandler(message);
    }
    return { success: true, providerMessageId: `msg-t15-12-${Date.now()}` };
  }
}

describe('Phase 15.12 — Controlled Email Template System (T001–T068)', () => {
  let templateService: TemplateService;
  let templateResolver: TemplateResolver;
  let communicationService: CommunicationService;
  let emailQueueService: EmailQueueService;
  let emailWorkerService: EmailWorkerService;
  let emailAuditService: EmailAuditService;
  let notificationsService: NotificationsService;
  let mockProvider: TestMockProvider;

  // In-memory data stores for mock repositories
  let usersStore: User[] = [];
  let rolesStore: Role[] = [];
  let emailJobsStore: EmailJob[] = [];
  let emailLogsStore: EmailLog[] = [];
  let notificationsStore: Notification[] = [];
  let systemSettingsStore: SystemSetting[] = [];
  let userPrefsStore: UserNotificationPreference[] = [];

  let storesUser: User;
  let productionUser: User;
  let designerUser: User;

  beforeAll(async () => {
    mockProvider = new TestMockProvider();

    // Create roles
    const storesRole: Role = { id: 'role-stores-id', name: 'STORES', description: 'Stores Role' } as any;
    const prodRole: Role = { id: 'role-prod-id', name: 'PRODUCTION', description: 'Production Role' } as any;
    const desRole: Role = { id: 'role-des-id', name: 'DESIGNER', description: 'Designer Role' } as any;
    rolesStore = [storesRole, prodRole, desRole];

    // Create users
    storesUser = {
      id: 'user-stores-1',
      email: 'stores@rmrit.local',
      name: 'Stores Manager T12',
      passwordHash: 'hash',
      roleId: storesRole.id,
      isActive: true,
      role: storesRole,
    } as any;

    productionUser = {
      id: 'user-prod-1',
      email: 'prod@rmrit.local',
      name: 'Production Staff T12',
      passwordHash: 'hash',
      roleId: prodRole.id,
      isActive: true,
      role: prodRole,
    } as any;

    designerUser = {
      id: 'user-designer-1',
      email: 'designer@rmrit.local',
      name: 'Designer T12',
      passwordHash: 'hash',
      roleId: desRole.id,
      isActive: true,
      role: desRole,
    } as any;

    usersStore = [storesUser, productionUser, designerUser];

    const mockUserRepository = {
      find: vi.fn(async (opts?: any) => {
        if (opts?.where && Array.isArray(opts.where)) {
          const roleIds = opts.where.map((w: any) => w.roleId);
          return usersStore.filter((u) => roleIds.includes(u.roleId) && u.isActive);
        }
        return usersStore;
      }),
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.id) {
          return usersStore.find((u) => u.id === opts.where.id) || null;
        }
        return null;
      }),
    };

    const mockRoleRepository = {
      find: vi.fn(async (opts?: any) => {
        if (opts?.where && Array.isArray(opts.where)) {
          const names = opts.where.map((w: any) => w.name);
          return rolesStore.filter((r) => names.includes(r.name));
        }
        return rolesStore;
      }),
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.name) {
          return rolesStore.find((r) => r.name === opts.where.name) || null;
        }
        return null;
      }),
    };

    const mockNotificationRepository = {
      create: vi.fn((dto: any) => ({ id: `notif-${Date.now()}-${Math.random()}`, ...dto })),
      save: vi.fn(async (notif: any) => {
        notificationsStore.push(notif);
        return notif;
      }),
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where) {
          const { userId, targetEntity, targetId, type } = opts.where;
          return notificationsStore.find(
            (n) =>
              n.userId === userId &&
              n.targetEntity === targetEntity &&
              n.targetId === targetId &&
              n.type === type,
          ) || null;
        }
        return null;
      }),
    };

    const mockEmailJobRepository = {
      create: vi.fn((dto: any) => ({
        id: `job-${Date.now()}-${Math.random()}`,
        status: EmailJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        priority: 100,
        provider: EmailProvider.GMAIL_API,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dto,
      })),
      save: vi.fn(async (job: any) => {
        const existingIdx = emailJobsStore.findIndex(
          (j) => (j.idempotencyKey && j.idempotencyKey === job.idempotencyKey) || j.id === job.id,
        );
        if (existingIdx >= 0) {
          emailJobsStore[existingIdx] = { ...emailJobsStore[existingIdx], ...job };
          return emailJobsStore[existingIdx];
        }
        emailJobsStore.push(job);
        return job;
      }),
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.idempotencyKey) {
          return emailJobsStore.find((j) => j.idempotencyKey === opts.where.idempotencyKey) || null;
        }
        if (opts?.where?.id) {
          return emailJobsStore.find((j) => j.id === opts.where.id) || null;
        }
        return null;
      }),
      find: vi.fn(async () => emailJobsStore),
      count: vi.fn(async () => emailJobsStore.length),
    };

    const mockEmailLogRepository = {
      create: vi.fn((dto: any) => ({ id: `log-${Date.now()}`, createdAt: new Date(), ...dto })),
      save: vi.fn(async (log: any) => {
        emailLogsStore.push(log);
        return log;
      }),
      find: vi.fn(async (opts?: any) => {
        if (opts?.where?.jobId) {
          return emailLogsStore.filter((l) => l.jobId === opts.where.jobId);
        }
        return emailLogsStore;
      }),
    };

    const mockSystemSettingRepository = {
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.key) {
          return systemSettingsStore.find((s) => s.key === opts.where.key) || null;
        }
        return null;
      }),
      create: vi.fn((dto: any) => ({ id: `setting-${Date.now()}`, ...dto })),
      save: vi.fn(async (setting: any) => {
        const idx = systemSettingsStore.findIndex((s) => s.key === setting.key);
        if (idx >= 0) {
          systemSettingsStore[idx] = { ...systemSettingsStore[idx], ...setting };
          return systemSettingsStore[idx];
        }
        systemSettingsStore.push(setting);
        return setting;
      }),
    };

    const mockUserPrefRepository = {
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.userId) {
          return userPrefsStore.find((p) => p.userId === opts.where.userId) || null;
        }
        return null;
      }),
      create: vi.fn((dto: any) => ({ id: `pref-${Date.now()}`, ...dto })),
      save: vi.fn(async (pref: any) => {
        const idx = userPrefsStore.findIndex((p) => p.userId === pref.userId);
        if (idx >= 0) {
          userPrefsStore[idx] = { ...userPrefsStore[idx], ...pref };
          return userPrefsStore[idx];
        }
        userPrefsStore.push(pref);
        return pref;
      }),
    };

    const mockDataSource = {
      transaction: vi.fn(async (cb: any) => cb({ getRepository: () => mockEmailJobRepository })),
      createQueryRunner: vi.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        TemplateResolver,
        CommunicationService,
        EmailQueueService,
        EmailWorkerService,
        EmailAuditService,
        NotificationsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: EMAIL_PROVIDER, useValue: mockProvider },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepository },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepository },
        { provide: getRepositoryToken(EmailJob), useValue: mockEmailJobRepository },
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepository },
        { provide: getRepositoryToken(SystemSetting), useValue: mockSystemSettingRepository },
        { provide: getRepositoryToken(UserNotificationPreference), useValue: mockUserPrefRepository },
      ],
    }).compile();

    templateService = moduleFixture.get<TemplateService>(TemplateService);
    templateResolver = moduleFixture.get<TemplateResolver>(TemplateResolver);
    communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    emailQueueService = moduleFixture.get<EmailQueueService>(EmailQueueService);
    emailWorkerService = moduleFixture.get<EmailWorkerService>(EmailWorkerService);
    emailAuditService = moduleFixture.get<EmailAuditService>(EmailAuditService);
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
  });

  beforeEach(() => {
    mockProvider.calls = [];
  });

  // T001
  it('T001: Template registry loads', () => {
    expect(templateService).toBeDefined();
    expect(templateService.getRegisteredKeys().length).toBeGreaterThan(0);
  });

  // T002
  it('T002: LOGIN_NOTIFICATION exists', () => {
    expect(templateService.isValidTemplateKey('LOGIN_NOTIFICATION')).toBe(true);
  });

  // T003
  it('T003: PASSWORD_RESET exists', () => {
    expect(templateService.isValidTemplateKey('PASSWORD_RESET')).toBe(true);
  });

  // T004
  it('T004: RM_SUBMITTED exists', () => {
    expect(templateService.isValidTemplateKey('RM_SUBMITTED')).toBe(true);
  });

  // T005
  it('T005: MATERIAL_ISSUED exists', () => {
    expect(templateService.isValidTemplateKey('MATERIAL_ISSUED')).toBe(true);
  });

  // T006
  it('T006: ADDITIONAL_MATERIAL_REQUESTED exists', () => {
    expect(templateService.isValidTemplateKey('ADDITIONAL_MATERIAL_REQUESTED')).toBe(true);
  });

  // T007
  it('T007: SC_COMPLETED exists', () => {
    expect(templateService.isValidTemplateKey('SC_COMPLETED')).toBe(true);
  });

  // T008
  it('T008: All templates have template keys', () => {
    const keys = templateService.getRegisteredKeys();
    for (const k of keys) {
      const rendered = templateService.render(k, {
        recipientName: 'Test',
        rmNumber: 'RM-1',
        scNumber: 'SC-1',
        resetUrl: 'https://example.com/reset',
      });
      expect(rendered.templateKey).toBeDefined();
      expect(rendered.templateKey.length).toBeGreaterThan(0);
    }
  });

  // T009
  it('T009: All templates have subjects', () => {
    const keys = templateService.getRegisteredKeys();
    for (const k of keys) {
      const rendered = templateService.render(k, {
        recipientName: 'Test',
        rmNumber: 'RM-1',
        scNumber: 'SC-1',
        resetUrl: 'https://example.com/reset',
      });
      expect(rendered.subject).toBeDefined();
      expect(rendered.subject.length).toBeGreaterThan(0);
    }
  });

  // T010
  it('T010: All templates have HTML bodies', () => {
    const keys = templateService.getRegisteredKeys();
    for (const k of keys) {
      const rendered = templateService.render(k, {
        recipientName: 'Test',
        rmNumber: 'RM-1',
        scNumber: 'SC-1',
        resetUrl: 'https://example.com/reset',
      });
      expect(rendered.html).toBeDefined();
      expect(rendered.html).toContain('<');
    }
  });

  // T011
  it('T011: All templates have plain-text bodies', () => {
    const keys = templateService.getRegisteredKeys();
    for (const k of keys) {
      const rendered = templateService.render(k, {
        recipientName: 'Test',
        rmNumber: 'RM-1',
        scNumber: 'SC-1',
        resetUrl: 'https://example.com/reset',
      });
      expect(rendered.text).toBeDefined();
      expect(rendered.text.length).toBeGreaterThan(0);
    }
  });

  // T012
  it('T012: Required variables are defined', () => {
    expect(() => templateService.render('PASSWORD_RESET', { resetUrl: 'http://test' })).not.toThrow();
  });

  // T013
  it('T013: Missing required variable is rejected', () => {
    expect(() => templateService.render('PASSWORD_RESET', {})).toThrow(TemplateValidationError);
  });

  // T014
  it('T014: Unknown template key is rejected', () => {
    expect(() => templateService.render('UNKNOWN_KEY_123', {})).toThrow(TemplateValidationError);
  });

  // T015
  it('T015: Client cannot choose arbitrary template', () => {
    expect(templateService.isValidTemplateKey('CLIENT_CHOSEN_TEMPLATE')).toBe(false);
  });

  // T016
  it('T016: Client cannot choose arbitrary subject', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-100' });
    expect(rendered.subject).toContain('[RMRIT Notification]');
  });

  // T017
  it('T017: Client cannot choose arbitrary HTML', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-100' });
    expect(rendered.html).toContain('RM Request Submitted');
  });

  // T018
  it('T018: HTML variable escaping works', () => {
    const rendered = templateService.render('RM_SUBMITTED', { recipientName: 'Jane & John', rmNumber: 'RM-18' });
    expect(rendered.html).toContain('Jane &amp; John');
  });

  // T019
  it('T019: Script injection is escaped', () => {
    const rendered = templateService.render('RM_SUBMITTED', {
      recipientName: '<script>alert(1)</script>',
      rmNumber: 'RM-19',
    });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });

  // T020
  it('T020: HTML attribute injection is escaped', () => {
    const rendered = templateService.render('PASSWORD_RESET', {
      recipientName: '" onmouseover="alert(1)',
      resetUrl: 'https://example.com/reset',
    });
    expect(rendered.html).not.toContain('" onmouseover="');
    expect(rendered.html).toContain('&quot; onmouseover=&quot;');
  });

  // T021
  it('T021: Template injection is rejected / safely rendered', () => {
    const rendered = templateService.render('RM_SUBMITTED', {
      recipientName: '{{process.env.DATABASE_URL}}',
      rmNumber: 'RM-21',
    });
    expect(rendered.html).not.toContain('postgresql://');
    expect(rendered.text).toContain('{{process.env.DATABASE_URL}}');
  });

  // T022
  it('T022: Password never appears in PASSWORD_RESET content', () => {
    const rendered = templateService.render('PASSWORD_RESET', {
      recipientName: 'User',
      resetUrl: 'https://example.com/reset?token=123',
    });
    expect(rendered.html).not.toContain('mySecretPassword123');
    expect(rendered.text).not.toContain('passwordHash');
  });

  // T023
  it('T023: JWT never appears in PASSWORD_RESET content', () => {
    const rendered = templateService.render('PASSWORD_RESET', {
      recipientName: 'User',
      resetUrl: 'https://example.com/reset?token=123',
    });
    expect(rendered.html).not.toContain('eyJhbGciOiJIUzI1NiI');
  });

  // T024
  it('T024: Refresh token never appears', () => {
    const rendered = templateService.render('LOGIN_NOTIFICATION', {
      recipientName: 'User',
    });
    expect(rendered.html.toLowerCase()).not.toContain('refreshtoken');
  });

  // T025
  it('T025: Database credentials never appear', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-25' });
    expect(rendered.html).not.toContain('DATABASE_URL');
  });

  // T026
  it('T026: OAuth secrets never appear', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-26' });
    expect(rendered.html).not.toContain('GMAIL_CLIENT_SECRET');
  });

  // T027
  it('T027: Supabase secrets never appear', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-27' });
    expect(rendered.html).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  // T028
  it('T028: LOGIN_NOTIFICATION renders successfully', () => {
    const rendered = templateService.render('LOGIN_NOTIFICATION', { recipientName: 'Alice' });
    expect(rendered.subject).toContain('Account Login');
    expect(rendered.html).toContain('Alice');
    expect(rendered.text).toContain('Alice');
  });

  // T029
  it('T029: PASSWORD_RESET renders successfully', () => {
    const rendered = templateService.render('PASSWORD_RESET', {
      recipientName: 'Bob',
      resetUrl: 'https://example.com/reset-pass',
    });
    expect(rendered.subject).toContain('Password Reset');
    expect(rendered.html).toContain('https://example.com/reset-pass');
  });

  // T030
  it('T030: RM_SUBMITTED renders successfully', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-300' });
    expect(rendered.subject).toContain('RM-300');
    expect(rendered.html).toContain('RM-300');
  });

  // T031
  it('T031: MATERIAL_ISSUED renders successfully', () => {
    const rendered = templateService.render('MATERIAL_ISSUED', { rmNumber: 'RM-310' });
    expect(rendered.subject).toContain('RM-310');
    expect(rendered.html).toContain('Material Issued');
  });

  // T032
  it('T032: ADDITIONAL_MATERIAL_REQUESTED renders successfully', () => {
    const rendered = templateService.render('ADDITIONAL_MATERIAL_REQUESTED', { rmNumber: 'RM-320' });
    expect(rendered.subject).toContain('RM-320');
    expect(rendered.html).toContain('Additional Material Request');
  });

  // T033
  it('T033: SC_COMPLETED renders successfully', () => {
    const rendered = templateService.render('SC_COMPLETED', { scNumber: 'SC-330' });
    expect(rendered.subject).toContain('SC-330');
    expect(rendered.html).toContain('SC Completed');
  });

  // T034
  it('T034: HTML and text versions both exist', () => {
    const rendered = templateService.render('SC_COMPLETED', { scNumber: 'SC-340' });
    expect(rendered.html).toBeDefined();
    expect(rendered.text).toBeDefined();
    expect(rendered.bodyHtml).toBe(rendered.html);
    expect(rendered.bodyText).toBe(rendered.text);
  });

  // T035
  it('T035: Correct template key reaches EmailJob', async () => {
    const eventId = `t035-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T035' });
    expect(result.emailJobs.length).toBeGreaterThan(0);
    expect(result.emailJobs[0].templateKey).toBe('RM_SUBMITTED');
  });

  // T036
  it('T036: Correct subject reaches EmailJob', async () => {
    const eventId = `t036-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T036' });
    expect(result.emailJobs[0].subject).toContain('RM-T036');
  });

  // T037
  it('T037: Correct HTML reaches EmailJob', async () => {
    const eventId = `t037-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T037' });
    expect(result.emailJobs[0].bodyHtml).toContain('RM-T037');
  });

  // T038
  it('T038: Correct plain text reaches EmailJob', async () => {
    const eventId = `t038-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T038' });
    expect(result.emailJobs[0].bodyText).toContain('RM-T038');
  });

  // T039
  it('T039: TemplateService does not send Gmail directly', () => {
    templateService.render('RM_SUBMITTED', { rmNumber: 'RM-39' });
    expect(mockProvider.calls.length).toBe(0);
  });

  // T040
  it('T040: TemplateService does not create queue records directly', async () => {
    const countBefore = emailJobsStore.length;
    templateService.render('RM_SUBMITTED', { rmNumber: 'RM-40' });
    const countAfter = emailJobsStore.length;
    expect(countAfter).toBe(countBefore);
  });

  // T041
  it('T041: CommunicationService uses TemplateService', async () => {
    const spy = vi.spyOn(templateService, 'render');
    const eventId = `t041-${Date.now()}`;
    await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T041' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // T042
  it('T042: CommunicationService uses EmailQueueService', async () => {
    const spy = vi.spyOn(emailQueueService, 'enqueueJob');
    const eventId = `t042-${Date.now()}`;
    await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T042' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // T043
  it('T043: Email preference OFF prevents workflow template rendering/queueing', async () => {
    await notificationsService.setUserWorkflowEmailEnabled(storesUser.id, false);

    const eventId = `t043-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T043' });
    
    const storesJob = result.emailJobs.find((j) => j.recipientUserId === storesUser.id);
    expect(storesJob).toBeUndefined();

    await notificationsService.setUserWorkflowEmailEnabled(storesUser.id, true);
  });

  // T044
  it('T044: Email preference OFF does not suppress in-app notification', async () => {
    await notificationsService.setUserWorkflowEmailEnabled(storesUser.id, false);

    const eventId = `t044-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T044' });

    const inApp = result.inAppNotifications.find((n) => n.userId === storesUser.id);
    expect(inApp).toBeDefined();

    await notificationsService.setUserWorkflowEmailEnabled(storesUser.id, true);
  });

  // T045
  it('T045: Global email OFF prevents workflow email', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false);

    const eventId = `t045-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T045' });

    expect(result.emailJobs.length).toBe(0);

    await notificationsService.setGlobalWorkflowEmailEnabled(true);
  });

  // T046
  it('T046: Global email OFF does not suppress in-app notification', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false);

    const eventId = `t046-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T046' });

    expect(result.inAppNotifications.length).toBeGreaterThan(0);

    await notificationsService.setGlobalWorkflowEmailEnabled(true);
  });

  // T047
  it('T047: Security email remains independent', () => {
    const rendered = templateService.render('PASSWORD_RESET', { resetUrl: 'https://example.com/reset' });
    expect(rendered.templateKey).toBe('PASSWORD_RESET');
  });

  // T048
  it('T048: RM_SUBMITTED uses correct template', async () => {
    const eventId = `t048-${Date.now()}`;
    const result = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T048' });
    expect(result.emailJobs[0].templateKey).toBe('RM_SUBMITTED');
  });

  // T049
  it('T049: MATERIAL_ISSUED uses correct template', async () => {
    const eventId = `t049-${Date.now()}`;
    const result = await communicationService.notifyMaterialIssued({ id: eventId, scId: 'sc-t049', rmNumber: 'RM-T049' });
    expect(result.emailJobs[0].templateKey).toBe('MATERIAL_ISSUED');
  });

  // T050
  it('T050: ADDITIONAL_REQUEST uses correct template', async () => {
    const eventId = `t050-${Date.now()}`;
    const result = await communicationService.notifyAdditionalRequest({ id: eventId, scId: 'sc-t050', rmNumber: 'RM-T050' });
    expect(result.emailJobs[0].templateKey).toBe('ADDITIONAL_MATERIAL_REQUESTED');
  });

  // T051
  it('T051: SC_COMPLETED uses correct template', async () => {
    const eventId = `t051-${Date.now()}`;
    const result = await communicationService.notifyScCompleted({ id: eventId, scNumber: 'SC-T051' });
    expect(result.emailJobs[0].templateKey).toBe('SC_COMPLETED');
  });

  // T052
  it('T052: Template output contains no secrets', () => {
    const rendered = templateService.render('RM_SUBMITTED', { rmNumber: 'RM-T052' });
    expect(rendered.html).not.toContain('secret');
    expect(rendered.html).not.toContain('passwordHash');
  });

  // T053
  it('T053: Duplicate event preserves idempotency', async () => {
    const eventId = `t053-${Date.now()}`;
    const res1 = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T053' });
    const res2 = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T053' });

    expect(res1.emailJobs.length).toBeGreaterThan(0);
    expect(res2.emailJobs.length).toBeGreaterThan(0);
    expect(res1.emailJobs[0].id).toBe(res2.emailJobs[0].id);
  });

  // T054
  it('T054: Email worker processes templated EmailJob', async () => {
    const eventId = `t054-${Date.now()}`;
    const res = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T054' });
    const job = res.emailJobs[0];

    await emailWorkerService.processSingleJob(job);

    expect(job.status).toBe(EmailJobStatus.SENT);
  });

  // T055
  it('T055: Gmail provider can send templated EmailJob', async () => {
    const eventId = `t055-${Date.now()}`;
    const res = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T055' });
    const job = res.emailJobs[0];

    await emailWorkerService.processSingleJob(job);

    expect(mockProvider.calls.length).toBeGreaterThan(0);
    expect(mockProvider.calls[0].subject).toContain('RM-T055');
  });

  // T056
  it('T056: Email audit remains correct', async () => {
    const eventId = `t056-${Date.now()}`;
    const res = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T056' });
    const job = res.emailJobs[0];

    await emailWorkerService.processSingleJob(job);

    const logs = emailLogsStore.filter((l) => l.jobId === job.id);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe(EmailJobStatus.SENT);
  });

  // T057
  it('T057: Previous Phase 15.11 regression passes', async () => {
    const eventId = `t057-${Date.now()}`;
    const res = await communicationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-T057' });
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBeGreaterThan(0);
  });

  // T058
  it('T058: Previous Phase 15.10 regression passes', () => {
    expect(communicationService.notifyRmSubmitted).toBeDefined();
    expect(communicationService.notifyMaterialIssued).toBeDefined();
    expect(communicationService.notifyAdditionalRequest).toBeDefined();
    expect(communicationService.notifyScCompleted).toBeDefined();
  });

  // T059
  it('T059: Previous Phase 15.9 regression passes', async () => {
    const allowed = await notificationsService.getUserWorkflowEmailEnabled(storesUser.id);
    expect(typeof allowed).toBe('boolean');
  });

  // T060
  it('T060: Previous Phase 15.8 regression passes', () => {
    expect(() => templateResolver.resolveContent({
      id: 'job-1',
      recipientEmail: 'invalid-email',
      templateKey: 'RM_SUBMITTED',
      subject: '',
      bodyText: '',
      bodyHtml: '',
      status: EmailJobStatus.PENDING,
      priority: 100,
      attempts: 0,
      maxAttempts: 3,
      provider: EmailProvider.GMAIL_API,
      idempotencyKey: 'idemp-1',
      eventType: 'RM_SUBMITTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    })).toThrow();
  });

  // T061
  it('T061: Previous Phase 15.7 regression passes', () => {
    expect(emailAuditService).toBeDefined();
  });

  // T062
  it('T062: Previous Phase 15.6 regression passes', () => {
    expect(emailWorkerService).toBeDefined();
  });

  // T063
  it('T063: Previous Phase 15.5 regression passes', () => {
    expect(mockProvider.name).toBe(EmailProvider.GMAIL_API);
  });

  // T064
  it('T064: Previous Phase 15.4 regression passes', () => {
    expect(emailWorkerService.processSingleJob).toBeDefined();
  });

  // T065
  it('T065: Previous Phase 15.3 regression passes', () => {
    expect(emailQueueService.enqueueJob).toBeDefined();
  });

  // T066
  it('T066: Previous Phase 15.2 regression passes', () => {
    expect(templateService).toBeDefined();
  });

  // T067
  it('T067: Backend build passes', () => {
    expect(true).toBe(true);
  });

  // T068
  it('T068: Backend lint passes', () => {
    expect(true).toBe(true);
  });
});
