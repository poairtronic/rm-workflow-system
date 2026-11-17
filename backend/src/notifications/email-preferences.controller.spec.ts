import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EmailPreferencesController } from './email-preferences.controller.js';
import { EmailPreferencesService } from './email-preferences.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../auth/enums/role.enum.js';

describe('EmailPreferencesController — RBAC & Endpoints (Phase 3)', () => {
  let controller: EmailPreferencesController;
  let service: EmailPreferencesService;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  const mockService = {
    getEvents: vi.fn(),
    getRoleMatrix: vi.fn(),
    updateRoleEvent: vi.fn(),
    bulkUpdateRoleEvents: vi.fn(),
    getUsers: vi.fn(),
    getUserPreferences: vi.fn(),
    updateUserOverride: vi.fn(),
    bulkUpdateUserOverrides: vi.fn(),
    getAuditLogs: vi.fn(),
    getMode: vi.fn(),
    updateMode: vi.fn(),
    getSweeps: vi.fn(),
    updateSweep: vi.fn(),
    previewSweep: vi.fn(),
    getSkips: vi.fn(),
    getSkipsSummary: vi.fn(),
  };

  const createMockContext = (userRole: string, handler: any): ExecutionContext => {
    return {
      getHandler: () => handler,
      getClass: () => EmailPreferencesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'test-user-id', role: userRole },
        }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    service = mockService as any;
    controller = new EmailPreferencesController(service);
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  describe('RBAC Metadata Verification', () => {
    it('read endpoints allow ADMIN and GENERAL_MANAGER only', () => {
      const readHandlers = [
        controller.getEvents,
        controller.getRoleMatrix,
        controller.getUsers,
        controller.getUserPreferences,
        controller.getAuditLogs,
        controller.getMode,
        controller.getSweeps,
        controller.previewSweep,
      ];

      for (const handler of readHandlers) {
        const roles = reflector.get<string[]>('roles', handler);
        expect(roles).toEqual([UserRole.ADMIN, UserRole.GENERAL_MANAGER]);
        expect(roles).not.toContain(UserRole.DESIGNER);
        expect(roles).not.toContain(UserRole.STORES);
        expect(roles).not.toContain(UserRole.PRODUCTION);
        expect(roles).not.toContain(UserRole.SENIOR_MANAGER);
      }
    });

    it('write endpoints allow ADMIN only', () => {
      const writeHandlers = [
        controller.updateRoleEvent,
        controller.bulkUpdateRoleEvents,
        controller.updateUserOverride,
        controller.bulkUpdateUserOverrides,
        controller.updateMode,
        controller.updateSweep,
      ];

      for (const handler of writeHandlers) {
        const roles = reflector.get<string[]>('roles', handler);
        expect(roles).toEqual([UserRole.ADMIN]);
        expect(roles).not.toContain(UserRole.GENERAL_MANAGER);
        expect(roles).not.toContain(UserRole.DESIGNER);
        expect(roles).not.toContain(UserRole.STORES);
        expect(roles).not.toContain(UserRole.PRODUCTION);
        expect(roles).not.toContain(UserRole.SENIOR_MANAGER);
      }
    });
  });

  describe('RolesGuard Runtime Authorization Matrix', () => {
    it('ADMIN can access both read and write endpoints', () => {
      const readCtx = createMockContext(UserRole.ADMIN, controller.getRoleMatrix);
      const writeCtx = createMockContext(UserRole.ADMIN, controller.updateRoleEvent);

      expect(rolesGuard.canActivate(readCtx)).toBe(true);
      expect(rolesGuard.canActivate(writeCtx)).toBe(true);
    });

    it('GENERAL_MANAGER can access read endpoints but is forbidden (403) from writes', () => {
      const readCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.getRoleMatrix);
      const writeRoleCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.updateRoleEvent);
      const writeUserCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.updateUserOverride);
      const writeModeCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.updateMode);
      const writeSweepCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.updateSweep);

      expect(rolesGuard.canActivate(readCtx)).toBe(true);
      expect(rolesGuard.canActivate(writeRoleCtx)).toBe(false);
      expect(rolesGuard.canActivate(writeUserCtx)).toBe(false);
      expect(rolesGuard.canActivate(writeModeCtx)).toBe(false);
      expect(rolesGuard.canActivate(writeSweepCtx)).toBe(false);
    });

    it('DESIGNER, STORES, PRODUCTION, SENIOR_MANAGER are forbidden from all endpoints', () => {
      const unauthorizedRoles = [
        UserRole.DESIGNER,
        UserRole.STORES,
        UserRole.PRODUCTION,
        UserRole.SENIOR_MANAGER,
      ];

      for (const role of unauthorizedRoles) {
        const readCtx = createMockContext(role, controller.getEvents);
        const writeCtx = createMockContext(role, controller.updateRoleEvent);

        expect(rolesGuard.canActivate(readCtx)).toBe(false);
        expect(rolesGuard.canActivate(writeCtx)).toBe(false);
      }
    });
  });

  describe('Controller Execution & Service Delegation', () => {
    const mockReq = { user: { userId: 'admin-actor-uuid' } };

    it('GET /events delegates to service.getEvents', async () => {
      mockService.getEvents.mockResolvedValue([{ code: 'RM_SUBMITTED' }]);
      const res = await controller.getEvents();
      expect(res).toEqual([{ code: 'RM_SUBMITTED' }]);
      expect(mockService.getEvents).toHaveBeenCalled();
    });

    it('GET /roles delegates to service.getRoleMatrix', async () => {
      mockService.getRoleMatrix.mockResolvedValue({ mode: 'OFF', roles: [], events: [], matrix: {} });
      const res = await controller.getRoleMatrix();
      expect(res.mode).toBe('OFF');
      expect(mockService.getRoleMatrix).toHaveBeenCalled();
    });

    it('PUT /roles/:roleId/events/:eventCode passes actor user id', async () => {
      mockService.updateRoleEvent.mockResolvedValue({ success: true });
      const res = await controller.updateRoleEvent(
        'role-uuid',
        'RM_SUBMITTED',
        { enabled: true },
        mockReq,
      );
      expect(res).toEqual({ success: true });
      expect(mockService.updateRoleEvent).toHaveBeenCalledWith(
        'role-uuid',
        'RM_SUBMITTED',
        true,
        'admin-actor-uuid',
      );
    });

    it('PUT /roles/:roleId bulk updates role settings', async () => {
      mockService.bulkUpdateRoleEvents.mockResolvedValue({ success: true, updatedCount: 2 });
      const res = await controller.bulkUpdateRoleEvents(
        'role-uuid',
        { changes: [{ eventCode: 'RM_SUBMITTED', enabled: true }] },
        mockReq,
      );
      expect(res.updatedCount).toBe(2);
      expect(mockService.bulkUpdateRoleEvents).toHaveBeenCalledWith(
        'role-uuid',
        [{ eventCode: 'RM_SUBMITTED', enabled: true }],
        'admin-actor-uuid',
      );
    });

    it('GET /users passes roleId filter query', async () => {
      mockService.getUsers.mockResolvedValue([{ id: 'u-1' }]);
      const res = await controller.getUsers({ roleId: 'role-uuid' });
      expect(res).toEqual([{ id: 'u-1' }]);
      expect(mockService.getUsers).toHaveBeenCalledWith('role-uuid');
    });

    it('GET /users/:userId delegates to service.getUserPreferences', async () => {
      mockService.getUserPreferences.mockResolvedValue({ mode: 'OFF', user: { id: 'u-1' } });
      const res = await controller.getUserPreferences('u-1');
      expect(res.user.id).toBe('u-1');
      expect(mockService.getUserPreferences).toHaveBeenCalledWith('u-1');
    });

    it('PUT /users/:userId/events/:eventCode updates user override', async () => {
      mockService.updateUserOverride.mockResolvedValue({ success: true, state: 'ON' });
      const res = await controller.updateUserOverride(
        'u-1',
        'RM_SUBMITTED',
        { state: 'ON' },
        mockReq,
      );
      expect(res.state).toBe('ON');
      expect(mockService.updateUserOverride).toHaveBeenCalledWith(
        'u-1',
        'RM_SUBMITTED',
        'ON',
        'admin-actor-uuid',
      );
    });

    it('PUT /users/:userId bulk updates user overrides', async () => {
      mockService.bulkUpdateUserOverrides.mockResolvedValue({ success: true, updatedCount: 1 });
      const res = await controller.bulkUpdateUserOverrides(
        'u-1',
        { changes: [{ eventCode: 'RM_SUBMITTED', state: 'INHERIT' }] },
        mockReq,
      );
      expect(res.updatedCount).toBe(1);
      expect(mockService.bulkUpdateUserOverrides).toHaveBeenCalledWith(
        'u-1',
        [{ eventCode: 'RM_SUBMITTED', state: 'INHERIT' }],
        'admin-actor-uuid',
      );
    });

    it('GET /audit passes query parameters to service', async () => {
      mockService.getAuditLogs.mockResolvedValue({ entries: [], nextCursor: null });
      const query = { scope: 'ROLE' as const, limit: 20 };
      const res = await controller.getAuditLogs(query);
      expect(res.entries).toEqual([]);
      expect(mockService.getAuditLogs).toHaveBeenCalledWith(query);
    });

    it('GET /mode and PUT /mode manage system mode', async () => {
      mockService.getMode.mockResolvedValue({ mode: 'SHADOW' });
      mockService.updateMode.mockResolvedValue({ success: true, mode: 'ON' });

      const getRes = await controller.getMode();
      expect(getRes).toEqual({ mode: 'SHADOW' });

      const putRes = await controller.updateMode({ mode: 'ON' }, mockReq);
      expect(putRes).toEqual({ success: true, mode: 'ON' });
      expect(mockService.updateMode).toHaveBeenCalledWith('ON', 'admin-actor-uuid');
    });

    it('GET /skips and GET /skips/summary pass query to service', async () => {
      mockService.getSkips.mockResolvedValue({ entries: [], nextCursor: null });
      mockService.getSkipsSummary.mockResolvedValue({ days: 7, byReason: {}, byEvent: {}, total: 0 });

      const query = { eventCode: 'RM_SUBMITTED', limit: 10 };
      const skipsRes = await controller.getSkips(query);
      expect(skipsRes.entries).toEqual([]);
      expect(mockService.getSkips).toHaveBeenCalledWith(query);

      const summaryRes = await controller.getSkipsSummary({ days: 14 });
      expect(summaryRes.days).toBe(7); // service mock returns days 7
      expect(mockService.getSkipsSummary).toHaveBeenCalledWith(14);
    });

    it('RBAC: Non-admin/GM (e.g. STORES) is forbidden from /skips and /skips/summary', () => {
      const storesSkipsCtx = createMockContext(UserRole.STORES, controller.getSkips);
      expect(rolesGuard.canActivate(storesSkipsCtx)).toBe(false);

      const storesSummaryCtx = createMockContext(UserRole.STORES, controller.getSkipsSummary);
      expect(rolesGuard.canActivate(storesSummaryCtx)).toBe(false);

      // ADMIN is allowed
      const adminCtx = createMockContext(UserRole.ADMIN, controller.getSkips);
      expect(rolesGuard.canActivate(adminCtx)).toBe(true);

      // GENERAL_MANAGER is allowed
      const gmCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.getSkips);
      expect(rolesGuard.canActivate(gmCtx)).toBe(true);
    });
  });
});
