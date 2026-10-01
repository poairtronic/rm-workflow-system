import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { ProductionProcess } from './entities/production-process.entity.js';
import { CreateProductionProcessDto } from './dto/create-production-process.dto.js';
import { UpdateProductionProcessDto } from './dto/update-production-process.dto.js';
import { GetProductionProcessFilterDto } from './dto/get-production-process-filter.dto.js';

@Injectable()
export class ProductionProcessService {
  private readonly logger = new Logger(ProductionProcessService.name);

  constructor(
    @InjectRepository(ProductionProcess)
    private readonly processRepo: Repository<ProductionProcess>,
  ) {}

  async create(dto: CreateProductionProcessDto): Promise<ProductionProcess> {
    const trimmedCode = dto.code.trim();
    const trimmedName = dto.name.trim();

    const existingCode = await this.processRepo.findOne({
      where: { code: trimmedCode },
    });
    if (existingCode) {
      throw new ConflictException(
        `Production process code "${trimmedCode}" is already in use by "${existingCode.name}".`,
      );
    }

    const existingSeq = await this.processRepo.findOne({
      where: { sequenceNumber: dto.sequenceNumber },
    });
    if (existingSeq) {
      throw new ConflictException(
        `Sequence number ${dto.sequenceNumber} is already assigned to process "${existingSeq.name}" (${existingSeq.code}).`,
      );
    }

    const process = this.processRepo.create({
      code: trimmedCode,
      name: trimmedName,
      sequenceNumber: dto.sequenceNumber,
      category: dto.category?.trim() || null,
      description: dto.description?.trim() || null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const saved = await this.processRepo.save(process);
    this.logger.log(
      `[PRODUCTION PROCESS CREATED] ID: ${saved.id}, Code: ${saved.code}, Sequence: ${saved.sequenceNumber}`,
    );
    return saved;
  }

  async findAll(filter?: GetProductionProcessFilterDto): Promise<ProductionProcess[]> {
    const where: FindOptionsWhere<ProductionProcess>[] = [];

    const baseWhere: FindOptionsWhere<ProductionProcess> = {};
    if (filter?.isActive !== undefined) {
      baseWhere.isActive = filter.isActive;
    }
    if (filter?.category) {
      baseWhere.category = filter.category;
    }

    if (filter?.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      where.push({ ...baseWhere, name: ILike(term) });
      where.push({ ...baseWhere, code: ILike(term) });
    } else {
      where.push(baseWhere);
    }

    return this.processRepo.find({
      where,
      order: { sequenceNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ProductionProcess> {
    const process = await this.processRepo.findOne({ where: { id } });
    if (!process) {
      throw new NotFoundException(
        `Production process with ID "${id}" was not found.`,
      );
    }
    return process;
  }

  async findByCode(code: string): Promise<ProductionProcess | null> {
    return this.processRepo.findOne({ where: { code: code.trim() } });
  }

  async update(
    id: string,
    dto: UpdateProductionProcessDto,
  ): Promise<ProductionProcess> {
    const process = await this.findOne(id);

    if (dto.code && dto.code.trim() !== process.code) {
      const trimmedCode = dto.code.trim();
      const existing = await this.processRepo.findOne({
        where: { code: trimmedCode },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Production process code "${trimmedCode}" is already in use by "${existing.name}".`,
        );
      }
      process.code = trimmedCode;
    }

    if (
      dto.sequenceNumber !== undefined &&
      dto.sequenceNumber !== process.sequenceNumber
    ) {
      const existingSeq = await this.processRepo.findOne({
        where: { sequenceNumber: dto.sequenceNumber },
      });
      if (existingSeq && existingSeq.id !== id) {
        throw new ConflictException(
          `Sequence number ${dto.sequenceNumber} is already assigned to process "${existingSeq.name}" (${existingSeq.code}).`,
        );
      }
      process.sequenceNumber = dto.sequenceNumber;
    }

    if (dto.name !== undefined) {
      process.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      process.category = dto.category?.trim() || null;
    }
    if (dto.description !== undefined) {
      process.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      process.isActive = dto.isActive;
    }

    const saved = await this.processRepo.save(process);
    this.logger.log(
      `[PRODUCTION PROCESS UPDATED] ID: ${saved.id}, Code: ${saved.code}, Sequence: ${saved.sequenceNumber}`,
    );
    return saved;
  }

  async toggleActive(id: string): Promise<ProductionProcess> {
    const process = await this.findOne(id);
    process.isActive = !process.isActive;
    const saved = await this.processRepo.save(process);
    this.logger.log(
      `[PRODUCTION PROCESS TOGGLED] ID: ${saved.id}, Active: ${saved.isActive}`,
    );
    return saved;
  }

  async getNextSequenceNumber(): Promise<number> {
    const highest = await this.processRepo
      .createQueryBuilder('p')
      .select('MAX(p.sequenceNumber)', 'max')
      .getRawOne();
    return (highest?.max || 0) + 1;
  }
}
