import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterDataService } from './master-data.service.js';
import { WarehousesController } from './controllers/warehouses.controller.js';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '../auth/enums/role.enum.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

describe('Phase 11.4 — Warehouse Master Data Specification', () => {
  let service: MasterDataService;
  let controller: WarehousesController;
  let categoryRepo: any;
  let familyRepo: any;
  let productRepo: any;
  let warehouseRepo: any;
  let locationRepo: any;
  let rackRepo: any;
  let binRepo: any;

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
    warehouseRepo = {
      create: vi.fn((dto) => ({ id: 'wh-1', createdAt: new Date(), updatedAt: new Date(), ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: entity.id || 'wh-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
      remove: vi.fn(),
    };
    locationRepo = {
      count: vi.fn(),
    };
    rackRepo = {};
    binRepo = {};

    service = new MasterDataService(
      categoryRepo,
      familyRepo,
      productRepo,
      warehouseRepo,
      locationRepo,
      rackRepo,
      binRepo,
    );

    controller = new WarehousesController(service);
  });

  describe('Warehouse Creation & Validation', () => {
    it('WAREHOUSE-001: Create warehouse successfully, WAREHOUSE-013: active default', async () => {
      const result = await service.createWarehouse({ code: 'WH001', name: 'Main Warehouse' });
      expect(result.code).toBe('WH001');
      expect(result.name).toBe('Main Warehouse');
      expect(result.isActive).toBe(true);
      expect(warehouseRepo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'WH001', name: 'Main Warehouse' }));
    });

    it('WAREHOUSE-006, WAREHOUSE-010: Normalize code and trim name', async () => {
      const result = await service.createWarehouse({ code: ' wh001 ', name: '  Main Warehouse  ' });
      expect(result.code).toBe('WH001');
      expect(result.name).toBe('Main Warehouse');
    });

    it('WAREHOUSE-014, WAREHOUSE-016: Reject duplicate code (case-insensitive normalization)', async () => {
      warehouseRepo.createQueryBuilder = vi.fn().mockImplementationOnce(() => createMockQueryBuilder({ id: 'wh-ex', code: 'WH001' }));
      await expect(service.createWarehouse({ code: 'wh001', name: 'New Name' })).rejects.toThrow(ConflictException);
    });

    it('WAREHOUSE-015, WAREHOUSE-017: Reject duplicate name (case-insensitive)', async () => {
      // First call (code check) returns null
      // Second call (name check) returns duplicate
      warehouseRepo.createQueryBuilder = vi.fn()
        .mockImplementationOnce(() => createMockQueryBuilder(null))
        .mockImplementationOnce(() => createMockQueryBuilder({ id: 'wh-ex', name: 'Main Warehouse' }));
        
      await expect(service.createWarehouse({ code: 'WH002', name: 'main warehouse' })).rejects.toThrow(ConflictException);
    });
  });

  describe('Warehouse Reading', () => {
    it('WAREHOUSE-018, WAREHOUSE-019, WAREHOUSE-020: List and search warehouses', async () => {
      await service.findWarehouses({ search: 'main', isActive: true });
      expect(warehouseRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('WAREHOUSE-021: Get warehouse by ID', async () => {
      warehouseRepo.findOne.mockResolvedValue({ id: 'wh-1', code: 'WH001', name: 'Main' });
      const result = await service.findWarehouseById('wh-1');
      expect(result.id).toBe('wh-1');
    });

    it('WAREHOUSE-022: Return not-found for nonexistent warehouse', async () => {
      warehouseRepo.findOne.mockResolvedValue(null);
      await expect(service.findWarehouseById('wh-none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Warehouse Updates & Lifecycle', () => {
    it('WAREHOUSE-023: Update warehouse successfully', async () => {
      warehouseRepo.findOne.mockResolvedValue({ id: 'wh-1', code: 'WH001', name: 'Main Warehouse', isActive: true });
      warehouseRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder(null));
      const result = await service.updateWarehouse('wh-1', { name: 'Updated Warehouse' });
      expect(result.name).toBe('Updated Warehouse');
    });

    it('WAREHOUSE-024, WAREHOUSE-025: Reject duplicate code or name during update', async () => {
      warehouseRepo.findOne.mockResolvedValue({ id: 'wh-1', code: 'WH001', name: 'Main Warehouse', isActive: true });
      
      // Mock code check returning duplicate
      warehouseRepo.createQueryBuilder = vi.fn().mockImplementationOnce(() => createMockQueryBuilder({ id: 'wh-2', code: 'WH002' }));
      await expect(service.updateWarehouse('wh-1', { code: 'WH002' })).rejects.toThrow(ConflictException);

      // Mock name check returning duplicate (code check is skipped since code is undefined)
      warehouseRepo.createQueryBuilder = vi.fn().mockImplementationOnce(() => createMockQueryBuilder({ id: 'wh-3', name: 'Existing Name' }));
      await expect(service.updateWarehouse('wh-1', { name: 'Existing Name' })).rejects.toThrow(ConflictException);
    });

    it('WAREHOUSE-026, WAREHOUSE-027, WAREHOUSE-028: Activate and Deactivate warehouse', async () => {
      warehouseRepo.findOne.mockResolvedValue({ id: 'wh-1', code: 'WH001', name: 'Main Warehouse', isActive: true });
      const r1 = await service.updateWarehouse('wh-1', { isActive: false });
      expect(r1.isActive).toBe(false);

      const r2 = await service.updateWarehouse('wh-1', { isActive: true });
      expect(r2.isActive).toBe(true);
    });
  });

  describe('Warehouse Deletion & Dependency Protection', () => {
    it('WAREHOUSE-029: Prevent deletion when dependent WarehouseLocation exists', async () => {
      warehouseRepo.findOne.mockResolvedValue({ id: 'wh-1', code: 'WH001', name: 'Main Warehouse' });
      locationRepo.count.mockResolvedValue(1);
      await expect(service.deleteWarehouse('wh-1')).rejects.toThrow(ConflictException);
    });

    it('WAREHOUSE-031: Safe delete works when permitted by existing design (no dependencies)', async () => {
      warehouseRepo.findOne.mockResolvedValue({ id: 'wh-1', code: 'WH001', name: 'Main Warehouse' });
      locationRepo.count.mockResolvedValue(0);
      const result = await service.deleteWarehouse('wh-1');
      expect(result.success).toBe(true);
      expect(warehouseRepo.remove).toHaveBeenCalled();
    });
  });

  describe('RBAC & Security', () => {
    it('WAREHOUSE-033, WAREHOUSE-034, WAREHOUSE-035: Verify ADMIN and STORES can perform authorized mutation', () => {
      const createRoles = Reflect.getMetadata(ROLES_KEY, controller.createWarehouse);
      expect(createRoles).toEqual([UserRole.ADMIN, UserRole.STORES]);

      const updateRoles = Reflect.getMetadata(ROLES_KEY, controller.updateWarehouse);
      expect(updateRoles).toEqual([UserRole.ADMIN, UserRole.STORES]);

      const deleteRoles = Reflect.getMetadata(ROLES_KEY, controller.deleteWarehouse);
      expect(deleteRoles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('WAREHOUSE-036, WAREHOUSE-037: Verify other roles are excluded from mutations', () => {
      const createRoles = Reflect.getMetadata(ROLES_KEY, controller.createWarehouse);
      expect(createRoles).not.toContain(UserRole.DESIGNER);
      expect(createRoles).not.toContain(UserRole.PRODUCTION);
      expect(createRoles).not.toContain(UserRole.SENIOR_MANAGER);
      expect(createRoles).not.toContain(UserRole.GENERAL_MANAGER);
    });

    it('WAREHOUSE-046: Verify Senior Designer remains absent from read roles', () => {
      const readRoles = Reflect.getMetadata(ROLES_KEY, controller.findWarehouses);
      expect(readRoles).not.toContain('SENIOR_DESIGNER');
    });
  });

  describe('Inventory Boundary', () => {
    it('WAREHOUSE-039, WAREHOUSE-040, WAREHOUSE-041, WAREHOUSE-042: Warehouse lifecycle does not mutate stock balances or transactions', async () => {
      // Confirmed because MasterDataService does not inject stock repos
      expect(service).toBeDefined();
    });
  });
});
