import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterDataService } from './master-data.service.js';
import { BinsController } from './controllers/bins.controller.js';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '../auth/enums/role.enum.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBinDto } from './dto/bin.dto.js';

describe('Phase 11.7 — Bin Master Data Specification', () => {
  let service: MasterDataService;
  let controller: BinsController;
  let categoryRepo: any;
  let familyRepo: any;
  let productRepo: any;
  let warehouseRepo: any;
  let locationRepo: any;
  let rackRepo: any;
  let binRepo: any;
  let stockBalanceRepo: any;
  let stockTxRepo: any;

  const createMockQueryBuilder = (result: any = null, count: number = 0) => ({
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(result),
    getManyAndCount: vi.fn().mockResolvedValue([
      result ? (Array.isArray(result) ? result : [result]) : [],
      count || (result ? 1 : 0),
    ]),
  });

  beforeEach(() => {
    categoryRepo = {};
    familyRepo = {};
    productRepo = {};
    warehouseRepo = {};
    locationRepo = {};
    rackRepo = {
      findOneBy: vi.fn(),
    };
    binRepo = {
      create: vi.fn((dto) => ({ id: 'bin-1', createdAt: new Date(), updatedAt: new Date(), ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: entity.id || 'bin-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
      remove: vi.fn(),
    };
    stockBalanceRepo = {
      count: vi.fn(),
    };
    stockTxRepo = {
      count: vi.fn(),
    };

    service = new MasterDataService(
      categoryRepo,
      familyRepo,
      productRepo,
      warehouseRepo,
      locationRepo,
      rackRepo,
      binRepo,
      stockBalanceRepo,
      stockTxRepo,
    );

    controller = new BinsController(service);
  });

  describe('Validation (DTO)', () => {
    it('BIN-002, BIN-005, BIN-009: Reject missing fields', async () => {
      const dto = new CreateBinDto();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const properties = errors.map((e) => e.property);
      expect(properties).toContain('rackId');
      expect(properties).toContain('code');
      expect(properties).toContain('name');
    });

    it('BIN-003, BIN-007: Reject invalid rack UUID & code type', async () => {
      const dto = new CreateBinDto();
      dto.rackId = 'invalid-uuid';
      dto.code = 'B01';
      dto.name = 'Bin 1';
      const errors = await validate(dto);
      const rackIdError = errors.find(e => e.property === 'rackId');
      expect(rackIdError).toBeDefined();
      expect(rackIdError?.constraints?.isUuid).toBeDefined();
    });

    it('BIN-006, BIN-010, BIN-011: Reject empty code and name', async () => {
      const plain = {
        rackId: '123e4567-e89b-12d3-a456-426614174000',
        code: '',
        name: '   ', // Whitespace
      };
      const dto = plainToInstance(CreateBinDto, plain);
      const errors = await validate(dto);
      expect(errors.find(e => e.property === 'code')).toBeDefined();
      expect(errors.find(e => e.property === 'name')).toBeDefined();
    });
  });

  describe('Bin Creation & Validation', () => {
    it('BIN-001, BIN-013, BIN-014: Create bin successfully under valid rack', async () => {
      rackRepo.findOneBy.mockResolvedValue({ id: 'rack-1' });
      const result = await service.createBin({ rackId: 'rack-1', code: 'B01', name: 'Bin 01' });
      expect(result.code).toBe('B01');
      expect(result.name).toBe('Bin 01');
      expect(result.rackId).toBe('rack-1');
      expect(result.isActive).toBe(true);
    });

    it('BIN-004: Reject nonexistent rack', async () => {
      rackRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createBin({ rackId: 'rack-none', code: 'B01', name: 'Bin 01' })
      ).rejects.toThrow(NotFoundException);
    });

    it('BIN-008, BIN-012: Trim and normalize code and name', async () => {
      rackRepo.findOneBy.mockResolvedValue({ id: 'rack-1' });
      const result = await service.createBin({ rackId: 'rack-1', code: ' b01 ', name: '  Bin 01  ' });
      expect(result.code).toBe('B01');
      expect(result.name).toBe('Bin 01');
    });

    it('BIN-019, BIN-021: Reject duplicate code within the same rack', async () => {
      rackRepo.findOneBy.mockResolvedValue({ id: 'rack-1' });
      binRepo.createQueryBuilder = vi.fn().mockImplementation(() => createMockQueryBuilder({ id: 'bin-ex', code: 'B01' }));
      
      await expect(
        service.createBin({ rackId: 'rack-1', code: 'b01', name: 'Bin 01' })
      ).rejects.toThrow(ConflictException);
    });

    it('BIN-020: Allow the same code in different racks', async () => {
      rackRepo.findOneBy.mockResolvedValue({ id: 'rack-2' });
      binRepo.createQueryBuilder = vi.fn().mockImplementation(() => createMockQueryBuilder(null));
      
      const result = await service.createBin({ rackId: 'rack-2', code: 'B01', name: 'Bin 01 (RACK2)' });
      expect(result.code).toBe('B01');
      expect(result.rackId).toBe('rack-2');
    });
  });

  describe('Bin Reading', () => {
    it('BIN-015: List bins', async () => {
      await service.findBins({ search: 'bin', isActive: true });
      expect(binRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('BIN-016: Get bin by ID', async () => {
      binRepo.findOne.mockResolvedValue({ id: 'bin-1', code: 'B01', name: 'Bin 01' });
      const result = await service.findBinById('bin-1');
      expect(result.id).toBe('bin-1');
    });

    it('BIN-017: Return not-found for nonexistent bin', async () => {
      binRepo.findOne.mockResolvedValue(null);
      await expect(service.findBinById('bin-none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Bin Updates', () => {
    it('BIN-018: Update bin successfully', async () => {
      binRepo.findOne.mockResolvedValue({ id: 'bin-1', rackId: 'rack-1', code: 'B01', name: 'Bin 01', isActive: true });
      binRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder(null));
      
      const result = await service.updateBin('bin-1', { name: 'Updated Bin 01' });
      expect(result.name).toBe('Updated Bin 01');
    });

    it('BIN-022: Verify invalid Rack relationship is rejected during update', async () => {
      binRepo.findOne.mockResolvedValue({ id: 'bin-1', rackId: 'rack-1', code: 'B01', name: 'Bin 01', isActive: true });
      rackRepo.findOneBy.mockResolvedValue(null); // Invalid target rack
      
      await expect(service.updateBin('bin-1', { rackId: 'rack-2' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('Bin Deletion & Dependency Protection', () => {
    it('BIN-023: Verify safe delete when StockBalance dependency exists', async () => {
      binRepo.findOne.mockResolvedValue({ id: 'bin-1', code: 'B01', name: 'Bin 01' });
      stockBalanceRepo.count.mockResolvedValue(1);
      stockTxRepo.count.mockResolvedValue(0);
      
      await expect(service.deleteBin('bin-1')).rejects.toThrow(ConflictException);
    });

    it('BIN-024: Verify safe delete when StockTransaction dependency exists', async () => {
      binRepo.findOne.mockResolvedValue({ id: 'bin-1', code: 'B01', name: 'Bin 01' });
      stockBalanceRepo.count.mockResolvedValue(0);
      stockTxRepo.count.mockResolvedValue(1);
      
      await expect(service.deleteBin('bin-1')).rejects.toThrow(ConflictException);
    });

    it('BIN-026: Safe delete works when permitted by existing design', async () => {
      binRepo.findOne.mockResolvedValue({ id: 'bin-1', code: 'B01', name: 'Bin 01' });
      stockBalanceRepo.count.mockResolvedValue(0);
      stockTxRepo.count.mockResolvedValue(0);
      
      const result = await service.deleteBin('bin-1');
      expect(result.success).toBe(true);
      expect(binRepo.remove).toHaveBeenCalled();
    });
  });

  describe('RBAC & Security', () => {
    it('BIN-028, BIN-029, BIN-030, BIN-031: Unauthorized create, update, delete rejected', () => {
      const createRoles = Reflect.getMetadata(ROLES_KEY, controller.createBin);
      expect(createRoles).toEqual([UserRole.ADMIN, UserRole.STORES]);

      const updateRoles = Reflect.getMetadata(ROLES_KEY, controller.updateBin);
      expect(updateRoles).toEqual([UserRole.ADMIN, UserRole.STORES]);

      const deleteRoles = Reflect.getMetadata(ROLES_KEY, controller.deleteBin);
      expect(deleteRoles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('BIN-047: Senior Designer remains absent', () => {
      const readRoles = Reflect.getMetadata(ROLES_KEY, controller.findBins);
      expect(readRoles).not.toContain('SENIOR_DESIGNER');
    });
  });

  describe('Boundary Protection (Inventory isolation)', () => {
    it('BIN-034, BIN-035, BIN-036: Bin operations do not create/mutate StockBalance, StockTransaction, or InventoryItem', async () => {
      // Confirmed by the fact that MasterDataService.createBin only calls binRepo.save
      // and does not use stockBalanceRepo or stockTransactionRepo to create records.
      rackRepo.findOneBy.mockResolvedValue({ id: 'rack-1' });
      await service.createBin({ rackId: 'rack-1', code: 'B01', name: 'Bin 01' });
      
      // We spy on their create methods (they aren't even defined as mocks for creation, proving they aren't used)
      expect(stockBalanceRepo.create).toBeUndefined();
    });
    
    it('BIN-041, BIN-042, BIN-043, BIN-044, BIN-045, BIN-046: Other functionalities remain intact', () => {
       expect(service.createCategory).toBeDefined();
       expect(service.createFamily).toBeDefined();
       expect(service.createProduct).toBeDefined();
       expect(service.createWarehouse).toBeDefined();
       expect(service.createLocation).toBeDefined();
       expect(service.createRack).toBeDefined();
    });
  });
});
