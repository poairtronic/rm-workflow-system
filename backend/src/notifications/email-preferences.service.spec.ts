import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmailPreferencesService } from './email-preferences.service.js';

describe('EmailPreferencesService', () => {
  let service: EmailPreferencesService;

  let notificationEventRepo: any;
  let roleEmailSettingRepo: any;
  let userEmailOverrideRepo: any;
  let emailSettingAuditRepo: any;
  let systemSettingRepo: any;
  let userPrefRepo: any;
  let roleRepo: any;
  let userRepo: any;
  let notificationPreferenceService: any;
  let dataSource: any;
  let transactionManager: any;
  let alertSweepService: any;

  const mockRoles = [
    { id: 'role-admin-id', name: 'ADMIN' },
    { id: 'role-designer-id', name: 'DESIGNER' },
    { id: 'role-stores-id', name: 'STORES' },
    { id: 'role-production-id', name: 'PRODUCTION' },
    { id: 'role-sm-id', name: 'SENIOR_MANAGER' },
    { id: 'role-gm-id', name: 'GENERAL_MANAGER' },
  ];

  const mockEvents = [
    { code: 'RM_SUBMITTED', label: 'RM Requisition Submitted', category: 'Raw Material', isConfigurable: true },
    { code: 'MATERIAL_ISSUED', label: 'Material Issued', category: 'Material Issue', isConfigurable: true },
  ];

  const mockUsers = [
    {
      id: 'user-1',
      name: 'Stores Officer',
      email: 'stores@example.com',
      department: 'Warehouse',
      roleId: 'role-stores-id',
      role: { id: 'role-stores-id', name: 'STORES' },
      isActive: true,
    },
    {
      id: 'user-inactive',
      name: 'Old User',
      email: 'inactive@example.com',
      roleId: 'role-stores-id',
      role: { id: 'role-stores-id', name: 'STORES' },
      isActive: false,
    },
  ];

  beforeEach(() => {
    notificationEventRepo = {
      find: vi.fn().mockResolvedValue(mockEvents),
      findOne: vi.fn().mockImplementation(async ({ where }: any) => {
        return mockEvents.find((e) => e.code === where.code && e.isConfigurable === where.isConfigurable) || null;
      }),
    };

    roleEmailSettingRepo = {
      find: vi.fn().mockResolvedValue([
        { roleId: 'role-stores-id', eventCode: 'RM_SUBMITTED', enabled: true },
      ]),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (entity) => ({ id: 'res-id', ...entity })),
      create: vi.fn().mockImplementation((val) => val),
    };

    userEmailOverrideRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (entity) => ({ id: 'ueo-id', ...entity })),
      create: vi.fn().mockImplementation((val) => val),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([{ userId: 'user-1', count: '2' }]),
      })),
    };

    emailSettingAuditRepo = {
      save: vi.fn().mockImplementation(async (entity) => ({ id: 'audit-id', ...entity })),
      create: vi.fn().mockImplementation((val) => val),
      createQueryBuilder: vi.fn(() => ({
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          {
            id: 'audit-1',
            scope: 'ROLE',
            targetId: 'role-stores-id',
            eventCode: 'RM_SUBMITTED',
            oldValue: 'OFF',
            newValue: 'ON',
            changedBy: 'user-admin',
            changedAt: new Date('2026-11-17T10:00:00Z'),
          },
        ]),
      })),
    };

    systemSettingRepo = {
      findOne: vi.fn().mockResolvedValue({ key: 'EMAIL_PREFS_V2_MODE', value: 'OFF' }),
      save: vi.fn().mockImplementation(async (entity) => entity),
      create: vi.fn().mockImplementation((val) => val),
    };

    userPrefRepo = {
      findOne: vi.fn().mockResolvedValue({ userId: 'user-1', workflowEmailEnabled: true }),
    };

    roleRepo = {
      find: vi.fn().mockResolvedValue(mockRoles),
      findOne: vi.fn().mockImplementation(async ({ where }: any) => {
        return mockRoles.find((r) => r.id === where.id) || null;
      }),
    };

    userRepo = {
      find: vi.fn().mockResolvedValue(mockUsers.filter((u) => u.isActive)),
      findOne: vi.fn().mockImplementation(async ({ where }: any) => {
        return mockUsers.find((u) => u.id === where.id) || null;
      }),
    };

    notificationPreferenceService = {
      getMode: vi.fn().mockResolvedValue('OFF'),
      clearModeCache: vi.fn(),
    };

    transactionManager = {
      getRepository: vi.fn((entityClass) => {
        if (entityClass.name === 'RoleEmailSetting') return roleEmailSettingRepo;
        if (entityClass.name === 'UserEmailOverride') return userEmailOverrideRepo;
        if (entityClass.name === 'EmailSettingAudit') return emailSettingAuditRepo;
        return null;
      }),
    };

    dataSource = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(transactionManager)),
    };

    alertSweepService = {
      getAllSweepConfigs: vi.fn().mockResolvedValue([
        { eventCode: 'DC_PENDING_2_DAYS', enabled: false, thresholdHours: 48, defaultHours: 48 },
      ]),
      updateSweepConfig: vi.fn().mockResolvedValue({
        eventCode: 'DC_PENDING_2_DAYS',
        enabled: true,
        thresholdHours: 36,
      }),
      previewSweep: vi.fn().mockResolvedValue({
        matchCount: 2,
        sample: [{ id: 'dc-1', referenceNumber: 'DC-001', hoursPending: 50 }],
      }),
    };

    service = new EmailPreferencesService(
      notificationEventRepo,
      roleEmailSettingRepo,
      userEmailOverrideRepo,
      emailSettingAuditRepo,
      systemSettingRepo,
      userPrefRepo,
      roleRepo,
      userRepo,
      notificationPreferenceService,
      dataSource,
      alertSweepService,
    );
  });

  describe('getEvents', () => {
    it('returns configurable events only', async () => {
      const events = await service.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        code: 'RM_SUBMITTED',
        label: 'RM Requisition Submitted',
        category: 'Raw Material',
      });
    });
  });

  describe('getRoleMatrix', () => {
    it('returns current mode, roles list, events list, and matrix dictionary', async () => {
      const res = await service.getRoleMatrix();
      expect(res.mode).toBe('OFF');
      expect(res.roles).toHaveLength(6);
      expect(res.events).toHaveLength(2);
      expect(res.matrix['role-stores-id']['RM_SUBMITTED']).toBe(true);
      expect(res.matrix['role-stores-id']['MATERIAL_ISSUED']).toBe(false);
      expect(res.matrix['role-designer-id']['RM_SUBMITTED']).toBe(false);
    });
  });

  describe('updateRoleEvent', () => {
    it('throws 404 if roleId does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateRoleEvent('unknown-role', 'RM_SUBMITTED', true, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 for PASSWORD_RESET, TEST_EMAIL or unregistered event', async () => {
      await expect(
        service.updateRoleEvent('role-stores-id', 'PASSWORD_RESET', true, 'admin-id'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateRoleEvent('role-stores-id', 'TEST_EMAIL', true, 'admin-id'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateRoleEvent('role-stores-id', 'UNKNOWN_EVENT', true, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('no-op when new value equals current value (no write, no audit)', async () => {
      roleEmailSettingRepo.findOne.mockResolvedValue({
        id: 'setting-1',
        roleId: 'role-stores-id',
        eventCode: 'RM_SUBMITTED',
        enabled: true,
      });

      const res = await service.updateRoleEvent('role-stores-id', 'RM_SUBMITTED', true, 'admin-id');
      expect(res.enabled).toBe(true);
      expect(roleEmailSettingRepo.save).not.toHaveBeenCalled();
      expect(emailSettingAuditRepo.save).not.toHaveBeenCalled();
    });

    it('writes role_email_settings and email_setting_audit row when value changes', async () => {
      roleEmailSettingRepo.findOne.mockResolvedValue({
        id: 'setting-1',
        roleId: 'role-stores-id',
        eventCode: 'RM_SUBMITTED',
        enabled: true,
      });

      const res = await service.updateRoleEvent('role-stores-id', 'RM_SUBMITTED', false, 'admin-id');
      expect(res.enabled).toBe(false);
      expect(roleEmailSettingRepo.save).toHaveBeenCalled();
      expect(emailSettingAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'ROLE',
          targetId: 'role-stores-id',
          eventCode: 'RM_SUBMITTED',
          oldValue: 'ON',
          newValue: 'OFF',
          changedBy: 'admin-id',
        }),
      );
    });
  });

  describe('bulkUpdateRoleEvents', () => {
    it('rolls back and throws 400 if any event in changes is invalid', async () => {
      await expect(
        service.bulkUpdateRoleEvents(
          'role-stores-id',
          [
            { eventCode: 'RM_SUBMITTED', enabled: false },
            { eventCode: 'PASSWORD_RESET', enabled: true },
          ],
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('updates all valid items in a single transaction and audits changes', async () => {
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: 'role-stores-id', eventCode: 'RM_SUBMITTED', enabled: true },
        { roleId: 'role-stores-id', eventCode: 'MATERIAL_ISSUED', enabled: false },
      ]);

      const res = await service.bulkUpdateRoleEvents(
        'role-stores-id',
        [
          { eventCode: 'RM_SUBMITTED', enabled: false }, // Changed ON -> OFF
          { eventCode: 'MATERIAL_ISSUED', enabled: false }, // No-op OFF -> OFF
        ],
        'admin-id',
      );

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(emailSettingAuditRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUsers', () => {
    it('returns active users with explicit override count', async () => {
      const users = await service.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual({
        id: 'user-1',
        name: 'Stores Officer',
        email: 'stores@example.com',
        department: 'Warehouse',
        role: { id: 'role-stores-id', name: 'STORES' },
        overrideCount: 2,
      });
    });

    it('throws 404 if roleId filter is provided but role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(service.getUsers('unknown-role')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPreferences', () => {
    it('throws 404 if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserPreferences('unknown-user')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 if user is inactive', async () => {
      await expect(service.getUserPreferences('user-inactive')).rejects.toThrow(BadRequestException);
    });

    it('returns user preferences with effective resolution matching evaluateUserPreference', async () => {
      userEmailOverrideRepo.find.mockResolvedValue([
        { userId: 'user-1', eventCode: 'RM_SUBMITTED', state: 'OFF' },
      ]);
      roleEmailSettingRepo.find.mockResolvedValue([
        { roleId: 'role-stores-id', eventCode: 'RM_SUBMITTED', enabled: true },
        { roleId: 'role-stores-id', eventCode: 'MATERIAL_ISSUED', enabled: true },
      ]);

      const res = await service.getUserPreferences('user-1');
      expect(res.legacyEmailOff).toBe(false);

      // Event 1: RM_SUBMITTED has override OFF -> effective false (source OVERRIDE_OFF)
      const ev1 = res.events.find((e) => e.code === 'RM_SUBMITTED');
      expect(ev1?.override).toBe('OFF');
      expect(ev1?.roleEnabled).toBe(true);
      expect(ev1?.effective).toBe(false);
      expect(ev1?.source).toBe('OVERRIDE_OFF');

      // Event 2: MATERIAL_ISSUED has no override (INHERIT) -> inherits roleEnabled true -> effective true (source ROLE_ON)
      const ev2 = res.events.find((e) => e.code === 'MATERIAL_ISSUED');
      expect(ev2?.override).toBe('INHERIT');
      expect(ev2?.roleEnabled).toBe(true);
      expect(ev2?.effective).toBe(true);
      expect(ev2?.source).toBe('ROLE_ON');
    });
  });

  describe('updateUserOverride', () => {
    it('throws 404 for unknown user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateUserOverride('unknown-user', 'RM_SUBMITTED', 'ON', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 for inactive user', async () => {
      await expect(
        service.updateUserOverride('user-inactive', 'RM_SUBMITTED', 'ON', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for non-configurable event', async () => {
      await expect(
        service.updateUserOverride('user-1', 'PASSWORD_RESET', 'ON', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('no-op when new state matches current state (no writes, no audit)', async () => {
      userEmailOverrideRepo.findOne.mockResolvedValue({
        id: 'override-1',
        userId: 'user-1',
        eventCode: 'RM_SUBMITTED',
        state: 'ON',
      });

      const res = await service.updateUserOverride('user-1', 'RM_SUBMITTED', 'ON', 'admin-id');
      expect(res.state).toBe('ON');
      expect(userEmailOverrideRepo.save).not.toHaveBeenCalled();
      expect(emailSettingAuditRepo.save).not.toHaveBeenCalled();
    });

    it('state INHERIT deletes existing row and writes audit entry', async () => {
      userEmailOverrideRepo.findOne.mockResolvedValue({
        id: 'override-1',
        userId: 'user-1',
        eventCode: 'RM_SUBMITTED',
        state: 'ON',
      });

      const res = await service.updateUserOverride('user-1', 'RM_SUBMITTED', 'INHERIT', 'admin-id');
      expect(res.state).toBe('INHERIT');
      expect(userEmailOverrideRepo.delete).toHaveBeenCalledWith({ id: 'override-1' });
      expect(emailSettingAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'USER',
          targetId: 'user-1',
          eventCode: 'RM_SUBMITTED',
          oldValue: 'ON',
          newValue: 'INHERIT',
          changedBy: 'admin-id',
        }),
      );
    });

    it('state ON creates new override row and writes audit entry', async () => {
      userEmailOverrideRepo.findOne.mockResolvedValue(null);

      const res = await service.updateUserOverride('user-1', 'RM_SUBMITTED', 'ON', 'admin-id');
      expect(res.state).toBe('ON');
      expect(userEmailOverrideRepo.save).toHaveBeenCalled();
      expect(emailSettingAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'USER',
          targetId: 'user-1',
          eventCode: 'RM_SUBMITTED',
          oldValue: 'INHERIT',
          newValue: 'ON',
          changedBy: 'admin-id',
        }),
      );
    });
  });

  describe('bulkUpdateUserOverrides', () => {
    it('rolls back and throws 400 if any event in changes is invalid', async () => {
      await expect(
        service.bulkUpdateUserOverrides(
          'user-1',
          [
            { eventCode: 'RM_SUBMITTED', state: 'ON' },
            { eventCode: 'TEST_EMAIL', state: 'OFF' },
          ],
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('executes bulk user overrides atomically and skips no-ops', async () => {
      userEmailOverrideRepo.find.mockResolvedValue([
        { id: 'ov-1', userId: 'user-1', eventCode: 'RM_SUBMITTED', state: 'OFF' },
      ]);

      const res = await service.bulkUpdateUserOverrides(
        'user-1',
        [
          { eventCode: 'RM_SUBMITTED', state: 'INHERIT' }, // Changed OFF -> INHERIT (delete)
          { eventCode: 'MATERIAL_ISSUED', state: 'ON' }, // Changed INHERIT -> ON (create)
        ],
        'admin-id',
      );

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      expect(userEmailOverrideRepo.delete).toHaveBeenCalledWith({ id: 'ov-1' });
      expect(emailSettingAuditRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAuditLogs', () => {
    it('returns formatted audit logs with resolved actor names and next cursor', async () => {
      userRepo.find.mockResolvedValue([{ id: 'user-admin', name: 'Admin Principal' }]);

      const res = await service.getAuditLogs({ limit: 10 });
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0]).toEqual({
        id: 'audit-1',
        scope: 'ROLE',
        targetId: 'role-stores-id',
        eventCode: 'RM_SUBMITTED',
        oldValue: 'OFF',
        newValue: 'ON',
        changedBy: 'user-admin',
        changedByName: 'Admin Principal',
        changedAt: expect.any(Date),
      });
      expect(res.nextCursor).toBeNull();
    });
  });

  describe('getMode & updateMode', () => {
    it('getMode returns current mode from NotificationPreferenceService', async () => {
      notificationPreferenceService.getMode.mockResolvedValue('SHADOW');
      const res = await service.getMode();
      expect(res).toEqual({ mode: 'SHADOW' });
    });

    it('updateMode rejects values other than OFF, SHADOW, ON with 400', async () => {
      await expect(service.updateMode('INVALID' as any, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updateMode writes EMAIL_PREFS_V2_MODE in system_settings and invalidates in-memory cache', async () => {
      systemSettingRepo.findOne.mockResolvedValue({
        id: 'setting-uuid',
        key: 'EMAIL_PREFS_V2_MODE',
        value: 'OFF',
      });

      const res = await service.updateMode('ON', 'admin-id');
      expect(res).toEqual({ success: true, mode: 'ON' });
      expect(systemSettingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'EMAIL_PREFS_V2_MODE',
          value: 'ON',
          updatedBy: 'admin-id',
        }),
      );
      expect(notificationPreferenceService.clearModeCache).toHaveBeenCalled();
    });
  });

  describe('Sweeps Endpoints (Phase 5)', () => {
    it('getSweeps delegates to alertSweepService.getAllSweepConfigs', async () => {
      const sweeps = await service.getSweeps();
      expect(sweeps).toHaveLength(1);
      expect(alertSweepService.getAllSweepConfigs).toHaveBeenCalled();
    });

    it('updateSweep throws BadRequestException (400) for invalid eventCode', async () => {
      await expect(
        service.updateSweep('UNKNOWN_EVENT', { enabled: true, thresholdHours: 48 }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateSweep throws BadRequestException (400) for thresholdHours < 1 or > 720', async () => {
      await expect(
        service.updateSweep('DC_PENDING_2_DAYS', { enabled: true, thresholdHours: 0 }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateSweep('DC_PENDING_2_DAYS', { enabled: true, thresholdHours: 1000 }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateSweep updates configuration successfully when valid', async () => {
      const res = await service.updateSweep(
        'DC_PENDING_2_DAYS',
        { enabled: true, thresholdHours: 36 },
        'admin-1',
      );
      expect(res.enabled).toBe(true);
      expect(res.thresholdHours).toBe(36);
      expect(alertSweepService.updateSweepConfig).toHaveBeenCalledWith(
        'DC_PENDING_2_DAYS',
        true,
        36,
        'admin-1',
      );
    });

    it('previewSweep throws BadRequestException (400) for invalid eventCode', async () => {
      await expect(service.previewSweep('INVALID_EVENT')).rejects.toThrow(BadRequestException);
    });

    it('previewSweep returns preview results from alertSweepService', async () => {
      const preview = await service.previewSweep('DC_PENDING_2_DAYS');
      expect(preview.matchCount).toBe(2);
      expect(preview.sample).toHaveLength(1);
      expect(alertSweepService.previewSweep).toHaveBeenCalledWith('DC_PENDING_2_DAYS');
    });
  });
});
