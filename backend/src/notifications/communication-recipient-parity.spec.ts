import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CommunicationService,
  PERMITTED_EMAIL_CONFIG,
} from './communication.service.js';
import {
  NotificationPreferenceService,
  EVENT_ALIAS_MAP,
} from './notification-preference.service.js';
import {
  PHASE_1_ROLE_EMAIL_SETTINGS_SEED,
  PHASE_1_EVENT_TO_ROLES_MAP,
} from '../database/migrations/1793700000000-Phase160EmailNotificationManagement.js';

describe('CommunicationService & Recipient Parity (Phase 2)', () => {
  const roles = {
    ADMIN: { id: 'role-admin-uuid', name: 'ADMIN' },
    DESIGNER: { id: 'role-designer-uuid', name: 'DESIGNER' },
    STORES: { id: 'role-stores-uuid', name: 'STORES' },
    PRODUCTION: { id: 'role-production-uuid', name: 'PRODUCTION' },
    SENIOR_MANAGER: { id: 'role-sm-uuid', name: 'SENIOR_MANAGER' },
    GENERAL_MANAGER: { id: 'role-gm-uuid', name: 'GENERAL_MANAGER' },
  };

  const users = [
    { id: 'u-admin', email: 'admin@example.com', name: 'Admin User', roleId: roles.ADMIN.id, role: roles.ADMIN, isActive: true },
    { id: 'u-designer', email: 'designer@example.com', name: 'Designer User', roleId: roles.DESIGNER.id, role: roles.DESIGNER, isActive: true },
    { id: 'u-stores', email: 'stores@example.com', name: 'Stores User', roleId: roles.STORES.id, role: roles.STORES, isActive: true },
    { id: 'u-production', email: 'production@example.com', name: 'Production User', roleId: roles.PRODUCTION.id, role: roles.PRODUCTION, isActive: true },
    { id: 'u-sm', email: 'sm@example.com', name: 'Senior Manager', roleId: roles.SENIOR_MANAGER.id, role: roles.SENIOR_MANAGER, isActive: true },
    { id: 'u-gm', email: 'gm@example.com', name: 'General Manager', roleId: roles.GENERAL_MANAGER.id, role: roles.GENERAL_MANAGER, isActive: true },
  ];

  // Configurable events in the system (12 legacy + 4 new Phase 5 overdue sweeps = 16 events)
  const sixteenEvents = [
    'RM_SUBMITTED',
    'MATERIAL_ISSUED',
    'ADDITIONAL_REQUEST',
    'MATERIAL_RETURNED',
    'EXTRA_MATERIAL_ISSUED',
    'MSL_LOW_STOCK',
    'MSL_CRITICAL',
    'MSL_OUT_OF_STOCK',
    'DC_APPROACHING_SLA',
    'DC_OVERDUE',
    'CONSUMABLE_RECEIPT_OVERDUE',
    'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
    'MATERIAL_ISSUE_OVERDUE_24H',
    'DC_PENDING_2_DAYS',
    'DC_QC_PENDING_24H',
    'CONSUMABLE_PENDING_2_DAYS',
  ];
  const phase5ApprovalEvents = [
    'CONSUMABLE_APPROVAL_REQUESTED',
    'CONSUMABLE_APPROVED',
    'CONSUMABLE_REJECTED',
  ];
  const allConfigurableEvents = [...sixteenEvents, ...phase5ApprovalEvents];
  const twelveEvents = sixteenEvents;

  let commService: CommunicationService;
  let preferenceService: NotificationPreferenceService;

  let notificationRepoMock: any;
  let userRepoMock: any;
  let roleRepoMock: any;
  let emailQueueServiceMock: any;
  let notificationsServiceMock: any;
  let templateServiceMock: any;
  let emailIdempotencyServiceMock: any;
  let recipientServiceMock: any;
  let notificationEventRepoMock: any;
  let roleEmailSettingRepoMock: any;
  let userEmailOverrideRepoMock: any;
  let userPrefRepoMock: any;
  let systemSettingRepoMock: any;

  beforeEach(() => {
    notificationRepoMock = {
      create: vi.fn().mockImplementation((val) => val),
      createQueryBuilder: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        into: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        orIgnore: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ identifiers: [] }),
      })),
      findOne: vi.fn().mockResolvedValue(null),
    };

    userRepoMock = {
      find: vi.fn().mockResolvedValue(users),
    };

    roleRepoMock = {
      find: vi.fn().mockImplementation(async ({ where }: any) => {
        const names = Array.isArray(where) ? where.map((w: any) => w.name) : [where?.name];
        return Object.values(roles).filter((r) => names.includes(r.name));
      }),
    };

    emailQueueServiceMock = {
      enqueueJob: vi.fn().mockImplementation(async (job) => ({ id: 'job-uuid', ...job })),
    };

    notificationsServiceMock = {
      getGlobalWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
      getConsumableEmailAlertsEnabled: vi.fn().mockResolvedValue(true),
      getUserWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
    };

    templateServiceMock = {
      render: vi.fn().mockReturnValue({
        templateKey: 'DEFAULT',
        subject: 'Test Subject',
        text: 'Text content',
        html: '<p>HTML content</p>',
      }),
    };

    emailIdempotencyServiceMock = {
      generateKey: vi.fn().mockReturnValue('idempotency-key-test'),
    };

    recipientServiceMock = {
      resolveRecipients: vi.fn().mockImplementation(async ({ specificTargetUserId, actorUserId }: any) => {
        if (specificTargetUserId) {
          return users.filter((u) => u.id === specificTargetUserId && u.isActive);
        }
        return users.filter((u) => u.isActive && (!actorUserId || u.id !== actorUserId));
      }),
      findActiveUsersByRoles: vi.fn().mockImplementation(async (roleNames: string[]) => {
        return users.filter((u) => roleNames.includes(u.role.name) && u.isActive);
      }),
    };

    notificationEventRepoMock = {
      findOne: vi.fn().mockImplementation(async ({ where }: any) => {
        if (allConfigurableEvents.includes(where.code)) {
          return { code: where.code, isConfigurable: true };
        }
        return null;
      }),
    };

    roleEmailSettingRepoMock = {
      find: vi.fn().mockImplementation(async ({ where }: any) => {
        const eventCode = where.eventCode;
        const allowed = PHASE_1_EVENT_TO_ROLES_MAP[eventCode] || [];
        return Object.values(roles).map((r) => ({
          roleId: r.id,
          eventCode,
          enabled: allowed.includes(r.name),
        }));
      }),
    };

    userEmailOverrideRepoMock = {
      find: vi.fn().mockResolvedValue([]),
    };

    userPrefRepoMock = {
      find: vi.fn().mockResolvedValue([]),
    };

    systemSettingRepoMock = {
      findOne: vi.fn().mockResolvedValue({ key: 'EMAIL_PREFS_V2_MODE', value: 'OFF' }),
    };

    preferenceService = new NotificationPreferenceService(
      notificationEventRepoMock,
      roleEmailSettingRepoMock,
      userEmailOverrideRepoMock,
      userPrefRepoMock,
      userRepoMock,
      systemSettingRepoMock,
    );

    commService = new CommunicationService(
      notificationRepoMock,
      userRepoMock,
      roleRepoMock,
      emailQueueServiceMock,
      notificationsServiceMock,
      templateServiceMock,
      emailIdempotencyServiceMock,
      recipientServiceMock,
      undefined,
      preferenceService,
    );
  });

  describe('Section 5: Verification of PERMITTED_EMAIL_CONFIG against notification_events', () => {
    it('every configurable event in PERMITTED_EMAIL_CONFIG matches notification_events (with alias mapping)', () => {
      const permittedKeys = Object.keys(PERMITTED_EMAIL_CONFIG);

      const securityOrDiagnosticKeys = ['PASSWORD_RESET', 'TEST_EMAIL'];
      const configurableKeys = permittedKeys.filter((k) => !securityOrDiagnosticKeys.includes(k));

      for (const key of configurableKeys) {
        const canonical = EVENT_ALIAS_MAP[key] || key;
        expect(allConfigurableEvents).toContain(canonical);
      }
    });
  });

  describe('Parity across all 12 events between Legacy Logic and New Resolver', () => {
    it('migration seed PHASE_1_EVENT_TO_ROLES_MAP strictly matches PERMITTED_EMAIL_CONFIG.allowedRoles for all events', () => {
      for (const eventCode of twelveEvents) {
        const expectedRoles = [...PERMITTED_EMAIL_CONFIG[eventCode].allowedRoles].sort();
        const seededRoles = [...(PHASE_1_EVENT_TO_ROLES_MAP[eventCode] || [])].sort();
        expect(seededRoles).toEqual(expectedRoles);
      }
    });

    for (const eventCode of twelveEvents) {
      it(`event "${eventCode}": new resolver recipients EQUAL old logic recipients`, async () => {
        // 1. Resolve recipients using Legacy logic
        const emailRule = PERMITTED_EMAIL_CONFIG[eventCode];
        const oldRoleUsers = await recipientServiceMock.findActiveUsersByRoles(emailRule.allowedRoles);
        const oldRecipients = oldRoleUsers.filter((u: any) => u.isActive);

        // 2. Resolve recipients using New Resolver (using imported migration seed)
        const newRecipients = await preferenceService.resolveRecipients(eventCode);

        // 3. Assert exact equality
        expect(newRecipients).not.toBeNull();
        const oldEmails = oldRecipients.map((u: any) => u.email).sort();
        const newEmails = newRecipients!.map((u: any) => u.email).sort();

        expect(newEmails).toEqual(oldEmails);
        expect(newEmails.length).toBeGreaterThan(0);
      });
    }

    it('proves that parity verification FAILS if any single seed cell is flipped', async () => {
      // Simulate flipping one seed cell for RM_SUBMITTED (e.g. enabling DESIGNER)
      const flippedRoles = [...(PHASE_1_EVENT_TO_ROLES_MAP['RM_SUBMITTED'] || []), 'DESIGNER'];
      roleEmailSettingRepoMock.find.mockImplementationOnce(async () => {
        return Object.values(roles).map((r) => ({
          roleId: r.id,
          eventCode: 'RM_SUBMITTED',
          enabled: flippedRoles.includes(r.name),
        }));
      });

      const oldRecipients = (await recipientServiceMock.findActiveUsersByRoles(
        PERMITTED_EMAIL_CONFIG['RM_SUBMITTED'].allowedRoles,
      )).map((u: any) => u.email).sort();

      const newRecipients = (await preferenceService.resolveRecipients('RM_SUBMITTED'))!.map(
        (u: any) => u.email,
      ).sort();

      // Mismatch must be detected
      expect(newRecipients).not.toEqual(oldRecipients);
      expect(newRecipients).toContain('designer@example.com');
      expect(oldRecipients).not.toContain('designer@example.com');
    });
  });

  describe('Global Switch & Consumable Gate', () => {
    it.each(['OFF', 'SHADOW', 'ON'] as const)(
      'global switch OFF -> no email in mode %s',
      async (mode) => {
        systemSettingRepoMock.findOne.mockResolvedValue({
          key: 'EMAIL_PREFS_V2_MODE',
          value: mode,
        });
        notificationsServiceMock.getGlobalWorkflowEmailEnabled.mockResolvedValue(false);

        const result = await commService.sendEvent({
          eventType: 'RM_SUBMITTED',
          entityType: 'RM_REQUEST',
          entityId: 'rm-123',
        });

        expect(result.emailJobs).toHaveLength(0);
        expect(emailQueueServiceMock.enqueueJob).not.toHaveBeenCalled();
      },
    );

    it.each(['OFF', 'SHADOW', 'ON'] as const)(
      'consumable gate OFF -> no consumable email in mode %s',
      async (mode) => {
        systemSettingRepoMock.findOne.mockResolvedValue({
          key: 'EMAIL_PREFS_V2_MODE',
          value: mode,
        });
        notificationsServiceMock.getConsumableEmailAlertsEnabled.mockResolvedValue(false);

        const result = await commService.sendEvent({
          eventType: 'CONSUMABLE_RECEIPT_OVERDUE',
          entityType: 'CONSUMABLE_REQUEST_ITEM',
          entityId: 'item-123',
        });

        expect(result.emailJobs).toHaveLength(0);
        expect(emailQueueServiceMock.enqueueJob).not.toHaveBeenCalled();
      },
    );
  });

  describe('Mode Transitions & Error Handling', () => {
    it('mode OFF -> resolver never called', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'OFF',
      });
      const resolveSpy = vi.spyOn(preferenceService, 'resolveRecipients');

      const result = await commService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'rm-123',
      });

      expect(resolveSpy).not.toHaveBeenCalled();
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('stores@example.com');
    });

    it('saving role or user setting while mode is OFF changes no email behavior (communication flow unchanged)', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'OFF',
      });

      // Simulate a user override turning STORES OFF and DESIGNER ON
      userEmailOverrideRepoMock.find.mockResolvedValue([
        { userId: 'u-stores', eventCode: 'RM_SUBMITTED', state: 'OFF' },
        { userId: 'u-designer', eventCode: 'RM_SUBMITTED', state: 'ON' },
      ]);

      // Simulate role_email_settings disabling STORES and enabling DESIGNER
      roleEmailSettingRepoMock.find.mockResolvedValue([
        { roleId: roles.STORES.id, eventCode: 'RM_SUBMITTED', enabled: false },
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: true },
      ]);

      const resolveSpy = vi.spyOn(preferenceService, 'resolveRecipients');

      const result = await commService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'rm-123',
      });

      // In mode OFF, new settings have zero effect on outgoing email:
      // Legacy recipient logic runs unchanged, sending email strictly to STORES
      expect(resolveSpy).not.toHaveBeenCalled();
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('stores@example.com');
    });

    it('mode SHADOW -> old recipients are used, shadow log line emitted, mismatch case logged', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'SHADOW',
      });

      // Override DESIGNER to ON in new resolver to create a mismatch against old logic
      userEmailOverrideRepoMock.find.mockResolvedValue([
        { userId: 'u-designer', eventCode: 'RM_SUBMITTED', state: 'ON' },
      ]);

      const logSpy = vi.spyOn((commService as any).logger, 'log');

      const result = await commService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'rm-123',
      });

      // In SHADOW mode, ONLY old recipients are sent emails (only stores, not designer)
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('stores@example.com');

      // Emitted shadow diff line
      const shadowLog = logSpy.mock.calls.find((call) =>
        String(call[0]).includes('[EMAIL_PREFS_SHADOW]'),
      );
      expect(shadowLog).toBeDefined();
      expect(shadowLog![0]).toContain('match=false');
      expect(shadowLog![0]).toContain('event=RM_SUBMITTED');
    });

    it('mode ON -> new recipients used', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'ON',
      });

      // Override DESIGNER to ON and STORES to OFF
      userEmailOverrideRepoMock.find.mockResolvedValue([
        { userId: 'u-designer', eventCode: 'RM_SUBMITTED', state: 'ON' },
        { userId: 'u-stores', eventCode: 'RM_SUBMITTED', state: 'OFF' },
      ]);

      const result = await commService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'rm-123',
      });

      // New recipients used: Designer included, Stores excluded
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('designer@example.com');
    });

    it('non-configurable or unknown event -> resolver returns null, old logic used', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'ON',
      });

      // Event is marked as non-configurable in notification_events
      notificationEventRepoMock.findOne.mockResolvedValue({
        code: 'RM_SUBMITTED',
        isConfigurable: false,
      });

      const resolveSpy = vi.spyOn(preferenceService, 'resolveRecipients');

      const result = await commService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'rm-123',
      });

      // Resolver returned null, fallback to old logic sent email to STORES
      expect(resolveSpy).toHaveBeenCalled();
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('stores@example.com');
    });

    it('resolver throws -> old logic used, email still sent', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'ON',
      });

      vi.spyOn(preferenceService, 'resolveRecipients').mockRejectedValue(
        new Error('Database query timed out'),
      );
      const errorSpy = vi.spyOn((commService as any).logger, 'error');

      const result = await commService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'rm-123',
      });

      // Fallback to old logic ensures STORES still gets email
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('stores@example.com');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('ADDITIONAL_MATERIAL_REQUESTED resolves as ADDITIONAL_REQUEST in communication flow', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'ON',
      });

      const resolveSpy = vi.spyOn(preferenceService, 'resolveRecipients');

      const result = await commService.sendEvent({
        eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
        entityType: 'ADDITIONAL_REQUEST',
        entityId: 'ar-123',
      });

      expect(resolveSpy).toHaveBeenCalledWith('ADDITIONAL_MATERIAL_REQUESTED', undefined);
      expect(result.emailJobs).toHaveLength(1);
      expect(result.emailJobs[0].recipientEmail).toBe('stores@example.com');
    });
  });
});
