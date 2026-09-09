import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction, TransactionType, AdjustmentDirection } from './entities/stock-transaction.entity.js';
import { DataSource } from 'typeorm';

describe('InventoryService', () => {
  let service: InventoryService;
  let dataSource: any;
  let inventoryItemRepository: any;

  beforeEach(async () => {
    // Mock QueryRunner
    const queryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        findOne: vi.fn(),
        save: vi.fn(),
        query: vi.fn(),
        createQueryBuilder: vi.fn(() => ({
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn(),
        })),
      },
    };

    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(StockBalance),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(StockTransaction),
          useValue: {
            find: vi.fn(),
            create: vi.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    inventoryItemRepository = module.get(getRepositoryToken(InventoryItem));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException on duplicate item (code 23505)', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.save.mockRejectedValueOnce({ code: '23505' });
      
      inventoryItemRepository.create.mockReturnValue({});

      await expect(service.create({
        material: 'TEST',
        materialType: 'TEST',
        grade: 'TEST',
        size: 'TEST',
        unit: 'KG',
      })).rejects.toThrow(ConflictException);

      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw ConflictException on duplicate item (code 23505)', async () => {
      inventoryItemRepository.findOne.mockResolvedValueOnce({ id: '123' });
      inventoryItemRepository.save.mockRejectedValueOnce({ code: '23505' });

      await expect(service.update('123', {
        material: 'TEST',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('addStockTransaction', () => {
    it('should generate an atomic increment query for STOCK_IN', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValueOnce({ id: 'item-1' }); // Item exists
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); // Transaction saved

      await service.addStockTransaction('item-1', {
        transactionType: TransactionType.STOCK_IN,
        quantity: 100,
        referenceType: 'MANUAL',
      }, 'user-1');

      expect(qr.startTransaction).toHaveBeenCalled();
      
      // Should execute atomic update with '+'
      expect(qr.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('current_quantity = current_quantity + $1'),
        [100, 'tx-1', 'item-1']
      );

      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should generate an atomic decrement query for STOCK_OUT', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValueOnce({ id: 'item-1' }); // Item exists
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); // Transaction saved

      await service.addStockTransaction('item-1', {
        transactionType: TransactionType.STOCK_OUT,
        quantity: 50,
        referenceType: 'MANUAL',
      }, 'user-1');

      // Should execute atomic update with '-'
      expect(qr.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('current_quantity = current_quantity - $1'),
        [50, 'tx-1', 'item-1']
      );
    });
  });

  describe('stockIn', () => {
    it('should successfully execute a Stock In transaction atomically', async () => {
      const qr = dataSource.createQueryRunner();
      
      // Mocks for successful flow
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 0 }) // Balance check
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 25.5 }); // Final fetch after update
      
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); // Transaction saved
      
      const result = await service.stockIn('item-1', {
        quantity: 25.5,
        referenceType: 'PO',
      }, 'user-1');

      expect(qr.startTransaction).toHaveBeenCalled();
      
      // Should execute atomic update with '+'
      expect(qr.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('current_quantity = current_quantity + $1'),
        [25.5, 'tx-1', 'item-1']
      );

      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.balance.currentQuantity).toBe(25.5);
    });

    it('should rollback if the balance update fails', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 0 }) // Balance check
        .mockResolvedValueOnce(null); // Simulate final fetch failing (update failed)
      
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); // Transaction saved
      
      await expect(service.stockIn('item-1', {
        quantity: 10,
        referenceType: 'PO',
      }, 'user-1')).rejects.toThrow();

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('stockOut', () => {
    it('should successfully execute a Stock Out transaction atomically', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 }) // Current balance
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 75 }); // Final balance
      
      qr.manager.query
        .mockResolvedValueOnce([[], 1]) // atomic decrement returns 1 affected row
        .mockResolvedValueOnce([[], 1]); // last_transaction_id update
        
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); // Transaction saved
      
      const result = await service.stockOut('item-1', {
        quantity: 25,
        referenceType: 'MANUAL',
      }, 'user-1');

      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.manager.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('current_quantity = current_quantity - $1'),
        [25, 'item-1']
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.balance!.currentQuantity).toBe(75);
    });

    it('should allow exact full-stock withdrawal', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 }) // Current balance
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 0 }); // Final balance
      
      qr.manager.query
        .mockResolvedValueOnce([[], 1]) // 1 row updated
        .mockResolvedValueOnce([[], 1]); 
        
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); 
      
      const result = await service.stockOut('item-1', {
        quantity: 100,
        referenceType: 'MANUAL',
      }, 'user-1');

      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.balance!.currentQuantity).toBe(0);
    });

    it('should throw BadRequestException if affected rows is 0 (insufficient stock)', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 }); // Current balance
      
      qr.manager.query.mockResolvedValueOnce([[], 0]); // 0 rows updated
      
      await expect(service.stockOut('item-1', {
        quantity: 101,
        referenceType: 'MANUAL',
      }, 'user-1')).rejects.toThrow('Insufficient stock.');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.manager.save).not.toHaveBeenCalled(); // No transaction created
    });

    it('should throw exception if balance record does not exist', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce(null); // No balance record
      
      await expect(service.stockOut('item-1', {
        quantity: 10,
        referenceType: 'MANUAL',
      }, 'user-1')).rejects.toThrow('Insufficient stock (no balance record found).');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.manager.query).not.toHaveBeenCalled();
    });

    it('should rollback if transaction insertion fails', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) 
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 }); 
      
      qr.manager.query.mockResolvedValueOnce([[], 1]); // decrement succeeds
      qr.manager.save.mockRejectedValueOnce(new Error('DB Error')); // save fails
      
      await expect(service.stockOut('item-1', {
        quantity: 10,
        referenceType: 'MANUAL',
      }, 'user-1')).rejects.toThrow('DB Error');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('stockAdjustment', () => {
    it('should successfully execute a Stock Adjustment INCREASE atomically', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) 
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 }) 
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 125 }); 
      
      qr.manager.query
        .mockResolvedValueOnce([[], 1]) 
        .mockResolvedValueOnce([[], 1]); 
        
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); 
      
      const result = await service.stockAdjustment('item-1', {
        quantity: 25,
        direction: AdjustmentDirection.INCREASE,
        referenceType: 'MANUAL',
        remarks: 'Found extra',
      }, 'user-1');

      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.manager.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('current_quantity = current_quantity + $1'),
        [25, 'item-1']
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.balance!.currentQuantity).toBe(125);
    });

    it('should successfully execute a Stock Adjustment DECREASE atomically', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) 
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 }) 
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 75 }); 
      
      qr.manager.query
        .mockResolvedValueOnce([[], 1]) 
        .mockResolvedValueOnce([[], 1]); 
        
      qr.manager.save.mockResolvedValueOnce({ id: 'tx-1' }); 
      
      const result = await service.stockAdjustment('item-1', {
        quantity: 25,
        direction: AdjustmentDirection.DECREASE,
        referenceType: 'MANUAL',
        remarks: 'Lost items',
      }, 'user-1');

      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.manager.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('current_quantity = current_quantity - $1'),
        [25, 'item-1']
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.balance!.currentQuantity).toBe(75);
    });

    it('should throw exception if DECREASE affects 0 rows (insufficient stock)', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) 
        .mockResolvedValueOnce({ id: 'bal-1', inventoryItemId: 'item-1', currentQuantity: 100 });
      
      qr.manager.query.mockResolvedValueOnce([[], 0]); // 0 rows affected
        
      await expect(service.stockAdjustment('item-1', {
        quantity: 101,
        direction: AdjustmentDirection.DECREASE,
        referenceType: 'MANUAL',
        remarks: 'Missing items',
      }, 'user-1')).rejects.toThrow('Insufficient stock for adjustment decrease.');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.manager.save).not.toHaveBeenCalled();
    });

    it('should throw exception if balance record does not exist', async () => {
      const qr = dataSource.createQueryRunner();
      
      qr.manager.findOne
        .mockResolvedValueOnce({ id: 'item-1' }) // Item exists
        .mockResolvedValueOnce(null); // No balance record
      
      await expect(service.stockAdjustment('item-1', {
        quantity: 10,
        direction: AdjustmentDirection.INCREASE,
        referenceType: 'MANUAL',
        remarks: 'Missing items',
      }, 'user-1')).rejects.toThrow('Insufficient stock (no balance record found).');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.manager.query).not.toHaveBeenCalled();
    });
  });
});
