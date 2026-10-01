import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GeneralIssue, GeneralIssueStatus } from './entities/general-issue.entity.js';
import { GeneralIssueItem } from './entities/general-issue-item.entity.js';
import { CreateGeneralIssueDto } from './dto/general-issue.dto.js';
import { MslTriggerService } from '../inventory/msl-trigger.service.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';

@Injectable()
export class GeneralIssueService {
  constructor(
    @InjectRepository(GeneralIssue)
    private readonly issueRepo: Repository<GeneralIssue>,
    @InjectRepository(GeneralIssueItem)
    private readonly issueItemRepo: Repository<GeneralIssueItem>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly mslTriggerService?: MslTriggerService,
  ) {}

  async createIssue(dto: CreateGeneralIssueDto, actorId: string): Promise<GeneralIssue> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validation: Item presence & non-emptiness
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('General issue must contain at least one item.');
      }

      // Check for duplicate items targeting the same product & bin combination
      const itemCombinations = new Set<string>();
      for (const item of dto.items) {
        const comboKey = `${item.productId}:${item.binId}`;
        if (itemCombinations.has(comboKey)) {
          throw new BadRequestException(
            `Duplicate item entry for product "${item.productId}" and bin "${item.binId}" in the same request.`,
          );
        }
        itemCombinations.add(comboKey);
      }

      // 2. Business Rule: SC/PO optional validation
      let scRecord: SalesOrderComponent | null = null;
      let poRecord: PurchaseOrder | null = null;

      if (dto.scId) {
        scRecord = await queryRunner.manager.findOne(SalesOrderComponent, {
          where: { id: dto.scId },
        });
        if (!scRecord) {
          throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
        }
      }

      if (dto.poId) {
        poRecord = await queryRunner.manager.findOne(PurchaseOrder, {
          where: { id: dto.poId },
        });
        if (!poRecord) {
          throw new NotFoundException(`Purchase Order with ID "${dto.poId}" not found.`);
        }
      }

      // If both SC and PO are provided, verify that the SC belongs to the PO
      if (scRecord && poRecord) {
        if (scRecord.poId !== poRecord.id) {
          throw new BadRequestException(
            `Sales Order Component "${scRecord.scNumber}" does not belong to Purchase Order "${poRecord.poNumber}".`,
          );
        }
      }

      const issueNumber = `GEN-ISS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      // 3. Create General Issue record (direct issuance without approval gate)
      const issue = this.issueRepo.create({
        issueNumber,
        scId: dto.scId || null,
        poId: dto.poId || null,
        department: dto.department,
        requester: dto.requester,
        reason: dto.reason,
        externalReference: dto.externalReference,
        remarks: dto.remarks,
        status: GeneralIssueStatus.ISSUED,
        issuedById: actorId,
      });

      const savedIssue = await queryRunner.manager.save(GeneralIssue, issue);
      const issueItems: GeneralIssueItem[] = [];

      // Sort items deterministically by binId and productId to prevent deadlocks
      const sortedItems = [...dto.items].sort((a, b) => {
        if (a.binId !== b.binId) return a.binId.localeCompare(b.binId);
        return a.productId.localeCompare(b.productId);
      });

      for (const itemDto of sortedItems) {
        // Server-side quantity validation
        QuantityCalculator.assertPositive(itemDto.quantityIssued, 'Quantity Issued');
        const requestedQty = QuantityCalculator.roundDecimal(itemDto.quantityIssued);

        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemDto.productId },
        });
        if (!product) {
          throw new NotFoundException(`Product "${itemDto.productId}" not found.`);
        }
        if (!product.isActive) {
          throw new BadRequestException(`Product "${product.name}" is inactive.`);
        }

        const bin = await queryRunner.manager.findOne(Bin, {
          where: { id: itemDto.binId },
        });
        if (!bin) {
          throw new NotFoundException(`Bin "${itemDto.binId}" not found.`);
        }
        if (!bin.isActive) {
          throw new BadRequestException(`Bin "${bin.code}" is inactive.`);
        }

        // Available quantity check
        const balance = await queryRunner.manager.findOne(StockBalance, {
          where: { binId: itemDto.binId, productId: itemDto.productId },
        });

        const availQty = balance
          ? QuantityCalculator.roundDecimal(Number(balance.currentQuantity))
          : 0;

        QuantityCalculator.assertWithinLimit(
          requestedQty,
          availQty,
          `Insufficient stock for Product "${product.name}" in bin "${bin.code}". Available: ${availQty}, Required: ${requestedQty}`,
        );

        // Atomic stock deduction with concurrency guard (ensures no negative stock)
        const updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, updated_at = NOW() 
           WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1`,
          [requestedQty, itemDto.binId, itemDto.productId],
        );

        if (updateResult[1] === 0) {
          throw new BadRequestException(
            `Insufficient stock in bin "${bin.code}". Concurrency conflict or no balance found.`,
          );
        }

        // Create immutable transaction ledger record
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.STOCK_OUT,
          productId: itemDto.productId,
          sourceBinId: itemDto.binId,
          quantity: requestedQty,
          referenceType: 'GENERAL_ISSUE',
          referenceId: savedIssue.id,
          remarks: itemDto.remarks || `General issue ${issueNumber}: ${dto.reason}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

        // Update last_transaction_id in stock balance
        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, itemDto.binId, itemDto.productId],
        );

        const issueItem = queryRunner.manager.create(GeneralIssueItem, {
          generalIssueId: savedIssue.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          quantityIssued: requestedQty,
          remarks: itemDto.remarks,
        });
        issueItems.push(await queryRunner.manager.save(GeneralIssueItem, issueItem));
      }

      await queryRunner.commitTransaction();

      // Post-commit event-driven MSL evaluation (safe & isolated)
      if (this.mslTriggerService) {
        const productIds = dto.items.map((i) => i.productId);
        this.mslTriggerService.triggerProductsEvaluation(productIds).catch(() => {});
      }

      return (await this.findOne(savedIssue.id))!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<GeneralIssue[]> {
    return this.issueRepo.find({
      relations: {
        issuedBy: true,
        salesOrderComponent: true,
        purchaseOrder: true,
        items: {
          product: true,
          bin: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<GeneralIssue> {
    const issue = await this.issueRepo.findOne({
      where: { id },
      relations: {
        items: {
          product: true,
          bin: true,
        },
        issuedBy: true,
        salesOrderComponent: true,
        purchaseOrder: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`General Issue with ID "${id}" not found.`);
    }
    return issue;
  }

  async cancelIssue(id: string, actorId: string, remarks?: string): Promise<GeneralIssue> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock parent row without joins to satisfy PostgreSQL FOR UPDATE rules
      const issue = await queryRunner.manager.findOne(GeneralIssue, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!issue) {
        throw new NotFoundException(`General Issue with ID "${id}" not found.`);
      }

      // Check whether issued quantity can be reversed
      if (issue.status === GeneralIssueStatus.CANCELLED) {
        throw new BadRequestException(`General Issue "${issue.issueNumber}" is already cancelled.`);
      }

      // Load items
      const items = await queryRunner.manager.find(GeneralIssueItem, {
        where: { generalIssueId: id },
      });
      issue.items = items;

      issue.status = GeneralIssueStatus.CANCELLED;
      const cancellationNote = remarks ? `[Cancelled by ${actorId}]: ${remarks}` : `[Cancelled by ${actorId}]`;
      issue.remarks = issue.remarks ? `${issue.remarks}\n${cancellationNote}` : cancellationNote;
      await queryRunner.manager.save(GeneralIssue, issue);

      // Reversal: How cancelled transactions affect stock
      for (const item of issue.items) {
        const qty = QuantityCalculator.roundDecimal(Number(item.quantityIssued));

        // Refund stock back to the original source bin
        const updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity + $1, updated_at = NOW() 
           WHERE bin_id = $2 AND product_id = $3`,
          [qty, item.binId, item.productId],
        );

        // If no stock balance row existed, create one
        if (updateResult[1] === 0) {
          const newBalance = queryRunner.manager.create(StockBalance, {
            binId: item.binId,
            productId: item.productId,
            currentQuantity: qty,
            openingBalance: 0,
          });
          await queryRunner.manager.save(StockBalance, newBalance);
        }

        // Ledger: Create immutable refund transaction
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.RETURN,
          productId: item.productId,
          destinationBinId: item.binId,
          quantity: qty,
          referenceType: 'GENERAL_ISSUE_CANCEL',
          referenceId: issue.id,
          remarks: `Cancellation of issue ${issue.issueNumber}: ${remarks || 'Stock reversed'}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, item.binId, item.productId],
        );
      }

      await queryRunner.commitTransaction();

      // Post-commit event-driven MSL evaluation (safe & isolated)
      if (this.mslTriggerService && items && items.length > 0) {
        const productIds = items.map((i) => i.productId);
        this.mslTriggerService.triggerProductsEvaluation(productIds).catch(() => {});
      }

      return (await this.findOne(id))!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
