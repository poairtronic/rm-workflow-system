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
import { ProductionService } from '../production/production.service.js';
import { AdditionalRequestService } from '../additional-request/additional-request.service.js';
import { AdditionalRequestStatus } from '../additional-request/entities/additional-request.entity.js';
import { ReturnStatus } from '../production/entities/material-return.entity.js';

@Injectable()
export class ScService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    private readonly productionService: ProductionService,
    private readonly additionalRequestService: AdditionalRequestService,
  ) {}

  async createSc(dto: CreateScDto) {
    const trimmedScNumber = dto.scNumber.trim();

    // Verify PO exists
    const po = await this.poRepo.findOne({
      where: { id: dto.poId },
    });
    if (!po) {
      throw new NotFoundException(
        `Purchase Order with ID "${dto.poId}" not found.`,
      );
    }

    // Check if SC already exists under the SAME PO
    const existingSc = await this.scRepo.findOne({
      where: { scNumber: trimmedScNumber, poId: dto.poId },
    });
    if (existingSc) {
      throw new ConflictException(
        `SC with number "${trimmedScNumber}" already exists under this PO.`,
      );
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

  async findAll(query?: {
    poId?: string;
    scNumber?: string;
    status?: ScStatus;
    search?: string;
  }) {
    const qb = this.scRepo
      .createQueryBuilder('sc')
      .leftJoinAndSelect('sc.purchaseOrder', 'po')
      .leftJoinAndSelect('sc.rmRequest', 'rm')
      .leftJoinAndSelect('rm.items', 'items');

    if (query?.poId) {
      qb.andWhere('sc.poId = :poId', { poId: query.poId });
    }
    if (query?.scNumber) {
      qb.andWhere('sc.scNumber ILIKE :scNumber', {
        scNumber: `%${query.scNumber}%`,
      });
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
      throw new NotFoundException(
        `Sales Order Component with ID "${id}" not found.`,
      );
    }
    return sc;
  }

  async completeSc(id: string, actorId: string, dto?: CompleteScDto) {
    const sc = await this.findOne(id);
    if (sc.status === ScStatus.COMPLETED) {
      throw new BadRequestException(
        `SC "${sc.scNumber}" is already COMPLETED.`,
      );
    }
    if (sc.status === ScStatus.CLOSED) {
      throw new BadRequestException(
        `SC "${sc.scNumber}" is already CLOSED and cannot be completed again.`,
      );
    }

    // 1. Verify Status
    if (sc.status !== ScStatus.IN_PRODUCTION && sc.status !== ScStatus.ADDITIONAL_REQUEST) {
      throw new BadRequestException(
        `SC "${sc.scNumber}" cannot be completed from status ${sc.status}. Must be IN_PRODUCTION or ADDITIONAL_REQUEST.`,
      );
    }

    // 2. Check pending Additional Requests
    const pendingAddlReqs = await this.additionalRequestService.findAll(id);
    const hasPendingAddl = pendingAddlReqs.some(
      (r) =>
        r.status === AdditionalRequestStatus.REQUESTED ||
        r.status === AdditionalRequestStatus.APPROVED,
    );
    if (hasPendingAddl) {
      throw new BadRequestException(
        `Cannot complete SC with pending additional material requests.`,
      );
    }

    // 3. Check pending Material Returns
    const hasPendingReturns = await this.scRepo.manager
      .createQueryBuilder('material_returns', 'mr')
      .where('mr.sc_id = :id', { id })
      .andWhere('mr.status = :status', { status: ReturnStatus.PENDING_STORE_ACK })
      .getCount() > 0;
    if (hasPendingReturns) {
      throw new BadRequestException(
        `Cannot complete SC with pending material returns awaiting Stores ACK.`,
      );
    }

    // 4. Check Unaccounted = 0
    const accounting = await this.productionService.getAccounting(id);
    for (const item of accounting.items) {
      if (item.unaccounted > 0) {
        throw new BadRequestException(
          `Cannot complete SC: RM Item ${item.rmItemId} has ${item.unaccounted} unaccounted quantity.`,
        );
      }
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
    if (sc.status !== ScStatus.COMPLETED) {
      throw new BadRequestException(
        `SC "${sc.scNumber}" cannot be closed from status ${sc.status}. Must be COMPLETED first.`,
      );
    }

    sc.status = ScStatus.CLOSED;
    sc.completionRemarks = dto?.remarks
      ? `${sc.completionRemarks || ''} [Closed: ${dto.remarks}]`
      : sc.completionRemarks;

    return this.scRepo.save(sc);
  }
}
