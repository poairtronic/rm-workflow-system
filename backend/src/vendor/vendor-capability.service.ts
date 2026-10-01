import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './entities/vendor.entity.js';
import { ProductionProcess } from '../production-process/entities/production-process.entity.js';
import { VendorProcessCapability } from './entities/vendor-process-capability.entity.js';
import { AssignVendorCapabilityDto } from './dto/assign-vendor-capability.dto.js';
import { UpdateVendorCapabilityDto } from './dto/update-vendor-capability.dto.js';

export interface VendorProcessValidationResult {
  isValid: boolean;
  reason?: string;
  vendor?: Vendor;
  process?: ProductionProcess;
  capability?: VendorProcessCapability;
}

@Injectable()
export class VendorCapabilityService {
  private readonly logger = new Logger(VendorCapabilityService.name);

  constructor(
    @InjectRepository(VendorProcessCapability)
    private readonly capabilityRepo: Repository<VendorProcessCapability>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(ProductionProcess)
    private readonly processRepo: Repository<ProductionProcess>,
  ) {}

  /**
   * Assigns an outside manufacturing process capability to an approved vendor.
   */
  async assignCapability(
    vendorId: string,
    dto: AssignVendorCapabilityDto,
  ): Promise<VendorProcessCapability> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${vendorId}" was not found.`);
    }

    const process = await this.processRepo.findOne({
      where: { id: dto.processId },
    });
    if (!process) {
      throw new NotFoundException(
        `Production process with ID "${dto.processId}" was not found.`,
      );
    }

    if (!process.allowsOutsideVendor) {
      throw new BadRequestException(
        `Production process "${process.name}" (${process.code}) is not configured to permit outside-vendor processing.`,
      );
    }

    const existing = await this.capabilityRepo.findOne({
      where: { vendorId, processId: dto.processId },
    });
    if (existing) {
      throw new ConflictException(
        `Vendor "${vendor.name}" (${vendor.code}) is already assigned capability for process "${process.name}" (${process.code}).`,
      );
    }

    const capability = this.capabilityRepo.create({
      vendorId,
      processId: dto.processId,
      isApproved: dto.isApproved !== undefined ? dto.isApproved : true,
      leadTimeDays: dto.leadTimeDays ?? null,
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.capabilityRepo.save(capability);
    this.logger.log(
      `[VENDOR CAPABILITY ASSIGNED] Vendor: "${vendor.name}" -> Process: "${process.name}" (ID: ${saved.id})`,
    );

    return this.capabilityRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { vendor: true, process: true },
    });
  }

  /**
   * Updates an existing capability assignment (approval status, lead time, notes).
   */
  async updateCapability(
    vendorId: string,
    processId: string,
    dto: UpdateVendorCapabilityDto,
  ): Promise<VendorProcessCapability> {
    const capability = await this.capabilityRepo.findOne({
      where: { vendorId, processId },
      relations: { vendor: true, process: true },
    });

    if (!capability) {
      throw new NotFoundException(
        `Capability mapping between vendor "${vendorId}" and process "${processId}" was not found.`,
      );
    }

    if (dto.isApproved !== undefined) {
      capability.isApproved = dto.isApproved;
    }
    if (dto.leadTimeDays !== undefined) {
      capability.leadTimeDays = dto.leadTimeDays;
    }
    if (dto.notes !== undefined) {
      capability.notes = dto.notes?.trim() || null;
    }

    const updated = await this.capabilityRepo.save(capability);
    this.logger.log(
      `[VENDOR CAPABILITY UPDATED] Vendor: "${capability.vendor?.name}" -> Process: "${capability.process?.name}", Approved: ${updated.isApproved}`,
    );

    return updated;
  }

  /**
   * Revokes / removes a process capability from a vendor.
   */
  async removeCapability(
    vendorId: string,
    processId: string,
  ): Promise<{ success: boolean; message: string }> {
    const capability = await this.capabilityRepo.findOne({
      where: { vendorId, processId },
      relations: { vendor: true, process: true },
    });

    if (!capability) {
      throw new NotFoundException(
        `Capability mapping between vendor "${vendorId}" and process "${processId}" was not found.`,
      );
    }

    const vendorName = capability.vendor?.name || vendorId;
    const processName = capability.process?.name || processId;

    await this.capabilityRepo.remove(capability);
    this.logger.log(
      `[VENDOR CAPABILITY REMOVED] Vendor: "${vendorName}" -x- Process: "${processName}"`,
    );

    return {
      success: true,
      message: `Capability for process "${processName}" revoked from vendor "${vendorName}".`,
    };
  }

  /**
   * Retrieves all certified/assigned capabilities for a given vendor.
   */
  async getVendorCapabilities(
    vendorId: string,
  ): Promise<VendorProcessCapability[]> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${vendorId}" was not found.`);
    }

    return this.capabilityRepo.find({
      where: { vendorId },
      relations: { process: true },
      order: {
        process: {
          sequenceNumber: 'ASC',
        },
      },
    });
  }

  /**
   * Retrieves all approved vendors for a specific manufacturing process.
   */
  async getVendorsForProcess(
    processId: string,
  ): Promise<VendorProcessCapability[]> {
    const process = await this.processRepo.findOne({ where: { id: processId } });
    if (!process) {
      throw new NotFoundException(
        `Production process with ID "${processId}" was not found.`,
      );
    }

    return this.capabilityRepo.find({
      where: { processId, isApproved: true },
      relations: { vendor: true },
      order: {
        vendor: {
          name: 'ASC',
        },
      },
    });
  }

  /**
   * Validates whether a vendor is actively certified and approved for a specific process.
   * Critical precondition validator for Delivery Challan (DC Type 1).
   */
  async validateVendorProcess(
    vendorId: string,
    processId: string,
  ): Promise<VendorProcessValidationResult> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      return {
        isValid: false,
        reason: `Vendor with ID "${vendorId}" does not exist.`,
      };
    }

    if (!vendor.isActive) {
      return {
        isValid: false,
        vendor,
        reason: `Vendor "${vendor.name}" (${vendor.code}) is inactive / suspended.`,
      };
    }

    const process = await this.processRepo.findOne({ where: { id: processId } });
    if (!process) {
      return {
        isValid: false,
        vendor,
        reason: `Production process with ID "${processId}" does not exist.`,
      };
    }

    if (!process.isActive) {
      return {
        isValid: false,
        vendor,
        process,
        reason: `Production process "${process.name}" (${process.code}) is inactive.`,
      };
    }

    if (!process.allowsOutsideVendor) {
      return {
        isValid: false,
        vendor,
        process,
        reason: `Production process "${process.name}" (${process.code}) does not permit outside-vendor processing.`,
      };
    }

    const capability = await this.capabilityRepo.findOne({
      where: { vendorId, processId },
      relations: { vendor: true, process: true },
    });

    if (!capability) {
      return {
        isValid: false,
        vendor,
        process,
        reason: `Vendor "${vendor.name}" (${vendor.code}) is not certified or assigned for process "${process.name}" (${process.code}).`,
      };
    }

    if (!capability.isApproved) {
      return {
        isValid: false,
        vendor,
        process,
        capability,
        reason: `Capability for process "${process.name}" is not approved (pending or revoked) for vendor "${vendor.name}".`,
      };
    }

    return {
      isValid: true,
      vendor,
      process,
      capability,
    };
  }
}

