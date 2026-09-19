import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterDataService } from './master-data.service.js';
import { FamiliesController } from './controllers/families.controller.js';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '../auth/enums/role.enum.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

describe('Phase 11.2 — Product Family Master Data Specification', () => {
  let service: MasterDataService;
  let controller: FamiliesController;
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
    getManyAndCount: vi.fn().mockResolvedValue([result ? (Array.isArray(result) ? result : [result]) : [], count || (result ? 1 : 0)]),
  });

  beforeEach(() => {
    categoryRepo = {
      findOneBy: vi.fn(),
      findOne: vi.fn(),
    };

    familyRepo = {
      create: vi.fn((dto) => ({ id: 'fam-1', createdAt: new Date(), updatedAt: new Date(), ...dto })),
      save: vi.fn((entity) => Promise.resolve({ id: entity.id || 'fam-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      remove: vi.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
      count: vi.fn().mockResolvedValue(0),
    };

    productRepo = {
      count: vi.fn().mockResolvedValue(0),
    };
    warehouseRepo = {};
    locationRepo = {};
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

    controller = new FamiliesController(service);
  });

  // =========================================================================
  // 1. CREATE FAMILY & VALIDATION & DUPLICATE PREVENTION
  // =========================================================================
  describe('1. Family Creation & Duplicate Prevention', () => {
    it('FAMILY-001: should create a family with trimmed name and default isActive=true', async () => {
      categoryRepo.findOneBy.mockResolvedValue({ id: 'cat-1', name: 'Raw Material' });
      const dto = { categoryId: 'cat-1', name: '   Special Steel   ' };
      const result = await service.createFamily(dto);

      expect(familyRepo.create).toHaveBeenCalledWith({
        categoryId: 'cat-1',
        name: 'Special Steel',
        isActive: true,
      });
      expect(result.name).toBe('Special Steel');
      expect(result.isActive).toBe(true);
    });

    it('FAMILY-010: should reject nonexistent category', async () => {
      categoryRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createFamily({ categoryId: 'cat-non', name: 'Steel' })).rejects.toThrow(NotFoundException);
    });

    it('FAMILY-013: should reject duplicate family within same category', async () => {
      categoryRepo.findOneBy.mockResolvedValue({ id: 'cat-1', name: 'Raw Material' });
      familyRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder({ id: 'fam-existing', name: 'Steel' }));

      await expect(service.createFamily({ categoryId: 'cat-1', name: 'STEEL' })).rejects.toThrow(ConflictException);
    });

    it('FAMILY-012: should allow same family name under different categories', async () => {
      categoryRepo.findOneBy.mockResolvedValue({ id: 'cat-2', name: 'Another Category' });
      familyRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder(null));

      const result = await service.createFamily({ categoryId: 'cat-2', name: 'Steel' });
      expect(result.name).toBe('Steel');
    });
  });

  // =========================================================================
  // 2. READ & FILTER FAMILIES
  // =========================================================================
  describe('2. Family Queries & Filtering', () => {
    it('FAMILY-015: should list families with pagination', async () => {
      const mockFamilies = [{ id: 'fam-1', name: 'Steel', isActive: true }];
      familyRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder(mockFamilies, 1));

      const result = await service.findFamilies({ page: 1, pageSize: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('FAMILY-017, FAMILY-018: should filter families by category and active state', async () => {
      const qb = createMockQueryBuilder([], 0);
      familyRepo.createQueryBuilder = vi.fn(() => qb);

      await service.findFamilies({ parentId: 'cat-1', isActive: false, search: 'steel' });

      expect(qb.andWhere).toHaveBeenCalledWith('f.categoryId = :parentId', { parentId: 'cat-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('f.isActive = :isActive', { isActive: false });
      expect(qb.andWhere).toHaveBeenCalledWith('f.name ILIKE :search', { search: '%steel%' });
    });

    it('FAMILY-019: should find family by ID', async () => {
      const mockFamily = { id: 'fam-1', name: 'Steel', isActive: true };
      familyRepo.findOne.mockResolvedValue(mockFamily);

      const result = await service.findFamilyById('fam-1');
      expect(result).toEqual(mockFamily);
    });

    it('FAMILY-020: should throw NotFoundException for nonexistent family', async () => {
      familyRepo.findOne.mockResolvedValue(null);
      await expect(service.findFamilyById('fam-non')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 3. UPDATE FAMILY & ACTIVATION / DEACTIVATION
  // =========================================================================
  describe('3. Family Updates & Lifecycle', () => {
    it('FAMILY-021: should update family name and active state', async () => {
      familyRepo.findOne.mockResolvedValue({ id: 'fam-1', categoryId: 'cat-1', name: 'Steel', isActive: true });
      familyRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder(null));

      const result = await service.updateFamily('fam-1', { name: '  Stainless Steel  ', isActive: false });
      expect(result.name).toBe('Stainless Steel');
      expect(result.isActive).toBe(false);
    });

    it('FAMILY-023: should validate new category during update', async () => {
      familyRepo.findOne.mockResolvedValue({ id: 'fam-1', categoryId: 'cat-1', name: 'Steel', isActive: true });
      categoryRepo.findOneBy.mockResolvedValue(null);

      await expect(service.updateFamily('fam-1', { categoryId: 'cat-new' })).rejects.toThrow(NotFoundException);
    });

    it('FAMILY-022: should reject duplicate family name during update', async () => {
      familyRepo.findOne.mockResolvedValue({ id: 'fam-1', categoryId: 'cat-1', name: 'Steel', isActive: true });
      familyRepo.createQueryBuilder = vi.fn(() => createMockQueryBuilder({ id: 'fam-2', name: 'Iron' }));

      await expect(service.updateFamily('fam-1', { name: 'Iron' })).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // 4. SAFE DELETION
  // =========================================================================
  describe('4. Family Safe Deletion Protection', () => {
    it('FAMILY-028: should allow safe deletion when no products exist', async () => {
      const family = { id: 'fam-1', name: 'Temporary Family', isActive: true };
      familyRepo.findOne.mockResolvedValue(family);
      productRepo.count.mockResolvedValue(0);

      const result = await service.deleteFamily('fam-1');

      expect(productRepo.count).toHaveBeenCalledWith({ where: { familyId: 'fam-1' } });
      expect(familyRepo.remove).toHaveBeenCalledWith(family);
      expect(result.success).toBe(true);
    });

    it('FAMILY-027: should prevent deletion when dependent products exist', async () => {
      const family = { id: 'fam-1', name: 'Steel', isActive: true };
      familyRepo.findOne.mockResolvedValue(family);
      productRepo.count.mockResolvedValue(5);

      await expect(service.deleteFamily('fam-1')).rejects.toThrow(ConflictException);
      expect(familyRepo.remove).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. CONTROLLER RBAC
  // =========================================================================
  describe('5. RBAC & Security Baseline', () => {
    it('FAMILY-030: should enforce ADMIN and STORES on create endpoint', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.createFamily);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('FAMILY-031: should enforce ADMIN and STORES on update endpoint', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.updateFamily);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('FAMILY-033: should enforce ADMIN and STORES on delete endpoint', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.deleteFamily);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('FAMILY-041: Senior Designer remains absent from read roles', () => {
      const getRoles = Reflect.getMetadata(ROLES_KEY, controller.findFamilies);
      expect(getRoles).not.toContain('SENIOR_DESIGNER');
    });
  });
});
