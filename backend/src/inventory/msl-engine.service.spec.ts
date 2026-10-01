import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { MslEngineService } from './msl-engine.service.js';
import { Product } from './entities/product.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { MslAlert, MslAlertStatus } from './entities/msl-alert.entity.js';

describe('MslEngineService', () => {
  let service: MslEngineService;
  let mockProductRepo: any;
  let mockStockBalanceRepo: any;
  let mockMslAlertRepo: any;

  beforeEach(async () => {
    mockProductRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
    };
    mockStockBalanceRepo = {
      find: vi.fn(),
    };
    mockMslAlertRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MslEngineService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepo,
        },
        {
          provide: getRepositoryToken(StockBalance),
          useValue: mockStockBalanceRepo,
        },
        {
          provide: getRepositoryToken(MslAlert),
          useValue: mockMslAlertRepo,
        },
      ],
    }).compile();

    service = module.get<MslEngineService>(MslEngineService);
  });

  it('should trigger alert if stock is below minimum inventory and no active alert exists', async () => {
    mockProductRepo.findOne.mockResolvedValue({ id: 'p1', isActive: true, minimumInventory: 50, name: 'Prod1' });
    mockStockBalanceRepo.find.mockResolvedValue([{ currentQuantity: 20 }, { currentQuantity: 10 }]);
    mockMslAlertRepo.findOne.mockResolvedValue(null);

    const createdAlert = { productId: 'p1', triggerQuantity: 30, minimumInventory: 50, status: MslAlertStatus.ACTIVE };
    mockMslAlertRepo.create.mockReturnValue(createdAlert);

    await service.evaluateMslForProduct('p1');

    expect(mockMslAlertRepo.create).toHaveBeenCalledWith({
      productId: 'p1',
      triggerQuantity: 30,
      minimumInventory: 50,
      status: MslAlertStatus.ACTIVE,
    });
    expect(mockMslAlertRepo.save).toHaveBeenCalledWith(createdAlert);
  });

  it('should resolve alert if stock is above minimum inventory and active alert exists', async () => {
    mockProductRepo.findOne.mockResolvedValue({ id: 'p1', isActive: true, minimumInventory: 50, name: 'Prod1' });
    mockStockBalanceRepo.find.mockResolvedValue([{ currentQuantity: 40 }, { currentQuantity: 20 }]);
    
    const existingAlert = { productId: 'p1', status: MslAlertStatus.ACTIVE, resolvedAt: null };
    mockMslAlertRepo.findOne.mockResolvedValue(existingAlert);

    await service.evaluateMslForProduct('p1');

    expect(existingAlert.status).toBe(MslAlertStatus.RESOLVED);
    expect(existingAlert.resolvedAt).toBeInstanceOf(Date);
    expect(mockMslAlertRepo.save).toHaveBeenCalledWith(existingAlert);
  });
});
