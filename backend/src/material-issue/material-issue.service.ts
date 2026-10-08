import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  MaterialIssue,
  MaterialIssueType,
} from './entities/material-issue.entity.js';
import { MaterialIssueItem } from './entities/material-issue-item.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from '../inventory/entities/stock-transaction.entity.js';
import { CreateMaterialIssueDto } from './dto/material-issue.dto.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';
import { StateMachineValidator } from '../common/utils/state-machine-validator.js';
import { WorkflowNotificationService } from '../notifications/workflow-notification.service.js';
import { MslTriggerService } from '../inventory/msl-trigger.service.js';
import { AdditionalMaterialRequest, AdditionalRequestStatus } from '../additional-request/entities/additional-request.entity.js';

@Injectable()
export class MaterialIssueService {
  constructor(
    @InjectRepository(MaterialIssue)
    private readonly issueRepo: Repository<MaterialIssue>,
    @InjectRepository(MaterialIssueItem)
    private readonly issueItemRepo: Repository<MaterialIssueItem>,
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(RmItem)
    private readonly rmItemRepo: Repository<RmItem>,
    @InjectRepository(Bin)
    private readonly binRepo: Repository<Bin>,
    private readonly dataSource: DataSource,
    private readonly workflowNotificationService: WorkflowNotificationService,
    @Optional()
    private readonly mslTriggerService?: MslTriggerService,
  ) {}

