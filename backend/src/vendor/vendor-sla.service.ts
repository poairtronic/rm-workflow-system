import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorSla } from './entities/vendor-sla.entity.js';
import { Vendor } from './entities/vendor.entity.js';
import { ProductionProcess } from '../production-process/entities/production-process.entity.js';
import { CreateVendorSlaDto } from './dto/create-vendor-sla.dto.js';
import { UpdateVendorSlaDto } from './dto/update-vendor-sla.dto.js';

export interface ExpectedReturnCalculationResult {
  expectedReturnDate: Date;
  slaDays: number;
  dispatchDate: Date;
  vendorName: string;
  processName: string;
}

@Injectable()
export class VendorSlaService {
  private readonly logger = new Logger(VendorSlaService.name);

  constructor(
    @InjectRepository(VendorSla)
    private readonly slaRepo: Repository<VendorSla>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(ProductionProcess)
    private readonly processRepo: Repository<ProductionProcess>,
  ) {}

  /**
   * Sets up an agreed SLA turnaround rule for a vendor-process pair.
   */
  async createSla(
    vendorId: string,
    dto: CreateVendorSlaDto,
  ): Promise<VendorSla> {
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

    const existing = await this.slaRepo.findOne({
      where: { vendorId, processId: dto.processId },
    });
    if (existing) {
      throw new ConflictException(
        `SLA configuration already exists for vendor "${vendor.name}" and process "${process.name}".`,
      );
    }

    const effectiveDate = new Date(dto.effectiveDate);

    const sla = this.slaRepo.create({
      vendorId,
      processId: dto.processId,
      slaDays: dto.slaDays,
      effectiveDate,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.slaRepo.save(sla);
    this.logger.log(
      `[VENDOR SLA CREATED] Vendor: "${vendor.name}", Process: "${process.name}", SLA: ${saved.slaDays} days`,
    );

    return this.slaRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { vendor: true, process: true },
    });
  }

  /**
   * Updates an SLA rule's duration, active status, effective date, or notes.
   */
  async updateSla(
    slaId: string,
    dto: UpdateVendorSlaDto,
  ): Promise<VendorSla> {
    const sla = await this.slaRepo.findOne({
      where: { id: slaId },
      relations: { vendor: true, process: true },
    });

    if (!sla) {
      throw new NotFoundException(`Vendor SLA with ID "${slaId}" was not found.`);
    }

    if (dto.slaDays !== undefined) {
      sla.slaDays = dto.slaDays;
    }
    if (dto.effectiveDate !== undefined) {
      sla.effectiveDate = new Date(dto.effectiveDate);
    }
    if (dto.isActive !== undefined) {
      sla.isActive = dto.isActive;
    }
    if (dto.notes !== undefined) {
      sla.notes = dto.notes?.trim() || null;
    }

    const updated = await this.slaRepo.save(sla);
    this.logger.log(
      `[VENDOR SLA UPDATED] ID: ${updated.id}, Vendor: "${updated.vendor?.name}", SLA: ${updated.slaDays} days, Active: ${updated.isActive}`,
    );

    return updated;
  }

  /**
   * Retrieves all SLA configurations registered for a specific vendor.
   */
  async getVendorSlas(vendorId: string): Promise<VendorSla[]> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${vendorId}" was not found.`);
    }

    return this.slaRepo.find({
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
   * Retrieves the active SLA agreement for a vendor and process.
   */
  async getSlaForVendorProcess(
    vendorId: string,
    processId: string,
  ): Promise<VendorSla> {
    const sla = await this.slaRepo.findOne({
      where: { vendorId, processId, isActive: true },
      relations: { vendor: true, process: true },
    });

    if (!sla) {
      throw new NotFoundException(
        `No active SLA agreement found for vendor "${vendorId}" and process "${processId}".`,
      );
    }

    return sla;
  }

  /**
   * Calculates expected return date for DC Type 1 based on agreed SLA duration.
   */
  async calculateExpectedReturnDate(
    vendorId: string,
    processId: string,
    dispatchDate: Date = new Date(),
  ): Promise<ExpectedReturnCalculationResult> {
    const sla = await this.getSlaForVendorProcess(vendorId, processId);
    const expectedReturnDate = new Date(
      dispatchDate.getTime() + sla.slaDays * 24 * 60 * 60 * 1000,
    );

    return {
      expectedReturnDate,
      slaDays: sla.slaDays,
      dispatchDate,
      vendorName: sla.vendor.name,
      processName: sla.process.name,
    };
  }

  /**
   * Removes / deletes an SLA rule.
   */
  async removeSla(slaId: string): Promise<{ success: boolean; message: string }> {
    const sla = await this.slaRepo.findOne({
      where: { id: slaId },
      relations: { vendor: true, process: true },
    });

    if (!sla) {
      throw new NotFoundException(`Vendor SLA with ID "${slaId}" was not found.`);
    }

    const vendorName = sla.vendor?.name || sla.vendorId;
    const processName = sla.process?.name || sla.processId;

    await this.slaRepo.remove(sla);
    this.logger.log(
      `[VENDOR SLA REMOVED] Vendor: "${vendorName}", Process: "${processName}"`,
    );

    return {
      success: true,
      message: `SLA agreement for process "${processName}" removed from vendor "${vendorName}".`,
    };
  }
}
