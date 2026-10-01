import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GeneralIssueService } from './general-issue.service.js';
import { GeneralIssue, GeneralIssueStatus } from './entities/general-issue.entity.js';
import { GeneralIssueItem } from './entities/general-issue-item.entity.js';
import { DataSource } from 'typeorm';
import { Product } from '../inventory/entities/product.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';

describe('GeneralIssueService — Phase 17.2 Business Rules Specification', () => {
  let service: GeneralIssueService;
  let mockIssueRepo: any;
  let mockItemRepo: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        findOne: vi.fn(),
        find: vi.fn(),
        query: vi.fn(),
        create: vi.fn((entityClass, data) => ({ ...data, id: 'mock-id' })),
        save: vi.fn(async (entityClass, data) => ({
          ...data,
          id: data.id || 'saved-id',
        })),
      },
    };

    mockIssueRepo = {
      create: vi.fn((data) => ({ ...data, id: 'issue-uuid-1' })),
      save: vi.fn(async (data) => ({ ...data, id: data.id || 'issue-uuid-1' })),
      find: vi.fn(),
      findOne: vi.fn(),
    };

    mockItemRepo = {
      create: vi.fn((data) => ({ ...data, id: 'item-uuid-1' })),
      save: vi.fn(async (data) => ({ ...data, id: data.id || 'item-uuid-1' })),
    };

    mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralIssueService,
        {
          provide: getRepositoryToken(GeneralIssue),
          useValue: mockIssueRepo,
        },
        {
          provide: getRepositoryToken(GeneralIssueItem),
          useValue: mockItemRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<GeneralIssueService>(GeneralIssueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Rule 1: Server-Side Validation — Empty or Duplicate Items', () => {
    it('should throw BadRequestException if items array is empty', async () => {
      await expect(
        service.createIssue(
          {
            reason: 'R&D testing',
            items: [],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if request has duplicate product and bin combinations', async () => {
      await expect(
        service.createIssue(
          {
            reason: 'Duplicate check',
            items: [
              { productId: 'prod-1', binId: 'bin-1', quantityIssued: 2 },
              { productId: 'prod-1', binId: 'bin-1', quantityIssued: 3 },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(/Duplicate item entry/);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Rule 2: SC/PO Optional Validation', () => {
    const validItem = {
      productId: 'prod-1',
      binId: 'bin-1',
      quantityIssued: 5,
    };

    function setupValidProductAndBin() {
      mockQueryRunner.manager.findOne.mockImplementation((entity: any, options: any) => {
        if (entity === Product) {
          return Promise.resolve({ id: options.where.id, name: 'Steel Rod', isActive: true });
        }
        if (entity === Bin) {
          return Promise.resolve({ id: options.where.id, code: 'BIN-A1', isActive: true });
        }
        if (entity === StockBalance) {
          return Promise.resolve({ currentQuantity: 10 });
        }
        return Promise.resolve(null);
      });
      mockQueryRunner.manager.query.mockResolvedValue([[], 1]); // 1 row updated
      mockIssueRepo.findOne.mockResolvedValue({
        id: 'saved-issue-id',
        issueNumber: 'GEN-ISS-100',
        status: GeneralIssueStatus.ISSUED,
      });
    }

    it('should successfully create general issue with neither SC nor PO provided (Pure General Issue)', async () => {
      setupValidProductAndBin();

      const result = await service.createIssue(
        {
          reason: 'Machine maintenance',
          department: 'Maintenance',
          items: [validItem],
        },
        'user-stores-1',
      );

      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockIssueRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scId: null,
          poId: null,
          reason: 'Machine maintenance',
          status: GeneralIssueStatus.ISSUED,
        }),
      );
    });

    it('should throw NotFoundException if specified scId does not exist', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null); // SC not found

      await expect(
        service.createIssue(
          {
            scId: 'non-existent-sc',
            reason: 'Test with bad SC',
            items: [validItem],
          },
          'user-stores-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if specified poId does not exist', async () => {
      mockQueryRunner.manager.findOne.mockImplementation((entity: any, options: any) => {
        if (entity === SalesOrderComponent) {
          return Promise.resolve({ id: 'valid-sc', scNumber: 'SC-101', poId: 'po-101' });
        }
        if (entity === PurchaseOrder) {
          return Promise.resolve(null); // PO not found
        }
        return Promise.resolve(null);
      });

      await expect(
        service.createIssue(
          {
            scId: 'valid-sc',
            poId: 'non-existent-po',
            reason: 'Test with bad PO',
            items: [validItem],
          },
          'user-stores-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if SC does not belong to specified PO', async () => {
      mockQueryRunner.manager.findOne.mockImplementation((entity: any, options: any) => {
        if (entity === SalesOrderComponent) {
          return Promise.resolve({ id: 'sc-1', scNumber: 'SC-01', poId: 'po-original' });
        }
        if (entity === PurchaseOrder) {
          return Promise.resolve({ id: 'po-different', poNumber: 'PO-99' });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.createIssue(
          {
            scId: 'sc-1',
            poId: 'po-different',
            reason: 'Mismatch test',
            items: [validItem],
          },
          'user-stores-1',
        ),
      ).rejects.toThrow(/does not belong to Purchase Order/);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should succeed when valid SC and matching PO are provided', async () => {
      setupValidProductAndBin();
      const originalFindOne = mockQueryRunner.manager.findOne;
      mockQueryRunner.manager.findOne = vi.fn().mockImplementation((entity: any, options: any) => {
        if (entity === SalesOrderComponent) {
          return Promise.resolve({ id: 'sc-1', scNumber: 'SC-01', poId: 'po-1' });
        }
        if (entity === PurchaseOrder) {
          return Promise.resolve({ id: 'po-1', poNumber: 'PO-01' });
        }
        return originalFindOne(entity, options);
      });

      const result = await service.createIssue(
        {
          scId: 'sc-1',
          poId: 'po-1',
          reason: 'Valid SC and PO linked',
          items: [validItem],
        },
        'user-stores-1',
      );

      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Rule 3 & 4: Inventory Quantity Available & No Negative Stock', () => {
    it('should throw NotFoundException if product is missing', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null); // Product not found

      await expect(
        service.createIssue(
          {
            reason: 'Stock check',
            items: [{ productId: 'missing-prod', binId: 'bin-1', quantityIssued: 1 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if product is inactive', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'prod-inactive',
        name: 'Old Steel',
        isActive: false,
      });

      await expect(
        service.createIssue(
          {
            reason: 'Stock check',
            items: [{ productId: 'prod-inactive', binId: 'bin-1', quantityIssued: 1 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(/is inactive/);
    });

    it('should throw NotFoundException if bin is missing', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 'p1', name: 'Product 1', isActive: true }) // Product ok
        .mockResolvedValueOnce(null); // Bin not found

      await expect(
        service.createIssue(
          {
            reason: 'Stock check',
            items: [{ productId: 'p1', binId: 'missing-bin', quantityIssued: 1 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if bin is inactive', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 'p1', name: 'Product 1', isActive: true })
        .mockResolvedValueOnce({ id: 'b1', code: 'BIN-DIS', isActive: false });

      await expect(
        service.createIssue(
          {
            reason: 'Stock check',
            items: [{ productId: 'p1', binId: 'b1', quantityIssued: 1 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(/is inactive/);
    });

    it('should throw BadRequestException if requested quantity exceeds available stock balance', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 'p1', name: 'Product 1', isActive: true })
        .mockResolvedValueOnce({ id: 'b1', code: 'BIN-1', isActive: true })
        .mockResolvedValueOnce({ currentQuantity: 3 }); // Available: 3, Requested: 5

      await expect(
        service.createIssue(
          {
            reason: 'Excess stock check',
            items: [{ productId: 'p1', binId: 'b1', quantityIssued: 5 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(/Insufficient stock/);
    });

    it('should throw BadRequestException if quantity <= 0', async () => {
      await expect(
        service.createIssue(
          {
            reason: 'Zero quantity check',
            items: [{ productId: 'p1', binId: 'b1', quantityIssued: 0 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(/must be greater than zero/);
    });

    it('should throw BadRequestException when atomic stock decrement returns 0 affected rows (Concurrency Protection)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 'p1', name: 'Product 1', isActive: true })
        .mockResolvedValueOnce({ id: 'b1', code: 'BIN-1', isActive: true })
        .mockResolvedValueOnce({ currentQuantity: 10 });

      // Atomic UPDATE returns 0 rows updated
      mockQueryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      await expect(
        service.createIssue(
          {
            reason: 'Concurrency race check',
            items: [{ productId: 'p1', binId: 'b1', quantityIssued: 5 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(/Insufficient stock in bin "BIN-1"\. Concurrency conflict/);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Rule 5 & 6: Atomic Deduction & Transaction Ledger Creation', () => {
    it('should atomically deduct stock and write immutable STOCK_OUT transaction to ledger', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 'p1', name: 'Alloy Bar', isActive: true })
        .mockResolvedValueOnce({ id: 'b1', code: 'BIN-01', isActive: true })
        .mockResolvedValueOnce({ currentQuantity: 20 });

      // Atomic update succeeds
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([[], 1]) // stock deduction update
        .mockResolvedValueOnce([[], 1]); // last_transaction_id update

      mockIssueRepo.findOne.mockResolvedValue({
        id: 'issue-100',
        issueNumber: 'GEN-ISS-100',
        status: GeneralIssueStatus.ISSUED,
      });

      await service.createIssue(
        {
          reason: 'Prototyping lab',
          items: [{ productId: 'p1', binId: 'b1', quantityIssued: 4.5 }],
        },
        'stores-operator',
      );

      // Verify atomic SQL deduction executed
      expect(mockQueryRunner.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE stock_balances'),
        [4.5, 'b1', 'p1'],
      );

      // Verify StockTransaction ledger creation
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({
          transactionType: TransactionType.STOCK_OUT,
          productId: 'p1',
          sourceBinId: 'b1',
          quantity: 4.5,
          referenceType: 'GENERAL_ISSUE',
          createdById: 'stores-operator',
        }),
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Rule 9: Direct Approval — Status is ISSUED immediately', () => {
    it('should set status to ISSUED upon creation without requiring approval', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 'p1', name: 'Product 1', isActive: true })
        .mockResolvedValueOnce({ id: 'b1', code: 'BIN-1', isActive: true })
        .mockResolvedValueOnce({ currentQuantity: 10 });
      mockQueryRunner.manager.query.mockResolvedValue([[], 1]);
      mockIssueRepo.findOne.mockResolvedValue({
        id: 'issue-direct',
        status: GeneralIssueStatus.ISSUED,
      });

      await service.createIssue(
        {
          reason: 'Immediate requirement',
          items: [{ productId: 'p1', binId: 'b1', quantityIssued: 2 }],
        },
        'stores-user',
      );

      expect(mockIssueRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GeneralIssueStatus.ISSUED,
        }),
      );
    });
  });

  describe('Rule 10 & 11: Reversal & How Cancelled Transactions Affect Stock', () => {
    it('should throw NotFoundException when cancelling non-existent issue', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.cancelIssue('missing-id', 'stores-user', 'Mistake'),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if issue is already cancelled', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'iss-1',
        issueNumber: 'GEN-ISS-01',
        status: GeneralIssueStatus.CANCELLED,
        items: [],
      });

      await expect(
        service.cancelIssue('iss-1', 'stores-user', 'Repeat cancel'),
      ).rejects.toThrow(/is already cancelled/);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should refund stock to original bin and create RETURN ledger entry on cancellation', async () => {
      const mockIssue = {
        id: 'iss-active',
        issueNumber: 'GEN-ISS-999',
        status: GeneralIssueStatus.ISSUED,
        remarks: 'Original remark',
        items: [
          { productId: 'p1', binId: 'b1', quantityIssued: 6 },
        ],
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockIssue);
      mockQueryRunner.manager.find.mockResolvedValueOnce(mockIssue.items);
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([[], 1]) // refund update
        .mockResolvedValueOnce([[], 1]); // last_transaction_id update

      mockIssueRepo.findOne.mockResolvedValue({
        ...mockIssue,
        status: GeneralIssueStatus.CANCELLED,
      });

      const cancelled = await service.cancelIssue(
        'iss-active',
        'admin-user',
        'Customer cancelled project',
      );

      // Verify status flipped to CANCELLED
      expect(mockIssue.status).toBe(GeneralIssueStatus.CANCELLED);
      expect(mockIssue.remarks).toContain('Customer cancelled project');

      // Verify stock refund query executed
      expect(mockQueryRunner.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('current_quantity = current_quantity + $1'),
        [6, 'b1', 'p1'],
      );

      // Verify RETURN transaction entry in ledger
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({
          transactionType: TransactionType.RETURN,
          productId: 'p1',
          destinationBinId: 'b1',
          quantity: 6,
          referenceType: 'GENERAL_ISSUE_CANCEL',
          createdById: 'admin-user',
        }),
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
