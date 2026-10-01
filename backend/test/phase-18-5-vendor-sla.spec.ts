import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { VendorSla } from '../src/vendor/entities/vendor-sla.entity.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { VendorSlaService } from '../src/vendor/vendor-sla.service.js';
import { VendorController } from '../src/vendor/vendor.controller.js';
import { CreateVendorSlaDto } from '../src/vendor/dto/create-vendor-sla.dto.js';
import { UpdateVendorSlaDto } from '../src/vendor/dto/update-vendor-sla.dto.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.5 — Vendor SLA Foundation Test Suite', () => {
  // =========================================================================
  // 1. DTO VALIDATION
  // =========================================================================
  describe('1. DTO Validation', () => {
    it('SLA-DTO-001: valid CreateVendorSlaDto passes validation', async () => {
      const dto = plainToInstance(CreateVendorSlaDto, {
        processId: '123e4567-e89b-12d3-a456-426614174000',
        slaDays: 5,
        effectiveDate: '2026-10-01T00:00:00Z',
        isActive: true,
        notes: 'Agreed turnaround 5 business days',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('SLA-DTO-002: invalid processId (not UUID) fails validation', async () => {
      const dto = plainToInstance(CreateVendorSlaDto, {
        processId: 'not-a-uuid',
        slaDays: 5,
        effectiveDate: '2026-10-01T00:00:00Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'processId')).toBe(true);
    });

    it('SLA-DTO-003: slaDays < 1 fails validation', async () => {
      const dto = plainToInstance(CreateVendorSlaDto, {
        processId: '123e4567-e89b-12d3-a456-426614174000',
        slaDays: 0,
        effectiveDate: '2026-10-01T00:00:00Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'slaDays')).toBe(true);
    });

    it('SLA-DTO-004: invalid effectiveDate fails validation', async () => {
      const dto = plainToInstance(CreateVendorSlaDto, {
        processId: '123e4567-e89b-12d3-a456-426614174000',
        slaDays: 5,
        effectiveDate: 'not-a-date',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'effectiveDate')).toBe(true);
    });

    it('SLA-DTO-005: valid UpdateVendorSlaDto passes validation', async () => {
      const dto = plainToInstance(UpdateVendorSlaDto, {
        slaDays: 7,
        isActive: false,
        notes: 'SLA renegotiated',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. SERVICE LAYER & BUSINESS LOGIC
  // =========================================================================
  describe('2. Service Layer & Business Logic', () => {
    let service: VendorSlaService;
    let slaRepo: Repository<VendorSla>;
    let vendorRepo: Repository<Vendor>;
    let processRepo: Repository<ProductionProcess>;

    const mockVendor: Vendor = {
      id: 'vendor-uuid-1',
      code: 'VEND-001',
      name: 'Apex Heat Treatment Ltd.',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProcess: ProductionProcess = {
      id: 'proc-uuid-1',
      code: 'PROC-HT',
      name: 'Heat Treatment',
      sequenceNumber: 4,
      isActive: true,
      isSkippable: false,
      isRepeatable: false,
      allowsOutsideVendor: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSla: VendorSla = {
      id: 'sla-uuid-1',
      vendorId: mockVendor.id,
      vendor: mockVendor,
      processId: mockProcess.id,
      process: mockProcess,
      slaDays: 5,
      effectiveDate: new Date('2026-10-01'),
      isActive: true,
      notes: 'Initial agreed SLA',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      slaRepo = {
        create: vi.fn().mockImplementation((val) => ({ id: 'sla-uuid-new', ...val })),
        save: vi.fn().mockImplementation((val) => Promise.resolve({ id: val.id || 'sla-uuid-new', ...val })),
        findOne: vi.fn(),
        findOneOrFail: vi.fn().mockResolvedValue(mockSla),
        find: vi.fn(),
        remove: vi.fn().mockResolvedValue(mockSla),
      } as unknown as Repository<VendorSla>;

      vendorRepo = {
        findOne: vi.fn(),
      } as unknown as Repository<Vendor>;

      processRepo = {
        findOne: vi.fn(),
      } as unknown as Repository<ProductionProcess>;

      service = new VendorSlaService(slaRepo, vendorRepo, processRepo);
    });

    it('SLA-SVC-001: should create an SLA agreement for vendor-process pair', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(null);

      const dto: CreateVendorSlaDto = {
        processId: mockProcess.id,
        slaDays: 5,
        effectiveDate: '2026-10-01T00:00:00Z',
        isActive: true,
        notes: 'Initial agreed SLA',
      };

      const result = await service.createSla(mockVendor.id, dto);
      expect(slaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: mockVendor.id,
          processId: mockProcess.id,
          slaDays: 5,
          isActive: true,
        }),
      );
      expect(result).toBeDefined();
    });

    it('SLA-SVC-002: should throw NotFoundException if vendor does not exist', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(null);

      const dto: CreateVendorSlaDto = {
        processId: mockProcess.id,
        slaDays: 5,
        effectiveDate: '2026-10-01',
      };

      await expect(service.createSla('invalid-vendor', dto)).rejects.toThrow(NotFoundException);
    });

    it('SLA-SVC-003: should throw NotFoundException if process does not exist', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(null);

      const dto: CreateVendorSlaDto = {
        processId: 'invalid-proc',
        slaDays: 5,
        effectiveDate: '2026-10-01',
      };

      await expect(service.createSla(mockVendor.id, dto)).rejects.toThrow(NotFoundException);
    });

    it('SLA-SVC-004: should throw ConflictException if SLA already configured', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(mockSla);

      const dto: CreateVendorSlaDto = {
        processId: mockProcess.id,
        slaDays: 5,
        effectiveDate: '2026-10-01',
      };

      await expect(service.createSla(mockVendor.id, dto)).rejects.toThrow(ConflictException);
    });

    it('SLA-SVC-005: should update SLA properties', async () => {
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue({ ...mockSla });

      const updateDto: UpdateVendorSlaDto = {
        slaDays: 8,
        isActive: false,
        notes: 'Renegotiated longer turnaround',
      };

      const result = await service.updateSla('sla-uuid-1', updateDto);
      expect(result.slaDays).toBe(8);
      expect(result.isActive).toBe(false);
      expect(slaRepo.save).toHaveBeenCalled();
    });

    it('SLA-SVC-006: should throw NotFoundException if SLA to update does not exist', async () => {
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(null);

      await expect(service.updateSla('invalid-sla', { slaDays: 6 })).rejects.toThrow(NotFoundException);
    });

    it('SLA-SVC-007: should retrieve all SLAs for vendor', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(slaRepo, 'find').mockResolvedValue([mockSla]);

      const result = await service.getVendorSlas(mockVendor.id);
      expect(result.length).toBe(1);
      expect(result[0].vendorId).toBe(mockVendor.id);
    });

    it('SLA-SVC-008: should retrieve active SLA for vendor and process', async () => {
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(mockSla);

      const result = await service.getSlaForVendorProcess(mockVendor.id, mockProcess.id);
      expect(result).toBeDefined();
      expect(result.slaDays).toBe(5);
    });

    it('SLA-SVC-009: should throw NotFoundException if active SLA not found', async () => {
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.getSlaForVendorProcess(mockVendor.id, mockProcess.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('SLA-SVC-010: should calculate expected return date correctly based on SLA days', async () => {
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(mockSla);

      const dispatchDate = new Date('2026-10-01T10:00:00Z');
      const calc = await service.calculateExpectedReturnDate(
        mockVendor.id,
        mockProcess.id,
        dispatchDate,
      );

      expect(calc.slaDays).toBe(5);
      const expectedTime = dispatchDate.getTime() + 5 * 24 * 60 * 60 * 1000;
      expect(calc.expectedReturnDate.getTime()).toBe(expectedTime);
      expect(calc.vendorName).toBe(mockVendor.name);
      expect(calc.processName).toBe(mockProcess.name);
    });

    it('SLA-SVC-011: should remove SLA agreement', async () => {
      vi.spyOn(slaRepo, 'findOne').mockResolvedValue(mockSla);

      const result = await service.removeSla('sla-uuid-1');
      expect(slaRepo.remove).toHaveBeenCalledWith(mockSla);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. SECURITY & RBAC METADATA VERIFICATION
  // =========================================================================
  describe('3. Security & RBAC Metadata Verification', () => {
    const reflector = new Reflector();

    it('SLA-SEC-001: createSla is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.createSla);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
      expect(roles).not.toContain(UserRole.DESIGNER);
    });

    it('SLA-SEC-002: updateSla is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.updateSla);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });

    it('SLA-SEC-003: removeSla is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.removeSla);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });
  });
});

