import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderComponent, ScStatus } from './entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { CreateScDto, CompleteScDto, CloseScDto } from './dto/sc.dto.js';

@Injectable()
export class ScService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
  ) {}

  async createSc(dto: CreateScDto) {
    const trimmedScNumber = dto.scNumber.trim();

    // Verify PO exists
    const po = await this.poRepo.findOne({
      where: { id: dto.poId },
    });
    if (!po) {
      throw new NotFoundException(`Purchase Order with ID "${dto.poId}" not found.`);
    }

    // Check if SC already exists under the SAME PO
    const existingSc = await this.scRepo.findOne({
      where: { scNumber: trimmedScNumber, poId: dto.poId },
    });
    if (existingSc) {
      throw new ConflictException(`SC with number "${trimmedScNumber}" already exists under this PO.`);
    }

    const sc = this.scRepo.create({
      poId: dto.poId,
      scNumber: trimmedScNumber,
      productName: dto.productName.trim(),
      description: dto.description?.trim(),
      drawingNumber: dto.drawingNumber?.trim(),
      targetQuantity: dto.targetQuantity ?? 1,
      status: ScStatus.DRAFT,
    });

    return this.scRepo.save(sc);
  }

  async findAll(query?: { poId?: string; scNumber?: string; status?: ScStatus; search?: string }) {
    const qb = this.scRepo
      .createQueryBuilder('sc')
      .leftJoinAndSelect('sc.purchaseOrder', 'po')
      .leftJoinAndSelect('sc.rmRequest', 'rm')
      .leftJoinAndSelect('rm.items', 'items');

    if (query?.poId) {
      qb.andWhere('sc.poId = :poId', { poId: query.poId });
    }
    if (query?.scNumber) {
      qb.andWhere('sc.scNumber ILIKE :scNumber', { scNumber: `%${query.scNumber}%` });
    }
    if (query?.status) {
      qb.andWhere('sc.status = :status', { status: query.status });
    }
    if (query?.search) {
      qb.andWhere(
        '(sc.scNumber ILIKE :search OR sc.productName ILIKE :search OR po.poNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('sc.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const sc = await this.scRepo.findOne({
      where: { id },
      relations: {
        purchaseOrder: true,
        rmRequest: { items: true },
        materialIssues: { items: { rmItem: true } },
        materialConsumptions: { rmItem: true },
        materialReturns: { items: { rmItem: true } },
        additionalRequests: { items: true },
      },
    });

    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${id}" not found.`);
    }
    return sc;
  }

  async completeSc(id: string, actorId: string, dto?: CompleteScDto) {
    const sc = await this.findOne(id);
    if (sc.status === ScStatus.COMPLETED) {
      throw new BadRequestException(`SC "${sc.scNumber}" is already COMPLETED.`);
    }
    if (sc.status === ScStatus.CLOSED) {
      throw new BadRequestException(`SC "${sc.scNumber}" is already CLOSED and cannot be completed again.`);
    }

    sc.status = ScStatus.COMPLETED;
    sc.completedAt = new Date();
    sc.completedById = actorId;
    sc.completionRemarks = dto?.remarks;

    return this.scRepo.save(sc);
  }

  async closeSc(id: string, actorId: string, dto?: CloseScDto) {
    const sc = await this.findOne(id);
    if (sc.status === ScStatus.CLOSED) {
      throw new BadRequestException(`SC "${sc.scNumber}" is already CLOSED.`);
    }
    if (sc.status === ScStatus.DRAFT) {
      throw new BadRequestException(`Cannot close a DRAFT SC.`);
    }

    sc.status = ScStatus.CLOSED;
    sc.completionRemarks = dto?.remarks
      ? `${sc.completionRemarks || ''} [Closed: ${dto.remarks}]`
      : sc.completionRemarks;

    return this.scRepo.save(sc);
  }
}
