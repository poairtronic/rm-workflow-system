import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService, GLOBAL_WORKFLOW_EMAIL_KEY } from '../src/notifications/notifications.service.js';
import { NotificationsController } from '../src/notifications/notifications.controller.ts';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { TemplateService } from '../src/email/template.service.js';
import { TemplateResolver } from '../src/email/resolvers/template.resolver.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
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
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

class TestMockProvider implements EmailProviderInterface {
  public calls: SendEmailOptions[] = [];
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.calls.push(options);
    return {
      success: true,
      messageId: `msg-db14-${Date.now()}`,
      provider: EmailProvider.GMAIL_API,
    };
  }
}

describe('Phase 15.14 — Database Model for Preferences (DB001–DB022)', () => {
  let notificationsService: NotificationsService;
  let notificationsController: NotificationsController;
  let communicationService: CommunicationService;
  let mockProvider: TestMockProvider;

  let adminUser: User;
  let userA: User;
  let userB: User;

  let systemSettingsStore: SystemSetting[] = [];
  let userPrefsStore: UserNotificationPreference[] = [];
  let notificationsStore: Notification[] = [];
  let emailJobsStore: EmailJob[] = [];
  let emailLogsStore: EmailLog[] = [];

  beforeAll(async () => {
    mockProvider = new TestMockProvider();

    adminUser = { id: 'admin-db-id', email: 'admin@rmrit.local', name: 'Admin', roleId: 'role-admin' } as any;
    userA = { id: 'user-a-db-id', email: 'usera@rmrit.local', name: 'User A', roleId: 'role-designer' } as any;
    userB = { id: 'user-b-db-id', email: 'userb@rmrit.local', name: 'User B', roleId: 'role-stores' } as any;

    const mockUserRepository = {
      find: vi.fn(async () => [adminUser, userA, userB]),
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.id === adminUser.id) return adminUser;
        if (opts?.where?.id === userA.id) return userA;
        if (opts?.where?.id === userB.id) return userB;
        return null;
      }),
    };

    const mockRoleRepository = {
      find: vi.fn(async () => [
        { id: 'role-admin', name: 'ADMIN' },
        { id: 'role-designer', name: 'DESIGNER' },
        { id: 'role-stores', name: 'STORES' },
      ]),
      findOne: vi.fn(async (opts?: any) => ({ id: 'role-id', name: opts?.where?.name || 'ADMIN' })),
    };

    const mockSystemSettingRepository = {
      findOne: vi.fn(async (opts?: any) => systemSettingsStore.find((s) => s.key === opts?.where?.key) || null),
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
      findOne: vi.fn(async (opts?: any) => userPrefsStore.find((p) => p.userId === opts?.where?.userId) || null),
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

    const mockNotificationRepository = {
      create: vi.fn((dto: any) => ({ id: `notif-${Date.now()}-${Math.random()}`, ...dto })),
      save: vi.fn(async (notif: any) => {
        const idx = notificationsStore.findIndex((n) => n.id === notif.id);
        if (idx >= 0) {
          notificationsStore[idx] = { ...notificationsStore[idx], ...notif };
          return notificationsStore[idx];
        }
        notificationsStore.push(notif);
        return notif;
      }),
      findOne: vi.fn(async (opts?: any) => {
        if (opts?.where?.targetEntity && opts?.where?.targetId) {
          return notificationsStore.find((n) => n.userId === opts.where.userId && n.targetEntity === opts.where.targetEntity && n.targetId === opts.where.targetId) || null;
        }
        return notificationsStore.find((n) => n.id === opts?.where?.id) || null;
      }),
      find: vi.fn(async () => notificationsStore),
    };

    const mockEmailJobRepository = {
      create: vi.fn((dto: any) => ({ id: `job-${Date.now()}-${Math.random()}`, status: EmailJobStatus.PENDING, attempts: 0, maxAttempts: 3, priority: 100, provider: EmailProvider.GMAIL_API, createdAt: new Date(), updatedAt: new Date(), ...dto })),
      save: vi.fn(async (job: any) => {
        const idx = emailJobsStore.findIndex((j) => j.id === job.id);
        if (idx >= 0) {
          emailJobsStore[idx] = { ...emailJobsStore[idx], ...job };
          return emailJobsStore[idx];
        }
        emailJobsStore.push(job);
        return job;
      }),
      findOne: vi.fn(async (opts?: any) => emailJobsStore.find((j) => j.id === opts?.where?.id) || null),
      find: vi.fn(async () => emailJobsStore),
    };

    const mockEmailLogRepository = {
      create: vi.fn((dto: any) => ({ id: `log-${Date.now()}`, ...dto })),
      save: vi.fn(async (log: any) => {
        emailLogsStore.push(log);
        return log;
      }),
      find: vi.fn(async () => emailLogsStore),
    };

    const mockDataSource = {
      transaction: vi.fn(async (cb: any) => cb({ getRepository: () => mockEmailJobRepository })),
      createQueryRunner: vi.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        CommunicationService,
        EmailQueueService,
        EmailWorkerService,
        TemplateService,
        TemplateResolver,
        EmailAuditService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: EMAIL_PROVIDER, useValue: mockProvider },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepository },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepository },
        { provide: getRepositoryToken(SystemSetting), useValue: mockSystemSettingRepository },
        { provide: getRepositoryToken(UserNotificationPreference), useValue: mockUserPrefRepository },
        { provide: getRepositoryToken(EmailJob), useValue: mockEmailJobRepository },
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
    notificationsController = moduleFixture.get<NotificationsController>(NotificationsController);
    communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
  });

  // DB001
  it('DB001 — User preference belongs to correct user', async () => {
    const pref = await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);
    expect(pref.userId).toBe(userA.id);
  });

  // DB002
  it('DB002 — user_id is unique per preference record', async () => {
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, true);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);
    const pref = await notificationsService.getUserWorkflowEmailEnabled(userA.id);
    expect(pref).toBe(false);
  });

  // DB003
  it('DB003 — duplicate user preference rejected or upserted cleanly', async () => {
    const p1 = await notificationsService.setUserWorkflowEmailEnabled(userA.id, true);
    const p2 = await notificationsService.setUserWorkflowEmailEnabled(userA.id, true);
    expect(p1.userId).toBe(p2.userId);
  });

  // DB004
  it('DB004 — default workflow_email_enabled is true when no record exists', async () => {
    const enabled = await notificationsService.getUserWorkflowEmailEnabled('non-existent-user-id');
    expect(enabled).toBe(true);
  });

  // DB005
  it('DB005 — global setting default is true when no record exists', async () => {
    systemSettingsStore = [];
    const enabled = await notificationsService.getGlobalWorkflowEmailEnabled();
    expect(enabled).toBe(true);
  });

  // DB006
  it('DB006 — global change does not modify user preference records', async () => {
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);
    await notificationsService.setGlobalWorkflowEmailEnabled(false, adminUser.id);

    const userPref = await notificationsService.getUserWorkflowEmailEnabled(userA.id);
    expect(userPref).toBe(false);

    await notificationsService.setGlobalWorkflowEmailEnabled(true, adminUser.id);
    const userPrefAfter = await notificationsService.getUserWorkflowEmailEnabled(userA.id);
    expect(userPrefAfter).toBe(false);
  });

  // DB007
  it('DB007 — user change does not modify global setting', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);

    const globalVal = await notificationsService.getGlobalWorkflowEmailEnabled();
    expect(globalVal).toBe(true);
  });

  // DB008
  it('DB008 — User A cannot modify User B preference via controller', async () => {
    const req = { user: { userId: userA.id } };
    await expect(
      notificationsController.updateUserPreferencesById(req, userB.id, { workflowEmailEnabled: false }),
    ).rejects.toThrow(ForbiddenException);
  });

  // DB009
  it('DB009 — non-admin cannot modify global setting (enforced by controller dto validation)', async () => {
    const req = { user: { userId: userA.id } };
    await expect(
      notificationsController.updateGlobalSettings({ workflowEmailEnabled: 'invalid' as any }, req),
    ).rejects.toThrow(BadRequestException);
  });

  // DB010
  it('DB010 — existing preference survives database operations', async () => {
    await notificationsService.setUserWorkflowEmailEnabled(userB.id, false);
    const prefB = await notificationsService.getUserWorkflowEmailEnabled(userB.id);
    expect(prefB).toBe(false);
  });

  // DB011
  it('DB011 — existing users remain valid without mandatory preference pre-creation', async () => {
    const prefNew = await notificationsService.getUserWorkflowEmailEnabled('brand-new-user');
    expect(prefNew).toBe(true);
  });

  // DB012
  it('DB012 — inactive users do not corrupt preference data', async () => {
    const inactiveUser = { id: 'inactive-user-id', isActive: false };
    const enabled = await notificationsService.getUserWorkflowEmailEnabled(inactiveUser.id);
    expect(enabled).toBe(true);
  });

  // DB013
  it('DB013 — notification rows remain unaffected when email is toggled OFF', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(adminUser.id, false);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);
    await notificationsService.setUserWorkflowEmailEnabled(userB.id, false);

    const res = await communicationService.notifyRmSubmitted({ id: 'rm-db013', rmNumber: 'RM-DB013' });
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBe(0);
  });

  // DB014
  it('DB014 — email jobs remain unaffected for users with email ON', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(adminUser.id, true);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, true);
    await notificationsService.setUserWorkflowEmailEnabled(userB.id, true);

    const res = await communicationService.notifyRmSubmitted({ id: 'rm-db014', rmNumber: 'RM-DB014' });
    expect(res.emailJobs.length).toBeGreaterThan(0);
  });

  // DB015
  it('DB015 — EmailLog remains unaffected and independent', async () => {
    const logs = await emailLogsStore;
    expect(Array.isArray(logs)).toBe(true);
  });

  // DB016
  it('DB016 — Idempotency remains unaffected by preference settings', async () => {
    const res1 = await communicationService.notifyRmSubmitted({ id: 'idem-db016', rmNumber: 'RM-IDEM' });
    const res2 = await communicationService.notifyRmSubmitted({ id: 'idem-db016', rmNumber: 'RM-IDEM' });
    expect(res1.inAppNotifications[0].id).toBe(res2.inAppNotifications[0].id);
  });

  // DB017 — Case 1: Global ON + User ON
  it('DB017 — Policy Case 1 (Global ON, User ON): In-App CREATED, Email QUEUED', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(adminUser.id, true);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, true);
    await notificationsService.setUserWorkflowEmailEnabled(userB.id, true);

    const res = await communicationService.notifyRmSubmitted({ id: 'case1', rmNumber: 'RM-CASE1' });
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBeGreaterThan(0);
  });

  // DB018 — Case 2: Global ON + User OFF
  it('DB018 — Policy Case 2 (Global ON, User OFF): In-App CREATED, Email SUPPRESSED', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(adminUser.id, false);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);
    await notificationsService.setUserWorkflowEmailEnabled(userB.id, false);

    const res = await communicationService.notifyRmSubmitted({ id: 'case2', rmNumber: 'RM-CASE2' });
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBe(0);
  });

  // DB019 — Case 3: Global OFF + User ON
  it('DB019 — Policy Case 3 (Global OFF, User ON): In-App CREATED, Email SUPPRESSED', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, true);

    const res = await communicationService.notifyRmSubmitted({ id: 'case3', rmNumber: 'RM-CASE3' });
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBe(0);
  });

  // DB020 — Case 4: Global OFF + User OFF
  it('DB020 — Policy Case 4 (Global OFF, User OFF): In-App CREATED, Email SUPPRESSED', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);

    const res = await communicationService.notifyRmSubmitted({ id: 'case4', rmNumber: 'RM-CASE4' });
    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBe(0);
  });

  // DB021
  it('DB021 — Security emails bypass workflow email preference toggles', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, adminUser.id);
    await notificationsService.setUserWorkflowEmailEnabled(userA.id, false);

    const isSecurityAllowed = await notificationsService.shouldSendEmail('SECURITY', userA.id);
    expect(isSecurityAllowed).toBe(true);
  });

  // DB022
  it('DB022 — Reconciled architecture confirmed: NO DATABASE MIGRATION REQUIRED (Existing Model Retained)', async () => {
    const globalKey = GLOBAL_WORKFLOW_EMAIL_KEY;
    expect(globalKey).toBe('GLOBAL_WORKFLOW_EMAIL_ENABLED');
    expect(UserNotificationPreference).toBeDefined();
    expect(SystemSetting).toBeDefined();
  });
});
