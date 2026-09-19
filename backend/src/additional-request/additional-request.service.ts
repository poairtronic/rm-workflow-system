import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdditionalMaterialRequest,
  AdditionalRequestStatus,
  AdditionalReason,
} from './entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from './entities/additional-request-item.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { CreateAdditionalRequestDto } from './dto/additional-request.dto.js';

@Injectable()
export class AdditionalRequestService {
  constructor(
    @InjectRepository(AdditionalMaterialRequest)
    private readonly requestRepo: Repository<AdditionalMaterialRequest>,
    @InjectRepository(AdditionalMaterialRequestItem)
    private readonly requestItemRepo: Repository<AdditionalMaterialRequestItem>,
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(RmItem)
    private readonly rmItemRepo: Repository<RmItem>,
  ) {}

  async createRequest(dto: CreateAdditionalRequestDto, actorId: string) {
    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(
        `Sales Order Component with ID "${dto.scId}" not found.`,
      );
    }

    if (sc.status === ScStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot request additional material for a COMPLETED SC.`,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        `Additional request must contain at least one item.`,
      );
    }

    const request = this.requestRepo.create({
      scId: dto.scId,
      requestedById: actorId,
      status: AdditionalRequestStatus.REQUESTED,
      reason: dto.reason || AdditionalReason.ADDITIONAL_REQUIREMENT,
      remarks: dto.remarks,
    });
    const savedRequest = await this.requestRepo.save(request);

    for (const itemDto of dto.items) {
      // Validate rmItemId belongs to the given scId
      const rmItem = await this.rmItemRepo.findOneBy({
        id: itemDto.rmItemId,
        scId: dto.scId,
      });
      if (!rmItem) {
        throw new BadRequestException(
          `RM Item "${itemDto.rmItemId}" not found or does not belong to SC "${dto.scId}".`,
        );
      }

      const item = this.requestItemRepo.create({
        requestId: savedRequest.id,
        rmItemId: itemDto.rmItemId,
        quantityRequested: itemDto.quantity,
        remarks: itemDto.remarks,
      });
      await this.requestItemRepo.save(item);
    }

    sc.status = ScStatus.ADDITIONAL_REQUEST;
    await this.scRepo.save(sc);

    // CRITICAL: Additional material request DOES NOT alter inventory stock
    return this.findOne(savedRequest.id);
  }

  async findAll(scId?: string) {
    const qb = this.requestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.salesOrderComponent', 'sc')
      .leftJoinAndSelect('req.items', 'items')
      .leftJoinAndSelect('items.rmItem', 'rmItem')
      .leftJoinAndSelect('req.requestedBy', 'requestedBy');

    if (scId) {
      qb.andWhere('req.scId = :scId', { scId });
    }

    qb.orderBy('req.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: {
        salesOrderComponent: true,
        items: { rmItem: true },
        requestedBy: true,
        approvedBy: true,
      },
    });

    if (!request) {
      throw new NotFoundException(
        `Additional Material Request with ID "${id}" not found.`,
      );
    }
    return request;
  }
}
