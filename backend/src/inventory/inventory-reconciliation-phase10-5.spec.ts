import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { Product } from './entities/product.entity.js';
import { Bin } from './entities/bin.entity.js';
import { NotFoundException } from '@nestjs/common';

describe('InventoryReconciliationService - Phase 10.5 Opening Balance', () => {
  let service: InventoryReconciliationService;
  let inventoryItemRepo: any;
  let stockBalanceRepo: any;
  let productRepo: any;
  let binRepo: any;
  let dataSource: any;
  let manager: any;

  beforeEach(async () => {
    inventoryItemRepo = {
      find: vi.fn(),
    };
    stockBalanceRepo = {
      findOne: vi.fn(),
    };
    productRepo = {
      findOne: vi.fn(),
    };
    binRepo = {
      findOne: vi.fn(),
    };
    manager = {
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const queryRunner = {
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
        { provide: getRepositoryToken(InventoryItem), useValue: inventoryItemRepo },
        { provide: getRepositoryToken(StockBalance), useValue: stockBalanceRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Bin), useValue: binRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<InventoryReconciliationService>(InventoryReconciliationService);
  });

  describe('manualMapAndReconcile', () => {
    it('OPENING-001: Legacy quantity is represented exactly once (CASE A)', async () => {
      // Mocks
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve({ id: 'prod-1' });
        if (entity === Bin) return Promise.resolve({ id: 'bin-1' });
        if (entity === StockBalance) {
          // first call is for legacy balance
          if (manager.findOne.mock.calls.length === 4) {
            return Promise.resolve({ id: 'sb-legacy', currentQuantity: 10, openingBalance: null });
          }
          // second call is for existing target balance (does not exist)
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const result = await service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1', 10);
      
      expect(result.status).toBe('RECONCILED');
      expect(manager.update).toHaveBeenCalledWith(StockBalance, { id: 'sb-legacy' }, {
        productId: 'prod-1',
        binId: 'bin-1',
        openingBalance: 10
      });
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('OPENING-002: Existing target StockBalance with matching quantity merges (CASE B)', async () => {
      let callCount = 0;
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve({ id: 'prod-1' });
        if (entity === Bin) return Promise.resolve({ id: 'bin-1' });
        if (entity === StockBalance) {
          callCount++;
          if (callCount === 1) return Promise.resolve({ id: 'sb-legacy', currentQuantity: 15, openingBalance: null });
          if (callCount === 2) return Promise.resolve({ id: 'sb-target', currentQuantity: 15, openingBalance: 15 });
        }
        return Promise.resolve(null);
      });

      const result = await service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1', 15);
      
      expect(result.status).toBe('RECONCILED');
      expect(manager.update).toHaveBeenCalledWith(StockBalance, { id: 'sb-target' }, {
        inventoryItemId: 'legacy-1',
        openingBalance: 15
      });
      expect(manager.delete).toHaveBeenCalledWith(StockBalance, { id: 'sb-legacy' });
    });

    it('OPENING-003: Existing target StockBalance with mismatched quantity becomes a conflict (CASE C)', async () => {
      let callCount = 0;
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve({ id: 'prod-1' });
        if (entity === Bin) return Promise.resolve({ id: 'bin-1' });
        if (entity === StockBalance) {
          callCount++;
          if (callCount === 1) return Promise.resolve({ id: 'sb-legacy', currentQuantity: 10 });
          if (callCount === 2) return Promise.resolve({ id: 'sb-target', currentQuantity: 20 });
        }
        return Promise.resolve(null);
      });

      const result = await service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1');
      
      expect(result.status).toBe('QUANTITY_CONFLICT');
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('OPENING-004: Missing Product rejects mapping', async () => {
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve(null); // Missing product
        return Promise.resolve(null);
      });

      await expect(service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1'))
        .rejects.toThrow('Target Product not found');
    });

    it('OPENING-005: Missing Bin rejects mapping', async () => {
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve({ id: 'prod-1' });
        if (entity === Bin) return Promise.resolve(null); // Missing bin
        return Promise.resolve(null);
      });

      await expect(service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1'))
        .rejects.toThrow('Target Bin not found');
    });

    it('OPENING-010: Opening balance is not overwritten incorrectly if not specified', async () => {
      let callCount = 0;
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve({ id: 'prod-1' });
        if (entity === Bin) return Promise.resolve({ id: 'bin-1' });
        if (entity === StockBalance) {
          callCount++;
          if (callCount === 1) return Promise.resolve({ id: 'sb-legacy', currentQuantity: 10, openingBalance: 5 });
          if (callCount === 2) return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const result = await service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1');
      
      expect(result.status).toBe('RECONCILED');
      expect(manager.update).toHaveBeenCalledWith(StockBalance, { id: 'sb-legacy' }, {
        productId: 'prod-1',
        binId: 'bin-1',
        openingBalance: 5
      });
    });

    it('OPENING-013: Actual reconciliation is transactional', async () => {
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === InventoryItem) return Promise.resolve({ id: 'legacy-1' });
        if (entity === Product) return Promise.resolve({ id: 'prod-1' });
        if (entity === Bin) return Promise.resolve({ id: 'bin-1' });
        if (entity === StockBalance) {
          return Promise.resolve({ id: 'sb-legacy' }); // First call
        }
        return Promise.resolve(null);
      });

      await service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1');
      expect(dataSource.createQueryRunner().startTransaction).toHaveBeenCalled();
      expect(dataSource.createQueryRunner().commitTransaction).toHaveBeenCalled();
    });

    it('OPENING-014: Rollback occurs on failure', async () => {
      manager.findOne.mockRejectedValue(new Error('DB Error'));

      await expect(service.manualMapAndReconcile('legacy-1', 'prod-1', 'bin-1'))
        .rejects.toThrow('DB Error');
      expect(dataSource.createQueryRunner().startTransaction).toHaveBeenCalled();
      expect(dataSource.createQueryRunner().rollbackTransaction).toHaveBeenCalled();
    });
  });
});
