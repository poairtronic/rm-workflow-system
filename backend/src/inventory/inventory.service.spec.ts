import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from './entities/stock-transaction.entity.js';
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
});
