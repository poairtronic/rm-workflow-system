import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ConsumablesService } from './consumables.service.js';
import { ConsumableRequest } from './entities/consumable-request.entity.js';
import {
  ConsumableRequestItem,
  ConsumableItemTrack,
  ConsumableItemStatus,
  ConsumableApprovalStatus,
} from './entities/consumable-request-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { ConsumablesController } from './consumables.controller.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { Reflector } from '@nestjs/core';

describe('Phase P2: Consumables Senior Manager Approval Engine', () => {
  let service: ConsumablesService;
  let dataSource: DataSource;
  let requestRepo: Repository<ConsumableRequest>;
  let itemRepo: Repository<ConsumableRequestItem>;
  let productRepo: Repository<Product>;
  let categoryRepo: Repository<ProductCategory>;
  let familyRepo: Repository<ProductFamily>;
  let vendorRepo: Repository<Vendor>;
  let binRepo: Repository<Bin>;
  let balanceRepo: Repository<StockBalance>;
  let transactionRepo: Repository<StockTransaction>;
  let mockAuditService: any;
  let mockConfigService: any;

  const mockCategory: ProductCategory = {
    id: 'cat-1',
    name: 'CONSUMABLES',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFamily: ProductFamily = {
    id: 'fam-1',
    categoryId: 'cat-1',
    category: mockCategory,
    name: 'General Consumables',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProductStock: Product = {
    id: 'prod-stock-1',
    familyId: 'fam-1',
    family: mockFamily,
    code: 'DRILL-01',
    name: 'Drill Bit 10mm',
    minimumInventory: 5,
    isActive: true,
    uom: 'NOS',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    categoryRepo = {
      findOne: vi.fn().mockResolvedValue(mockCategory),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'cat-1' })),
      save: vi.fn().mockImplementation((c) => Promise.resolve(c)),
    } as any;

    familyRepo = {
      findOne: vi.fn().mockResolvedValue(mockFamily),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'fam-1' })),
      save: vi.fn().mockImplementation((f) => Promise.resolve(f)),
    } as any;

    productRepo = {
      findOne: vi.fn().mockResolvedValue(mockProductStock),
      find: vi.fn().mockResolvedValue([mockProductStock]),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'prod-new' })),
      save: vi.fn().mockImplementation((p) => Promise.resolve(p)),
    } as any;

    vendorRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'vnd-new' })),
      save: vi.fn().mockImplementation((v) => Promise.resolve(v)),
    } as any;

    binRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'bin-1', code: 'BIN-01' }),
    } as any;

    balanceRepo = {
      find: vi.fn().mockResolvedValue([{ currentQuantity: 10 }]),
      findOne: vi.fn().mockResolvedValue({ currentQuantity: 10 }),
      save: vi.fn().mockImplementation((b) => Promise.resolve(b)),
    } as any;

    transactionRepo = {
      create: vi.fn().mockImplementation((t) => ({ ...t, id: 'tx-1' })),
      save: vi.fn().mockImplementation((t) => Promise.resolve(t)),
    } as any;

    requestRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'req-uuid-1', items: [] })),
      save: vi.fn().mockImplementation((r) => Promise.resolve({ ...r, id: r.id || 'req-uuid-1' })),
    } as any;

    itemRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: d.id || `item-${Math.random()}` })),
      save: vi.fn().mockImplementation((items) => Promise.resolve(items)),
      createQueryBuilder: vi.fn(),
    } as any;

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'CONSUMABLE_SM_APPROVAL_MODE') return 'OFF';
        if (key === 'CONSUMABLE_SM_APPROVAL_SCOPE') return 'ALL';
        return null;
      }),
    };

    dataSource = {
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (cb) => {
        const manager: any = {
          createQueryBuilder: vi.fn(),
          find: balanceRepo.find,
          findOne: balanceRepo.findOne,
          save: vi.fn().mockImplementation((entityClass, entities) => Promise.resolve(entities)),
        };
        return await cb(manager);
      }),
      createQueryRunner: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        startTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        manager: {
          findOne: vi.fn(),
          save: vi.fn(),
          delete: vi.fn(),
          count: vi.fn().mockResolvedValue(0),
        },
      }),
    } as any;

    service = new ConsumablesService(
      dataSource,
      requestRepo,
      itemRepo,
      productRepo,
      categoryRepo,
      familyRepo,
      vendorRepo,
      binRepo,
      balanceRepo,
      transactionRepo,
      undefined,
      undefined,
      undefined,
      mockConfigService,
      mockAuditService,
    );
  });

  describe('1. Configuration & Mode/Scope Evaluation', () => {
    it('defaults to mode=OFF and scope=ALL when variables are empty', async () => {
      mockConfigService.get = vi.fn().mockReturnValue(undefined);
      delete process.env.CONSUMABLE_SM_APPROVAL_MODE;
      delete process.env.CONSUMABLE_SM_APPROVAL_SCOPE;

      const config = await service.getApprovalConfig();
      expect(config).toEqual({ mode: 'OFF', scope: 'ALL' });
    });

    it('falls back to OFF and ALL on invalid configuration values with warning', async () => {
      mockConfigService.get = vi.fn((key) => {
        if (key === 'CONSUMABLE_SM_APPROVAL_MODE') return 'INVALID_MODE';
        if (key === 'CONSUMABLE_SM_APPROVAL_SCOPE') return 'PARTIAL';
        return null;
      });

      const config = await service.getApprovalConfig();
      expect(config).toEqual({ mode: 'OFF', scope: 'ALL' });
    });

    it('correctly parses ON and PURCHASE_ONLY', async () => {
      mockConfigService.get = vi.fn((key) => {
        if (key === 'CONSUMABLE_SM_APPROVAL_MODE') return 'ON';
        if (key === 'CONSUMABLE_SM_APPROVAL_SCOPE') return 'PURCHASE_ONLY';
        return null;
      });

      const config = await service.getApprovalConfig();
      expect(config).toEqual({ mode: 'ON', scope: 'PURCHASE_ONLY' });
    });
  });

  describe('2. createRequest Matrix & Step 0 created_by_user_id', () => {
    it('sets created_by_user_id and approves lines immediately when mode=OFF', async () => {
      mockConfigService.get = vi.fn().mockReturnValue('OFF');
      vi.spyOn(service, 'findOneRequest').mockResolvedValue({ id: 'req-1' } as any);

      await service.createRequest(
        {
          requestedBy: 'operator-1',
          items: [
            {
              description: 'Drill Bit 10mm',
              productId: 'prod-stock-1',
              requestedQty: 2,
            },
          ],
        },
        'user-uuid-123',
      );

      expect(requestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdByUserId: 'user-uuid-123',
          requestedBy: 'operator-1',
        }),
      );

      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalStatus: ConsumableApprovalStatus.APPROVED,
          approvedAt: expect.any(Date),
        }),
      );
    });

    it('sets PENDING_SM_APPROVAL for ALL lines when mode=ON and scope=ALL', async () => {
      mockConfigService.get = vi.fn((key) => {
        if (key === 'CONSUMABLE_SM_APPROVAL_MODE') return 'ON';
        if (key === 'CONSUMABLE_SM_APPROVAL_SCOPE') return 'ALL';
        return null;
      });
      vi.spyOn(service, 'findOneRequest').mockResolvedValue({ id: 'req-1' } as any);

      await service.createRequest(
        {
          requestedBy: 'senior-mgr-1',
          items: [
            { description: 'Drill Bit 10mm', productId: 'prod-stock-1', requestedQty: 2 },
            { description: 'New Custom Tool', isNewProduct: true, requestedQty: 5 },
          ],
        },
        'sm-user-uuid',
      );

      // Verify all lines received PENDING_SM_APPROVAL even when raised by SM
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Drill Bit 10mm',
          approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
          approvedAt: null,
        }),
      );

      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'New Custom Tool',
          approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
          approvedAt: null,
        }),
      );
    });

    it('approves STOCK_ITEM but keeps NON_STOCK_OR_NEW PENDING when mode=ON and scope=PURCHASE_ONLY', async () => {
      mockConfigService.get = vi.fn((key) => {
        if (key === 'CONSUMABLE_SM_APPROVAL_MODE') return 'ON';
        if (key === 'CONSUMABLE_SM_APPROVAL_SCOPE') return 'PURCHASE_ONLY';
        return null;
      });
      vi.spyOn(service, 'findOneRequest').mockResolvedValue({ id: 'req-1' } as any);

      await service.createRequest(
        {
          requestedBy: 'operator-1',
          items: [
            { description: 'Drill Bit 10mm', productId: 'prod-stock-1', requestedQty: 2 }, // Stock: 10 -> STOCK_ITEM
            { description: 'New Custom Tool', isNewProduct: true, requestedQty: 5 }, // New -> NON_STOCK_OR_NEW
          ],
        },
        'user-uuid-1',
      );

      // Stock item is approved immediately
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Drill Bit 10mm',
          itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
          approvalStatus: ConsumableApprovalStatus.APPROVED,
          approvedAt: expect.any(Date),
        }),
      );

      // Non-stock / purchase item is held pending
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'New Custom Tool',
          itemCategoryTrack: ConsumableItemTrack.NON_STOCK_OR_NEW,
          approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
          approvedAt: null,
        }),
      );
    });
  });

  describe('3. bulkApprove Logic & Live Stock Tally', () => {
    it('throws BadRequestException if itemIds array is empty or > 200', async () => {
      await expect(service.bulkApprove({ itemIds: [] }, 'sm-1')).rejects.toThrow(
        BadRequestException,
      );

      const tooMany = Array.from({ length: 201 }, (_, i) => `uuid-${i}`);
      await expect(service.bulkApprove({ itemIds: tooMany }, 'sm-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('approves pending items and leaves already approved items untouched (double call -> 0)', async () => {
      const mockPendingItem = {
        id: 'item-p1',
        description: 'Gloves',
        productId: 'prod-1',
        itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
        requestedQty: 2,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      // First call finds 1 pending item
      const qbMock: any = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockPendingItem]),
      };

      dataSource.transaction = vi.fn().mockImplementation(async (cb) => {
        return await cb({
          createQueryBuilder: vi.fn().mockReturnValue(qbMock),
          find: vi.fn().mockResolvedValue([{ currentQuantity: 10 }]),
          save: vi.fn().mockResolvedValue([mockPendingItem]),
        });
      });

      const res1 = await service.bulkApprove({ itemIds: ['item-p1', 'item-already-approved'] }, 'sm-1');
      expect(res1.approvedCount).toBe(1);
      expect(res1.ignoredCount).toBe(1);
      expect(mockPendingItem.approvalStatus).toBe(ConsumableApprovalStatus.APPROVED);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'CONSUMABLE_APPROVED',
          entityId: 'item-p1',
        }),
      );

      // Second call: no pending items returned by query
      qbMock.getMany = vi.fn().mockResolvedValue([]);
      const res2 = await service.bulkApprove({ itemIds: ['item-p1'] }, 'sm-1');
      expect(res2.approvedCount).toBe(0);
      expect(res2.ignoredCount).toBe(1);
    });

    it('switches line to purchase queue when live stock is depleted during approval', async () => {
      const mockStockItem = {
        id: 'item-depleted',
        description: 'End Mill 10mm',
        productId: 'prod-depleted',
        itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        requestedQty: 10,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      const qbMock: any = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockStockItem]),
      };

      dataSource.transaction = vi.fn().mockImplementation(async (cb) => {
        return await cb({
          createQueryBuilder: vi.fn().mockReturnValue(qbMock),
          find: vi.fn().mockResolvedValue([{ currentQuantity: 2 }]), // Only 2 in stock, requested 10
          save: vi.fn().mockResolvedValue([mockStockItem]),
        });
      });

      const res = await service.bulkApprove({ itemIds: ['item-depleted'] }, 'sm-1');

      expect(res.approvedCount).toBe(1);
      expect(res.switchedToPurchase).toHaveLength(1);
      expect(res.switchedToPurchase[0].id).toBe('item-depleted');

      expect(mockStockItem.itemCategoryTrack).toBe(ConsumableItemTrack.NON_STOCK_OR_NEW);
      expect(mockStockItem.status).toBe(ConsumableItemStatus.OPEN);
      expect(mockStockItem.approvalStatus).toBe(ConsumableApprovalStatus.APPROVED);

      // Audit logged for track switch
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'CONSUMABLE_TRACK_SWITCHED',
          entityId: 'item-depleted',
        }),
      );
    });

    it('enforces in-batch running tally: first line stays stock, second switches to purchase when stock exhausted', async () => {
      const line1 = {
        id: 'line-1',
        description: 'Bearing 6204',
        productId: 'prod-bearing',
        itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        requestedQty: 5,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      const line2 = {
        id: 'line-2',
        description: 'Bearing 6204',
        productId: 'prod-bearing',
        itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        requestedQty: 5,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      const qbMock: any = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([line1, line2]),
      };

      dataSource.transaction = vi.fn().mockImplementation(async (cb) => {
        return await cb({
          createQueryBuilder: vi.fn().mockReturnValue(qbMock),
          find: vi.fn().mockResolvedValue([{ currentQuantity: 6 }]), // 6 available: line1 gets 5 (1 left), line2 needs 5 -> switches!
          save: vi.fn().mockResolvedValue([line1, line2]),
        });
      });

      const res = await service.bulkApprove({ itemIds: ['line-1', 'line-2'] }, 'sm-1');

      expect(res.approvedCount).toBe(2);
      expect(line1.itemCategoryTrack).toBe(ConsumableItemTrack.STOCK_ITEM);
      expect(line2.itemCategoryTrack).toBe(ConsumableItemTrack.NON_STOCK_OR_NEW);
      expect(line2.status).toBe(ConsumableItemStatus.OPEN);
      expect(res.switchedToPurchase).toEqual([{ id: 'line-2', description: 'Bearing 6204' }]);
    });
  });

  describe('4. bulkReject Logic & Validation', () => {
    it('throws BadRequestException if rejection reason is less than 5 characters', async () => {
      await expect(
        service.bulkReject({ itemIds: ['uuid-1'], rejectionReason: 'No' }, 'sm-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects pending items with reason, batch ID, and audit record', async () => {
      const pendingItem = {
        id: 'item-reject-1',
        description: 'Special Gloves',
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      const qbMock: any = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([pendingItem]),
      };

      dataSource.transaction = vi.fn().mockImplementation(async (cb) => {
        return await cb({
          createQueryBuilder: vi.fn().mockReturnValue(qbMock),
          save: vi.fn().mockResolvedValue([pendingItem]),
        });
      });

      const res = await service.bulkReject(
        {
          itemIds: ['item-reject-1'],
          rejectionReason: 'Standard gloves must be used instead',
        },
        'sm-user-1',
      );

      expect(res.rejectedCount).toBe(1);
      expect(pendingItem.approvalStatus).toBe(ConsumableApprovalStatus.REJECTED);
      expect(pendingItem.rejectionReason).toBe('Standard gloves must be used instead');
      expect(pendingItem.rejectedById).toBe('sm-user-1');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'CONSUMABLE_REJECTED',
          entityId: 'item-reject-1',
        }),
      );
    });
  });

  describe('5. Workflow Action Gates (printPurchaseRequisition, receivePurchase, issueToProduction)', () => {
    it('printPurchaseRequisition blocks unapproved lines with 400 naming the lines', async () => {
      const pendingItem = {
        id: 'item-unapp-1',
        description: 'Grinding Wheel',
        status: ConsumableItemStatus.OPEN,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      } as ConsumableRequestItem;

      itemRepo.find = vi.fn().mockResolvedValue([pendingItem]);

      await expect(
        service.printPurchaseRequisition({ itemIds: ['item-unapp-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('printPurchaseRequisition permits legacy NULL and APPROVED lines', async () => {
      const legacyItem = {
        id: 'item-legacy-1',
        description: 'Legacy Item',
        status: ConsumableItemStatus.OPEN,
        approvalStatus: null,
      } as ConsumableRequestItem;

      const approvedItem = {
        id: 'item-app-2',
        description: 'Approved Item',
        status: ConsumableItemStatus.OPEN,
        approvalStatus: ConsumableApprovalStatus.APPROVED,
      } as ConsumableRequestItem;

      itemRepo.find = vi.fn().mockResolvedValue([legacyItem, approvedItem]);
      vi.spyOn(service, 'generateNextPrNumber').mockResolvedValue('152');

      const res = await service.printPurchaseRequisition({ itemIds: ['item-legacy-1', 'item-app-2'] });
      expect(res.prNumber).toBe('152');
      expect(res.items).toHaveLength(2);
    });

    it('receivePurchase blocks unapproved lines', async () => {
      itemRepo.findOne = vi.fn().mockResolvedValue({
        id: 'item-rec-1',
        status: ConsumableItemStatus.PURCHASE_REQUESTED,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      });

      await expect(
        service.receivePurchase({ itemId: 'item-rec-1', realReceivedQty: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('issueToProduction blocks unapproved lines', async () => {
      itemRepo.findOne = vi.fn().mockResolvedValue({
        id: 'item-iss-1',
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      });

      await expect(
        service.issueToProduction('item-iss-1', { issuedQty: 1, binId: 'bin-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Deletion Guards (deleteLineItem & bulkDeleteLineItems)', () => {
    it('deleteLineItem throws 400 when attempting to delete a REJECTED line', async () => {
      itemRepo.findOne = vi.fn().mockResolvedValue({
        id: 'item-rej-del',
        approvalStatus: ConsumableApprovalStatus.REJECTED,
        issuedQty: 0,
      });

      await expect(service.deleteLineItem('item-rej-del')).rejects.toThrow(BadRequestException);
    });

    it('bulkDeleteLineItems rejects entire request when a REJECTED line is present', async () => {
      itemRepo.find = vi.fn().mockResolvedValue([
        { id: 'item-valid', approvalStatus: ConsumableApprovalStatus.APPROVED },
        { id: 'item-rej', approvalStatus: ConsumableApprovalStatus.REJECTED },
      ]);

      await expect(
        service.bulkDeleteLineItems(['item-valid', 'item-rej']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('7. Role Guards & Route Protection', () => {
    it('verifies ConsumablesController approval endpoints only allow SENIOR_MANAGER and ADMIN', () => {
      const reflector = new Reflector();

      const bulkApproveRoles = reflector.get<UserRole[]>(
        'roles',
        ConsumablesController.prototype.bulkApprove,
      );
      expect(bulkApproveRoles).toEqual([UserRole.SENIOR_MANAGER, UserRole.ADMIN]);
      expect(bulkApproveRoles).not.toContain(UserRole.GENERAL_MANAGER);
      expect(bulkApproveRoles).not.toContain(UserRole.STORES);
      expect(bulkApproveRoles).not.toContain(UserRole.PRODUCTION);

      const bulkRejectRoles = reflector.get<UserRole[]>(
        'roles',
        ConsumablesController.prototype.bulkReject,
      );
      expect(bulkRejectRoles).toEqual([UserRole.SENIOR_MANAGER, UserRole.ADMIN]);
      expect(bulkRejectRoles).not.toContain(UserRole.GENERAL_MANAGER);

      const pendingCountRoles = reflector.get<UserRole[]>(
        'roles',
        ConsumablesController.prototype.getPendingCount,
      );
      expect(pendingCountRoles).toEqual([UserRole.SENIOR_MANAGER, UserRole.ADMIN]);
    });
  });

  describe('Phase P4: Queue Integration, Filters & Sweeps', () => {
    describe('1. findAllLineItems filtering', () => {
      it('approvedOnly: true filters for NULL or APPROVED approvalStatus', async () => {
        const mockQb: any = {
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          take: vi.fn().mockReturnThis(),
          getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        itemRepo.createQueryBuilder = vi.fn().mockReturnValue(mockQb);

        await service.findAllLineItems({ approvedOnly: true } as any);

        expect(mockQb.andWhere).toHaveBeenCalledWith(
          '(item.approvalStatus IS NULL OR item.approvalStatus = :approvedStatus)',
          { approvedStatus: ConsumableApprovalStatus.APPROVED },
        );
      });

      it('approvalStatus filter queries exact approvalStatus', async () => {
        const mockQb: any = {
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          take: vi.fn().mockReturnThis(),
          getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        itemRepo.createQueryBuilder = vi.fn().mockReturnValue(mockQb);

        await service.findAllLineItems({ approvalStatus: ConsumableApprovalStatus.REJECTED } as any);

        expect(mockQb.andWhere).toHaveBeenCalledWith(
          'item.approvalStatus = :approvalStatus',
          { approvalStatus: ConsumableApprovalStatus.REJECTED },
        );
      });
    });

    describe('2. SLA Sweeps - Age clock and approval filtering', () => {
      it('skips pending and rejected lines, and measures age from approvedAt', async () => {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

        const items: any[] = [
          // 1. Pending line created 72h ago -> MUST BE SKIPPED
          {
            id: 'item-pending-72h',
            description: 'Pending Drill',
            status: ConsumableItemStatus.OPEN,
            approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
            createdAt: threeDaysAgo,
            approvedAt: null,
          },
          // 2. Rejected line created 72h ago -> MUST BE SKIPPED
          {
            id: 'item-rejected-72h',
            description: 'Rejected End Mill',
            status: ConsumableItemStatus.OPEN,
            approvalStatus: ConsumableApprovalStatus.REJECTED,
            createdAt: threeDaysAgo,
            approvedAt: null,
          },
          // 3. Approved line created 72h ago, but approved 1h ago -> NOT OVERDUE (1h < 24h)
          {
            id: 'item-approved-1h',
            description: 'Freshly Approved Bearing',
            status: ConsumableItemStatus.OPEN,
            approvalStatus: ConsumableApprovalStatus.APPROVED,
            createdAt: threeDaysAgo,
            approvedAt: oneHourAgo,
            requestedQty: 10,
            uom: 'NOS',
          },
          // 4. Approved line approved 25h ago -> OVERDUE
          {
            id: 'item-approved-25h',
            description: 'Overdue Approved Belt',
            status: ConsumableItemStatus.OPEN,
            approvalStatus: ConsumableApprovalStatus.APPROVED,
            createdAt: threeDaysAgo,
            approvedAt: twentyFiveHoursAgo,
            requestedQty: 5,
            uom: 'NOS',
          },
          // 5. Legacy line (approvalStatus null), created 25h ago -> OVERDUE (uses createdAt)
          {
            id: 'item-legacy-25h',
            description: 'Legacy Oil',
            status: ConsumableItemStatus.OPEN,
            approvalStatus: null,
            createdAt: twentyFiveHoursAgo,
            approvedAt: null,
            requestedQty: 2,
            uom: 'NOS',
          },
        ];

        itemRepo.find = vi.fn().mockResolvedValue(items);

        const mockCommService: any = {
          sendConsumableAlert: vi.fn().mockResolvedValue(true),
        };
        (service as any).communicationService = mockCommService;

        const res = await service.checkAndAlertConsumableSlas();

        // 2 items should be counted as overdue: item-approved-25h and item-legacy-25h
        expect(res.overdueReceiptCount).toBe(2);
      });
    });
  });
});
