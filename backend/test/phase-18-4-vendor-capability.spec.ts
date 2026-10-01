import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { VendorProcessCapability } from '../src/vendor/entities/vendor-process-capability.entity.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { VendorCapabilityService } from '../src/vendor/vendor-capability.service.js';
import { VendorController } from '../src/vendor/vendor.controller.js';
import { VendorService } from '../src/vendor/vendor.service.js';
import { AssignVendorCapabilityDto } from '../src/vendor/dto/assign-vendor-capability.dto.js';
import { UpdateVendorCapabilityDto } from '../src/vendor/dto/update-vendor-capability.dto.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.4 — Vendor Process Capability Mapping Test Suite', () => {
  // =========================================================================
  // 1. DTO VALIDATION
  // =========================================================================
  describe('1. DTO Validation', () => {
    it('VPC-DTO-001: valid AssignVendorCapabilityDto passes validation', async () => {
      const dto = plainToInstance(AssignVendorCapabilityDto, {
        processId: '123e4567-e89b-12d3-a456-426614174000',
        isApproved: true,
        leadTimeDays: 5,
        notes: 'Certified for vacuum hardening',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('VPC-DTO-002: invalid processId (not UUID) fails validation', async () => {
      const dto = plainToInstance(AssignVendorCapabilityDto, {
        processId: 'not-a-uuid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'processId')).toBe(true);
    });

    it('VPC-DTO-003: negative leadTimeDays fails validation', async () => {
      const dto = plainToInstance(AssignVendorCapabilityDto, {
        processId: '123e4567-e89b-12d3-a456-426614174000',
        leadTimeDays: -2,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'leadTimeDays')).toBe(true);
    });

    it('VPC-DTO-004: valid UpdateVendorCapabilityDto passes validation', async () => {
      const dto = plainToInstance(UpdateVendorCapabilityDto, {
        isApproved: false,
        leadTimeDays: 7,
        notes: 'Temporarily suspended due to audit failure',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. SERVICE LAYER & BUSINESS LOGIC
  // =========================================================================
  describe('2. Service Layer & Business Logic', () => {
    let service: VendorCapabilityService;
    let capRepo: Repository<VendorProcessCapability>;
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

    const mockCapability: VendorProcessCapability = {
      id: 'cap-uuid-1',
      vendorId: mockVendor.id,
      vendor: mockVendor,
      processId: mockProcess.id,
      process: mockProcess,
      isApproved: true,
      leadTimeDays: 4,
      notes: 'ISO 9001 certified',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      capRepo = {
        create: vi.fn().mockImplementation((val) => ({ id: 'cap-uuid-new', ...val })),
        save: vi.fn().mockImplementation((val) => Promise.resolve({ id: val.id || 'cap-uuid-new', ...val })),
        findOne: vi.fn(),
        findOneOrFail: vi.fn().mockResolvedValue(mockCapability),
        find: vi.fn(),
        remove: vi.fn().mockResolvedValue(mockCapability),
      } as unknown as Repository<VendorProcessCapability>;

      vendorRepo = {
        findOne: vi.fn(),
      } as unknown as Repository<Vendor>;

      processRepo = {
        findOne: vi.fn(),
      } as unknown as Repository<ProductionProcess>;

      service = new VendorCapabilityService(capRepo, vendorRepo, processRepo);
    });

    it('VPC-SVC-001: should assign capability to vendor successfully', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(capRepo, 'findOne').mockResolvedValue(null);

      const dto: AssignVendorCapabilityDto = {
        processId: mockProcess.id,
        isApproved: true,
        leadTimeDays: 4,
        notes: 'ISO 9001 certified',
      };

      const result = await service.assignCapability(mockVendor.id, dto);
      expect(capRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: mockVendor.id,
          processId: mockProcess.id,
          isApproved: true,
          leadTimeDays: 4,
        }),
      );
      expect(result).toBeDefined();
    });

    it('VPC-SVC-002: should throw NotFoundException if vendor does not exist', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(null);

      const dto: AssignVendorCapabilityDto = { processId: mockProcess.id };
      await expect(service.assignCapability('invalid-vendor', dto)).rejects.toThrow(NotFoundException);
    });

    it('VPC-SVC-003: should throw NotFoundException if process does not exist', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(null);

      const dto: AssignVendorCapabilityDto = { processId: 'invalid-proc' };
      await expect(service.assignCapability(mockVendor.id, dto)).rejects.toThrow(NotFoundException);
    });

    it('VPC-SVC-004: should throw BadRequestException if process forbids outside vendors', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue({
        ...mockProcess,
        allowsOutsideVendor: false,
      });

      const dto: AssignVendorCapabilityDto = { processId: mockProcess.id };
      await expect(service.assignCapability(mockVendor.id, dto)).rejects.toThrow(BadRequestException);
    });

    it('VPC-SVC-005: should throw ConflictException if vendor capability already exists', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(capRepo, 'findOne').mockResolvedValue(mockCapability);

      const dto: AssignVendorCapabilityDto = { processId: mockProcess.id };
      await expect(service.assignCapability(mockVendor.id, dto)).rejects.toThrow(ConflictException);
    });

    it('VPC-SVC-006: should update capability details', async () => {
      vi.spyOn(capRepo, 'findOne').mockResolvedValue({ ...mockCapability });

      const updateDto: UpdateVendorCapabilityDto = {
        isApproved: false,
        leadTimeDays: 7,
      };

      const result = await service.updateCapability(mockVendor.id, mockProcess.id, updateDto);
      expect(result.isApproved).toBe(false);
      expect(result.leadTimeDays).toBe(7);
      expect(capRepo.save).toHaveBeenCalled();
    });

    it('VPC-SVC-007: should remove capability mapping', async () => {
      vi.spyOn(capRepo, 'findOne').mockResolvedValue(mockCapability);

      const result = await service.removeCapability(mockVendor.id, mockProcess.id);
      expect(capRepo.remove).toHaveBeenCalledWith(mockCapability);
      expect(result.success).toBe(true);
    });

    it('VPC-SVC-008: should retrieve all capabilities for vendor', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(capRepo, 'find').mockResolvedValue([mockCapability]);

      const result = await service.getVendorCapabilities(mockVendor.id);
      expect(result.length).toBe(1);
      expect(result[0].vendorId).toBe(mockVendor.id);
    });

    it('VPC-SVC-009: should retrieve all approved vendors for process', async () => {
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(capRepo, 'find').mockResolvedValue([mockCapability]);

      const result = await service.getVendorsForProcess(mockProcess.id);
      expect(result.length).toBe(1);
      expect(result[0].processId).toBe(mockProcess.id);
    });

    // Validation engine tests (DC Type 1 foundation)
    it('VPC-SVC-010: validateVendorProcess returns valid when all requirements are met', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(capRepo, 'findOne').mockResolvedValue(mockCapability);

      const res = await service.validateVendorProcess(mockVendor.id, mockProcess.id);
      expect(res.isValid).toBe(true);
      expect(res.vendor).toBeDefined();
      expect(res.process).toBeDefined();
      expect(res.capability).toBeDefined();
    });

    it('VPC-SVC-011: validateVendorProcess returns invalid when vendor is inactive', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue({ ...mockVendor, isActive: false });

      const res = await service.validateVendorProcess(mockVendor.id, mockProcess.id);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('inactive');
    });

    it('VPC-SVC-012: validateVendorProcess returns invalid when process forbids outside vendors', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue({ ...mockProcess, allowsOutsideVendor: false });

      const res = await service.validateVendorProcess(mockVendor.id, mockProcess.id);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('does not permit outside-vendor');
    });

    it('VPC-SVC-013: validateVendorProcess returns invalid when mapping does not exist', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(capRepo, 'findOne').mockResolvedValue(null);

      const res = await service.validateVendorProcess(mockVendor.id, mockProcess.id);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('not certified or assigned');
    });

    it('VPC-SVC-014: validateVendorProcess returns invalid when capability is not approved', async () => {
      vi.spyOn(vendorRepo, 'findOne').mockResolvedValue(mockVendor);
      vi.spyOn(processRepo, 'findOne').mockResolvedValue(mockProcess);
      vi.spyOn(capRepo, 'findOne').mockResolvedValue({ ...mockCapability, isApproved: false });

      const res = await service.validateVendorProcess(mockVendor.id, mockProcess.id);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('not approved');
    });
  });

  // =========================================================================
  // 3. SECURITY & RBAC METADATA VERIFICATION
  // =========================================================================
  describe('3. Security & RBAC Metadata Verification', () => {
    const reflector = new Reflector();

    it('VPC-SEC-001: assignCapability is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.assignCapability);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
      expect(roles).not.toContain(UserRole.DESIGNER);
    });

    it('VPC-SEC-002: updateCapability is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.updateCapability);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });

    it('VPC-SEC-003: removeCapability is restricted to ADMIN and STORES roles', () => {
      const roles = reflector.get<string[]>('roles', VendorController.prototype.removeCapability);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
    });
  });
});
