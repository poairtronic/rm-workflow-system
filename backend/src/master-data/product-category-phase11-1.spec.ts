import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterDataService } from './master-data.service.js';
import { CategoriesController } from './controllers/categories.controller.js';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '../auth/enums/role.enum.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

describe('Phase 11.1 — Product Category Master Data Specification', () => {
  let service: MasterDataService;
  let controller: CategoriesController;
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
    getManyAndCount: vi
      .fn()
      .mockResolvedValue([
        result ? (Array.isArray(result) ? result : [result]) : [],
        count || (result ? 1 : 0),
      ]),
  });

  beforeEach(() => {
    categoryRepo = {
      create: vi.fn((dto) => ({
        id: 'cat-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dto,
      })),
      save: vi.fn((entity) =>
        Promise.resolve({
          id: entity.id || 'cat-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...entity,
        }),
      ),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      remove: vi.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    familyRepo = {
      count: vi.fn().mockResolvedValue(0),
      findOneBy: vi.fn(),
      createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
    };

    productRepo = {};
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

    controller = new CategoriesController(service);
  });

  // =========================================================================
  // 1. CREATE CATEGORY & VALIDATION & DUPLICATE PREVENTION
  // =========================================================================
  describe('1. Category Creation & Duplicate Prevention', () => {
    it('CAT-001: should create a category with trimmed name and default isActive=true', async () => {
      const dto = { name: '   Stainless Steel   ' };
      const result = await service.createCategory(dto);

      expect(categoryRepo.create).toHaveBeenCalledWith({
        name: 'Stainless Steel',
        isActive: true,
      });
      expect(result.name).toBe('Stainless Steel');
      expect(result.isActive).toBe(true);
    });

    it('CAT-002: should create a category with explicit isActive=false', async () => {
      const dto = { name: 'Obsolete Material', isActive: false };
      const result = await service.createCategory(dto);

      expect(categoryRepo.create).toHaveBeenCalledWith({
        name: 'Obsolete Material',
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });

    it('CAT-003: should reject creation if category name is empty or whitespace only', async () => {
      await expect(service.createCategory({ name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory({ name: '' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('CAT-004: should reject duplicate category name (case-insensitive)', async () => {
      categoryRepo.createQueryBuilder = vi.fn(() =>
        createMockQueryBuilder({ id: 'cat-existing', name: 'Raw Metals' }),
      );

      await expect(
        service.createCategory({ name: 'raw metals' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createCategory({ name: 'RAW METALS' }),
      ).rejects.toThrow('Category with name "RAW METALS" already exists.');
    });
  });

  // =========================================================================
  // 2. READ & FILTER CATEGORIES
  // =========================================================================
  describe('2. Category Queries & Filtering', () => {
    it('CAT-005: should find categories with pagination and ordering', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Alloys', isActive: true },
        { id: 'cat-2', name: 'Plastics', isActive: true },
      ];
      categoryRepo.createQueryBuilder = vi.fn(() =>
        createMockQueryBuilder(mockCategories, 2),
      );

      const result = await service.findCategories({ page: 1, pageSize: 10 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('CAT-006: should filter categories by search keyword and isActive flag', async () => {
      const qb = createMockQueryBuilder(
        [{ id: 'cat-1', name: 'Alloys', isActive: true }],
        1,
      );
      categoryRepo.createQueryBuilder = vi.fn(() => qb);

      await service.findCategories({
        search: 'all',
        isActive: true,
        page: 2,
        pageSize: 5,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('c.name ILIKE :search', {
        search: '%all%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('c.isActive = :isActive', {
        isActive: true,
      });
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('CAT-007: should find category by ID with families relation', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Metals',
        isActive: true,
        families: [{ id: 'fam-1', name: 'Steel' }],
      };
      categoryRepo.findOne.mockResolvedValue(mockCategory);

      const result = await service.findCategoryById('cat-1');
      expect(result).toEqual(mockCategory);
      expect(categoryRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        relations: { families: true },
      });
    });

    it('CAT-008: should throw NotFoundException when category ID is not found', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findCategoryById('cat-non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 3. UPDATE CATEGORY & ACTIVATION / DEACTIVATION
  // =========================================================================
  describe('3. Category Updates & Activation/Deactivation', () => {
    it('CAT-009: should update category name and active state', async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Metals',
        isActive: true,
      });

      const result = await service.updateCategory('cat-1', {
        name: '   Special Metals   ',
        isActive: false,
      });

      expect(result.name).toBe('Special Metals');
      expect(result.isActive).toBe(false);
      expect(categoryRepo.save).toHaveBeenCalled();
    });

    it('CAT-010: should reject update if new name is empty/blank', async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Metals',
        isActive: true,
      });

      await expect(
        service.updateCategory('cat-1', { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('CAT-011: should reject update if new name conflicts with another category', async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Metals',
        isActive: true,
      });
      categoryRepo.createQueryBuilder = vi.fn(() =>
        createMockQueryBuilder({ id: 'cat-2', name: 'Plastics' }),
      );

      await expect(
        service.updateCategory('cat-1', { name: 'Plastics' }),
      ).rejects.toThrow(ConflictException);
    });

    it('CAT-012: should allow category to update without changing its own name', async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Metals',
        isActive: true,
      });
      categoryRepo.createQueryBuilder = vi.fn(
        () => createMockQueryBuilder(null), // no other category has this name
      );

      const result = await service.updateCategory('cat-1', {
        name: 'Metals',
        isActive: false,
      });
      expect(result.name).toBe('Metals');
      expect(result.isActive).toBe(false);
    });

    it('CAT-013: should throw NotFoundException when updating non-existent category', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCategory('cat-non-existent', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 4. SAFE DELETION & TRACEABILITY PROTECTION
  // =========================================================================
  describe('4. Category Safe Deletion Protection', () => {
    it('CAT-014: should safely delete category when no product families are attached', async () => {
      const category = {
        id: 'cat-1',
        name: 'Temporary Category',
        isActive: true,
      };
      categoryRepo.findOne.mockResolvedValue(category);
      familyRepo.count.mockResolvedValue(0);

      const result = await service.deleteCategory('cat-1');

      expect(familyRepo.count).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
      });
      expect(categoryRepo.remove).toHaveBeenCalledWith(category);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('CAT-015: should reject category deletion when associated product families exist', async () => {
      const category = { id: 'cat-1', name: 'Raw Metals', isActive: true };
      categoryRepo.findOne.mockResolvedValue(category);
      familyRepo.count.mockResolvedValue(3);

      await expect(service.deleteCategory('cat-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.deleteCategory('cat-1')).rejects.toThrow(
        'Cannot delete category "Raw Metals" because it contains 3 product families. Deactivate it instead.',
      );
      expect(categoryRepo.remove).not.toHaveBeenCalled();
    });

    it('CAT-016: should throw NotFoundException when deleting non-existent category', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteCategory('cat-non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // 5. CONTROLLER & RBAC AUTHORIZATION METADATA
  // =========================================================================
  describe('5. RBAC & Security Baseline', () => {
    it('SEC-001: should enforce ADMIN and STORES roles on createCategory endpoint', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.createCategory);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('SEC-002: should enforce ADMIN and STORES roles on updateCategory endpoint', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.updateCategory);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('SEC-003: should enforce ADMIN and STORES roles on deleteCategory endpoint', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.deleteCategory);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.STORES]);
    });

    it('SEC-004: should allow all authenticated operational roles on read endpoints', () => {
      const getRoles = Reflect.getMetadata(
        ROLES_KEY,
        controller.findCategories,
      );
      const getByIdRoles = Reflect.getMetadata(
        ROLES_KEY,
        controller.findCategoryById,
      );

      const expectedRoles = [
        UserRole.ADMIN,
        UserRole.DESIGNER,
        UserRole.STORES,
        UserRole.PRODUCTION,
        UserRole.SENIOR_MANAGER,
        UserRole.GENERAL_MANAGER,
      ];

      expect(getRoles).toEqual(expectedRoles);
      expect(getByIdRoles).toEqual(expectedRoles);
      // Ensure SENIOR_DESIGNER is NOT in any role list
      expect(getRoles).not.toContain('SENIOR_DESIGNER');
      expect(getByIdRoles).not.toContain('SENIOR_DESIGNER');
    });

    it('SEC-005: controller delegates endpoints properly to service', async () => {
      const spyFindAll = vi
        .spyOn(service, 'findCategories')
        .mockResolvedValue({
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        });
      const spyFindById = vi
        .spyOn(service, 'findCategoryById')
        .mockResolvedValue({
          id: 'cat-1',
          name: 'Steel',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const spyCreate = vi
        .spyOn(service, 'createCategory')
        .mockResolvedValue({
          id: 'cat-1',
          name: 'Steel',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const spyUpdate = vi
        .spyOn(service, 'updateCategory')
        .mockResolvedValue({
          id: 'cat-1',
          name: 'Steel Updated',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const spyDelete = vi
        .spyOn(service, 'deleteCategory')
        .mockResolvedValue({ success: true, message: 'Deleted' });

      await controller.findCategories({ page: 1 });
      expect(spyFindAll).toHaveBeenCalledWith({ page: 1 });

      await controller.findCategoryById('cat-1');
      expect(spyFindById).toHaveBeenCalledWith('cat-1');

      await controller.createCategory({ name: 'Steel' });
      expect(spyCreate).toHaveBeenCalledWith({ name: 'Steel' });

      await controller.updateCategory('cat-1', { name: 'Steel Updated' });
      expect(spyUpdate).toHaveBeenCalledWith('cat-1', {
        name: 'Steel Updated',
      });

      await controller.deleteCategory('cat-1');
      expect(spyDelete).toHaveBeenCalledWith('cat-1');
    });
  });
});
