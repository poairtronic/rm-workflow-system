import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Vendor } from './entities/vendor.entity.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';
import { GetVendorFilterDto } from './dto/get-vendor-filter.dto.js';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
  ) {}

  /**
   * Creates a new Vendor master record with uniqueness validation on code.
   */
  async create(dto: CreateVendorDto): Promise<Vendor> {
    const trimmedCode = dto.code.trim();
    const trimmedName = dto.name.trim();

    const existingCode = await this.vendorRepo.findOne({
      where: { code: ILike(trimmedCode) },
    });
    if (existingCode) {
      throw new ConflictException(
        `Vendor with code "${trimmedCode}" is already registered (existing: "${existingCode.name}").`,
      );
    }

    const vendor = this.vendorRepo.create({
      code: trimmedCode,
      name: trimmedName,
      category: dto.category?.trim() || null,
      contactPerson: dto.contactPerson?.trim() || null,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      address: dto.address?.trim() || null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.vendorRepo.save(vendor);
    this.logger.log(
      `[VENDOR CREATED] ID: ${saved.id}, Code: ${saved.code}, Name: "${saved.name}"`,
    );
    return saved;
  }

  /**
   * Retrieves all vendors with optional search, category, and active status filters.
   */
  async findAll(filter?: GetVendorFilterDto): Promise<Vendor[]> {
    const query = this.vendorRepo.createQueryBuilder('vendor');

    if (filter?.isActive !== undefined) {
      query.andWhere('vendor.isActive = :isActive', {
        isActive: filter.isActive,
      });
    }

    if (filter?.category && filter.category.trim().length > 0) {
      query.andWhere('LOWER(vendor.category) = LOWER(:category)', {
        category: filter.category.trim(),
      });
    }

    if (filter?.search && filter.search.trim().length > 0) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(vendor.name) LIKE :term OR LOWER(vendor.code) LIKE :term OR LOWER(vendor.contactPerson) LIKE :term OR LOWER(vendor.email) LIKE :term)',
        { term },
      );
    }

    const vendors = await query.getMany();
    return vendors.sort((a, b) => {
      const numA = parseInt(a.code.replace(/\D/g, ''), 10);
      const numB = parseInt(b.code.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.code.localeCompare(b.code);
    });
  }

  /**
   * Retrieves a single vendor by ID.
   */
  async findOne(id: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" was not found.`);
    }
    return vendor;
  }

  /**
   * Retrieves a single vendor by code (case-insensitive).
   */
  async findByCode(code: string): Promise<Vendor | null> {
    return this.vendorRepo.findOne({
      where: { code: ILike(code.trim()) },
    });
  }

  /**
   * Updates an existing vendor with uniqueness conflict validation if code changes.
   */
  async update(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    const vendor = await this.findOne(id);

    if (dto.code !== undefined) {
      const trimmedCode = dto.code.trim();
      if (trimmedCode.toLowerCase() !== vendor.code.toLowerCase()) {
        const existingCode = await this.vendorRepo.findOne({
          where: { code: ILike(trimmedCode) },
        });
        if (existingCode && existingCode.id !== id) {
          throw new ConflictException(
            `Vendor code "${trimmedCode}" is already in use by "${existingCode.name}".`,
          );
        }
        vendor.code = trimmedCode;
      }
    }

    if (dto.name !== undefined) {
      vendor.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      vendor.category = dto.category?.trim() || null;
    }
    if (dto.contactPerson !== undefined) {
      vendor.contactPerson = dto.contactPerson?.trim() || null;
    }
    if (dto.email !== undefined) {
      vendor.email = dto.email?.trim() || null;
    }
    if (dto.phone !== undefined) {
      vendor.phone = dto.phone?.trim() || null;
    }
    if (dto.address !== undefined) {
      vendor.address = dto.address?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      vendor.isActive = dto.isActive;
    }
    if (dto.notes !== undefined) {
      vendor.notes = dto.notes?.trim() || null;
    }

    const updated = await this.vendorRepo.save(vendor);
    this.logger.log(
      `[VENDOR UPDATED] ID: ${updated.id}, Code: ${updated.code}, Name: "${updated.name}"`,
    );
    return updated;
  }

  /**
   * Toggles the active status of a vendor (soft activate / deactivate).
   */
  async toggleActive(id: string): Promise<Vendor> {
    const vendor = await this.findOne(id);
    vendor.isActive = !vendor.isActive;
    const updated = await this.vendorRepo.save(vendor);
    this.logger.log(
      `[VENDOR TOGGLED] ID: ${updated.id}, Code: ${updated.code}, Active: ${updated.isActive}`,
    );
    return updated;
  }

  /**
   * Soft-deactivates a vendor.
   */
  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const vendor = await this.findOne(id);
    vendor.isActive = false;
    await this.vendorRepo.save(vendor);
    this.logger.log(
      `[VENDOR DEACTIVATED] ID: ${vendor.id}, Code: ${vendor.code}`,
    );
    return {
      success: true,
      message: `Vendor "${vendor.name}" (${vendor.code}) has been deactivated.`,
    };
  }
}

