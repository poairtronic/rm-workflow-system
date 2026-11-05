import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem, ReworkItemStatus } from './entities/dc-rework-item.entity.js';
import { MercIndentPending } from '../merc-indent/entities/merc-indent-pending.entity.js';
import { MercIndentLineItem } from '../merc-indent/entities/merc-indent-line-item.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('Special Process Delivery Challan (Type 3) Service', () => {
  let service: DeliveryChallanService;
  let mockChallanRepo: any;
  let mockPendingRepo: any;
  let mockLineItemRepo: any;
  let mockReworkRepo: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockChallanRepo = {
      createQueryBuilder: vi.fn(),
      findOne: vi.fn(),
    };

    mockPendingRepo = {
      createQueryBuilder: vi.fn(),
      findOne: vi.fn(),
    };

    mockLineItemRepo = {
      find: vi.fn(),
    };

    mockReworkRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };

    mockQueryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: vi.fn(),
        create: vi.fn((entityClass, data) => ({ ...data, id: 'saved-id-123' })),
        save: vi.fn(async (entityClass, data) => data),
      },
    };

    mockDataSource = {
      createQueryRunner: vi.fn(() => mockQueryRunner),
      getRepository: vi.fn(),
      query: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryChallanService,
        { provide: getRepositoryToken(DeliveryChallan), useValue: mockChallanRepo },
        { provide: getRepositoryToken(DeliveryChallanItem), useValue: {} },
        { provide: getRepositoryToken(DcMovement), useValue: {} },
        { provide: getRepositoryToken(DcQcInspection), useValue: {} },
        { provide: getRepositoryToken(DcReworkItem), useValue: mockReworkRepo },
        { provide: getRepositoryToken(MercIndentPending), useValue: mockPendingRepo },
        { provide: getRepositoryToken(MercIndentLineItem), useValue: mockLineItemRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DeliveryChallanService>(DeliveryChallanService);
  });

  describe('getMercPoItems', () => {
    it('throws NotFoundException if PO does not exist in MERC indents', async () => {
      mockPendingRepo.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      await expect(service.getMercPoItems('PO-NONEXISTENT')).rejects.toThrow(NotFoundException);
    });

    it('returns PO details, line items with formatted poPartLabel, and availableStockProducts', async () => {
      const mockIndent = {
        id: 'indent-uuid-1',
        indentNumber: 'IND-901',
        poNumber: 'PO-2026-X1',
        customerName: 'Aero Corp',
        layoutNumber: 'LAY-880',
      };

      const mockItems = [
        {
          mercItemId: 'item-101',
          itemType: 'RAW_MATERIAL',
          name: 'BASE FLANGE',
          material: 'SS316',
          shape: 'ROUND',
          lengthMm: 120,
          widthMm: null,
          heightMm: null,
          diameterMm: 50,
          quantityRequired: 15,
          unit: 'PCS',
          vendorName: 'Apex Forge',
          source: 'MERC',
        },
      ];

      const mockStock = [
        { id: 'prod-1', name: 'HEX BOLT M12', total_stock: '45.000' },
      ];

      mockPendingRepo.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockIndent),
      });

      mockLineItemRepo.find.mockResolvedValue(mockItems);
      mockDataSource.query.mockResolvedValue(mockStock);

      const result = await service.getMercPoItems('PO-2026-X1');

      expect(result.poNumber).toBe('PO-2026-X1');
      expect(result.layoutNumber).toBe('LAY-880');
      expect(result.mercIndentId).toBe('indent-uuid-1');
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].poPartLabel).toBe('PO-2026-X1 - BASE FLANGE');
      expect(result.lineItems[0].quantityRequired).toBe(15);
      expect(result.availableStockProducts).toHaveLength(1);
      expect(result.availableStockProducts[0].productName).toBe('HEX BOLT M12');
      expect(result.availableStockProducts[0].totalStock).toBe(45);
    });
  });

  describe('createSplDc', () => {
    it('throws NotFoundException if vendor is not found', async () => {
      const vendorRepo = {
        findOne: vi.fn().mockResolvedValue(null),
      };
      mockQueryRunner.manager.getRepository.mockReturnValue(vendorRepo);

      await expect(
        service.createSplDc(
          {
            vendorId: 'v-unknown',
            poNumber: 'PO-123',
            dispatchGroups: [
              {
                processName: 'HEAT TREATMENT',
                items: [
                  {
                    poPartLabel: 'PO-123 - PLATE',
                    partNo: 'P-1',
                    dispatchedQty: 5,
                  },
                ],
              },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('creates SPL DC and line items without deducting inventory stock', async () => {
      const vendorRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 'v-1', name: 'Apex Heat' }),
      };
      const dcRepo = {
        createQueryBuilder: vi.fn().mockReturnValue({
          setLock: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue({ challanNumber: 'SDC/2627/0009' }),
        }),
      };

      mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
        if (entity === Vendor) return vendorRepo;
        if (entity === DeliveryChallan) return dcRepo;
        return { findOne: vi.fn() };
      });

      const result = await service.createSplDc(
        {
          vendorId: 'v-1',
          poNumber: 'PO-999',
          layoutNumber: 'L-01',
          mercIndentId: 'm-indent-1',
          mercIndentNumber: 'IND-999',
          dispatchGroups: [
            {
              processName: 'HEAT TREATMENT',
              items: [
                {
                  poPartLabel: 'PO-999 - MAIN FLANGE',
                  partNo: 'MF-01',
                  dispatchedQty: 10,
                  batchNo: 'B-001',
                },
                {
                  poPartLabel: 'EXTRA PACKING RING',
                  partNo: 'PR-99',
                  dispatchedQty: 2,
                  isExtraItem: true,
                },
              ],
            },
          ],
        },
        'user-admin',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.status).toBe('OPEN');
      expect(result.poNumber).toBe('PO-999');
      expect(result.dcNumber).toBe('SDC/2627/0010');
      expect(result.itemCount).toBe(2);
    });

    it('deducts inventory stock balance and writes STOCK_OUT transaction when extra stock item is added to SPL DC', async () => {
      const vendorRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 'v-1', name: 'Apex Heat' }),
      };
      const dcRepo = {
        createQueryBuilder: vi.fn().mockReturnValue({
          setLock: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue({ challanNumber: 'SDC/2627/0009' }),
        }),
      };
      const mockStockBalance = {
        id: 'sb-1',
        productId: 'prod-extra-1',
        binId: 'bin-1',
        currentQuantity: 10,
      };
      const stockBalanceRepo = {
        createQueryBuilder: vi.fn().mockReturnValue({
          setLock: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          getMany: vi.fn().mockResolvedValue([mockStockBalance]),
        }),
      };

      mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
        if (entity === Vendor) return vendorRepo;
        if (entity === DeliveryChallan) return dcRepo;
        if (entity.name === 'StockBalance' || entity.name?.includes('StockBalance')) return stockBalanceRepo;
        return stockBalanceRepo;
      });

      const result = await service.createSplDc(
        {
          vendorId: 'v-1',
          poNumber: 'PO-999',
          dispatchGroups: [
            {
              processName: 'HEAT TREATMENT',
              items: [
                {
                  poPartLabel: 'EXTRA BOLT',
                  partNo: 'BLT-01',
                  productId: 'prod-extra-1',
                  dispatchedQty: 4,
                  isExtraItem: true,
                },
              ],
            },
          ],
        },
        'user-admin',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockStockBalance.currentQuantity).toBe(6);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          transactionType: 'STOCK_OUT',
          quantity: 4,
          reason: expect.stringContaining('STOCK OUT FOR TYPE 3 DC SDC/2627/0010'),
          remarks: expect.stringContaining('STOCK OUT FOR TYPE 3 DC SDC/2627/0010'),
        }),
      );
    });
  });

  describe('listSplDcs', () => {
    it('queries only SPL_PROCESS challans and computes sentQty, passedQty, and vendorQty', async () => {
      const mockDc = {
        id: 'spl-dc-1',
        challanNumber: 'SDC/2627/0001',
        status: DeliveryChallanStatus.OPEN,
        poNumber: 'PO-444',
        layoutNumber: 'LAY-1',
        mercIndentNumber: 'IND-444',
        expectedReturnDate: new Date('2026-11-20'),
        notes: 'Priority dispatch',
        createdAt: new Date('2026-11-05'),
        vendor: { name: 'Super Spl Processors', address: 'Plot 4, Industrial Area' },
        items: [
          { quantityDispatched: 10, qcPassedQty: 3, quantityReturned: 3 },
          { quantityDispatched: 5, qcPassedQty: 0, quantityReturned: 0 },
        ],
      };

      const qbMock: any = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockDc]),
      };

      mockChallanRepo.createQueryBuilder.mockReturnValue(qbMock);

      const rows = await service.listSplDcs({ poNumber: 'PO-444' });

      expect(qbMock.where).toHaveBeenCalledWith('dc.type = :splType', {
        splType: DeliveryChallanType.SPL_PROCESS,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].dcNumber).toBe('SDC/2627/0001');
      expect(rows[0].vendorName).toBe('Super Spl Processors');
      expect(rows[0].itemCount).toBe(2);
      expect(rows[0].sentQty).toBe(15);
      expect(rows[0].passedQty).toBe(3);
      expect(rows[0].vendorQty).toBe(12); // 15 sent - 3 returned
      expect(rows[0].remarks).toBe('Priority dispatch');
    });
  });

  describe('getPrintableChallanData (SPL DC)', () => {
    it('returns formatted SPL DC print payload with poPartLabel as partNo and particulars', async () => {
      const mockSplDc = {
        id: 'spl-dc-uuid-99',
        challanNumber: 'SDC/2627/0015',
        type: DeliveryChallanType.SPL_PROCESS,
        status: DeliveryChallanStatus.OPEN,
        poNumber: 'PO-SPECIAL-01',
        layoutNumber: 'LAY-SP-01',
        mercIndentNumber: 'IND-SP-01',
        notes: 'SPECIAL COATING REQUIRED',
        createdAt: new Date('2026-11-05T10:00:00Z'),
        vendor: {
          id: 'v-spl',
          name: 'Apex Super Surface Treatments',
          address: 'Plot 77, SIDCO Industrial Estate, Ambattur, Chennai',
          contactPerson: 'Mr. Rajan',
          phone: '9840123456',
        },
        items: [
          {
            id: 'item-1',
            poPartLabel: 'PO-SPECIAL-01 - BASE PLATE 20MM',
            partNumber: 'BP-20',
            description: 'Plasma nitriding required',
            quantityDispatched: 8,
            quantityReturned: 0,
            batchNumber: 'BATCH-SPL-01',
            processName: 'PLASMA NITRIDING',
          },
        ],
      };

      mockChallanRepo.findOne.mockResolvedValue(mockSplDc);

      const printable = (await service.getPrintableChallanData('spl-dc-uuid-99')) as any;

      expect(printable.dcNumber).toBe('SDC/2627/0015');
      expect(printable.dcType).toBe('SPL_PROCESS');
      expect(printable.dcTypeLabel).toBe('SUPPLIER DC');
      expect(printable.poNumber).toBe('PO-SPECIAL-01');
      expect(printable.layoutNumber).toBe('LAY-SP-01');
      expect(printable.mercIndentNumber).toBe('IND-SP-01');
      expect(printable.vendor.name).toBe('Apex Super Surface Treatments');
      expect(printable.vendor.address).toBe('Plot 77, SIDCO Industrial Estate, Ambattur, Chennai');
      expect(printable.companyName).toBe('VELAN METROLOGY INDIA PRIVATE LIMITED');
      expect(printable.companyGstin).toBe('33AAICV7596H1ZR');
      expect(printable.processType).toBe('PLASMA NITRIDING');

      // Key Verification: partNo and particulars formatted with poPartLabel
      expect(printable.items).toHaveLength(1);
      expect(printable.items[0].partNo).toBe('PO-SPECIAL-01 - BASE PLATE 20MM');
      expect(printable.items[0].particulars).toBe('PO-SPECIAL-01 - BASE PLATE 20MM');
      expect(printable.items[0].quantity).toBe(8);
      expect(printable.items[0].unit).toBe('NOS');
      expect(printable.items[0].batchNo).toBe('BATCH-SPL-01');
    });

    it('returns only the rework line item when printing SPL DC in rework mode (same vendor rework)', async () => {
      const mockSplDc = {
        id: 'spl-dc-uuid-99',
        challanNumber: 'SDC/2627/0015',
        type: DeliveryChallanType.SPL_PROCESS,
        status: DeliveryChallanStatus.OPEN,
        poNumber: 'AGIPL PO 1340',
        layoutNumber: '1340',
        mercIndentNumber: 'AGIPL-IND-2026-230',
        notes: 'REWORK DC FOR DEFECTIVE UNITS FROM SDC/2627/0015',
        createdAt: new Date('2026-11-05T10:00:00Z'),
        vendor: {
          id: 'v-spl',
          name: 'ABI ENGINEERINGS',
          address: 'PADI',
        },
        items: [
          {
            id: 'item-1',
            poPartLabel: 'AGIPL PO 1340 - AL 65 X 25',
            partNumber: 'AL 65 X 25',
            quantityDispatched: 1,
            processName: '2121',
          },
          {
            id: 'item-2',
            poPartLabel: 'AGIPL PO 1340 - TAP',
            partNumber: 'TAP',
            quantityDispatched: 112,
            processName: '2121',
          },
        ],
      };

      const mockReworkItem = {
        id: 'rw-item-1',
        sourceDcId: 'spl-dc-uuid-99',
        reworkDcId: 'spl-dc-uuid-99',
        partNumber: 'TAP',
        productName: 'TAP',
        rejectedQty: 1,
        reworkStatus: ReworkItemStatus.RE_DISPATCHED,
        poNumber: 'AGIPL PO 1340',
      };

      mockChallanRepo.findOne.mockResolvedValue(mockSplDc);
      mockReworkRepo.find.mockResolvedValue([mockReworkItem]);

      const printable = (await service.getPrintableChallanData('spl-dc-uuid-99', undefined, 'rework')) as any;

      expect(printable.isRework).toBe(true);
      expect(printable.dcTypeLabel).toBe('SUPPLIER DC (REWORK)');
      expect(printable.items).toHaveLength(1);
      expect(printable.items[0].partNo).toBe('AGIPL PO 1340 - TAP');
      expect(printable.items[0].quantity).toBe(1);
    });
  });
});

