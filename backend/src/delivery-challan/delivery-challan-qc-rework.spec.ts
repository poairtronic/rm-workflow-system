import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement, DcMovementStatus } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem, ReworkItemStatus } from './entities/dc-rework-item.entity.js';
import { DataSource } from 'typeorm';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';

describe('Phase 23 — DC Quality Check Gate, Rework Module & Split Accounting (Unit & Business Logic)', () => {
  let service: DeliveryChallanService;
  let mockChallanRepo: any;
  let mockItemRepo: any;
  let mockDcMovementRepo: any;
  let mockDcQcRepo: any;
  let mockReworkRepo: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  // Repositories inside queryRunner.manager
  let managerChallanRepo: any;
  let managerItemRepo: any;
  let managerMovementRepo: any;
  let managerStockRepo: any;
  let managerTxRepo: any;
  let managerQcRepo: any;
  let managerReworkRepo: any;
  let managerVendorRepo: any;

  beforeEach(async () => {
    const mockQb: any = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ challanNumber: 'SDC/2627/0001' }),
    };

    managerChallanRepo = {
      findOne: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'new-challan-id' })),
      createQueryBuilder: vi.fn().mockReturnValue(mockQb),
    };

    managerItemRepo = {
      find: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'new-item-id' })),
    };

    managerMovementRepo = {
      findOne: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'new-movement-id' })),
    };

    managerStockRepo = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 'stock-balance-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerTxRepo = {
      create: vi.fn((data) => ({ ...data, id: 'tx-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerQcRepo = {
      create: vi.fn((data) => ({ ...data, id: 'qc-log-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerReworkRepo = {
      create: vi.fn((data) => ({ ...data, id: 'rework-item-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerVendorRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'vendor-uuid-1', name: 'Precision Engineering Ltd', isActive: true }),
    };

    mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        findOne: vi.fn((entityClass, opts) => {
          if (entityClass === DeliveryChallan) return managerChallanRepo.findOne(opts);
          return null;
        }),
        find: vi.fn((entityClass, opts) => {
          if (entityClass === DeliveryChallanItem) return managerItemRepo.find(opts);
          return [];
        }),
        save: vi.fn((entityClass, data) => {
          if (!data) return Promise.resolve(entityClass);
          return Promise.resolve(data);
        }),
        create: vi.fn((entityClass, data) => {
          if (entityClass === DeliveryChallan) return { ...data, id: 'new-dc-id', challanNumber: 'SDC/2627/0099' };
          if (entityClass === DeliveryChallanItem) return { ...data, id: 'new-item-id' };
          if (entityClass === DcMovement) return { ...data, id: 'new-movement-id' };
          return { ...data, id: 'created-id' };
        }),
        getRepository: vi.fn((entityClass) => {
          if (entityClass === DeliveryChallan) return managerChallanRepo;
          if (entityClass === DeliveryChallanItem) return managerItemRepo;
          if (entityClass === DcMovement) return managerMovementRepo;
          if (entityClass === StockBalance) return managerStockRepo;
          if (entityClass === StockTransaction) return managerTxRepo;
          if (entityClass === DcQcInspection) return managerQcRepo;
          if (entityClass === DcReworkItem) return managerReworkRepo;
          if (entityClass === Vendor) return managerVendorRepo;
          return {
            findOne: vi.fn(),
            save: vi.fn((d) => Promise.resolve(d)),
            create: vi.fn((d) => d),
          };
        }),
      },
    };

    mockChallanRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn((d) => Promise.resolve(d)),
      create: vi.fn((d) => d),
    };

    mockItemRepo = {
      find: vi.fn(),
      save: vi.fn((d) => Promise.resolve(d)),
    };

    mockDcMovementRepo = {
      find: vi.fn(),
      save: vi.fn((d) => Promise.resolve(d)),
    };

    mockDcQcRepo = {
      find: vi.fn(),
      save: vi.fn((d) => Promise.resolve(d)),
      create: vi.fn((d) => d),
    };

    mockReworkRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn((d) => Promise.resolve(d)),
      create: vi.fn((d) => d),
    };

    mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryChallanService,
        { provide: getRepositoryToken(DeliveryChallan), useValue: mockChallanRepo },
        { provide: getRepositoryToken(DeliveryChallanItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(DcMovement), useValue: mockDcMovementRepo },
        { provide: getRepositoryToken(DcQcInspection), useValue: mockDcQcRepo },
        { provide: getRepositoryToken(DcReworkItem), useValue: mockReworkRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DeliveryChallanService>(DeliveryChallanService);
  });

  describe('Step 1: Dock Receipt Inwarding (processChallanReturn)', () => {
    it('inwards 5 of 10 dispatched units into qcPendingQty without closing DC or crediting stock', async () => {
      const mockDc: any = {
        id: 'dc-1',
        challanNumber: 'SDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.DISPATCHED,
        vendorId: 'vendor-1',
      };

      const mockItem: any = {
        id: 'item-1',
        challanId: 'dc-1',
        quantityDispatched: 10,
        qcPendingQty: 0,
        qcPassedQty: 0,
        qcRejectedQty: 0,
        quantityReturned: 0,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);

      const result = await service.processChallanReturn(
        'dc-1',
        {
          actualReceiptDate: new Date().toISOString(),
          verificationRemarks: 'Dock inward batch 1',
          items: [{ itemId: 'item-1', quantityToReturn: 5 }],
        },
        'user-storekeeper-1'
      );

      // Verify that qcPendingQty is incremented by 5
      expect(mockItem.qcPendingQty).toBe(5);
      // Verify parent DC status is PARTIALLY_RETURNED, NOT CLOSED
      expect(result.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
      // Verify no stock balance movement was invoked
      expect(managerStockRepo.save).not.toHaveBeenCalled();
      expect(managerTxRepo.save).not.toHaveBeenCalled();
    });

    it('rejects dock return if quantity exceeds remaining balance at vendor', async () => {
      const mockDc: any = {
        id: 'dc-1',
        challanNumber: 'SDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.DISPATCHED,
      };

      const mockItem: any = {
        id: 'item-1',
        challanId: 'dc-1',
        quantityDispatched: 10,
        qcPendingQty: 5, // 5 already in QC
        qcPassedQty: 0,
        qcRejectedQty: 0,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);

      // Attempting to return 6 when only 5 remain at vendor (10 - 5 = 5)
      await expect(
        service.processChallanReturn(
          'dc-1',
          {
            actualReceiptDate: new Date().toISOString(),
            items: [{ itemId: 'item-1', quantityToReturn: 6 }],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('supports Type 2 revised expected return: changes 100 expected to 95 and inwards 40 partial units', async () => {
      const mockDc: any = {
        id: 'dc-type2',
        challanNumber: 'SDC/2627/0002',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        status: DeliveryChallanStatus.DISPATCHED,
      };

      const mockItem: any = {
        id: 'item-t2',
        challanId: 'dc-type2',
        quantityDispatched: 50,
        expectedOutputQuantity: 100, // Originally expected 100
        qcPendingQty: 0,
        qcPassedQty: 0,
        qcRejectedQty: 0,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);

      const result = await service.processChallanReturn(
        'dc-type2',
        {
          actualReceiptDate: new Date().toISOString(),
          verificationRemarks: 'Vendor revised output to 95, received 40 today',
          items: [
            {
              itemId: 'item-t2',
              expectedReturnQty: 95, // Revised to 95
              receivedQty: 40,
            },
          ],
        },
        'stores-user'
      );

      // Verify that expected quantities were updated to 95
      expect(mockItem.expectedReturnQty).toBe(95);
      expect(mockItem.expectedOutputQuantity).toBe(95);
      // Verify qcPendingQty is incremented by 40
      expect(mockItem.qcPendingQty).toBe(40);
      expect(result.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
    });

    it('rejects revising expected return below already received/accounted quantity', async () => {
      const mockDc: any = {
        id: 'dc-type2',
        challanNumber: 'SDC/2627/0002',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      };

      const mockItem: any = {
        id: 'item-t2',
        challanId: 'dc-type2',
        quantityDispatched: 50,
        expectedOutputQuantity: 95,
        qcPendingQty: 40, // 40 already received
        qcPassedQty: 0,
        qcRejectedQty: 0,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);

      // Attempting to set expected to 30 when 40 is already in QC
      await expect(
        service.processChallanReturn(
          'dc-type2',
          {
            actualReceiptDate: new Date().toISOString(),
            items: [
              {
                itemId: 'item-t2',
                expectedReturnQty: 30,
                receivedQty: 5,
              },
            ],
          },
          'stores-user'
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Step 2: Quality Check (QC) Gate Verification (qcInspectChallan)', () => {
    it('executes 10 -> 5 received -> 2 Pass / 3 Fail rule: creates 3 Rework units and keeps DC in Partial', async () => {
      const mockDc: any = {
        id: 'dc-1',
        challanNumber: 'SDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
        vendorId: 'vendor-1',
        vendor: { id: 'vendor-1', name: 'Vendor Tech' },
        scId: 'sc-1005',
        sc: { scNumber: 'SC-1005', purchaseOrderId: 'po-50', purchaseOrder: { id: 'po-50', poNumber: 'PO-50' } },
      };

      const mockItem: any = {
        id: 'item-1',
        challanId: 'dc-1',
        productId: 'prod-gear-1',
        product: { id: 'prod-gear-1', name: 'Forged Gear Blank', uom: 'PCS' },
        quantityDispatched: 10,
        qcPendingQty: 5, // 5 units waiting at QC gate
        qcPassedQty: 0,
        qcRejectedQty: 0,
        quantityReturned: 0,
        scId: 'sc-1005',
        sc: { scNumber: 'SC-1005', purchaseOrderId: 'po-50', purchaseOrder: { id: 'po-50', poNumber: 'PO-50' } },
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);
      managerItemRepo.find.mockResolvedValue([mockItem]);

      // Inspector passes 2, rejects 3
      const result = await service.qcInspectChallan(
        'dc-1',
        {
          items: [
            {
              itemId: 'item-1',
              passedQty: 2,
              rejectedQty: 3,
              qcRemarks: 'Dimensional deviation on tooth profile (+0.05mm)',
            },
          ],
        },
        'inspector-1'
      );

      // Verify split math
      expect(mockItem.qcPendingQty).toBe(0);
      expect(mockItem.qcPassedQty).toBe(2);
      expect(mockItem.qcRejectedQty).toBe(3);
      expect(mockItem.quantityReturned).toBe(5);

      // Verify DC remains PARTIALLY_RETURNED because 5 units are still at the vendor
      expect(result.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);

      // Verify DcReworkItem creation with original SC # and PO #
      expect(managerReworkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceDcId: 'dc-1',
          sourceDcNumber: 'SDC/2627/0001',
          scId: 'sc-1005',
          scNumber: 'SC-1005',
          poNumber: 'PO-50',
          rejectedQty: 3,
          reworkStatus: ReworkItemStatus.PENDING_ACK,
          qcRemarks: 'Dimensional deviation on tooth profile (+0.05mm)',
        })
      );
    });

    it('Type 2 General Inventory Outward: atomically increments stock_balances with editable actualStoreInwardQty on QC pass', async () => {
      const mockDc: any = {
        id: 'dc-type2',
        challanNumber: 'SDC/2627/0002',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
        vendorId: 'vendor-casting-1',
      };

      const mockItem: any = {
        id: 'item-type2',
        challanId: 'dc-type2',
        productId: 'raw-ingot-id',
        outputProductId: 'machined-casting-id',
        outputBinId: 'bin-main-store-id',
        quantityDispatched: 10,
        expectedOutputQuantity: 10,
        qcPendingQty: 5,
        qcPassedQty: 0,
        qcRejectedQty: 0,
        actualReceivedQty: 4.8, // editable actual yield entered
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);
      managerItemRepo.find.mockResolvedValue([mockItem]);

      const mockStockBalance: any = {
        productId: 'machined-casting-id',
        binId: 'bin-main-store-id',
        currentQuantity: 100,
      };
      managerStockRepo.findOne.mockResolvedValue(mockStockBalance);

      await service.qcInspectChallan(
        'dc-type2',
        {
          items: [
            {
              itemId: 'item-type2',
              passedQty: 5,
              rejectedQty: 0,
              actualStoreInwardQty: 4.8, // Actual weight/yield after machining
              targetBinId: 'bin-main-store-id',
            },
          ],
        },
        'inspector-1'
      );

      // Verify that exactly 4.8 (actual store inward yield) was credited to stock
      expect(mockStockBalance.currentQuantity).toBe(104.8);
      expect(managerStockRepo.save).toHaveBeenCalledWith(mockStockBalance);

      // Verify immutable stock transaction
      expect(managerTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'machined-casting-id',
          destinationBinId: 'bin-main-store-id',
          quantity: 4.8,
          referenceType: 'DELIVERY_CHALLAN_TYPE_2_QC_PASS',
        })
      );
    });

    it('auto-closes Delivery Challan when 100% of custody is accounted for (Passed + Rework = Total Dispatched)', async () => {
      const mockDc: any = {
        id: 'dc-closing',
        challanNumber: 'SDC/2627/0003',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
        vendorId: 'vendor-1',
      };

      // Item previously had 2 passed, 3 reworked. Now remaining 5 units arrive and pass QC.
      const mockItem: any = {
        id: 'item-closing',
        challanId: 'dc-closing',
        productId: 'prod-1',
        quantityDispatched: 10,
        qcPendingQty: 5,
        qcPassedQty: 2,
        qcRejectedQty: 3,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);
      managerItemRepo.find.mockResolvedValue([mockItem]);

      const result = await service.qcInspectChallan(
        'dc-closing',
        {
          items: [{ itemId: 'item-closing', passedQty: 5, rejectedQty: 0 }],
        },
        'inspector-1'
      );

      // Total Accounted: 2 + 5 = 7 Passed, 3 Rejected -> 10 Total. Pending at vendor = 0, Pending QC = 0.
      expect(mockItem.qcPassedQty).toBe(7);
      expect(mockItem.qcRejectedQty).toBe(3);
      expect(mockItem.qcPendingQty).toBe(0);
      expect(result.status).toBe(DeliveryChallanStatus.CLOSED);
    });
  });

  describe('Step 3: Rework Lifecycle & Re-Dispatch (Rework Management)', () => {
    it('marks rework item as MARKED_OKAY when acknowledged by production/quality', async () => {
      const mockReworkItem: any = {
        id: 'rework-1',
        reworkStatus: ReworkItemStatus.PENDING_ACK,
      };
      mockReworkRepo.findOne.mockResolvedValue(mockReworkItem);

      const result = await service.markReworkItemOkay('rework-1');
      expect(result.reworkStatus).toBe(ReworkItemStatus.MARKED_OKAY);
      expect(mockReworkRepo.save).toHaveBeenCalledWith(mockReworkItem);
    });

    it('spawns a new Rework Delivery Challan attached to the same SC # / PO # with rejected quantity', async () => {
      const mockReworkItem: any = {
        id: 'rework-1',
        sourceDcId: 'dc-orig-1',
        sourceDcNumber: 'SDC/2627/0001',
        dcType: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        scId: 'sc-1005',
        scNumber: 'SC-1005',
        poId: 'po-50',
        poNumber: 'PO-50',
        productId: 'prod-gear-1',
        productName: 'Forged Gear Blank',
        rejectedQty: 3,
        uom: 'PCS',
        originalVendorId: 'vendor-1',
        reworkStatus: ReworkItemStatus.MARKED_OKAY,
      };
      mockReworkRepo.findOne.mockResolvedValue(mockReworkItem);

      const result = await service.reDispatchReworkItem(
        'rework-1',
        {
          vendorId: 'vendor-alternative-2',
          targetReturnDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          notes: 'Re-machining teeth on rejected gear blanks',
        },
        'user-planner-1'
      );

      // Verify that the rework item is marked RE_DISPATCHED
      expect(result.reworkItem.reworkStatus).toBe(ReworkItemStatus.RE_DISPATCHED);
      expect(result.reworkItem.reworkDcNumber).toBe('SDC/2627/0099');

      // Verify that the new DC maintains SC linkage and rejected quantity
      expect(result.deliveryChallan.scId).toBe('sc-1005');
      expect(result.deliveryChallan.vendorId).toBe('vendor-alternative-2');
    });

    it('re-dispatches rework to SAME vendor, updating existing DC and item counters for inwarding', async () => {
      const mockItem: any = {
        id: 'item-orig-1',
        productId: 'prod-gear-1',
        partNumber: 'DC2-005',
        quantityDispatched: 70,
        expectedReturnQty: 70,
        quantityReturned: 70,
        qcPassedQty: 69,
        qcRejectedQty: 1,
        qcPendingQty: 0,
      };

      const mockExistingDc: any = {
        id: 'dc-orig-1',
        challanNumber: 'SDC/2627/0016',
        vendorId: 'vendor-1',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        status: DeliveryChallanStatus.CLOSED,
        actualReturnDate: new Date('2026-10-22'),
        items: [mockItem],
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, options: any) => {
        if (entity === DeliveryChallan) {
          return mockExistingDc;
        }
        return null;
      });

      const mockReworkItem: any = {
        id: 'rework-same-1',
        sourceDcId: 'dc-orig-1',
        sourceDcNumber: 'SDC/2627/0016',
        dcType: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        productId: 'prod-gear-1',
        productName: 'Forged Gear Blank',
        rejectedQty: 1,
        uom: 'PCS',
        originalVendorId: 'vendor-1',
        reworkStatus: ReworkItemStatus.MARKED_OKAY,
      };
      mockReworkRepo.findOne.mockResolvedValue(mockReworkItem);

      const result = await service.reDispatchReworkItem(
        'rework-same-1',
        {
          vendorId: 'vendor-1', // Same vendor
          targetReturnDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          notes: 'Same vendor rework re-dispatch',
        },
        'user-planner-1'
      );

      // Verify that the DC status is reopened to DISPATCHED and actualReturnDate cleared
      expect(result.deliveryChallan.status).toBe(DeliveryChallanStatus.DISPATCHED);
      expect(result.deliveryChallan.actualReturnDate).toBeNull();
      expect(result.reworkItem.reworkStatus).toBe(ReworkItemStatus.RE_DISPATCHED);
      // Verify item qcPendingQty is reset to 0
      expect(mockItem.qcPendingQty).toBe(0);

      // Active rework quantity at vendor (1) offsets qcRejectedQty (1)
      const reworkQtyAtVendor = Number(result.reworkItem.rejectedQty);
      const settledRejected = Math.max(0, mockItem.qcRejectedQty - reworkQtyAtVendor);
      const alreadyAccounted = mockItem.qcPendingQty + mockItem.qcPassedQty + settledRejected;
      const vendorPending = mockItem.expectedReturnQty - alreadyAccounted;
      expect(vendorPending).toBe(1);
    });
  });
});
