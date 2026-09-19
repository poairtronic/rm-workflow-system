import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';
import { InventoryService } from './inventory.service.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from './entities/stock-transaction.entity.js';
import { Product } from './entities/product.entity.js';
import { Bin } from './entities/bin.entity.js';

describe('InventoryReconciliationService & InventoryService - Phase 10.6 Verification', () => {
  let reconciliationService: InventoryReconciliationService;
  let inventoryService: InventoryService;

  let manager: any;
  let queryRunner: any;
  let dataSource: any;

  beforeEach(async () => {
    manager = {
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      query: vi.fn(),
      save: vi.fn(),
    };
    queryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager,
    };
    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryReconciliationService,
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: {} },
        {
          provide: getRepositoryToken(StockBalance),
          useValue: { create: vi.fn() },
        },
        {
          provide: getRepositoryToken(StockTransaction),
          useValue: { create: vi.fn() },
        },
        { provide: getRepositoryToken(Product), useValue: {} },
        { provide: getRepositoryToken(Bin), useValue: {} },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    reconciliationService = module.get<InventoryReconciliationService>(
      InventoryReconciliationService,
    );
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  describe('Certification Tests', () => {
    it('VERIFY-001: Product + Bin is authoritative and StockBalance is not duplicated', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // item
        .mockResolvedValueOnce({ id: 'prod-1' }) // product
        .mockResolvedValueOnce({ id: 'bin-1' }) // bin
        .mockResolvedValueOnce({ id: 'sb-1', currentQuantity: 5 }) // legacy balance
        .mockResolvedValueOnce({ id: 'sb-2', currentQuantity: 5 }); // target balance

      const result = await reconciliationService.manualMapAndReconcile(
        'item-1',
        'prod-1',
        'bin-1',
      );
      expect(result.status).toBe('RECONCILED');
      // Proves we delete legacy and merge identity instead of keeping two stock authorities
      expect(manager.delete).toHaveBeenCalledWith(StockBalance, { id: 'sb-1' });
      expect(manager.update).toHaveBeenCalledWith(
        StockBalance,
        { id: 'sb-2' },
        expect.any(Object),
      );
    });

    it('VERIFY-002: InventoryItem remains preserved', async () => {
      // The reconciliation logic does not delete InventoryItem (no manager.delete(InventoryItem))
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ id: 'prod-1' })
        .mockResolvedValueOnce({ id: 'bin-1' })
        .mockResolvedValueOnce({ id: 'sb-1', currentQuantity: 5 })
        .mockResolvedValueOnce(null);

      await reconciliationService.manualMapAndReconcile(
        'item-1',
        'prod-1',
        'bin-1',
      );
      expect(manager.delete).not.toHaveBeenCalled(); // nothing deleted
    });

    it('VERIFY-009: Quantity conflict is not silently overwritten', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ id: 'prod-1' })
        .mockResolvedValueOnce({ id: 'bin-1' })
        .mockResolvedValueOnce({ id: 'sb-1', currentQuantity: 10 }) // legacy
        .mockResolvedValueOnce({ id: 'sb-2', currentQuantity: 15 }); // target

      const result = await reconciliationService.manualMapAndReconcile(
        'item-1',
        'prod-1',
        'bin-1',
      );
      expect(result.status).toBe('QUANTITY_CONFLICT');
      expect(manager.update).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('VERIFY-011: Opening balance is not double-counted (idempotent overwrite)', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ id: 'prod-1' })
        .mockResolvedValueOnce({ id: 'bin-1' })
        .mockResolvedValueOnce({
          id: 'sb-1',
          currentQuantity: 5,
          openingBalance: 10,
        })
        .mockResolvedValueOnce(null);

      await reconciliationService.manualMapAndReconcile(
        'item-1',
        'prod-1',
        'bin-1',
      );

      // Inherits existing balance if not specified
      expect(manager.update).toHaveBeenCalledWith(
        StockBalance,
        { id: 'sb-1' },
        expect.objectContaining({ openingBalance: 10 }),
      );
    });

    it('VERIFY-013: Historical transactions remain immutable', async () => {
      // The reconciliation service does not touch StockTransaction.
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ id: 'prod-1' })
        .mockResolvedValueOnce({ id: 'bin-1' })
        .mockResolvedValueOnce({
          id: 'sb-1',
          currentQuantity: 5,
          openingBalance: 10,
        })
        .mockResolvedValueOnce(null);

      await reconciliationService.manualMapAndReconcile(
        'item-1',
        'prod-1',
        'bin-1',
      );
      expect(
        manager.update.mock.calls.some((call) => call[0] === StockTransaction),
      ).toBe(false);
    });

    it('VERIFY-015: Actual reconciliation is idempotent', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ id: 'prod-1' })
        .mockResolvedValueOnce({ id: 'bin-1' })
        .mockResolvedValueOnce({
          id: 'sb-1',
          currentQuantity: 5,
          openingBalance: 10,
        })
        .mockResolvedValueOnce({
          id: 'sb-1',
          currentQuantity: 5,
          openingBalance: 10,
        });

      const res = await reconciliationService.manualMapAndReconcile(
        'item-1',
        'prod-1',
        'bin-1',
      );
      // Should hit Case A because IDs match (meaning it is already reconciled to this row)
      expect(res.status).toBe('RECONCILED');
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('VERIFY-016: Rollback works on constraint failure', async () => {
      manager.findOne.mockRejectedValue(new Error('Constraint failure'));
      await expect(
        reconciliationService.manualMapAndReconcile(
          'item-1',
          'prod-1',
          'bin-1',
        ),
      ).rejects.toThrow();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('VERIFY-018: Stock IN propagates Product + Bin correctly', async () => {
      // Using mock for InventoryService.stockIn
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // item
        .mockResolvedValueOnce({ productId: 'prod-1', binId: 'bin-1' }) // current balance
        .mockResolvedValueOnce({ currentQuantity: 10 }); // final balance

      manager.query.mockResolvedValue([[], 1]); // fake update result

      const mockTxRepo = (inventoryService as any).stockTransactionRepository;
      mockTxRepo.create.mockReturnValue({ id: 'tx-1' });
      manager.save.mockResolvedValue({ id: 'tx-1' });

      await inventoryService.stockIn(
        'item-1',
        { quantity: 5, referenceType: 'PO', referenceId: '123' },
        'user-1',
      );

      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          destinationBinId: 'bin-1',
          transactionType: TransactionType.STOCK_IN,
        }),
      );
    });

    it('VERIFY-019: Stock OUT propagates Product + Bin correctly', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ productId: 'prod-1', binId: 'bin-1' })
        .mockResolvedValueOnce({ currentQuantity: 5 });

      manager.query.mockResolvedValue([[], 1]); // fake update result row count = 1

      const mockTxRepo = (inventoryService as any).stockTransactionRepository;
      mockTxRepo.create.mockReturnValue({ id: 'tx-2' });
      manager.save.mockResolvedValue({ id: 'tx-2' });

      await inventoryService.stockOut(
        'item-1',
        { quantity: 5, referenceType: 'SC', referenceId: '123' },
        'user-1',
      );

      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          sourceBinId: 'bin-1',
          transactionType: TransactionType.STOCK_OUT,
        }),
      );
    });
  });
});
