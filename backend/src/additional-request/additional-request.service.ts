import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
import { RmRequest, RmRequestStatus } from '../rm/entities/rm-request.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { CreateAdditionalRequestDto } from './dto/additional-request.dto.js';
import { WorkflowNotificationService } from '../notifications/workflow-notification.service.js';

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
    private readonly workflowNotificationService: WorkflowNotificationService,
  ) {}

  async createRequest(dto: CreateAdditionalRequestDto, actorId: string) {
    const queryRunner = this.scRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sc = await queryRunner.manager.findOne(SalesOrderComponent, {
        where: { id: dto.scId },
        lock: { mode: 'pessimistic_write' },
      });

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

      const request = queryRunner.manager.create(AdditionalMaterialRequest, {
        scId: dto.scId,
        requestedById: actorId,
        status: AdditionalRequestStatus.REQUESTED,
        reason: dto.reason || AdditionalReason.ADDITIONAL_REQUIREMENT,
        remarks: dto.remarks,
      });
      const savedRequest = await queryRunner.manager.save(AdditionalMaterialRequest, request);

      for (const itemDto of dto.items) {
        let rmItem: RmItem | null = null;

        if (itemDto.rmItemId) {
          rmItem = await queryRunner.manager.findOne(RmItem, {
            where: {
              id: itemDto.rmItemId,
              scId: dto.scId,
            },
          });
        }

        // If no rmItemId or if productId is provided (e.g. screws, pins, hardware requested by Production)
        if (!rmItem && itemDto.productId) {
          rmItem = await queryRunner.manager.findOne(RmItem, {
            where: {
              scId: dto.scId,
              mappedProductId: itemDto.productId,
            },
          });

          if (!rmItem) {
            let rmRequest = await queryRunner.manager.findOne(RmRequest, {
              where: { scId: dto.scId },
            });

            if (!rmRequest) {
              rmRequest = queryRunner.manager.create(RmRequest, {
                scId: dto.scId,
                status: RmRequestStatus.REVIEWED,
                createdById: actorId,
              });
              rmRequest = await queryRunner.manager.save(RmRequest, rmRequest);
            }

            const product = await queryRunner.manager.findOne(Product, {
              where: { id: itemDto.productId },
            });

            if (!product) {
              throw new NotFoundException(`Product with ID "${itemDto.productId}" not found.`);
            }

            rmItem = queryRunner.manager.create(RmItem, {
              scId: dto.scId,
              rmFormId: rmRequest.id,
              material: product.name,
              mappedProductId: product.id,
              materialType: 'COMPONENT',
              grade: product.code || 'STANDARD',
              size: product.uom || 'STD',
              quantity: 0,
              remarks: itemDto.remarks || 'Production Extra Request Item',
            });
            rmItem = await queryRunner.manager.save(RmItem, rmItem);
          }
        }

        if (!rmItem) {
          throw new BadRequestException(
            `Either a valid rmItemId or productId is required for requesting extra material on SC "${dto.scId}".`,
          );
        }

        const reqQty = itemDto.quantityRequested ?? itemDto.quantity;
        if (reqQty == null) {
          throw new BadRequestException(
            `Quantity or quantityRequested is required for RM Item "${rmItem.id}".`,
          );
        }

        const item = queryRunner.manager.create(AdditionalMaterialRequestItem, {
          requestId: savedRequest.id,
          rmItemId: rmItem.id,
          quantityRequested: reqQty,
          remarks: itemDto.remarks,
        });
        await queryRunner.manager.save(AdditionalMaterialRequestItem, item);
      }

      sc.status = ScStatus.ADDITIONAL_REQUEST;
      await queryRunner.manager.save(SalesOrderComponent, sc);

      await queryRunner.commitTransaction();

      // Post-commit notification for ADDITIONAL_REQUEST
      try {
        await this.workflowNotificationService.notifyAdditionalRequest({
          id: savedRequest.id,
          scId: dto.scId,
          rmNumber: sc.scNumber,
          requestedById: actorId,
        });
      } catch (notifyErr: any) {
        console.error('Workflow notification for ADDITIONAL_REQUEST failed post-commit:', notifyErr);
      }

      // CRITICAL: Additional material request DOES NOT alter inventory stock
      return this.findOne(savedRequest.id);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (
        error?.code === '23505' ||
        (error?.message && error.message.includes('UNIQUE constraint failed')) ||
        (error?.message && error.message.includes('idx_single_active_request'))
      ) {
        throw new ConflictException(
          `An active additional material request already exists for this SC.`,
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
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

  async approveRequest(id: string, actorId: string) {
    const queryRunner = this.scRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(AdditionalMaterialRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(`Additional Request with ID "${id}" not found.`);
      }

      if (request.status !== AdditionalRequestStatus.REQUESTED) {
        throw new BadRequestException(`Cannot approve request in status ${request.status}`);
      }

      request.status = AdditionalRequestStatus.APPROVED;
      request.approvedById = actorId;
      request.approvedAt = new Date();

      await queryRunner.manager.save(AdditionalMaterialRequest, request);
      await queryRunner.commitTransaction();

      // Post-commit notification for EXTRA_MATERIAL_APPROVED
      if (this.workflowNotificationService) {
        try {
          const sc = await this.scRepo.findOne({ where: { id: request.scId } });
          await this.workflowNotificationService.notifyExtraMaterialApproved({
            id: request.id,
            scId: request.scId,
            rmNumber: sc?.scNumber || request.scId,
            recipientUserId: request.requestedById,
          });
        } catch (notifyErr: any) {
          console.error('Workflow notification for EXTRA_MATERIAL_APPROVED failed post-commit:', notifyErr);
        }
      }

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectRequest(id: string, actorId: string) {
    const queryRunner = this.scRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(AdditionalMaterialRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(`Additional Request with ID "${id}" not found.`);
      }

      if (request.status !== AdditionalRequestStatus.REQUESTED) {
        throw new BadRequestException(`Cannot reject request in status ${request.status}`);
      }

      request.status = AdditionalRequestStatus.REJECTED;
      request.approvedById = actorId;
      request.approvedAt = new Date();
      await queryRunner.manager.save(AdditionalMaterialRequest, request);

      // Revert SC status
      const sc = await queryRunner.manager.findOne(SalesOrderComponent, {
        where: { id: request.scId },
        lock: { mode: 'pessimistic_write' }
      });
      if (!sc) {
        throw new NotFoundException(`SC with ID "${request.scId}" not found.`);
      }
      if (sc.status === ScStatus.ADDITIONAL_REQUEST) {
        sc.status = ScStatus.IN_PRODUCTION;
        await queryRunner.manager.save(SalesOrderComponent, sc);
      }

      await queryRunner.commitTransaction();

      // Post-commit notification for EXTRA_MATERIAL_REJECTED
      if (this.workflowNotificationService) {
        try {
          await this.workflowNotificationService.notifyExtraMaterialRejected({
            id: request.id,
            scId: request.scId,
            rmNumber: sc.scNumber,
            recipientUserId: request.requestedById,
          });
        } catch (notifyErr: any) {
          console.error('Workflow notification for EXTRA_MATERIAL_REJECTED failed post-commit:', notifyErr);
        }
      }

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
