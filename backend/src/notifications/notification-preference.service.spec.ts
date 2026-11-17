import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationPreferenceService,
  EVENT_ALIAS_MAP,
} from './notification-preference.service.js';

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let notificationEventRepo: any;
  let roleEmailSettingRepo: any;
  let userEmailOverrideRepo: any;
  let userPrefRepo: any;
  let userRepo: any;
  let systemSettingRepo: any;

  const roles = {
    DESIGNER: { id: 'role-designer-uuid', name: 'DESIGNER' },
    STORES: { id: 'role-stores-uuid', name: 'STORES' },
    PRODUCTION: { id: 'role-production-uuid', name: 'PRODUCTION' },
    ADMIN: { id: 'role-admin-uuid', name: 'ADMIN' },
  };

  beforeEach(() => {
    notificationEventRepo = {
      findOne: vi.fn(),
    };
    roleEmailSettingRepo = {
      find: vi.fn(),
    };
    userEmailOverrideRepo = {
      find: vi.fn(),
    };
    userPrefRepo = {
      find: vi.fn(),
    };
    userRepo = {
      find: vi.fn(),
    };
    systemSettingRepo = {
      findOne: vi.fn(),
    };

    service = new NotificationPreferenceService(
      notificationEventRepo,
      roleEmailSettingRepo,
      userEmailOverrideRepo,
      userPrefRepo,
      userRepo,
      systemSettingRepo,
    );
  });

  describe('getMode', () => {
    const originalEnv = process.env.EMAIL_PREFS_V2_MODE;

    beforeEach(() => {
      delete process.env.EMAIL_PREFS_V2_MODE;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.EMAIL_PREFS_V2_MODE = originalEnv;
      } else {
        delete process.env.EMAIL_PREFS_V2_MODE;
      }
    });

    it('reads EMAIL_PREFS_V2_MODE from system_settings when present', async () => {
      systemSettingRepo.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'SHADOW',
      });
      process.env.EMAIL_PREFS_V2_MODE = 'OFF';

      const mode = await service.getMode();
      expect(mode).toBe('SHADOW');
      expect(systemSettingRepo.findOne).toHaveBeenCalledWith({
        where: { key: 'EMAIL_PREFS_V2_MODE' },
      });
    });

    it('falls back to env var when system_settings row is missing', async () => {
      systemSettingRepo.findOne.mockResolvedValue(null);
      process.env.EMAIL_PREFS_V2_MODE = 'ON';

      const mode = await service.getMode();
      expect(mode).toBe('ON');
    });

    it('defaults to OFF when neither system_settings nor env var is set', async () => {
      systemSettingRepo.findOne.mockResolvedValue(null);

      const mode = await service.getMode();
      expect(mode).toBe('OFF');
    });

    it('falls back gracefully to OFF if systemSetting query throws', async () => {
      systemSettingRepo.findOne.mockRejectedValue(new Error('DB disconnect'));

      const mode = await service.getMode();
      expect(mode).toBe('OFF');
    });

    it('caches the mode in memory for 30s so subsequent calls make 0 DB queries', async () => {
      systemSettingRepo.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'OFF',
      });

      const mode1 = await service.getMode();
      expect(mode1).toBe('OFF');
      expect(systemSettingRepo.findOne).toHaveBeenCalledTimes(1);

      // Subsequent calls within 30s TTL must not query the DB
      const mode2 = await service.getMode();
      const mode3 = await service.getMode();
      expect(mode2).toBe('OFF');
      expect(mode3).toBe('OFF');
      expect(systemSettingRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('refreshes mode from system_settings after 30s TTL expires', async () => {
      vi.useFakeTimers();
      try {
        systemSettingRepo.findOne.mockResolvedValue({
          key: 'EMAIL_PREFS_V2_MODE',
          value: 'OFF',
        });

        const mode1 = await service.getMode();
        expect(mode1).toBe('OFF');
        expect(systemSettingRepo.findOne).toHaveBeenCalledTimes(1);

        // Advance time by 31 seconds
        vi.advanceTimersByTime(31_000);

        systemSettingRepo.findOne.mockResolvedValue({
          key: 'EMAIL_PREFS_V2_MODE',
          value: 'ON',
        });

        const mode2 = await service.getMode();
        expect(mode2).toBe('ON');
        expect(systemSettingRepo.findOne).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('clearModeCache() immediately invalidates in-memory cache', async () => {
      systemSettingRepo.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'OFF',
      });

      await service.getMode();
      expect(systemSettingRepo.findOne).toHaveBeenCalledTimes(1);

      service.clearModeCache();

      systemSettingRepo.findOne.mockResolvedValue({
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'SHADOW',
      });

      const mode = await service.getMode();
      expect(mode).toBe('SHADOW');
      expect(systemSettingRepo.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveRecipients', () => {
    const defaultEvent = {
      code: 'RM_SUBMITTED',
      isConfigurable: true,
    };

    beforeEach(() => {
      notificationEventRepo.findOne.mockResolvedValue(defaultEvent);
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.STORES.id, eventCode: 'RM_SUBMITTED', enabled: true },
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: false },
        { roleId: roles.PRODUCTION.id, eventCode: 'RM_SUBMITTED', enabled: false },
        { roleId: roles.ADMIN.id, eventCode: 'RM_SUBMITTED', enabled: false },
      ]);
      userEmailOverrideRepo.find.mockResolvedValue([]);
      userPrefRepo.find.mockResolvedValue([]);
    });

    it('role ON, no override -> included', async () => {
      const storesUser = {
        id: 'user-stores-1',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(1);
      expect(recipients![0].id).toBe('user-stores-1');
    });

    it('role OFF, no override -> excluded', async () => {
      const designerUser = {
        id: 'user-designer-1',
        email: 'designer@example.com',
        roleId: roles.DESIGNER.id,
        role: roles.DESIGNER,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([designerUser]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(0);
    });

    it('role OFF + override ON -> included', async () => {
      const designerUser = {
        id: 'user-designer-1',
        email: 'designer@example.com',
        roleId: roles.DESIGNER.id,
        role: roles.DESIGNER,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([designerUser]);
      userEmailOverrideRepo.find.mockResolvedValue([
        { userId: 'user-designer-1', eventCode: 'RM_SUBMITTED', state: 'ON' },
      ]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(1);
      expect(recipients![0].id).toBe('user-designer-1');
    });

    it('role ON + override OFF -> excluded', async () => {
      const storesUser = {
        id: 'user-stores-1',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser]);
      userEmailOverrideRepo.find.mockResolvedValue([
        { userId: 'user-stores-1', eventCode: 'RM_SUBMITTED', state: 'OFF' },
      ]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(0);
    });

    it('4 designers, role ON, 2 overrides OFF -> exactly 2 receive', async () => {
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: true },
      ]);
      const designers = [
        { id: 'd-1', email: 'd1@example.com', roleId: roles.DESIGNER.id, role: roles.DESIGNER, isActive: true },
        { id: 'd-2', email: 'd2@example.com', roleId: roles.DESIGNER.id, role: roles.DESIGNER, isActive: true },
        { id: 'd-3', email: 'd3@example.com', roleId: roles.DESIGNER.id, role: roles.DESIGNER, isActive: true },
        { id: 'd-4', email: 'd4@example.com', roleId: roles.DESIGNER.id, role: roles.DESIGNER, isActive: true },
      ];
      userRepo.find.mockResolvedValue(designers);
      userEmailOverrideRepo.find.mockResolvedValue([
        { userId: 'd-2', eventCode: 'RM_SUBMITTED', state: 'OFF' },
        { userId: 'd-4', eventCode: 'RM_SUBMITTED', state: 'OFF' },
      ]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(2);
      expect(recipients!.map((u) => u.id).sort()).toEqual(['d-1', 'd-3']);
    });

    it('legacy workflow_email_enabled=false, no override -> excluded', async () => {
      const storesUser = {
        id: 'user-stores-1',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser]);
      userPrefRepo.find.mockResolvedValue([
        { userId: 'user-stores-1', workflowEmailEnabled: false },
      ]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(0);
    });

    it('legacy false + override ON -> included', async () => {
      const storesUser = {
        id: 'user-stores-1',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser]);
      userPrefRepo.find.mockResolvedValue([
        { userId: 'user-stores-1', workflowEmailEnabled: false },
      ]);
      userEmailOverrideRepo.find.mockResolvedValue([
        { userId: 'user-stores-1', eventCode: 'RM_SUBMITTED', state: 'ON' },
      ]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED');
      expect(recipients).toHaveLength(1);
      expect(recipients![0].id).toBe('user-stores-1');
    });

    it('actor excluded; inactive user excluded', async () => {
      const storesUser1 = {
        id: 'user-actor',
        email: 'actor@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      const storesUser2 = {
        id: 'user-stores-2',
        email: 'stores2@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      const inactiveUser = {
        id: 'user-inactive',
        email: 'inactive@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: false,
      };
      userRepo.find.mockResolvedValue([storesUser1, storesUser2, inactiveUser]);

      const recipients = await service.resolveRecipients('RM_SUBMITTED', 'user-actor');
      expect(recipients).toHaveLength(1);
      expect(recipients![0].id).toBe('user-stores-2');
    });

    it('non-configurable or unknown event -> resolver returns null', async () => {
      // 1. Unknown event
      notificationEventRepo.findOne.mockResolvedValueOnce(null);
      const resUnknown = await service.resolveRecipients('NON_EXISTENT_EVENT');
      expect(resUnknown).toBeNull();

      // 2. Event with isConfigurable = false
      notificationEventRepo.findOne.mockResolvedValueOnce({
        code: 'PASSWORD_RESET',
        isConfigurable: false,
      });
      const resNonConfig = await service.resolveRecipients('PASSWORD_RESET');
      expect(resNonConfig).toBeNull();
    });

    it('ADDITIONAL_MATERIAL_REQUESTED resolves as ADDITIONAL_REQUEST', async () => {
      notificationEventRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.code === 'ADDITIONAL_REQUEST') {
          return { code: 'ADDITIONAL_REQUEST', isConfigurable: true };
        }
        return null;
      });

      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.STORES.id, eventCode: 'ADDITIONAL_REQUEST', enabled: true },
      ]);

      const storesUser = {
        id: 'stores-user-id',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser]);

      const recipients = await service.resolveRecipients('ADDITIONAL_MATERIAL_REQUESTED');
      expect(notificationEventRepo.findOne).toHaveBeenCalledWith({
        where: { code: 'ADDITIONAL_REQUEST' },
      });
      expect(roleEmailSettingRepo.find).toHaveBeenCalledWith({
        where: { eventCode: 'ADDITIONAL_REQUEST' },
      });
      expect(recipients).toHaveLength(1);
      expect(recipients![0].id).toBe('stores-user-id');
    });
  });

  describe('resolveRecipientsDetailed (Phase 6 Skipped Reasons)', () => {
    beforeEach(() => {
      notificationEventRepo.findOne.mockResolvedValue({
        code: 'RM_SUBMITTED',
        isConfigurable: true,
      });
      userPrefRepo.find.mockResolvedValue([]);
    });

    it('role ON + override OFF -> one OVERRIDE_OFF row in skipped; role OFF + override OFF -> no row', async () => {
      // Stores role ON, Designer role OFF
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.STORES.id, eventCode: 'RM_SUBMITTED', enabled: true },
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: false },
      ]);

      const storesUser = {
        id: 'u-stores',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      const designerUser = {
        id: 'u-designer',
        email: 'designer@example.com',
        roleId: roles.DESIGNER.id,
        role: roles.DESIGNER,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser, designerUser]);

      // Both users have override OFF
      userEmailOverrideRepo.find.mockResolvedValue([
        { userId: 'u-stores', eventCode: 'RM_SUBMITTED', state: 'OFF' },
        { userId: 'u-designer', eventCode: 'RM_SUBMITTED', state: 'OFF' },
      ]);

      const result = await service.resolveRecipientsDetailed('RM_SUBMITTED');
      expect(result).not.toBeNull();
      expect(result!.recipients).toHaveLength(0);

      // Only storesUser should be in skipped with OVERRIDE_OFF because their role was ON
      // designerUser's role was OFF, so no row for them
      expect(result!.skipped).toHaveLength(1);
      expect(result!.skipped[0]).toEqual({
        user: storesUser,
        reason: 'OVERRIDE_OFF',
      });
    });

    it('role ON + legacy off -> LEGACY_USER_OFF; role OFF + legacy off -> no row', async () => {
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.STORES.id, eventCode: 'RM_SUBMITTED', enabled: true },
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: false },
      ]);

      const storesUser = {
        id: 'u-stores',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      const designerUser = {
        id: 'u-designer',
        email: 'designer@example.com',
        roleId: roles.DESIGNER.id,
        role: roles.DESIGNER,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser, designerUser]);
      userEmailOverrideRepo.find.mockResolvedValue([]);

      // Both users have workflowEmailEnabled = false
      userPrefRepo.find.mockResolvedValue([
        { userId: 'u-stores', workflowEmailEnabled: false },
        { userId: 'u-designer', workflowEmailEnabled: false },
      ]);

      const result = await service.resolveRecipientsDetailed('RM_SUBMITTED');
      expect(result).not.toBeNull();
      expect(result!.recipients).toHaveLength(0);

      expect(result!.skipped).toHaveLength(1);
      expect(result!.skipped[0]).toEqual({
        user: storesUser,
        reason: 'LEGACY_USER_OFF',
      });
    });

    it('actor with role ON -> ACTOR row; actor with role OFF -> no row', async () => {
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.STORES.id, eventCode: 'RM_SUBMITTED', enabled: true },
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: false },
      ]);

      const storesUser = {
        id: 'u-stores',
        email: 'stores@example.com',
        roleId: roles.STORES.id,
        role: roles.STORES,
        isActive: true,
      };
      const designerUser = {
        id: 'u-designer',
        email: 'designer@example.com',
        roleId: roles.DESIGNER.id,
        role: roles.DESIGNER,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([storesUser, designerUser]);
      userEmailOverrideRepo.find.mockResolvedValue([]);
      userPrefRepo.find.mockResolvedValue([]);

      // Test storesUser as actor
      const resStoresActor = await service.resolveRecipientsDetailed('RM_SUBMITTED', 'u-stores');
      expect(resStoresActor!.recipients).toHaveLength(0);
      expect(resStoresActor!.skipped).toEqual([
        { user: storesUser, reason: 'ACTOR' },
      ]);

      // Test designerUser as actor (role OFF -> no ACTOR row)
      const resDesignerActor = await service.resolveRecipientsDetailed('RM_SUBMITTED', 'u-designer');
      expect(resDesignerActor!.recipients).toEqual([storesUser]);
      expect(resDesignerActor!.skipped).toHaveLength(0); // designerUser role OFF -> no row
    });

    it('ROLE_OFF is never written to skipped', async () => {
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: roles.DESIGNER.id, eventCode: 'RM_SUBMITTED', enabled: false },
      ]);

      const designerUser = {
        id: 'u-designer',
        email: 'designer@example.com',
        roleId: roles.DESIGNER.id,
        role: roles.DESIGNER,
        isActive: true,
      };
      userRepo.find.mockResolvedValue([designerUser]);
      userEmailOverrideRepo.find.mockResolvedValue([]);
      userPrefRepo.find.mockResolvedValue([]);

      const result = await service.resolveRecipientsDetailed('RM_SUBMITTED');
      expect(result!.recipients).toHaveLength(0);
      expect(result!.skipped).toHaveLength(0); // Never written
    });
  });
});
