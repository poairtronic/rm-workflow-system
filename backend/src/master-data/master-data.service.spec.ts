import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterDataService } from './master-data.service.js';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let categoryRepo: any;
  let familyRepo: any;
  let productRepo: any;
  let warehouseRepo: any;
  let locationRepo: any;
  let rackRepo: any;
  let binRepo: any;

  const createMockQueryBuilder = (result: any = null) => ({
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(result),
    getManyAndCount: vi.fn().mockResolvedValue([result ? [result] : [], result ? 1 : 0]),
  });

  beforeEach(() => {
    categoryRepo = {
      create: vi.fn((dto) => ({ id: 'cat-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'cat-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    familyRepo = {
      create: vi.fn((dto) => ({ id: 'fam-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'fam-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    productRepo = {
      create: vi.fn((dto) => ({ id: 'prod-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'prod-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    warehouseRepo = {
      create: vi.fn((dto) => ({ id: 'wh-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'wh-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    locationRepo = {
      create: vi.fn((dto) => ({ id: 'loc-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'loc-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    rackRepo = {
      create: vi.fn((dto) => ({ id: 'rack-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'rack-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    binRepo = {
      create: vi.fn((dto) => ({ id: 'bin-1', ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: 'bin-1', ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    service = new MasterDataService(
      categoryRepo,
      familyRepo,
      productRepo,
      warehouseRepo,
      locationRepo,
      rackRepo,
      binRepo,
    );
  });

  // ==========================================
  // 1. CATEGORY TESTS
  // ==========================================
  describe('Product Categories', () => {
    it('1. should create a valid category', async () => {
      const res = await service.createCategory({ name: '  Raw Metal  ' });
      expect(categoryRepo.create).toHaveBeenCalledWith({ name: 'Raw Metal', isActive: true });
      expect(res.name).toBe('Raw Metal');
    });

    it('2. should reject duplicate category name', async () => {
      categoryRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder({ id: 'cat-1', name: 'Raw Metal' }));
      await expect(service.createCategory({ name: 'Raw Metal' })).rejects.toThrow(ConflictException);
    });

    it('3. should update category name and active state', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 'cat-1', name: 'Raw Metal', isActive: true });
      const res = await service.updateCategory('cat-1', { name: 'Alloys', isActive: false });
      expect(res.name).toBe('Alloys');
      expect(res.isActive).toBe(false);
    });
  });

  // ==========================================
  // 2. FAMILY TESTS
  // ==========================================
  describe('Product Families', () => {
    it('4. should create a valid family', async () => {
      categoryRepo.findOneBy.mockResolvedValue({ id: 'cat-1', name: 'Raw Metal' });
      const res = await service.createFamily({ categoryId: 'cat-1', name: 'Steel Rods' });
      expect(res.name).toBe('Steel Rods');
    });

    it('5. should reject family creation if category does not exist', async () => {
      categoryRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createFamily({ categoryId: 'cat-invalid', name: 'Steel Rods' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('6. should reject duplicate family name within same category', async () => {
      categoryRepo.findOneBy.mockResolvedValue({ id: 'cat-1', name: 'Raw Metal' });
      familyRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder({ id: 'fam-1', name: 'Steel Rods' }));
      await expect(service.createFamily({ categoryId: 'cat-1', name: 'Steel Rods' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==========================================
  // 3. PRODUCT TESTS
  // ==========================================
  describe('Products', () => {
    it('7. should create a product without creating stock balances', async () => {
      familyRepo.findOneBy.mockResolvedValue({ id: 'fam-1', name: 'Steel Rods' });
      const res = await service.createProduct({
        familyId: 'fam-1',
        name: 'OHNS 25 Dia Rod',
        minimumInventory: 10,
        maximumInventory: 100,
      });

      expect(res.name).toBe('OHNS 25 Dia Rod');
      expect(res.minimumInventory).toBe(10);
      expect(res.maximumInventory).toBe(100);
    });

    it('8. should reject product creation if family does not exist', async () => {
      familyRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createProduct({ familyId: 'fam-invalid', name: 'OHNS Rod' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('9. should reject product if maximumInventory < minimumInventory', async () => {
      familyRepo.findOneBy.mockResolvedValue({ id: 'fam-1' });
      await expect(
        service.createProduct({
          familyId: 'fam-1',
          name: 'Invalid Product',
          minimumInventory: 50,
          maximumInventory: 20,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // 4. WAREHOUSE TESTS
  // ==========================================
  describe('Warehouses', () => {
    it('10. should create warehouse with normalized uppercase code', async () => {
      const res = await service.createWarehouse({ code: '  wh-01  ', name: 'Main Yard' });
      expect(res.code).toBe('WH-01');
      expect(res.name).toBe('Main Yard');
    });

    it('11. should reject duplicate warehouse code', async () => {
      warehouseRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder({ id: 'wh-1', code: 'WH-01' }));
      await expect(service.createWarehouse({ code: 'WH-01', name: 'Yard 2' })).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================
  // 5. LOCATION TESTS
  // ==========================================
  describe('Warehouse Locations', () => {
    it('12. should create location under warehouse', async () => {
      warehouseRepo.findOneBy.mockResolvedValue({ id: 'wh-1', code: 'WH-01' });
      const res = await service.createLocation({ warehouseId: 'wh-1', code: 'loc-a', name: 'Bay A' });
      expect(res.code).toBe('LOC-A');
    });

    it('13. should reject location if warehouse does not exist', async () => {
      warehouseRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createLocation({ warehouseId: 'wh-invalid', code: 'LOC-A', name: 'Bay A' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // 6. RACK TESTS
  // ==========================================
  describe('Racks', () => {
    it('14. should create rack under location', async () => {
      locationRepo.findOneBy.mockResolvedValue({ id: 'loc-1', code: 'LOC-A' });
      const res = await service.createRack({ locationId: 'loc-1', code: 'rack-01', name: 'Heavy Rack 1' });
      expect(res.code).toBe('RACK-01');
    });
  });

  // ==========================================
  // 7. BIN TESTS
  // ==========================================
  describe('Bins', () => {
    it('15. should create bin under rack', async () => {
      rackRepo.findOneBy.mockResolvedValue({ id: 'rack-1', code: 'RACK-01' });
      const res = await service.createBin({ rackId: 'rack-1', code: 'bin-a1', name: 'Slot A-1' });
      expect(res.code).toBe('BIN-A1');
    });
  });
});
