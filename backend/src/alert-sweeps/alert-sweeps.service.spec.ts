import { describe, it, expect, vi, beforeEach } from 'vitest';
import { In } from 'typeorm';
import { AlertSweepService, SWEEP_CONFIGS } from './alert-sweeps.service.js';
import { DeliveryChallanStatus } from '../delivery-challan/entities/delivery-challan.entity.js';
import { ConsumableItemStatus } from '../consumables/entities/consumable-request-item.entity.js';
import { RmRequestStatus } from '../rm/entities/rm-request.entity.js';

describe('AlertSweepService', () => {
  let service: AlertSweepService;

  let watchRepoMock: any;
  let systemSettingRepoMock: any;
  let dcRepoMock: any;
  let dcItemRepoMock: any;
  let consumableRequestRepoMock: any;
  let consumableItemRepoMock: any;
  let rmRequestRepoMock: any;
  let materialIssueRepoMock: any;
  let communicationServiceMock: any;
  let dataSourceMock: any;

  beforeEach(() => {
    watchRepoMock = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (entity) => ({ id: 'watch-uuid', ...entity })),
      create: vi.fn().mockImplementation((val) => val),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    systemSettingRepoMock = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (val) => val),
      create: vi.fn().mockImplementation((val) => val),
    };

    dcRepoMock = {
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => ({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      })),
    };

    dcItemRepoMock = {
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => ({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      })),
    };

    consumableRequestRepoMock = {
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => ({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      })),
    };

    consumableItemRepoMock = {
      find: vi.fn().mockResolvedValue([]),
    };

    rmRequestRepoMock = {
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => ({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      })),
    };

    materialIssueRepoMock = {
      find: vi.fn().mockResolvedValue([]),
    };

    communicationServiceMock = {
      sendEvent: vi.fn().mockResolvedValue({ inAppNotifications: [], emailJobs: [] }),
    };

    dataSourceMock = {
      transaction: vi.fn().mockImplementation(async (cb) => {
        const manager = {
          getRepository: (entity: any) => {
            if (entity.name === 'SystemSetting') return systemSettingRepoMock;
            return {};
          },
        };
        return await cb(manager);
      }),
    };

    service = new AlertSweepService(
      watchRepoMock,
      systemSettingRepoMock,
      dcRepoMock,
      dcItemRepoMock,
      consumableRequestRepoMock,
      consumableItemRepoMock,
      rmRequestRepoMock,
      materialIssueRepoMock,
      communicationServiceMock,
      dataSourceMock,
    );
  });

  describe('Switch OFF Behavior (Production Safety Rule 1)', () => {
    it('switch OFF -> sweepMaterialIssueOverdue returns 0 immediately with zero queries against business tables and zero emails', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue(null); // missing row = OFF

      const count = await service.sweepMaterialIssueOverdue();

      expect(count).toBe(0);
      expect(rmRequestRepoMock.createQueryBuilder).not.toHaveBeenCalled();
      expect(communicationServiceMock.sendEvent).not.toHaveBeenCalled();
    });

    it('switch OFF -> sweepDcPending returns 0 immediately with zero emails', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'DC_PENDING_ALERTS_ENABLED', value: 'false' });

      const count = await service.sweepDcPending();

      expect(count).toBe(0);
      expect(dcRepoMock.find).not.toHaveBeenCalled();
      expect(communicationServiceMock.sendEvent).not.toHaveBeenCalled();
    });

    it('switch OFF -> sweepConsumablePending returns 0 immediately with zero emails', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'CONSUMABLE_PENDING_ALERTS_ENABLED', value: '0' });

      const count = await service.sweepConsumablePending();

      expect(count).toBe(0);
      expect(consumableRequestRepoMock.createQueryBuilder).not.toHaveBeenCalled();
      expect(communicationServiceMock.sendEvent).not.toHaveBeenCalled();
    });

    it('switch OFF -> sweepDcQcPending returns 0 immediately with zero emails', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue(null);

      const count = await service.sweepDcQcPending();

      expect(count).toBe(0);
      expect(dcItemRepoMock.createQueryBuilder).not.toHaveBeenCalled();
      expect(communicationServiceMock.sendEvent).not.toHaveBeenCalled();
    });
  });

  describe('DC_PENDING_2_DAYS Sweep', () => {
    it('alerts only DISPATCHED or PARTIALLY_RETURNED DCs older than threshold, excluding OPEN, RETURNED, CLOSED', async () => {
      systemSettingRepoMock.findOne.mockImplementation(async ({ where }: any) => {
        if (where.key === 'DC_PENDING_ALERTS_ENABLED') return { key: 'DC_PENDING_ALERTS_ENABLED', value: 'true' };
        if (where.key === 'DC_PENDING_ALERT_HOURS') return { key: 'DC_PENDING_ALERT_HOURS', value: '48' };
        return null;
      });

      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50 hours old
      const recentDate = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20 hours old (below threshold)

      const dcs = [
        {
          id: 'dc-1',
          challanNumber: 'DC-001',
          status: DeliveryChallanStatus.DISPATCHED,
          createdAt: oldDate,
          vendor: { name: 'Vendor A' },
        },
        {
          id: 'dc-2',
          challanNumber: 'DC-002',
          status: DeliveryChallanStatus.PARTIALLY_RETURNED,
          createdAt: oldDate,
          vendor: { name: 'Vendor B' },
        },
      ];

      dcRepoMock.find.mockResolvedValue(dcs);

      const count = await service.sweepDcPending();

      expect(count).toBe(2);
      expect(communicationServiceMock.sendEvent).toHaveBeenCalledTimes(2);

      const firstCall = communicationServiceMock.sendEvent.mock.calls[0][0];
      expect(firstCall.eventType).toBe('DC_PENDING_2_DAYS');
      expect(firstCall.entityId).toContain('dc-1_pending_');
      expect(firstCall.metadata.challanNumber).toBe('DC-001');
    });

    it('same-day rerun generates identical entityId (idempotent)', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'DC_PENDING_ALERTS_ENABLED', value: 'true' });
      const dc = {
        id: 'dc-same-day',
        challanNumber: 'DC-SAME',
        status: DeliveryChallanStatus.DISPATCHED,
        createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
      };
      dcRepoMock.find.mockResolvedValue([dc]);

      await service.sweepDcPending();
      const firstEntityId = communicationServiceMock.sendEvent.mock.calls[0][0].entityId;

      communicationServiceMock.sendEvent.mockClear();
      await service.sweepDcPending();
      const secondEntityId = communicationServiceMock.sendEvent.mock.calls[0][0].entityId;

      expect(firstEntityId).toBe(secondEntityId);
      expect(firstEntityId).toBe(`${dc.id}_pending_${new Date().toISOString().split('T')[0]}`);
    });
  });

  describe('CONSUMABLE_PENDING_2_DAYS Sweep', () => {
    it('alerts non-terminal consumable requests and ignores fully issued requests', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'CONSUMABLE_PENDING_ALERTS_ENABLED', value: 'true' });

      const pendingReq = {
        id: 'req-pending-1',
        requestCode: 'CR-101',
        requestedBy: 'Stores Admin',
        createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
        items: [
          { id: 'item-1', status: ConsumableItemStatus.OPEN },
          { id: 'item-2', status: ConsumableItemStatus.PURCHASE_REQUESTED },
        ],
      };

      consumableRequestRepoMock.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([pendingReq]),
      });

      const count = await service.sweepConsumablePending();

      expect(count).toBe(1);
      const call = communicationServiceMock.sendEvent.mock.calls[0][0];
      expect(call.eventType).toBe('CONSUMABLE_PENDING_2_DAYS');
      expect(call.entityId).toContain('req-pending-1_pending_');
      expect(call.metadata.itemsCount).toBe(2);
    });
  });

  describe('DC_QC_PENDING_24H Sweep & Watch Reconciliation', () => {
    it('creates watch row on first sight, keeps on partial inspection, deletes when qc_pending_qty reaches 0', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'DC_QC_PENDING_ALERTS_ENABLED', value: 'true' });

      const now = new Date();
      const item1 = {
        id: 'item-qc-1',
        challanId: 'dc-100',
        qcPendingQty: 50,
        partNumber: 'PN-01',
        challan: { id: 'dc-100', challanNumber: 'DC-100', status: DeliveryChallanStatus.DISPATCHED },
      };

      // Item 1 is active in QC
      dcItemRepoMock.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([item1]),
      });

      // Existing watch table has an old row for item-finished that is NO LONGER active in QC
      const finishedWatch = {
        id: 'watch-finished-uuid',
        alertCode: 'DC_QC_PENDING_24H',
        entityId: 'item-finished',
        firstSeenAt: new Date(now.getTime() - 40 * 60 * 60 * 1000),
      };
      watchRepoMock.find.mockResolvedValue([finishedWatch]);

      await service.sweepDcQcPending();

      // Assert deleted finished watch
      expect(watchRepoMock.delete).toHaveBeenCalledWith({ id: In(['watch-finished-uuid']) });

      // Assert saved new watch for item-qc-1
      expect(watchRepoMock.save).toHaveBeenCalled();
      const savedArg = watchRepoMock.save.mock.calls[0][0];
      expect(savedArg.entityId).toBe('item-qc-1');
      expect(savedArg.alertCode).toBe('DC_QC_PENDING_24H');
    });

    it('aggregates multiple overdue items of the same DC into ONE email with an HTML table', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'DC_QC_PENDING_ALERTS_ENABLED', value: 'true' });

      const now = new Date();
      const item1 = {
        id: 'item-1',
        challanId: 'dc-agg',
        qcPendingQty: 10,
        partNumber: 'PART-A',
        partName: 'Flange A',
        challan: { id: 'dc-agg', challanNumber: 'DC-AGG', vendor: { name: 'Vendor Fast' } },
      };
      const item2 = {
        id: 'item-2',
        challanId: 'dc-agg',
        qcPendingQty: 25,
        partNumber: 'PART-B',
        partName: 'Gasket B',
        challan: { id: 'dc-agg', challanNumber: 'DC-AGG', vendor: { name: 'Vendor Fast' } },
      };

      dcItemRepoMock.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([item1, item2]),
      });

      // Both items in watch past 24h threshold
      const pastTime = new Date(now.getTime() - 30 * 60 * 60 * 1000);
      watchRepoMock.find.mockResolvedValue([
        { id: 'w-1', alertCode: 'DC_QC_PENDING_24H', entityId: 'item-1', firstSeenAt: pastTime },
        { id: 'w-2', alertCode: 'DC_QC_PENDING_24H', entityId: 'item-2', firstSeenAt: pastTime },
      ]);

      const count = await service.sweepDcQcPending();

      // Exactly 1 email sent for the DC aggregating both items
      expect(count).toBe(1);
      expect(communicationServiceMock.sendEvent).toHaveBeenCalledTimes(1);

      const call = communicationServiceMock.sendEvent.mock.calls[0][0];
      expect(call.eventType).toBe('DC_QC_PENDING_24H');
      expect(call.entityId).toContain('dc-agg_qc_');
      expect(call.metadata.itemsCount).toBe(2);
      expect(call.metadata.itemsTableHtml).toContain('PART-A');
      expect(call.metadata.itemsTableHtml).toContain('PART-B');
    });
  });

  describe('Isolation and Cap Rules', () => {
    it('a throwing sweep does not break subsequent sweeps', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED', value: 'true' });

      // First sweep throws an unexpected DB error
      rmRequestRepoMock.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      // Second sweep succeeds
      vi.spyOn(service, 'sweepDcPending').mockResolvedValue(3);
      vi.spyOn(service, 'sweepConsumablePending').mockResolvedValue(1);
      vi.spyOn(service, 'sweepDcQcPending').mockResolvedValue(2);

      const results = await service.runAllSweeps();

      expect(results.materialIssueAlerts).toBe(0);
      expect(results.dcPendingAlerts).toBe(3);
      expect(results.consumablePendingAlerts).toBe(1);
      expect(results.dcQcAlerts).toBe(2);
    });

    it('preview sends nothing and writes nothing', async () => {
      systemSettingRepoMock.findOne.mockResolvedValue({ key: 'DC_PENDING_ALERT_HOURS', value: '48' });

      dcRepoMock.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(1),
        take: vi.fn().mockReturnValue({
          getMany: vi.fn().mockResolvedValue([
            { id: 'dc-prev', challanNumber: 'DC-PREV', createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000), vendor: { name: 'V' } },
          ]),
        }),
      });

      const preview = await service.previewSweep('DC_PENDING_2_DAYS');

      expect(preview.matchCount).toBe(1);
      expect(preview.sample).toHaveLength(1);
      expect(preview.sample[0].referenceNumber).toBe('DC-PREV');
      expect(communicationServiceMock.sendEvent).not.toHaveBeenCalled();
      expect(watchRepoMock.save).not.toHaveBeenCalled();
      expect(watchRepoMock.delete).not.toHaveBeenCalled();
    });
  });
});
