import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RmRequest, RmRequestStatus, FormType } from './entities/rm-request.entity.js';
import { RmItem } from './entities/rm-item.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { CreateRmDto, CreateRmItemDto, SubmitRmDto } from './dto/rm.dto.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';
import { StateMachineValidator } from '../common/utils/state-machine-validator.js';

@Injectable()
export class RmService {
  constructor(
    @InjectRepository(RmRequest)
    private readonly rmRepo: Repository<RmRequest>,
    @InjectRepository(RmItem)
    private readonly rmItemRepo: Repository<RmItem>,
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
  ) {}

  async createRm(dto: CreateRmDto, actorId: string) {
    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
    }

    const existingRm = await this.rmRepo.findOneBy({ scId: dto.scId });
    if (existingRm) {
      throw new ConflictException(`RM Request already exists for SC "${sc.scNumber}".`);
    }

    const rm = this.rmRepo.create({
      scId: dto.scId,
      formType: FormType.SC,
      createdById: actorId,
      status: RmRequestStatus.DRAFT,
      remarks: dto.remarks,
    });

    // CRITICAL: RM Creation MUST NOT change stock!
    return this.rmRepo.save(rm);
  }

  async addRmItem(rmId: string, dto: CreateRmItemDto) {
    const rm = await this.rmRepo.findOne({
      where: { id: rmId },
      relations: { items: true },
    });
    if (!rm) {
      throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
    }

    StateMachineValidator.assertRmDraft(rm.status, 'add items');

    const item = this.rmItemRepo.create({
      rmFormId: rm.id,
      scId: rm.scId,
      material: dto.material.trim(),
      materialType: dto.materialType || 'ROUND_BAR',
      grade: dto.grade.trim(),
      quantity: QuantityCalculator.roundDecimal(dto.quantity),
      size: dto.size.trim(),
      length: dto.length,
      width: dto.width,
      thickness: dto.thickness,
      diameter: dto.diameter,
      weight: dto.weight,
      weightUnit: dto.weightUnit || 'KG',
      remarks: dto.remarks?.trim(),
    });

    return this.rmItemRepo.save(item);
  }

  async submitRm(rmId: string, dto?: SubmitRmDto) {
    const rm = await this.rmRepo.findOne({
      where: { id: rmId },
      relations: { items: true, salesOrderComponent: true },
    });
    if (!rm) {
      throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
    }

    if (!rm.items || rm.items.length === 0) {
      throw new BadRequestException(`Cannot submit an RM Request without any Material Items.`);
    }

    StateMachineValidator.assertRmDraft(rm.status, 'submit RM Request');

    rm.status = RmRequestStatus.SUBMITTED;
    rm.submittedAt = new Date();
    if (dto?.remarks) {
      rm.remarks = `${rm.remarks || ''} [Submit: ${dto.remarks}]`;
    }

    if (rm.salesOrderComponent) {
      rm.salesOrderComponent.status = ScStatus.SUBMITTED;
      await this.scRepo.save(rm.salesOrderComponent);
    }

    // CRITICAL: RM Submission MUST NOT change stock!
    return this.rmRepo.save(rm);
  }

  async findAll(query?: { scId?: string; status?: RmRequestStatus }) {
    const qb = this.rmRepo
      .createQueryBuilder('rm')
      .leftJoinAndSelect('rm.salesOrderComponent', 'sc')
      .leftJoinAndSelect('rm.items', 'items')
      .leftJoinAndSelect('rm.createdBy', 'createdBy');

    if (query?.scId) {
      qb.andWhere('rm.scId = :scId', { scId: query.scId });
    }
    if (query?.status) {
      qb.andWhere('rm.status = :status', { status: query.status });
    }

    qb.orderBy('rm.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const rm = await this.rmRepo.findOne({
      where: { id },
      relations: {
        salesOrderComponent: { purchaseOrder: true },
        items: { materialIssues: true, materialConsumptions: true, materialReturns: true },
        createdBy: true,
      },
    });

    if (!rm) {
      throw new NotFoundException(`RM Request with ID "${id}" not found.`);
    }
    return rm;
  }
}
