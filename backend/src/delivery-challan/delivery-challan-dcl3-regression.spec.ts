import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement, DcMovementStatus } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem } from './entities/dc-rework-item.entity.js';
import { DataSource } from 'typeorm';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';

describe('Phase DCL.3: Regression Suite (Type 2, Inward, QC, Closure, Movements)', () => {
  let service: DeliveryChallanService;

  let mockChallanRepo: any;
  let mockItemRepo: any;
  let mockDcMovementRepo: any;
  let mockDcQcRepo: any;
  let mockReworkRepo: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  let managerChallanRepo: any;
  let managerItemRepo: any;
  let managerMovementRepo: any;
  let managerStockRepo: any;
  let managerTxRepo: any;
  let managerQcRepo: any;
  let managerVendorRepo: any;

  beforeEach(async () => {
    const mockSeqQb: any = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ challanNumber: 'SDC/2627/0050' }),
      getRawMany: vi.fn().mockResolvedValue([]),
    };

    managerChallanRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data, id: data.id || 'dc-gen-id' })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'dc-gen-id' })),
      createQueryBuilder: vi.fn().mockReturnValue(mockSeqQb),
    };

    managerItemRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data, id: data.id || 'item-gen-id' })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'item-gen-id' })),
      createQueryBuilder: vi.fn().mockReturnValue(mockSeqQb),
    };

    managerMovementRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn((data) => Promise.resolve({ ...data, id: 'movement-id' })),
      create: vi.fn((entityClass, data) => ({ ...(data || entityClass), id: 'movement-id' })),
    };

    managerStockRepo = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 'stock-balance-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
      createQueryBuilder: vi.fn(),
    };

    managerTxRepo = {
      create: vi.fn((data) => ({ ...data, id: 'tx-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerQcRepo = {
      create: vi.fn((data) => ({ ...data, id: 'qc-id' })),
      save: vi.fn((data) => Promise.resolve({ ...data })),
    };

    managerVendorRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'vendor-1', name: 'Precision Engineering', isActive: true }),
    };

    mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        getRepository: vi.fn((entity: any) => {
          if (entity === DeliveryChallan) return managerChallanRepo;
          if (entity === DeliveryChallanItem) return managerItemRepo;
          if (entity === DcMovement) return managerMovementRepo;
          if (entity === StockBalance) return managerStockRepo;
          if (entity === StockTransaction) return managerTxRepo;
          if (entity === DcQcInspection) return managerQcRepo;
          if (entity === DcReworkItem) return mockReworkRepo;
          if (entity === Vendor) return managerVendorRepo;
          return {
            findOne: vi.fn(),
            save: vi.fn((d) => Promise.resolve(d)),
            create: vi.fn((c, d) => d || c),
            createQueryBuilder: vi.fn().mockReturnValue(mockSeqQb),
          };
        }),
        create: vi.fn((entityClass: any, data: any) => ({ ...(data || entityClass), id: 'mgr-created-id' })),
        save: vi.fn((data: any) => Promise.resolve({ ...data, id: data.id || 'mgr-saved-id' })),
        findOne: vi.fn((entity: any, opts: any) => {
          if (entity === DeliveryChallan) return managerChallanRepo.findOne(opts);
          if (entity === DeliveryChallanItem) return managerItemRepo.findOne(opts);
          if (entity === Vendor) return managerVendorRepo.findOne(opts);
          return Promise.resolve(null);
        }),
        find: vi.fn((entity: any, opts: any) => {
          if (entity === DeliveryChallanItem) return managerItemRepo.find(opts);
          return Promise.resolve([]);
        }),
        query: vi.fn().mockResolvedValue([]),
      },
    };

    mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      getRepository: vi.fn(),
    };

    mockChallanRepo = {
      createQueryBuilder: vi.fn(),
      findOne: vi.fn(),
    };
    mockItemRepo = { find: vi.fn() };
    mockDcMovementRepo = { find: vi.fn() };
    mockDcQcRepo = { find: vi.fn() };
    mockReworkRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((data: any) => ({ ...data, id: 'rework-item-id' })),
      save: vi.fn((data: any) => Promise.resolve({ ...data, id: 'rework-item-id' })),
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

  // --------------------------------------------------------------------------
  // 1. Regression: Type 2 creation
  // --------------------------------------------------------------------------
  it('Regression 1: creates Type 2 General Inventory / Stock Conversion challan without lock restrictions', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const mockStockBalance = {
      id: 'sb-1',
      productId: 'prod-billet-1',
      binId: 'bin-main-1',
      currentQuantity: 100,
    };

    const mockSbQb: any = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(mockStockBalance),
    };
    managerStockRepo.createQueryBuilder.mockReturnValue(mockSbQb);

    // Mock sequence query for Type 2
    mockQueryRunner.manager.query.mockResolvedValueOnce([{ max_seq: '0' }]);
    mockChallanRepo.findOne.mockResolvedValue({
      id: 'dc-gen-id',
      challanNumber: 'SDC/2627/0051',
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.DISPATCHED,
    });

    const result = await service.createType2Challan(
      {
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: 'vendor-1',
        dispatchDate: futureDate.toISOString(),
        notes: 'Type 2 Stock Conversion dispatch',
        items: [
          {
            productId: 'prod-billet-1',
            binId: 'bin-main-1',
            outputProductId: 'prod-shaft-1',
            quantityDispatched: 25,
            expectedOutputQuantity: 25,
          },
        ],
      } as any,
      'test-user-id',
    );

    expect(result).toBeDefined();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    // Stock balance was reduced by 25
    expect(mockStockBalance.currentQuantity).toBe(75);
    // StockTransaction DC_DISPATCH was logged
    expect(managerTxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: TransactionType.DC_DISPATCH,
        quantity: 25,
      }),
    );
  });

  // --------------------------------------------------------------------------
  // 2. Regression: recordReturn and Inward
  // --------------------------------------------------------------------------
  it('Regression 2: recordReturn inwards partial quantity and updates status to PARTIALLY_RETURNED', async () => {
    const mockDc: any = {
      id: 'dc-ret-1',
      challanNumber: 'SDC/2627/0010',
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      status: DeliveryChallanStatus.DISPATCHED,
      vendorId: 'vendor-1',
    };

    const mockItem: any = {
      id: 'item-ret-1',
      challanId: 'dc-ret-1',
      quantityDispatched: 20,
      initialExpectedQty: 20,
      expectedReturnQty: 20,
      actualReceivedQty: 0,
      qcPendingQty: 0,
      qcPassedQty: 0,
      qcRejectedQty: 0,
    };

    managerChallanRepo.findOne.mockResolvedValue(mockDc);
    mockQueryRunner.manager.find.mockResolvedValue([mockItem]);

    const res = await service.processChallanReturn(
      'dc-ret-1',
      {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: 'Received partial batch of 12 units',
        items: [
          {
            itemId: 'item-ret-1',
            receivedQty: 12,
          },
        ],
      },
      'inspector-1',
    );

    expect(mockItem.actualReceivedQty).toBe(12);
    expect(mockItem.qcPendingQty).toBe(12);
    // DC status transitioned to PARTIALLY_RETURNED
    expect(mockDc.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 3. Regression: QC Inspection
  // --------------------------------------------------------------------------
  it('Regression 3: qcInspectChallan accepts 10 and rejects 2 with split accounting', async () => {
    const mockDc: any = {
      id: 'dc-qc-1',
      challanNumber: 'SDC/2627/0011',
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      vendorId: 'vendor-1',
      vendor: { id: 'vendor-1', name: 'Precision Heat Treaters' },
    };

    const mockItem: any = {
      id: 'item-qc-1',
      challanId: 'dc-qc-1',
      productId: 'prod-gear-1',
      product: { id: 'prod-gear-1', name: 'Forged Gear Blank', uom: 'PCS' },
      quantityDispatched: 20,
      actualReceivedQty: 12,
      qcPendingQty: 12,
      qcPassedQty: 0,
      qcRejectedQty: 0,
      quantityReturned: 0,
    };

    managerChallanRepo.findOne.mockResolvedValue(mockDc);
    managerItemRepo.findOne.mockResolvedValue(mockItem);
    managerItemRepo.find.mockResolvedValue([mockItem]);

    const result = await service.qcInspectChallan(
      'dc-qc-1',
      {
        items: [
          {
            itemId: 'item-qc-1',
            passedQty: 10,
            rejectedQty: 2,
            qcRemarks: '10 passed dimensional check, 2 cracked',
          },
        ],
      },
      'qc-officer-1',
    );

    expect(mockItem.qcPassedQty).toBe(10);
    expect(mockItem.qcRejectedQty).toBe(2);
    expect(mockItem.qcPendingQty).toBe(0); // 12 - (10 + 2) = 0
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 4. Regression: DC Closure
  // --------------------------------------------------------------------------
  it('Regression 4: closes DC automatically when all items are fully received and inspected', async () => {
    const mockDc: any = {
      id: 'dc-close-1',
      challanNumber: 'SDC/2627/0012',
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      vendorId: 'vendor-1',
      vendor: { id: 'vendor-1', name: 'Precision Heat Treaters' },
    };

    // Item 1 had 10 dispatched, 10 passed
    const item1: any = {
      id: 'it-1',
      challanId: 'dc-close-1',
      quantityDispatched: 10,
      actualReceivedQty: 10,
      qcPendingQty: 0,
      qcPassedQty: 10,
      qcRejectedQty: 0,
      quantityReturned: 10,
    };

    // Item 2 had 5 dispatched, now inspect final 5
    const item2: any = {
      id: 'it-2',
      challanId: 'dc-close-1',
      quantityDispatched: 5,
      actualReceivedQty: 5,
      qcPendingQty: 5,
      qcPassedQty: 0,
      qcRejectedQty: 0,
      quantityReturned: 0,
    };

    managerChallanRepo.findOne.mockResolvedValue(mockDc);
    managerItemRepo.findOne.mockImplementation(({ where }: any) => {
      if (where?.id === 'it-2') return Promise.resolve(item2);
      if (where?.id === 'it-1') return Promise.resolve(item1);
      return Promise.resolve(null);
    });
    managerItemRepo.find.mockResolvedValue([item1, item2]);

    const result = await service.qcInspectChallan(
      'dc-close-1',
      {
        items: [
          {
            itemId: 'it-2',
            passedQty: 5,
            rejectedQty: 0,
            qcRemarks: 'All 5 accepted',
          },
        ],
      },
      'qc-officer-1',
    );

    // item 2 now has 5 passed
    expect(item2.qcPassedQty).toBe(5);
    // All items fully settled (10 + 5 === 15 dispatched), so DC must transition to CLOSED
    expect(mockDc.status).toBe(DeliveryChallanStatus.CLOSED);
  });

  // --------------------------------------------------------------------------
  // 5. Regression: DC Movement Ledger Totals
  // --------------------------------------------------------------------------
  it('Regression 5: reconciles DC Movement ledger totals and verifies running liabilities', async () => {
    const mockMovement1 = {
      id: 'm-1',
      challanId: 'dc-1',
      scId: 'sc-1',
      dispatchedQty: 50,
      returnedQty: 30,
      status: DcMovementStatus.PARTIAL_RETURNED,
    };

    const mockMovement2 = {
      id: 'm-2',
      challanId: 'dc-2',
      scId: 'sc-1',
      dispatchedQty: 20,
      returnedQty: 20,
      status: DcMovementStatus.RETURNED,
    };

    mockDcMovementRepo.find.mockResolvedValue([mockMovement1, mockMovement2]);

    const movements = await mockDcMovementRepo.find({ where: { scId: 'sc-1' } });
    const totalDispatched = movements.reduce((acc: number, m: any) => acc + m.dispatchedQty, 0);
    const totalReturned = movements.reduce((acc: number, m: any) => acc + m.returnedQty, 0);
    const activeLiability = totalDispatched - totalReturned;

    expect(totalDispatched).toBe(70);
    expect(totalReturned).toBe(50);
    expect(activeLiability).toBe(20);
    expect(movements.find((m: any) => m.id === 'm-1').status).toBe(DcMovementStatus.PARTIAL_RETURNED);
    expect(movements.find((m: any) => m.id === 'm-2').status).toBe(DcMovementStatus.RETURNED);
  });
});
