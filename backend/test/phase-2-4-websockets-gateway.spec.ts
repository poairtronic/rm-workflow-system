import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway } from '../src/notifications/notifications.gateway.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { SystemSetting } from '../src/notifications/entities/system-setting.entity.js';
import { UserNotificationPreference } from '../src/notifications/entities/user-notification-preference.entity.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { AuditService } from '../src/audit/audit.service.js';

describe('Phase 2.4 — Native Socket.IO WebSockets Gateway (WS-001 to WS-015)', () => {
  let gateway: NotificationsGateway;
  let jwtService: JwtService;
  let configService: ConfigService;
  let mockServer: any;

  beforeEach(() => {
    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    jwtService = {
      verify: vi.fn(),
      sign: vi.fn(),
    } as any;

    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'test_jwt_secret';
        return null;
      }),
    } as any;

    gateway = new NotificationsGateway(jwtService, configService);
    gateway.server = mockServer;
  });

  describe('WS-001 - WS-005: Gateway Lifecycle & Authentication Handshake', () => {
    it('WS-001: Gateway is defined and server reference is accessible', () => {
      expect(gateway).toBeDefined();
      expect(gateway.server).toBeDefined();
    });

    it('WS-002: Rejects client connection when no auth token is provided', async () => {
      const mockClient: any = {
        id: 'client-no-token',
        handshake: {
          auth: {},
          headers: {},
          query: {},
        },
        disconnect: vi.fn(),
        join: vi.fn(),
        data: {},
      };

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('WS-003: Rejects client connection when JWT is invalid or expired', async () => {
      const mockClient: any = {
        id: 'client-invalid-token',
        handshake: {
          auth: { token: 'invalid.jwt.token' },
          headers: {},
          query: {},
        },
        disconnect: vi.fn(),
        join: vi.fn(),
        data: {},
      };

      vi.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('WS-004: Authenticates valid token from handshake.auth and joins user and role rooms', async () => {
      const mockClient: any = {
        id: 'client-valid-auth',
        handshake: {
          auth: { token: 'valid.jwt.token' },
          headers: {},
          query: {},
        },
        disconnect: vi.fn(),
        join: vi.fn().mockResolvedValue(undefined),
        data: {},
      };

      vi.spyOn(jwtService, 'verify').mockReturnValue({
        sub: 'user-uuid-101',
        role: 'STORES',
        email: 'stores@rmrit.com',
        name: 'Stores Officer',
      } as any);

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect(mockClient.join).toHaveBeenCalledWith('user:user-uuid-101');
      expect(mockClient.join).toHaveBeenCalledWith('role:STORES');
      expect(mockClient.data.user).toEqual({
        userId: 'user-uuid-101',
        role: 'STORES',
        email: 'stores@rmrit.com',
        name: 'Stores Officer',
      });
    });

    it('WS-005: Authenticates token from Authorization header fallback (Bearer scheme)', async () => {
      const mockClient: any = {
        id: 'client-header-auth',
        handshake: {
          auth: {},
          headers: {
            authorization: 'Bearer header.jwt.token',
          },
          query: {},
        },
        disconnect: vi.fn(),
        join: vi.fn().mockResolvedValue(undefined),
        data: {},
      };

      vi.spyOn(jwtService, 'verify').mockReturnValue({
        sub: 'user-uuid-202',
        role: 'PRODUCTION',
      } as any);

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect(mockClient.join).toHaveBeenCalledWith('user:user-uuid-202');
      expect(mockClient.join).toHaveBeenCalledWith('role:PRODUCTION');
    });
  });

  describe('WS-006 - WS-010: Targeted Real-Time Emitters', () => {
    it('WS-006: sendNotificationToUser emits "notification" to user room', () => {
      const sampleNotification = {
        id: 'notif-uuid-555',
        userId: 'user-uuid-101',
        title: 'Material Issued',
        message: 'Materials for SC-2030 are ready.',
        type: 'MATERIAL_ISSUED',
        isRead: false,
      };

      gateway.sendNotificationToUser('user-uuid-101', sampleNotification);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-uuid-101');
      expect(mockServer.emit).toHaveBeenCalledWith('notification', sampleNotification);
    });

    it('WS-007: sendNotificationToRole emits "notification" to role room', () => {
      const sampleRoleNotification = {
        title: 'Emergency Stock Alert',
        message: 'EN31 Bar has reached critical MSL threshold.',
        type: 'LOW_STOCK_ALERT',
      };

      gateway.sendNotificationToRole('STORES', sampleRoleNotification);

      expect(mockServer.to).toHaveBeenCalledWith('role:STORES');
      expect(mockServer.emit).toHaveBeenCalledWith('notification', sampleRoleNotification);
    });

    it('WS-008: sendUnreadCountToUser emits "notification:unread-count" to user room', () => {
      gateway.sendUnreadCountToUser('user-uuid-101', 3);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-uuid-101');
      expect(mockServer.emit).toHaveBeenCalledWith('notification:unread-count', { count: 3 });
    });

    it('WS-009: broadcast emits event to all connected clients', () => {
      gateway.broadcast('system:maintenance', { status: 'scheduled' });

      expect(mockServer.emit).toHaveBeenCalledWith('system:maintenance', { status: 'scheduled' });
    });

    it('WS-010: handlePing responds with pong and timestamp', () => {
      const mockClient: any = { id: 'client-ping' };
      const response = gateway.handlePing(mockClient, { clientTime: 12345 });

      expect(response.event).toBe('pong');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data.echo).toEqual({ clientTime: 12345 });
    });
  });

  describe('WS-011 - WS-013: CommunicationService Live Emission Integration', () => {
    let communicationService: CommunicationService;
    let mockNotificationRepo: any;
    let mockUserRepo: any;
    let mockRoleRepo: any;
    let mockEmailQueueService: any;
    let mockNotificationsService: any;

    beforeEach(() => {
      mockNotificationRepo = {
        create: vi.fn((dto) => ({ id: 'notif-saved-999', ...dto })),
        save: vi.fn(async (n) => ({ id: 'notif-saved-999', ...n })),
        findOne: vi.fn(),
        createQueryBuilder: vi.fn(),
      };

      mockUserRepo = { find: vi.fn() };
      mockRoleRepo = { findOne: vi.fn() };
      mockEmailQueueService = { enqueueJob: vi.fn() };
      mockNotificationsService = {
        getGlobalWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
        getUserWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
      };

      communicationService = new CommunicationService(
        mockNotificationRepo,
        mockUserRepo,
        mockRoleRepo,
        mockEmailQueueService,
        mockNotificationsService,
        undefined,
        undefined,
        undefined,
        gateway, // injected gateway
      );
    });

    it('WS-011: createInAppNotification triggers gateway.sendNotificationToUser immediately after DB save', async () => {
      const sendSpy = vi.spyOn(gateway, 'sendNotificationToUser');

      const result = await communicationService.createInAppNotification({
        userId: 'user-target-123',
        title: 'New RM Subcontract Form',
        message: 'RM-505 is pending approval',
        type: 'RM_SUBMITTED',
      });

      expect(result.id).toBe('notif-saved-999');
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith('user-target-123', expect.objectContaining({
        userId: 'user-target-123',
        title: 'New RM Subcontract Form',
      }));
    });
  });

  describe('WS-014 - WS-015: NotificationsService Read State Emission Integration', () => {
    let notificationsService: NotificationsService;
    let mockSystemSettingRepo: any;
    let mockUserPrefRepo: any;
    let mockNotificationRepo: any;
    let mockAuditService: any;

    beforeEach(() => {
      mockSystemSettingRepo = { findOne: vi.fn(), save: vi.fn(), find: vi.fn() };
      mockUserPrefRepo = { findOne: vi.fn(), save: vi.fn() };
      mockNotificationRepo = {
        update: vi.fn().mockResolvedValue({ affected: 4 }),
        count: vi.fn().mockResolvedValue(0),
        findOne: vi.fn().mockResolvedValue({
          id: 'notif-read-1',
          userId: 'user-read-1',
          isRead: false,
        }),
        save: vi.fn(async (n) => ({ ...n, isRead: true })),
      };
      mockAuditService = { logEvent: vi.fn() };

      notificationsService = new NotificationsService(
        mockSystemSettingRepo,
        mockUserPrefRepo,
        mockNotificationRepo,
        mockAuditService,
        gateway, // injected gateway
      );
    });

    it('WS-014: markAllAsRead emits unread count of 0 via gateway', async () => {
      const sendCountSpy = vi.spyOn(gateway, 'sendUnreadCountToUser');

      const res = await notificationsService.markAllAsRead('user-read-1');

      expect(res.success).toBe(true);
      expect(sendCountSpy).toHaveBeenCalledWith('user-read-1', 0);
    });

    it('WS-015: markNotificationAsRead emits updated unread count via gateway', async () => {
      mockNotificationRepo.count.mockResolvedValue(2);
      const sendCountSpy = vi.spyOn(gateway, 'sendUnreadCountToUser');

      await notificationsService.markNotificationAsRead('user-read-1', 'notif-read-1');

      expect(sendCountSpy).toHaveBeenCalledWith('user-read-1', 2);
    });
  });
});
