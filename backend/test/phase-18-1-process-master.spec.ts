import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { ProductionProcessService } from '../src/production-process/production-process.service.js';
import { ProductionProcessController } from '../src/production-process/production-process.controller.js';
import { CreateProductionProcessDto } from '../src/production-process/dto/create-production-process.dto.js';
import { UpdateProductionProcessDto } from '../src/production-process/dto/update-production-process.dto.js';
import { GetProductionProcessFilterDto } from '../src/production-process/dto/get-production-process-filter.dto.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.1 — Production Process Master Test Suite', () => {
  describe('1. DTO Validation & Schema Boundaries', () => {
    it('PROC-DTO-001: should pass validation with valid inputs', async () => {
      const dto = plainToInstance(CreateProductionProcessDto, {
        code: 'PROC-01',
        name: 'CNC Turning',
        sequenceNumber: 1,
        category: 'MACHINING',
        description: 'Primary CNC turning operation',
        isActive: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('PROC-DTO-002: should fail when code is missing or empty', async () => {
      const dto = plainToInstance(CreateProductionProcessDto, {
        code: '',
        name: 'CNC Turning',
        sequenceNumber: 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('PROC-DTO-003: should fail when code exceeds 50 characters', async () => {
      const dto = plainToInstance(CreateProductionProcessDto, {
        code: 'P'.repeat(51),
        name: 'CNC Turning',
        sequenceNumber: 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('PROC-DTO-004: should fail when name is missing or empty', async () => {
      const dto = plainToInstance(CreateProductionProcessDto, {
        code: 'PROC-01',
        name: '',
        sequenceNumber: 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('PROC-DTO-005: should fail when sequenceNumber is less than 1', async () => {
      const dtoZero = plainToInstance(CreateProductionProcessDto, {
        code: 'PROC-01',
        name: 'CNC Turning',
        sequenceNumber: 0,
      });
      const errorsZero = await validate(dtoZero);
      expect(errorsZero.some((e) => e.property === 'sequenceNumber')).toBe(true);

      const dtoNegative = plainToInstance(CreateProductionProcessDto, {
        code: 'PROC-02',
        name: 'CNC Turning',
        sequenceNumber: -3,
      });
      const errorsNegative = await validate(dtoNegative);
      expect(errorsNegative.some((e) => e.property === 'sequenceNumber')).toBe(true);
    });

    it('PROC-DTO-006: should fail when sequenceNumber is not an integer', async () => {
      const dtoFloat = plainToInstance(CreateProductionProcessDto, {
        code: 'PROC-01',
        name: 'CNC Turning',
        sequenceNumber: 2.5,
      });
      const errorsFloat = await validate(dtoFloat);
      expect(errorsFloat.some((e) => e.property === 'sequenceNumber')).toBe(true);
    });

    it('PROC-DTO-007: should transform filter query parameters correctly', () => {
      const filterTrue = plainToInstance(GetProductionProcessFilterDto, {
        isActive: 'true',
        category: 'MACHINING',
      });
      expect(filterTrue.isActive).toBe(true);
      expect(filterTrue.category).toBe('MACHINING');

      const filterFalse = plainToInstance(GetProductionProcessFilterDto, {
        isActive: 'false',
      });
      expect(filterFalse.isActive).toBe(false);
    });
  });

  describe('2. ProductionProcessService Business Logic', () => {
    let service: ProductionProcessService;
    let repo: Partial<Record<keyof Repository<ProductionProcess>, any>>;

    const mockProcess1: ProductionProcess = {
      id: 'uuid-proc-1',
      code: 'PROC-01',
      name: 'Laser Cutting',
      sequenceNumber: 1,
      category: 'CUTTING',
      isActive: true,
      description: 'First stage raw material sheet cutting',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProcess2: ProductionProcess = {
      id: 'uuid-proc-2',
      code: 'PROC-02',
      name: 'CNC Machining',
      sequenceNumber: 2,
      category: 'MACHINING',
      isActive: true,
      description: 'Precision machining',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      repo = {
        find: vi.fn(),
        findOne: vi.fn(),
        create: vi.fn(),
        save: vi.fn(),
        createQueryBuilder: vi.fn(),
      };

      service = new ProductionProcessService(repo as any);
    });

    it('PROC-SVC-001: create() successfully creates and returns a process step', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((item) => ({ id: 'uuid-new', ...item }));
      repo.save.mockImplementation(async (item) => item);

      const result = await service.create({
        code: 'PROC-01',
        name: 'Laser Cutting',
        sequenceNumber: 1,
        category: 'CUTTING',
        description: 'First stage raw material sheet cutting',
      });

      expect(repo.findOne).toHaveBeenCalledTimes(2);
      expect(result.code).toBe('PROC-01');
      expect(result.sequenceNumber).toBe(1);
      expect(result.isActive).toBe(true);
    });

    it('PROC-SVC-002: create() throws ConflictException if process code already exists', async () => {
      repo.findOne.mockResolvedValueOnce(mockProcess1);

      await expect(
        service.create({
          code: 'PROC-01',
          name: 'Duplicate Code Process',
          sequenceNumber: 3,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('PROC-SVC-003: create() throws ConflictException if sequence number is already assigned', async () => {
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockProcess1);

      await expect(
        service.create({
          code: 'PROC-99',
          name: 'Duplicate Seq Process',
          sequenceNumber: 1,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('PROC-SVC-004: findAll() returns processes ordered by sequenceNumber ASC', async () => {
      repo.find.mockResolvedValue([mockProcess1, mockProcess2]);

      const result = await service.findAll();
      expect(result.length).toBe(2);
      expect(result[0].sequenceNumber).toBe(1);
      expect(result[1].sequenceNumber).toBe(2);
      expect(repo.find).toHaveBeenCalledWith({
        where: [{}],
        order: { sequenceNumber: 'ASC' },
      });
    });

    it('PROC-SVC-005: findAll() applies isActive and category filters', async () => {
      repo.find.mockResolvedValue([mockProcess1]);

      await service.findAll({ isActive: true, category: 'CUTTING' });
      expect(repo.find).toHaveBeenCalledWith({
        where: [{ isActive: true, category: 'CUTTING' }],
        order: { sequenceNumber: 'ASC' },
      });
    });

    it('PROC-SVC-006: findOne() returns single process if found', async () => {
      repo.findOne.mockResolvedValue(mockProcess1);

      const result = await service.findOne('uuid-proc-1');
      expect(result).toBe(mockProcess1);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-proc-1' } });
    });

    it('PROC-SVC-007: findOne() throws NotFoundException if process not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-uuid')).rejects.toThrow(NotFoundException);
    });

    it('PROC-SVC-008: update() successfully updates process fields', async () => {
      repo.findOne.mockResolvedValue(mockProcess1);
      repo.save.mockImplementation(async (item) => item);

      const result = await service.update('uuid-proc-1', {
        name: 'Updated Laser Cutting Name',
        description: 'New operation instructions',
      });

      expect(result.name).toBe('Updated Laser Cutting Name');
      expect(result.description).toBe('New operation instructions');
    });

    it('PROC-SVC-009: update() rejects duplicate sequenceNumber when changed', async () => {
      repo.findOne
        .mockResolvedValueOnce({ ...mockProcess1 })
        .mockResolvedValueOnce({ ...mockProcess2 });

      await expect(
        service.update('uuid-proc-1', {
          sequenceNumber: 2,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('PROC-SVC-010: toggleActive() inverts isActive boolean status', async () => {
      const process = { ...mockProcess1, isActive: true };
      repo.findOne.mockResolvedValue(process);
      repo.save.mockImplementation(async (item) => item);

      const toggled = await service.toggleActive('uuid-proc-1');
      expect(toggled.isActive).toBe(false);

      repo.findOne.mockResolvedValue(toggled);
      const toggledBack = await service.toggleActive('uuid-proc-1');
      expect(toggledBack.isActive).toBe(true);
    });
  });

  describe('3. ProductionProcessController & RBAC Security', () => {
    let controller: ProductionProcessController;
    let service: Partial<Record<keyof ProductionProcessService, any>>;
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    const mockProcess: ProductionProcess = {
      id: 'uuid-proc-1',
      code: 'PROC-01',
      name: 'Cutting',
      sequenceNumber: 1,
      category: 'CUTTING',
      isActive: true,
      description: 'Cutting process',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      service = {
        create: vi.fn().mockResolvedValue(mockProcess),
        findAll: vi.fn().mockResolvedValue([mockProcess]),
        findOne: vi.fn().mockResolvedValue(mockProcess),
        update: vi.fn().mockResolvedValue(mockProcess),
        toggleActive: vi.fn().mockResolvedValue({ ...mockProcess, isActive: false }),
      };

      controller = new ProductionProcessController(service as any);
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    function createMockContext(userRole: UserRole, handler: Function): ExecutionContext {
      return {
        getHandler: () => handler,
        getClass: () => ProductionProcessController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'test-user', role: userRole },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('PROC-SEC-001: POST /api/production-processes permits ADMIN role', () => {
      const ctx = createMockContext(UserRole.ADMIN, controller.create);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('PROC-SEC-002: POST /api/production-processes permits STORES role', () => {
      const ctx = createMockContext(UserRole.STORES, controller.create);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('PROC-SEC-003: POST /api/production-processes permits PRODUCTION role', () => {
      const ctx = createMockContext(UserRole.PRODUCTION, controller.create);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('PROC-SEC-004: POST /api/production-processes denies DESIGNER role', () => {
      const ctx = createMockContext(UserRole.DESIGNER, controller.create);
      expect(rolesGuard.canActivate(ctx)).toBe(false);
    });

    it('PROC-SEC-005: PATCH /api/production-processes/:id denies DESIGNER role', () => {
      const ctx = createMockContext(UserRole.DESIGNER, controller.update);
      expect(rolesGuard.canActivate(ctx)).toBe(false);
    });

    it('PROC-SEC-006: GET /api/production-processes is accessible without role restriction (JwtAuthGuard)', () => {
      const ctx = createMockContext(UserRole.DESIGNER, controller.findAll);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('PROC-SEC-007: Controller methods delegate to service methods', async () => {
      const createDto: CreateProductionProcessDto = {
        code: 'PROC-01',
        name: 'Cutting',
        sequenceNumber: 1,
      };
      await controller.create(createDto);
      expect(service.create).toHaveBeenCalledWith(createDto);

      await controller.findAll({});
      expect(service.findAll).toHaveBeenCalledWith({});

      await controller.findOne('uuid-proc-1');
      expect(service.findOne).toHaveBeenCalledWith('uuid-proc-1');

      const updateDto: UpdateProductionProcessDto = { name: 'New Name' };
      await controller.update('uuid-proc-1', updateDto);
      expect(service.update).toHaveBeenCalledWith('uuid-proc-1', updateDto);

      await controller.toggleActive('uuid-proc-1');
      expect(service.toggleActive).toHaveBeenCalledWith('uuid-proc-1');
    });
  });
});