  async createIssue(dto: CreateMaterialIssueDto, actorId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
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

    StateMachineValidator.assertScActive(sc.status, 'Material Issue');

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        `Material issue must contain at least one item.`,
      );
    }

    if (!dto.additionalRequestId) {
      if (
        sc.status !== ScStatus.STORES_PENDING &&
        sc.status !== ScStatus.PARTIALLY_ISSUED
      ) {
        throw new ConflictException(
          `Initial Material Issue cannot be processed for SC "${sc.scNumber}". Current status is already "${sc.status}". For additional material, submit an Additional Material Request.`,
        );
      }
    }

      let issueType = MaterialIssueType.INITIAL_ISSUE;
      let additionalReq: AdditionalMaterialRequest | null = null;
      if (dto.additionalRequestId) {
        additionalReq = await queryRunner.manager.findOne(AdditionalMaterialRequest, {
          where: { id: dto.additionalRequestId, scId: dto.scId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!additionalReq) {
          throw new BadRequestException(`Additional Request ${dto.additionalRequestId} not found or mismatch`);
        }
        if (additionalReq.status !== AdditionalRequestStatus.APPROVED) {
          throw new BadRequestException(`Additional Request is not APPROVED`);
        }
        issueType = MaterialIssueType.ADDITIONAL_ISSUE;
      }

      const issueNumber = `ISS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const issue = this.issueRepo.create({
        scId: dto.scId,
        issueNumber,
        issueType,
        additionalRequestId: dto.additionalRequestId,
        issuedById: actorId,
        remarks: dto.remarks,
      });

      const savedIssue = await queryRunner.manager.save(MaterialIssue, issue);
      const issueItems: MaterialIssueItem[] = [];
      const affectedProductIds = new Set<string>();

      // Deterministically sort items by binId and rmItemId to prevent lock-ordering deadlocks during concurrent issues
      const sortedItems = [...dto.items].sort((a, b) => {
        if (a.binId !== b.binId) return a.binId.localeCompare(b.binId);
        return a.rmItemId.localeCompare(b.rmItemId);
      });

      for (const itemDto of sortedItems) {
        QuantityCalculator.assertPositive(
          itemDto.quantityIssued,
          'Quantity Issued',
        );

        const rmItem = await queryRunner.manager.findOne(RmItem, {
          where: { id: itemDto.rmItemId },
          relations: { rmRequest: true },
        });
        if (!rmItem) {
          throw new NotFoundException(
            `RM Item "${itemDto.rmItemId}" not found.`,
          );
        }
        if (rmItem.scId !== dto.scId) {
          console.error('ERROR_LOG: createIssue mismatch', { rmItem_scId: rmItem.scId, dto_scId: dto.scId });
          throw new BadRequestException(
            `RM Item "${itemDto.rmItemId}" does not belong to SC "${dto.scId}".`,
          );
        }

        if (!dto.additionalRequestId && rmItem.rmRequest.status !== 'REVIEWED') {
          throw new BadRequestException(
            `RM Request must be REVIEWED before Material Issue. Current status: ${rmItem.rmRequest.status}`,
          );
        }
        if (!rmItem.mappedProductId) {
          throw new BadRequestException(
            `RM Item "${rmItem.id}" has no mapped Product. Stores Review must explicitly map it first.`,
          );
        }
        affectedProductIds.add(rmItem.mappedProductId);

        const bin = await queryRunner.manager.findOne(Bin, {
          where: { id: itemDto.binId },
        });
        if (!bin) {
          throw new NotFoundException(`Bin "${itemDto.binId}" not found.`);
        }
        if (!bin.isActive) {
          throw new BadRequestException(`Bin "${bin.code}" is inactive.`);
        }

        const requestedQty = QuantityCalculator.roundDecimal(
          itemDto.quantityIssued,
        );

        if (issueType === MaterialIssueType.INITIAL_ISSUE) {
          const sumRes = await queryRunner.manager.query(
            `SELECT COALESCE(SUM(mii.quantity_issued), 0) as total 
             FROM material_issue_items mii 
             JOIN material_issues mi ON mi.id = mii.material_issue_id 
             WHERE mii.rm_item_id = $1 AND mi.issue_type = 'INITIAL_ISSUE'`,
            [rmItem.id],
          );
          const alreadyIssued = Number(sumRes[0].total) || 0;
          const remainingAllowed = QuantityCalculator.roundDecimal(
            Number(rmItem.quantity) - alreadyIssued,
          );
          if (requestedQty > remainingAllowed) {
            throw new BadRequestException(
              `Cannot over-issue RM Item "${rmItem.id}". Total required: ${rmItem.quantity}, already issued: ${alreadyIssued}, remaining allowed: ${remainingAllowed}, attempted: ${requestedQty}`,
            );
          }
        }

        // Check bin stock balance targeting specifically the mapped product
        let balance = await queryRunner.manager.findOne(StockBalance, {
          where: { binId: itemDto.binId, productId: rmItem.mappedProductId },
        });

        const availQty = balance
          ? QuantityCalculator.roundDecimal(Number(balance.currentQuantity))
          : 0;

        QuantityCalculator.assertWithinLimit(
          requestedQty,
          availQty,
          `Insufficient stock for Product in bin "${bin.code}". Available: ${availQty}, Required: ${requestedQty}`,
        );

        // Atomic stock decrement matching product and bin
        const updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, updated_at = NOW() 
           WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1`,
          [requestedQty, itemDto.binId, rmItem.mappedProductId],
        );

        if (updateResult[1] === 0) {
          throw new BadRequestException(
            `Insufficient stock in bin "${bin.code}". Concurrency conflict or no balance found.`,
          );
        }

        // Log immutable StockTransaction
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.STORES_ISSUE,
          productId: rmItem.mappedProductId,
          sourceBinId: itemDto.binId,
          quantity: requestedQty,
          referenceType: 'MATERIAL_ISSUE',
          referenceId: savedIssue.id,
          remarks: itemDto.remarks || `Material issue for SC ${sc.scNumber}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

        // Update last_transaction_id on stock balance
        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, itemDto.binId, rmItem.mappedProductId],
        );

        const issueItem = queryRunner.manager.create(MaterialIssueItem, {
          materialIssueId: savedIssue.id,
          rmItemId: itemDto.rmItemId,
          quantityIssued: requestedQty,
          heatNumber: itemDto.heatNumber,
          batchNumber: itemDto.batchNumber,
          remarks: itemDto.remarks,
        });
        issueItems.push(
          await queryRunner.manager.save(MaterialIssueItem, issueItem),
        );
      }

      // Update statuses based on issue type
      if (issueType === MaterialIssueType.INITIAL_ISSUE) {
        // Calculate total requested quantity across all RM Items for this SC
        const allRmItems = await queryRunner.manager.find(RmItem, {
          where: { scId: dto.scId },
        });
        const totalRequested = allRmItems.reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        );

        // Calculate total issued quantity across all Material Issues of type INITIAL_ISSUE for this SC
        const sumResult = await queryRunner.manager.query(
          `SELECT SUM(mii.quantity_issued) as total 
           FROM material_issue_items mii 
           JOIN material_issues mi ON mi.id = mii.material_issue_id 
           WHERE mi.sc_id = $1 AND mi.issue_type = 'INITIAL_ISSUE'`,
          [dto.scId]
        );
        const totalIssued = Number(sumResult[0].total) || 0;

        // Update SC status
        if (totalIssued >= totalRequested) {
          sc.status = ScStatus.ISSUED;
        } else {
          sc.status = ScStatus.PARTIALLY_ISSUED;
        }
      } else if (issueType === MaterialIssueType.ADDITIONAL_ISSUE && additionalReq) {
        additionalReq.status = AdditionalRequestStatus.ISSUED;
        await queryRunner.manager.save(AdditionalMaterialRequest, additionalReq);
        // SC goes back to IN_PRODUCTION (or ISSUED if they haven't consumed yet)
        sc.status = ScStatus.IN_PRODUCTION; 
      }
      
      await queryRunner.manager.save(SalesOrderComponent, sc);

      await queryRunner.commitTransaction();

      // Post-commit event-driven MSL evaluation (safe & isolated)
      if (this.mslTriggerService && affectedProductIds.size > 0) {
        this.mslTriggerService
          .triggerProductsEvaluation(Array.from(affectedProductIds))
          .catch(() => {});
      }

      // Post-commit notification
      try {
        if (issueType === MaterialIssueType.ADDITIONAL_ISSUE && additionalReq) {
          await this.workflowNotificationService.notifyExtraMaterialIssued({
            id: savedIssue.id,
            scId: dto.scId,
            rmNumber: sc.scNumber,
            additionalRequestId: additionalReq.id,
            recipientUserId: additionalReq.requestedById,
          });
        } else {
          await this.workflowNotificationService.notifyMaterialIssued({
            id: savedIssue.id,
            scId: dto.scId,
            rmNumber: sc.scNumber,
          });
        }
      } catch (notifyErr: any) {
        console.error('Workflow notification for Material Issue failed post-commit:', notifyErr);
      }

      return this.findOne(savedIssue.id);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (
        error?.code === '23505' ||
        (error?.message && error.message.includes('UNIQUE constraint failed')) ||
        (error?.message && error.message.includes('idx_material_issue_initial'))
      ) {
        throw new ConflictException(
          `Initial Material Issue for SC "${dto.scId}" has already been processed.`,
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(scId?: string) {
    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.salesOrderComponent', 'sc')
      .leftJoinAndSelect('issue.items', 'items')
      .leftJoinAndSelect('items.rmItem', 'rmItem')
      .leftJoinAndSelect('issue.issuedBy', 'issuedBy')
      .leftJoinAndSelect('issue.receipts', 'receipts')
      .leftJoinAndSelect('receipts.items', 'receiptItems');

    if (scId) {
      qb.andWhere('issue.scId = :scId', { scId });
    }

    qb.orderBy('issue.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const issue = await this.issueRepo.findOne({
      where: { id },
      relations: {
        salesOrderComponent: true,
        items: { rmItem: true },
        issuedBy: true,
        receipts: { items: true },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Material Issue with ID "${id}" not found.`);
    }
    return issue;
  }
}
