import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RmRequest, RmRequestStatus, FormType } from './entities/rm-request.entity.js';
import { RmItem, AvailabilityStatus } from './entities/rm-item.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { CreateRmDto, CreateRmItemDto, SubmitRmDto } from './dto/rm.dto.js';
import { StoresReviewRmDto } from './dto/stores-review.dto.js';
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
    private readonly dataSource: DataSource,
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

  async reviewRm(rmId: string, dto: StoresReviewRmDto, actorId: string) {
    const rm = await this.rmRepo.findOne({
      where: { id: rmId },
      relations: { items: true },
    });
    if (!rm) {
      throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
    }

    if (rm.status !== RmRequestStatus.SUBMITTED && rm.status !== RmRequestStatus.REVIEWED) {
      throw new BadRequestException(`RM Request must be SUBMITTED to be reviewed. Current status: ${rm.status}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const mapping of dto.itemMappings) {
        const item = rm.items.find(i => i.id === mapping.rmItemId);
        if (!item) {
          throw new BadRequestException(`RM Item "${mapping.rmItemId}" does not belong to this RM Request.`);
        }

        if (mapping.productId) {
          const balances = await queryRunner.manager.find(StockBalance, {
            where: { productId: mapping.productId },
          });

          const totalAvailable = balances.reduce((sum, b) => sum + Number(b.currentQuantity), 0);
          const reqQty = Number(item.quantity);

          item.mappedProductId = mapping.productId;
          item.availableQuantitySnapshot = totalAvailable;

          if (totalAvailable >= reqQty) {
            item.availabilityStatus = AvailabilityStatus.AVAILABLE;
          } else if (totalAvailable > 0) {
            item.availabilityStatus = AvailabilityStatus.PARTIAL;
          } else {
            item.availabilityStatus = AvailabilityStatus.NOT_AVAILABLE;
          }
        } else {
          item.mappedProductId = undefined;
          item.availableQuantitySnapshot = 0;
          item.availabilityStatus = AvailabilityStatus.NOT_AVAILABLE;
        }

        await queryRunner.manager.save(RmItem, item);
      }

      rm.status = RmRequestStatus.REVIEWED;
      rm.reviewedAt = new Date();
      rm.reviewedById = actorId;
      if (dto.remarks) {
        rm.remarks = `${rm.remarks || ''} [Review: ${dto.remarks}]`;
      }

      await queryRunner.manager.save(RmRequest, rm);
      await queryRunner.commitTransaction();

      return this.findOne(rmId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
