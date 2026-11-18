import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSource, Repository, In } from 'typeorm';
import { ConsumablesBatchNotificationService } from '../src/consumables/consumables-batch-notification.service.js';
import { ConsumableRequest } from '../src/consumables/entities/consumable-request.entity.js';
import {
  ConsumableRequestItem,
  ConsumableApprovalStatus,
  ConsumableItemTrack,
  ConsumableItemStatus,
} from '../src/consumables/entities/consumable-request-item.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { ConsumablesService } from '../src/consumables/consumables.service.js';
import { resolveEventPriority } from '../src/email/constants/email-priorities.js';

describe('Phase P5: Consumables Senior Manager Approval Notifications Integration & E2E Verification', () => {
  let notificationService: ConsumablesBatchNotificationService;
  let consumablesService: ConsumablesService;

  let mockItemRepo: any;
  let mockUserRepo: any;
  let mockRoleRepo: any;
  let mockRequestRepo: any;
  let mockEmailQueueService: any;
  let mockPreferenceService: any;
  let mockSkipLogService: any;
  let mockConfigService: any;
  let mockAuditService: any;
  let mockDataSource: any;

  // Roles
  const adminRole: Role = { id: 'role-admin', name: 'ADMIN', description: '', isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const smRole: Role = { id: 'role-sm', name: 'SENIOR_MANAGER', description: '', isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const storesRole: Role = { id: 'role-stores', name: 'STORES', description: '', isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const prodRole: Role = { id: 'role-prod', name: 'PRODUCTION', description: '', isActive: true, createdAt: new Date(), updatedAt: new Date() };

  // Users
  const adminUser: User = { id: 'u-admin', email: 'admin@example.com', name: 'System Admin', roleId: 'role-admin', role: adminRole, isActive: true } as any;
  const smUser: User = { id: 'u-sm', email: 'sm@example.com', name: 'Senior Manager', roleId: 'role-sm', role: smRole, isActive: true } as any;
  const storeUser1: User = { id: 'u-store-1', email: 'store1@example.com', name: 'Stores Person 1', roleId: 'role-stores', role: storesRole, isActive: true } as any;
  const storeUser2: User = { id: 'u-store-2', email: 'store2@example.com', name: 'Stores Person 2', roleId: 'role-stores', role: storesRole, isActive: true } as any;
  const reqUser1: User = { id: 'u-req-1', email: 'req1@example.com', name: 'Requester Alpha', roleId: 'role-prod', role: prodRole, isActive: true } as any;
  const reqUser2: User = { id: 'u-req-2', email: 'req2@example.com', name: 'Requester Beta', roleId: 'role-prod', role: prodRole, isActive: true } as any;
  const reqUser3: User = { id: 'u-req-3', email: 'req3@example.com', name: 'Requester Gamma', roleId: 'role-prod', role: prodRole, isActive: true } as any;

  beforeEach(() => {
    mockEmailQueueService = {
      enqueueJob: vi.fn().mockResolvedValue({ id: 'job-uuid-1' }),
    };

    mockPreferenceService = {
      getMode: vi.fn().mockResolvedValue('LIVE'),
      isUserEligibleForEvent: vi.fn().mockResolvedValue({ eligible: true, reason: 'ENABLED' }),
    };

    mockSkipLogService = {
      logSkips: vi.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'CONSUMABLE_SM_APPROVAL_MODE') return 'ON';
        if (key === 'CONSUMABLE_SM_APPROVAL_SCOPE') return 'ALL';
        return null;
      }),
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    mockRoleRepo = {
      find: vi.fn().mockImplementation((options: any) => {
        const where = options?.where;
        if (Array.isArray(where)) {
          const names = where.map((w: any) => w.name);
          const results = [];
          if (names.includes('SENIOR_MANAGER')) results.push(smRole);
          if (names.includes('ADMIN')) results.push(adminRole);
          return Promise.resolve(results);
        }
        if (where?.name === 'STORES') return Promise.resolve([storesRole]);
        return Promise.resolve([]);
      }),
    };

    mockUserRepo = {
      find: vi.fn().mockImplementation((options: any) => {
        const roleIds = options?.where?.roleId?._value || [];
        const users = [adminUser, smUser, storeUser1, storeUser2, reqUser1, reqUser2, reqUser3];
        return Promise.resolve(users.filter((u) => roleIds.includes(u.roleId)));
      }),
      findOne: vi.fn().mockImplementation((options: any) => {
        const id = options?.where?.id;
        const users = [adminUser, smUser, storeUser1, storeUser2, reqUser1, reqUser2, reqUser3];
        return Promise.resolve(users.find((u) => u.id === id) || null);
      }),
    };

    mockItemRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((i) => Promise.resolve(i)),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: d.id || 'item-new' })),
    };

    mockRequestRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'req-1' })),
      save: vi.fn().mockImplementation((r) => Promise.resolve(r)),
    };

    mockDataSource = {
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (cb) => {
        const manager: any = {
          createQueryBuilder: vi.fn(),
          find: vi.fn().mockResolvedValue([]),
          findOne: vi.fn().mockResolvedValue(null),
          save: vi.fn().mockImplementation((cls, data) => Promise.resolve(data)),
        };
        return await cb(manager);
      }),
    };

    notificationService = new ConsumablesBatchNotificationService(
      mockItemRepo,
      mockUserRepo,
      mockRoleRepo,
      mockEmailQueueService,
      undefined,
      mockPreferenceService,
      mockSkipLogService,
      mockConfigService,
    );

    consumablesService = new ConsumablesService(
      mockDataSource,
      mockRequestRepo,
      mockItemRepo,
      { findOne: vi.fn().mockResolvedValue({ id: 'p1' }) } as any,
      { findOne: vi.fn().mockResolvedValue({ id: 'c1' }) } as any,
      { findOne: vi.fn().mockResolvedValue({ id: 'f1' }) } as any,
      { findOne: vi.fn().mockResolvedValue(null) } as any,
      { findOne: vi.fn().mockResolvedValue({ id: 'b1' }) } as any,
      { find: vi.fn().mockResolvedValue([{ currentQuantity: 10 }]) } as any,
      { create: vi.fn(), save: vi.fn() } as any,
      undefined,
      undefined,
      undefined,
      mockConfigService,
      mockAuditService,
      notificationService,
    );
  });

  describe('1. Priority Classification Check', () => {
    it('verifies all 3 consumable approval events are Priority 1', () => {
      expect(resolveEventPriority('CONSUMABLE_APPROVAL_REQUESTED')).toBe(1);
      expect(resolveEventPriority('CONSUMABLE_APPROVED')).toBe(1);
      expect(resolveEventPriority('CONSUMABLE_REJECTED')).toBe(1);
    });
  });

  describe('2. Scenario: Bulk approve of 30 lines across 3 requesters and 2 STORES users -> exactly 5 jobs', () => {
    it('dispatches exactly 5 jobs: 2 for STORES (all lines) and 3 for requesters (their own lines)', async () => {
      const batchId = 'batch-approve-30';
      const items: ConsumableRequestItem[] = [];

      // Requesters 1, 2, 3 each have 10 lines
      const requesters = [reqUser1, reqUser2, reqUser3];
      for (let r = 0; r < 3; r++) {
        const reqUser = requesters[r];
        const reqObj: ConsumableRequest = {
          id: `req-parent-${r + 1}`,
          requestCode: `REQ-2026-000${r + 1}`,
          createdByUserId: reqUser.id,
          createdByUser: reqUser,
          requestedBy: reqUser.name,
          paymentMode: 'CASH' as any,
          requestDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;

        for (let i = 0; i < 10; i++) {
          const itemIdx = r * 10 + i + 1;
          const item: Partial<ConsumableRequestItem> = {
            id: `item-${itemIdx}`,
            description: `Tool Item ${itemIdx}`,
            requestedQty: 2,
            uom: 'NOS',
            endUserInVelan: `Bay ${r + 1}`,
            itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
            approvalStatus: ConsumableApprovalStatus.APPROVED,
            approvalBatchId: batchId,
            request: reqObj,
          };
          items.push(item as ConsumableRequestItem);
        }
      }

      expect(items).toHaveLength(30);
      mockItemRepo.find.mockResolvedValue(items);

      const switchedToPurchase = [
        { id: 'item-5', description: 'Tool Item 5' },
        { id: 'item-15', description: 'Tool Item 15' },
      ];

      await notificationService.notifyBulkApproved(
        batchId,
        items.map((i) => i.id),
        { switchedToPurchase },
      );

      // Exactly 5 jobs enqueued
      expect(mockEmailQueueService.enqueueJob).toHaveBeenCalledTimes(5);

      const enqueuedCalls = mockEmailQueueService.enqueueJob.mock.calls.map((c: any) => c[0]);

      // All jobs MUST be Priority 1
      for (const call of enqueuedCalls) {
        expect(call.priority).toBe(1);
        expect(call.eventType).toBe('CONSUMABLE_APPROVED');
      }

      // Check STORES jobs (storeUser1 and storeUser2)
      const storeJobs = enqueuedCalls.filter(
        (c: any) => c.recipientUserId === 'u-store-1' || c.recipientUserId === 'u-store-2',
      );
      expect(storeJobs).toHaveLength(2);
      for (const job of storeJobs) {
        expect(job.payload.itemsCount).toBe(30);
        expect(job.payload.switchedCount).toBe(2);
        expect(job.idempotencyKey).toBe(`consumable-approved:${batchId}:${job.recipientUserId}`);
        expect(job.bodyHtml).toContain('/consumables/purchase-store');
      }

      // Check Requester jobs (each gets only their own 10 items)
      const req1Job = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-req-1');
      expect(req1Job).toBeDefined();
      expect(req1Job.payload.itemsCount).toBe(10);
      expect(req1Job.payload.switchedCount).toBe(1);
      expect(req1Job.idempotencyKey).toBe(`consumable-approved:${batchId}:u-req-1`);
      expect(req1Job.bodyHtml).toContain('Tool Item 1');
      expect(req1Job.bodyHtml).not.toContain('Tool Item 11');

      const req2Job = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-req-2');
      expect(req2Job).toBeDefined();
      expect(req2Job.payload.itemsCount).toBe(10);
      expect(req2Job.payload.switchedCount).toBe(1);
      expect(req2Job.idempotencyKey).toBe(`consumable-approved:${batchId}:u-req-2`);
      expect(req2Job.bodyHtml).toContain('Tool Item 15');

      const req3Job = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-req-3');
      expect(req3Job).toBeDefined();
      expect(req3Job.payload.itemsCount).toBe(10);
      expect(req3Job.payload.switchedCount).toBe(0);
      expect(req3Job.idempotencyKey).toBe(`consumable-approved:${batchId}:u-req-3`);
    });
  });

  describe('3. Scenario: Bulk reject of 10 lines across 2 requesters -> 2 jobs with reasons', () => {
    it('dispatches exactly 2 jobs with rejection reasons to the 2 requesters', async () => {
      const batchId = 'batch-reject-10';
      const items: ConsumableRequestItem[] = [];
      const rejectionReason = 'Current shop inventory must be exhausted first';

      const req1: ConsumableRequest = {
        id: 'req-r1',
        requestCode: 'REQ-2026-101',
        createdByUserId: reqUser1.id,
        createdByUser: reqUser1,
      } as any;
      const req2: ConsumableRequest = {
        id: 'req-r2',
        requestCode: 'REQ-2026-102',
        createdByUserId: reqUser2.id,
        createdByUser: reqUser2,
      } as any;

      for (let i = 1; i <= 5; i++) {
        items.push({
          id: `item-rej-${i}`,
          description: `Custom Bit ${i}`,
          requestedQty: 1,
          uom: 'NOS',
          rejectionReason,
          approvalStatus: ConsumableApprovalStatus.REJECTED,
          request: req1,
        } as any);
      }
      for (let i = 6; i <= 10; i++) {
        items.push({
          id: `item-rej-${i}`,
          description: `Custom Bit ${i}`,
          requestedQty: 3,
          uom: 'NOS',
          rejectionReason,
          approvalStatus: ConsumableApprovalStatus.REJECTED,
          request: req2,
        } as any);
      }

      mockItemRepo.find.mockResolvedValue(items);

      await notificationService.notifyBulkRejected(batchId, items.map((i) => i.id), {
        rejecterId: 'u-sm',
        rejectionReason,
      });

      expect(mockEmailQueueService.enqueueJob).toHaveBeenCalledTimes(2);

      const enqueuedCalls = mockEmailQueueService.enqueueJob.mock.calls.map((c: any) => c[0]);

      for (const call of enqueuedCalls) {
        expect(call.priority).toBe(1);
        expect(call.eventType).toBe('CONSUMABLE_REJECTED');
        expect(call.payload.rejectionReason).toBe(rejectionReason);
        expect(call.bodyText).toContain(rejectionReason);
        expect(call.bodyHtml).toContain(rejectionReason);
        expect(call.bodyHtml).toContain('/consumables/requests');
      }

      const req1Job = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-req-1');
      expect(req1Job).toBeDefined();
      expect(req1Job.payload.itemsCount).toBe(5);
      expect(req1Job.idempotencyKey).toBe(`consumable-rejected:${batchId}:u-req-1`);

      const req2Job = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-req-2');
      expect(req2Job).toBeDefined();
      expect(req2Job.payload.itemsCount).toBe(5);
      expect(req2Job.idempotencyKey).toBe(`consumable-rejected:${batchId}:u-req-2`);
    });
  });

  describe('4. Scenario: Request with 5 pending lines and 2 approvers -> 2 jobs', () => {
    it('dispatches exactly 2 jobs: one to SENIOR_MANAGER and one to ADMIN', async () => {
      const request: ConsumableRequest = {
        id: 'req-new-5',
        requestCode: 'REQ-2026-999',
        requestedBy: 'Floor Supervisor',
        createdByUserId: 'u-operator-9',
      } as any;

      const pendingItems: ConsumableRequestItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `item-pending-${i + 1}`,
        description: `Machining Insert ${i + 1}`,
        requestedQty: 10,
        uom: 'NOS',
        endUserInVelan: 'Bay 4',
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem));

      await notificationService.notifyApprovalRequested(request, pendingItems, 'u-operator-9');

      expect(mockEmailQueueService.enqueueJob).toHaveBeenCalledTimes(2);

      const enqueuedCalls = mockEmailQueueService.enqueueJob.mock.calls.map((c: any) => c[0]);

      const smJob = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-sm');
      expect(smJob).toBeDefined();
      expect(smJob.priority).toBe(1);
      expect(smJob.eventType).toBe('CONSUMABLE_APPROVAL_REQUESTED');
      expect(smJob.idempotencyKey).toBe(`consumable-approval-requested:req-new-5:u-sm`);
      expect(smJob.payload.pendingCount).toBe(5);
      expect(smJob.bodyHtml).toContain('/consumables/approvals');

      const adminJob = enqueuedCalls.find((c: any) => c.recipientUserId === 'u-admin');
      expect(adminJob).toBeDefined();
      expect(adminJob.priority).toBe(1);
      expect(adminJob.eventType).toBe('CONSUMABLE_APPROVAL_REQUESTED');
      expect(adminJob.idempotencyKey).toBe(`consumable-approval-requested:req-new-5:u-admin`);
    });

    it('suppresses email to creator when creator is also an approver', async () => {
      const request: ConsumableRequest = {
        id: 'req-sm-created',
        requestCode: 'REQ-2026-SM1',
        requestedBy: 'Senior Manager',
        createdByUserId: 'u-sm',
      } as any;

      const pendingItems = [
        {
          id: 'item-p1',
          description: 'Special Sensor',
          approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
        } as ConsumableRequestItem,
      ];

      await notificationService.notifyApprovalRequested(request, pendingItems, 'u-sm');

      expect(mockEmailQueueService.enqueueJob).toHaveBeenCalledTimes(1);
      const enqueued = mockEmailQueueService.enqueueJob.mock.calls[0][0];
      expect(enqueued.recipientUserId).toBe('u-admin');
    });
  });

  describe('5. Scenario: User with the event OFF excluded and logged as PREF_OFF', () => {
    it('excludes approver with preference OFF and logs PREF_OFF to skip log service', async () => {
      mockPreferenceService.isUserEligibleForEvent.mockImplementation(async (user: User) => {
        if (user.id === 'u-admin') {
          return { eligible: false, reason: 'USER_OFF' };
        }
        return { eligible: true, reason: 'ENABLED' };
      });

      const request: ConsumableRequest = {
        id: 'req-pref-test',
        requestCode: 'REQ-2026-P01',
        requestedBy: 'Supervisor',
        createdByUserId: 'u-operator-1',
      } as any;

      const items = [
        { id: 'item-1', description: 'Wire', approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL } as ConsumableRequestItem,
      ];

      await notificationService.notifyApprovalRequested(request, items, 'u-operator-1');

      expect(mockEmailQueueService.enqueueJob).toHaveBeenCalledTimes(1);
      expect(mockEmailQueueService.enqueueJob.mock.calls[0][0].recipientUserId).toBe('u-sm');

      expect(mockSkipLogService.logSkips).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventCode: 'CONSUMABLE_APPROVAL_REQUESTED',
            recipientUserId: 'u-admin',
            reason: 'PREF_OFF',
            entityId: 'req-pref-test',
          }),
        ]),
      );
    });

    it('excludes requester with preference OFF on bulk-approval and logs PREF_OFF', async () => {
      mockPreferenceService.isUserEligibleForEvent.mockImplementation(async (user: User) => {
        if (user.id === 'u-req-1') {
          return { eligible: false, reason: 'ROLE_OFF' };
        }
        return { eligible: true, reason: 'ENABLED' };
      });

      const req: ConsumableRequest = {
        id: 'req-app-pref',
        requestCode: 'REQ-2026-A01',
        createdByUserId: 'u-req-1',
        createdByUser: reqUser1,
      } as any;

      const item: ConsumableRequestItem = {
        id: 'item-app-1',
        description: 'Gloves',
        approvalStatus: ConsumableApprovalStatus.APPROVED,
        request: req,
      } as any;

      mockItemRepo.find.mockResolvedValue([item]);

      await notificationService.notifyBulkApproved('batch-pref-app', ['item-app-1']);

      expect(mockEmailQueueService.enqueueJob).toHaveBeenCalledTimes(2);

      expect(mockSkipLogService.logSkips).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventCode: 'CONSUMABLE_APPROVED',
            recipientUserId: 'u-req-1',
            reason: 'PREF_OFF',
          }),
        ]),
      );
    });
  });

  describe('6. Scenario: Email/enqueue failure does not roll back approval & MODE OFF sends nothing new', () => {
    it('MODE OFF sends nothing new (all methods return immediately without enqueueing)', async () => {
      mockConfigService.get = vi.fn().mockReturnValue('OFF');

      const req: ConsumableRequest = { id: 'req-mode-off', requestCode: 'REQ-OFF' } as any;
      const item: ConsumableRequestItem = { id: 'item-off', approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL } as any;

      await notificationService.notifyApprovalRequested(req, [item], 'u-1');
      await notificationService.notifyBulkApproved('batch-off', ['item-off']);
      await notificationService.notifyBulkRejected('batch-off', ['item-off'], { rejectionReason: 'test reason' });

      expect(mockEmailQueueService.enqueueJob).not.toHaveBeenCalled();
      expect(mockItemRepo.find).not.toHaveBeenCalled();
      expect(mockUserRepo.find).not.toHaveBeenCalled();
    });

    it('email dispatch error inside bulkApprove does not roll back approval transaction', async () => {
      mockConfigService.get = vi.fn().mockReturnValue('ON');

      const mockPendingItem = {
        id: 'item-rollback-test',
        description: 'Test Item',
        productId: 'prod-1',
        itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      const qbMock: any = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPendingItem]),
      };

      mockDataSource.transaction = vi.fn().mockImplementation(async (cb) => {
        return await cb({
          createQueryBuilder: vi.fn().mockReturnValue(qbMock),
          find: vi.fn().mockResolvedValue([{ currentQuantity: 10 }]),
          save: vi.fn().mockResolvedValue([mockPendingItem]),
        });
      });

      vi.spyOn(notificationService, 'notifyBulkApproved').mockRejectedValue(
        new Error('Redis/DB Email Queue Down'),
      );

      const result = await consumablesService.bulkApprove(
        { itemIds: ['item-rollback-test'] },
        'u-sm',
      );

      expect(result.approvedCount).toBe(1);
      expect(mockPendingItem.approvalStatus).toBe(ConsumableApprovalStatus.APPROVED);
    });

    it('email dispatch error inside bulkReject does not fail rejection operation', async () => {
      mockConfigService.get = vi.fn().mockReturnValue('ON');

      const mockPendingItem = {
        id: 'item-rej-err-test',
        description: 'Test Item 2',
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      const qbMock: any = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPendingItem]),
      };

      mockDataSource.transaction = vi.fn().mockImplementation(async (cb) => {
        return await cb({
          createQueryBuilder: vi.fn().mockReturnValue(qbMock),
          save: vi.fn().mockResolvedValue([mockPendingItem]),
        });
      });

      vi.spyOn(notificationService, 'notifyBulkRejected').mockRejectedValue(
        new Error('SMTP Transport Timeout'),
      );

      const result = await consumablesService.bulkReject(
        { itemIds: ['item-rej-err-test'], rejectionReason: 'Not needed at this time' },
        'u-sm',
      );

      expect(result.rejectedCount).toBe(1);
      expect(mockPendingItem.approvalStatus).toBe(ConsumableApprovalStatus.REJECTED);
    });
  });

  describe('7. Template 50-row Display Cap and Formatting', () => {
    it('caps table at 50 rows and renders "+ M more" in email body when item count exceeds 50', async () => {
      const req1: ConsumableRequest = {
        id: 'req-55',
        requestCode: 'REQ-2026-55',
        createdByUserId: reqUser1.id,
        createdByUser: reqUser1,
      } as any;

      const items: ConsumableRequestItem[] = Array.from({ length: 55 }, (_, i) => ({
        id: `item-55-${i + 1}`,
        description: `Cutting Insert #${i + 1}`,
        requestedQty: 1,
        uom: 'NOS',
        endUserInVelan: 'Shopfloor',
        itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
        approvalStatus: ConsumableApprovalStatus.APPROVED,
        request: req1,
      } as any));

      mockItemRepo.find.mockResolvedValue(items);

      await notificationService.notifyBulkApproved('batch-55', items.map((i) => i.id));

      const calls = mockEmailQueueService.enqueueJob.mock.calls.map((c: any) => c[0]);
      const reqJob = calls.find((c: any) => c.recipientUserId === 'u-req-1');

      expect(reqJob).toBeDefined();
      expect(reqJob.bodyHtml).toContain('+ 5 more items...');
      expect(reqJob.bodyText).toContain('+ 5 more items...');
    });
  });
});
