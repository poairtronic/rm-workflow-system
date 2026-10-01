import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { VendorService } from '../src/vendor/vendor.service.js';
import { VendorController } from '../src/vendor/vendor.controller.js';
import { CreateVendorDto } from '../src/vendor/dto/create-vendor.dto.js';
import { UpdateVendorDto } from '../src/vendor/dto/update-vendor.dto.js';
import { GetVendorFilterDto } from '../src/vendor/dto/get-vendor-filter.dto.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.3 — Vendor Master Test Suite', () => {
  // =========================================================================
  // 1. DTO VALIDATION & SCHEMA BOUNDARIES
  // =========================================================================
  describe('1. DTO Validation & Schema Boundaries', () => {
    it('VEND-DTO-001: should pass validation with all valid inputs', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: 'VEND-001',
        name: 'Apex Heat Treatment Ltd.',
        category: 'HEAT_TREATMENT',
        contactPerson: 'John Doe',
        email: 'john.doe@apexht.com',
        phone: '+91 9876543210',
        address: 'Plot 45, Industrial Area, Sector 58',
        isActive: true,
        notes: 'Preferred vendor for vacuum hardening',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('VEND-DTO-002: should fail when code is missing or empty', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: '',
        name: 'Apex Heat Treatment Ltd.',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('VEND-DTO-003: should fail when code exceeds 50 characters', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: 'V'.repeat(51),
        name: 'Apex Heat Treatment Ltd.',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('VEND-DTO-004: should fail when name is missing or empty', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: 'VEND-001',
        name: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('VEND-DTO-005: should fail when name exceeds 150 characters', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: 'VEND-001',
        name: 'A'.repeat(151),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('VEND-DTO-006: should fail when email format is invalid', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: 'VEND-001',
        name: 'Apex Heat Treatment Ltd.',
        email: 'not-an-email',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('VEND-DTO-007: should pass with valid email and optional fields omitted', async () => {
      const dto = plainToInstance(CreateVendorDto, {
        code: 'VEND-002',
        name: 'Precision Grinding Co.',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('VEND-DTO-008: UpdateVendorDto allows partial updates', async () => {
      const dto = plainToInstance(UpdateVendorDto, {
        name: 'Apex Thermal Solutions Ltd.',
        notes: 'Name changed after corporate merger',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('VEND-DTO-009: GetVendorFilterDto parses boolean string transformation', async () => {
      const dto = plainToInstance(GetVendorFilterDto, {
        isActive: 'true',
        category: 'HEAT_TREATMENT',
        search: 'Apex',
      });
      expect(dto.isActive).toBe(true);
      expect(dto.category).toBe('HEAT_TREATMENT');
      expect(dto.search).toBe('Apex');
    });
  });

  // =========================================================================
  // 2. SERVICE LAYER & BUSINESS RULES
  // =========================================================================
  describe('2. Service Layer & Business Rules', () => {
    let service: VendorService;
    let repo: Repository<Vendor>;

    const mockVendor: Vendor = {
      id: 'uuid-vend-1',
      code: 'VEND-001',
      name: 'Apex Heat Treatment Ltd.',
      category: 'HEAT_TREATMENT',
      contactPerson: 'John Doe',
      email: 'john.doe@apexht.com',
      phone: '+91 9876543210',
      address: 'Plot 45, Ind Area',
      isActive: true,
      notes: 'Initial notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      repo = {
        create: vi.fn().mockImplementation((val) => ({ id: 'uuid-new', ...val })),
        save: vi.fn().mockImplementation((val) => Promise.resolve({ id: val.id || 'uuid-new', ...val })),
        findOne: vi.fn(),
        createQueryBuilder: vi.fn(),
      } as unknown as Repository<Vendor>;

      service = new VendorService(repo);
    });

    it('VEND-SVC-001: should create a new vendor with trimmed code and name', async () => {
      vi.spyOn(repo, 'findOne').mockResolvedValue(null);

      const dto: CreateVendorDto = {
        code: '  VEND-001  ',
        name: '  Apex Heat Treatment Ltd.  ',
        category: ' HEAT_TREATMENT ',
      };

      const result = await service.create(dto);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VEND-001',
          name: 'Apex Heat Treatment Ltd.',
          category: 'HEAT_TREATMENT',
          isActive: true,
        }),
      );
      expect(result).toHaveProperty('id');
    });

    it('VEND-SVC-002: should throw ConflictException if vendor code already exists', async () => {
      vi.spyOn(repo, 'findOne').mockResolvedValue(mockVendor);

      const dto: CreateVendorDto = {
        code: 'VEND-001',
        name: 'Duplicate Vendor',
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('VEND-SVC-003: should find single vendor by ID', async () => {
      vi.spyOn(repo, 'findOne').mockResolvedValue(mockVendor);

      const result = await service.findOne('uuid-vend-1');
      expect(result.id).toBe('uuid-vend-1');
      expect(result.code).toBe('VEND-001');
    });

    it('VEND-SVC-004: should throw NotFoundException if vendor ID is not found', async () => {
      vi.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('uuid-nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('VEND-SVC-005: should find vendor by code (case-insensitive)', async () => {
      vi.spyOn(repo, 'findOne').mockResolvedValue(mockVendor);

      const result = await service.findByCode('vend-001');
      expect(result).toBeDefined();
      expect(result?.code).toBe('VEND-001');
    });

    it('VEND-SVC-006: should find all vendors applying search, category, and active filters', async () => {
      const qbMock = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockVendor]),
      };
      vi.spyOn(repo, 'createQueryBuilder').mockReturnValue(qbMock as any);

      const filter: GetVendorFilterDto = {
        isActive: true,
        category: 'HEAT_TREATMENT',
        search: 'Apex',
      };

      const results = await service.findAll(filter);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('vendor');
      expect(qbMock.andWhere).toHaveBeenCalledTimes(3);
      expect(qbMock.orderBy).toHaveBeenCalledWith('vendor.name', 'ASC');
      expect(results.length).toBe(1);
    });

    it('VEND-SVC-007: should update vendor fields and validate code uniqueness', async () => {
      vi.spyOn(repo, 'findOne')
        .mockResolvedValueOnce(mockVendor) // findOne(id)
        .mockResolvedValueOnce(null); // uniqueness check for new code

      const updateDto: UpdateVendorDto = {
        code: 'VEND-001-MOD',
        name: 'Apex Solutions',
        phone: '+91 9999999999',
      };

      const result = await service.update('uuid-vend-1', updateDto);
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe('Apex Solutions');
    });

    it('VEND-SVC-008: should throw ConflictException if updated code belongs to another vendor', async () => {
      vi.spyOn(repo, 'findOne')
        .mockResolvedValueOnce(mockVendor) // findOne(id)
        .mockResolvedValueOnce({ ...mockVendor, id: 'other-uuid', code: 'VEND-002' }); // code conflict

      const updateDto: UpdateVendorDto = {
        code: 'VEND-002',
      };

      await expect(service.update('uuid-vend-1', updateDto)).rejects.toThrow(ConflictException);
    });

    it('VEND-SVC-009: should toggle vendor active status', async () => {
      const vendorActive = { ...mockVendor, isActive: true };
      vi.spyOn(repo, 'findOne').mockResolvedValue(vendorActive);

      const result = await service.toggleActive('uuid-vend-1');
      expect(result.isActive).toBe(false);
    });

    it('VEND-SVC-010: should soft-deactivate vendor via remove()', async () => {
      const vendorActive = { ...mockVendor, isActive: true };
      vi.spyOn(repo, 'findOne').mockResolvedValue(vendorActive);

      const result = await service.remove('uuid-vend-1');
      expect(vendorActive.isActive).toBe(false);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deactivated');
    });
  });

  // =========================================================================
  // 3. CONTROLLER LAYER & DELEGATION
  // =========================================================================
  describe('3. Controller Layer & Delegation', () => {
    let controller: VendorController;
    let service: VendorService;

    const sampleVendor = {
      id: 'uuid-1',
      code: 'VEND-01',
      name: 'Test Vendor',
      isActive: true,
    } as Vendor;

    beforeEach(() => {
      service = {
        create: vi.fn().mockResolvedValue(sampleVendor),
        findAll: vi.fn().mockResolvedValue([sampleVendor]),
        findOne: vi.fn().mockResolvedValue(sampleVendor),
        update: vi.fn().mockResolvedValue({ ...sampleVendor, name: 'Updated' }),
        toggleActive: vi.fn().mockResolvedValue({ ...sampleVendor, isActive: false }),
        remove: vi.fn().mockResolvedValue({ success: true, message: 'Deactivated' }),
      } as unknown as VendorService;

      controller = new VendorController(service);
    });

    it('VEND-CTRL-001: create() delegates to service.create()', async () => {
      const dto: CreateVendorDto = { code: 'VEND-01', name: 'Test Vendor' };
      const res = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(res).toEqual(sampleVendor);
    });

    it('VEND-CTRL-002: findAll() delegates to service.findAll()', async () => {
      const filter: GetVendorFilterDto = { isActive: true };
      const res = await controller.findAll(filter);
      expect(service.findAll).toHaveBeenCalledWith(filter);
      expect(res).toEqual([sampleVendor]);
    });

    it('VEND-CTRL-003: findOne() delegates to service.findOne()', async () => {
      const res = await controller.findOne('uuid-1');
      expect(service.findOne).toHaveBeenCalledWith('uuid-1');
      expect(res).toEqual(sampleVendor);
    });

    it('VEND-CTRL-004: update() delegates to service.update()', async () => {
      const dto: UpdateVendorDto = { name: 'Updated' };
      const res = await controller.update('uuid-1', dto);
      expect(service.update).toHaveBeenCalledWith('uuid-1', dto);
      expect(res.name).toBe('Updated');
    });

    it('VEND-CTRL-005: toggleActive() delegates to service.toggleActive()', async () => {
      const res = await controller.toggleActive('uuid-1');
      expect(service.toggleActive).toHaveBeenCalledWith('uuid-1');
      expect(res.isActive).toBe(false);
    });

    it('VEND-CTRL-006: remove() delegates to service.remove()', async () => {
      const res = await controller.remove('uuid-1');
      expect(service.remove).toHaveBeenCalledWith('uuid-1');
      expect(res.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. SECURITY & RBAC METADATA VERIFICATION
  // =========================================================================
  describe('4. Security & RBAC Metadata Verification', () => {
    const reflector = new Reflector();

    it('VEND-SEC-001: Controller is protected with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', VendorController);
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);
    });

    it('VEND-SEC-002: POST /api/vendors is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.create);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
      expect(roles).not.toContain(UserRole.DESIGNER);
    });

    it('VEND-SEC-003: PATCH /api/vendors/:id is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.update);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });

    it('VEND-SEC-004: PATCH /api/vendors/:id/toggle-active is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.toggleActive);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });

    it('VEND-SEC-005: DELETE /api/vendors/:id is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.remove);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });
  });
});

