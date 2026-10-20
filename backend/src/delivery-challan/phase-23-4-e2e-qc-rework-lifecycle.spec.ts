import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryChallanController } from './delivery-challan.controller.js';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement, DcMovementStatus } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem, ReworkItemStatus } from './entities/dc-rework-item.entity.js';
import { DataSource } from 'typeorm';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';

describe('Phase 4 — End-to-End Validation & Certification (QC Gate, Rework Loop & Split-Accounting)', () => {
  let controller: DeliveryChallanController;
  let service: DeliveryChallanService;

  let mockChallanRepo: any;
  let mockItemRepo: any;
  let mockDcMovementRepo: any;
  let mockDcQcRepo: any;
  let mockReworkRepo: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  // Manager repositories
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
      getOne: vi.fn().mockResolvedValue({ challanNumber: 'SDC/2627/0050' }),
    };

    managerChallanRepo = {
      findOne: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'dc-rework-gen-id' })),
      createQueryBuilder: vi.fn().mockReturnValue(mockQb),
    };

    managerItemRepo = {
      find: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'item-rework-gen-id' })),
    };

    managerMovementRepo = {
      findOne: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'movement-id' })),
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
      create: vi.fn((data) => ({ ...data, id: 'rework-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerVendorRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'vendor-heat-treat-1', name: 'Heat Treatment Specialists', isActive: true }),
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
          if (entityClass === DeliveryChallan) return { ...data, id: 'dc-rework-gen-id', challanNumber: 'SDC/2627/0051' };
          if (entityClass === DeliveryChallanItem) return { ...data, id: 'item-rework-gen-id' };
          if (entityClass === DcMovement) return { ...data, id: 'movement-id' };
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
      controllers: [DeliveryChallanController],
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

    controller = module.get<DeliveryChallanController>(DeliveryChallanController);
    service = module.get<DeliveryChallanService>(DeliveryChallanService);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Full Multi-Stage Lifecycle (Type 1 Process Outward)
  // 10 Dispatched -> Batch 1: Inward 5 -> QC: 2 Pass / 3 Fail -> Rework Spawned
  //               -> Batch 2: Inward 5 -> QC: 5 Pass -> Full Closure
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Scenario 1: Complete Type 1 Multi-Stage Lifecycle & Split Accounting Matrix', () => {
    it('executes full state machine from dispatch to dock inward, QC split, rework spawn, and final closure', async () => {
      const mockDc: any = {
        id: 'dc-stage1',
        challanNumber: 'SDC/2627/0100',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.DISPATCHED,
        vendorId: 'vendor-heat-treat-1',
        vendor: { id: 'vendor-heat-treat-1', name: 'Heat Treatment Specialists' },
        scId: 'sc-8888',
        sc: {
          id: 'sc-8888',
          scNumber: 'SC-8888',
          purchaseOrder: { id: 'po-99', poNumber: 'PO-99' },
        },
      };

      const mockItem: any = {
        id: 'item-gear-100',
        challanId: 'dc-stage1',
        productId: 'prod-spur-gear',
        product: { id: 'prod-spur-gear', name: 'Spur Gear Hub', code: 'SGH-01', uom: 'PCS' },
        quantityDispatched: 10,
        qcPendingQty: 0,
        qcPassedQty: 0,
        qcRejectedQty: 0,
        quantityReturned: 0,
        scId: 'sc-8888',
        sc: {
          id: 'sc-8888',
          scNumber: 'SC-8888',
          purchaseOrder: { id: 'po-99', poNumber: 'PO-99' },
        },
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);
      managerItemRepo.find.mockResolvedValue([mockItem]);

      // ─────────────────────────────────────────────────────────────────────────
      // Step 1: Dock Inwarding 5 units (Storekeeper receives first batch at dock)
      // ─────────────────────────────────────────────────────────────────────────
      const dockReturnDto = {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: 'Dock batch 1: 5 units arrived from Heat Treatment',
        items: [{ itemId: 'item-gear-100', quantityToReturn: 5 }],
      };

      const step1Result = await controller.dockReturn('dc-stage1', dockReturnDto, { user: { id: 'storekeeper-1' } } as any);

      // Invariants Check 1:
      // qcPendingQty = 5, qcPassed = 0, qcRejected = 0, vendor balance = 5
      expect(mockItem.qcPendingQty).toBe(5);
      expect(mockItem.qcPassedQty).toBe(0);
      expect(mockItem.qcRejectedQty).toBe(0);
      expect(step1Result.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
      // Zero stock movements
      expect(managerStockRepo.save).not.toHaveBeenCalled();

      // ─────────────────────────────────────────────────────────────────────────
      // Step 2: Quality Check Gate on Batch 1 (Inspector: 2 Pass / 3 Reject)
      // ─────────────────────────────────────────────────────────────────────────
      const qcInspectDto = {
        items: [
          {
            itemId: 'item-gear-100',
            passedQty: 2,
            rejectedQty: 3,
            qcRemarks: 'Hardness below threshold (HRC 42 vs required HRC 55)',
          },
        ],
      };

      const mockMovement: any = {
        challanId: 'dc-stage1',
        challanItemId: 'item-gear-100',
        dispatchedQty: 10,
        returnedQty: 0,
        status: DcMovementStatus.DISPATCHED,
      };
      managerMovementRepo.findOne.mockResolvedValue(mockMovement);

      const step2Result = await controller.qcInspect('dc-stage1', qcInspectDto, { user: { id: 'qc-inspector-1' } } as any);

      // Invariants Check 2:
      // qcPendingQty = 0 (decremented by 5)
      // qcPassedQty = 2
      // qcRejectedQty = 3
      // Vendor Balance = 10 - (2 + 3) = 5 remaining at vendor
      expect(mockItem.qcPendingQty).toBe(0);
      expect(mockItem.qcPassedQty).toBe(2);
      expect(mockItem.qcRejectedQty).toBe(3);
      expect(step2Result.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);

      // Verify Type 1 WIP Progress movement updated (2 units passed)
      expect(mockMovement.returnedQty).toBe(2);
      expect(mockMovement.status).toBe(DcMovementStatus.PARTIALLY_RETURNED);

      // Verify Rework Item creation with exact upstream SC # / PO #
      expect(managerReworkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceDcId: 'dc-stage1',
          sourceDcNumber: 'SDC/2627/0100',
          scId: 'sc-8888',
          scNumber: 'SC-8888',
          poNumber: 'PO-99',
          rejectedQty: 3,
          reworkStatus: ReworkItemStatus.PENDING_ACK,
          qcRemarks: 'Hardness below threshold (HRC 42 vs required HRC 55)',
        })
      );

      // ─────────────────────────────────────────────────────────────────────────
      // Step 3: Rework Lifecycle (Acknowledge & Re-Dispatch under same SC/PO)
      // ─────────────────────────────────────────────────────────────────────────
      const mockCreatedReworkItem: any = {
        id: 'rework-item-gear-1',
        sourceDcId: 'dc-stage1',
        sourceDcNumber: 'SDC/2627/0100',
        dcType: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        scId: 'sc-8888',
        scNumber: 'SC-8888',
        poId: 'po-99',
        poNumber: 'PO-99',
        productId: 'prod-spur-gear',
        productName: 'Spur Gear Hub',
        rejectedQty: 3,
        uom: 'PCS',
        originalVendorId: 'vendor-heat-treat-1',
        reworkStatus: ReworkItemStatus.PENDING_ACK,
      };
      mockReworkRepo.findOne.mockResolvedValue(mockCreatedReworkItem);

      // Acknowledge rework item
      const ackResult = await controller.markReworkItemOkay('rework-item-gear-1');
      expect(ackResult.reworkStatus).toBe(ReworkItemStatus.MARKED_OKAY);

      // Re-dispatch rework item to vendor for re-hardening
      const reDispatchResult = await controller.reDispatchReworkItem(
        'rework-item-gear-1',
        {
          vendorId: 'vendor-heat-treat-1',
          targetReturnDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          notes: 'Re-hardening rejected spur gears to HRC 58',
        },
        { user: { id: 'production-manager-1' } } as any
      );

      expect(reDispatchResult.reworkItem.reworkStatus).toBe(ReworkItemStatus.RE_DISPATCHED);
      expect(reDispatchResult.deliveryChallan.scId).toBe('sc-8888');

      // ─────────────────────────────────────────────────────────────────────────
      // Step 4: Batch 2 Inwarding & Inspection (Remaining 5 units arrive and pass)
      // ─────────────────────────────────────────────────────────────────────────
      // Inward remaining 5 units
      await controller.dockReturn(
        'dc-stage1',
        {
          actualReceiptDate: new Date().toISOString(),
          items: [{ itemId: 'item-gear-100', quantityToReturn: 5 }],
        },
        { user: { id: 'storekeeper-1' } } as any
      );
      expect(mockItem.qcPendingQty).toBe(5);

      // QC inspect: all 5 pass
      const finalResult = await controller.qcInspect(
        'dc-stage1',
        {
          items: [{ itemId: 'item-gear-100', passedQty: 5, rejectedQty: 0 }],
        },
        { user: { id: 'qc-inspector-1' } } as any
      );

      // Final Mathematical Reconciliation:
      // Total Dispatched: 10
      // Total QC Passed: 2 + 5 = 7
      // Total QC Rejected: 3
      // Total In QC: 0
      // Total at Vendor: 0
      // Accounted: 7 + 3 = 10 (100%)
      expect(mockItem.qcPassedQty).toBe(7);
      expect(mockItem.qcRejectedQty).toBe(3);
      expect(mockItem.qcPendingQty).toBe(0);
      expect(finalResult.status).toBe(DeliveryChallanStatus.CLOSED);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Type 2 General Inventory Outward with Asymmetric Stock Conversion
  // 10 Castings Dispatched -> 4.850 Kg Machined Inwarded (Yield Variance)
  // Stock Balance is atomically updated ONLY upon QC Pass
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Scenario 2: Type 2 Stock Conversion & Yield Variance Invariants', () => {
    it('does not touch inventory on dock receipt, then atomically credits warehouse stock with editable yield on QC pass', async () => {
      const mockDc: any = {
        id: 'dc-type2-yield',
        challanNumber: 'SDC/2627/0200',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        status: DeliveryChallanStatus.DISPATCHED,
        vendorId: 'vendor-foundry-1',
      };

      const mockItem: any = {
        id: 'item-raw-casting',
        challanId: 'dc-type2-yield',
        productId: 'prod-raw-billet',
        outputProductId: 'prod-machined-flange',
        outputBinId: 'bin-fg-store-1',
        quantityDispatched: 10,
        expectedOutputQuantity: 10,
        qcPendingQty: 0,
        qcPassedQty: 0,
        qcRejectedQty: 0,
        quantityReturned: 0,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);
      managerItemRepo.find.mockResolvedValue([mockItem]);

      // 1. Dock Inwarding 5 units with custom yield entered
      await controller.dockReturn(
        'dc-type2-yield',
        {
          actualReceiptDate: new Date().toISOString(),
          items: [
            {
              itemId: 'item-raw-casting',
              quantityToReturn: 5,
              actualInwardQty: 4.85, // Actual scale weight/yield
              targetBinId: 'bin-fg-store-1',
            },
          ],
        },
        { user: { id: 'dock-receiver-1' } } as any
      );

      // Verify stock balance was NOT changed during dock receipt
      expect(managerStockRepo.save).not.toHaveBeenCalled();
      expect(mockItem.actualReceivedQty).toBe(4.85);
      expect(mockItem.returnTargetBinId).toBe('bin-fg-store-1');

      // 2. QC Inspection Passes the 5 units with actual inward weight
      const existingStock: any = {
        productId: 'prod-machined-flange',
        binId: 'bin-fg-store-1',
        currentQuantity: 50.0,
      };
      managerStockRepo.findOne.mockResolvedValue(existingStock);

      await controller.qcInspect(
        'dc-type2-yield',
        {
          items: [
            {
              itemId: 'item-raw-casting',
              passedQty: 5,
              rejectedQty: 0,
              actualStoreInwardQty: 4.85,
              targetBinId: 'bin-fg-store-1',
            },
          ],
        },
        { user: { id: 'inspector-1' } } as any
      );

      // Verify atomic stock credit with exact yield variance: 50.0 + 4.85 = 54.85
      expect(existingStock.currentQuantity).toBe(54.85);
      expect(managerStockRepo.save).toHaveBeenCalledWith(existingStock);

      // Verify immutable stock transaction logged
      expect(managerTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-machined-flange',
          destinationBinId: 'bin-fg-store-1',
          quantity: 4.85,
          transactionType: TransactionType.DC_RETURN,
          referenceType: 'DELIVERY_CHALLAN_TYPE_2_QC_PASS',
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Strict Validation & Negative Boundary Guards
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Scenario 3: Negative Boundary Guards & Error Handling', () => {
    it('throws BadRequestException if inspector tries to pass/reject more than pending in QC', async () => {
      const mockDc: any = {
        id: 'dc-guard-1',
        challanNumber: 'SDC/2627/0300',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      };

      const mockItem: any = {
        id: 'item-guard-1',
        challanId: 'dc-guard-1',
        quantityDispatched: 10,
        qcPendingQty: 3, // Only 3 units pending QC
        qcPassedQty: 0,
        qcRejectedQty: 0,
      };

      managerChallanRepo.findOne.mockResolvedValue(mockDc);
      mockQueryRunner.manager.find.mockResolvedValue([mockItem]);
      managerItemRepo.find.mockResolvedValue([mockItem]);

      // Attempting to pass 2 and reject 2 (total 4 > 3 pending)
      await expect(
        controller.qcInspect(
          'dc-guard-1',
          {
            items: [{ itemId: 'item-guard-1', passedQty: 2, rejectedQty: 2 }],
          },
          { user: { id: 'inspector-1' } } as any
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents re-acknowledging a rework item that has already been re-dispatched', async () => {
      const mockReworkItem: any = {
        id: 'rework-done-1',
        reworkStatus: ReworkItemStatus.RE_DISPATCHED,
        reworkDcNumber: 'SDC/2627/0055',
      };
      mockReworkRepo.findOne.mockResolvedValue(mockReworkItem);

      await expect(controller.markReworkItemOkay('rework-done-1')).rejects.toThrow(BadRequestException);
    });
  });
});
