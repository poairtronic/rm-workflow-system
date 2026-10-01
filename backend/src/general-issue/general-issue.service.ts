import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GeneralIssue, GeneralIssueStatus } from './entities/general-issue.entity.js';
import { GeneralIssueItem } from './entities/general-issue-item.entity.js';
import { CreateGeneralIssueDto } from './dto/general-issue.dto.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';

@Injectable()
export class GeneralIssueService {
  constructor(
    @InjectRepository(GeneralIssue)
    private readonly issueRepo: Repository<GeneralIssue>,
    @InjectRepository(GeneralIssueItem)
    private readonly issueItemRepo: Repository<GeneralIssueItem>,
    private readonly dataSource: DataSource,
  ) {}

  async createIssue(dto: CreateGeneralIssueDto, actorId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException(`General issue must contain at least one item.`);
      }

      const issueNumber = `GEN-ISS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const issue = this.issueRepo.create({
        issueNumber,
        department: dto.department,
        requester: dto.requester,
        reason: dto.reason,
        externalReference: dto.externalReference,
        remarks: dto.remarks,
        issuedById: actorId,
      });

      const savedIssue = await queryRunner.manager.save(GeneralIssue, issue);
      const issueItems: GeneralIssueItem[] = [];

      // Sort items by binId and productId to prevent deadlocks
      const sortedItems = [...dto.items].sort((a, b) => {
        if (a.binId !== b.binId) return a.binId.localeCompare(b.binId);
        return a.productId.localeCompare(b.productId);
      });

      for (const itemDto of sortedItems) {
        QuantityCalculator.assertPositive(itemDto.quantityIssued, 'Quantity Issued');

        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemDto.productId },
        });
        if (!product) {
          throw new NotFoundException(`Product "${itemDto.productId}" not found.`);
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

        let balance = await queryRunner.manager.findOne(StockBalance, {
          where: { binId: itemDto.binId, productId: itemDto.productId },
        });

        const availQty = balance ? QuantityCalculator.roundDecimal(Number(balance.currentQuantity)) : 0;
        const requestedQty = QuantityCalculator.roundDecimal(itemDto.quantityIssued);

        QuantityCalculator.assertWithinLimit(
          requestedQty,
          availQty,
          `Insufficient stock for Product in bin "${bin.code}". Available: ${availQty}, Required: ${requestedQty}`,
        );

        // Atomic stock decrement
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

        // Ledger transaction
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.STOCK_OUT, // General issue uses STOCK_OUT
          productId: itemDto.productId,
          sourceBinId: itemDto.binId,
          quantity: requestedQty,
          referenceType: 'GENERAL_ISSUE',
          referenceId: savedIssue.id,
          remarks: itemDto.remarks || `General issue: ${dto.reason}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

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

      // Fire workflow notification? Or MSL trigger? We can trigger MSL engine later.

      return this.findOne(savedIssue.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.issueRepo.find({
      relations: {
        issuedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelIssue(id: string, actorId: string, remarks?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issue = await queryRunner.manager.findOne(GeneralIssue, {
        where: { id },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!issue) {
        throw new NotFoundException(`General Issue with ID "${id}" not found.`);
      }

      if (issue.status === GeneralIssueStatus.CANCELLED) {
        throw new BadRequestException(`General Issue "${issue.issueNumber}" is already cancelled.`);
      }

      issue.status = GeneralIssueStatus.CANCELLED;
      issue.remarks = issue.remarks ? `${issue.remarks}\n[Cancelled]: ${remarks}` : `[Cancelled]: ${remarks}`;
      await queryRunner.manager.save(GeneralIssue, issue);

      for (const item of issue.items) {
        const qty = Number(item.quantityIssued);

        // Refund stock
        await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity + $1, updated_at = NOW() 
           WHERE bin_id = $2 AND product_id = $3`,
          [qty, item.binId, item.productId],
        );

        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.STOCK_IN,
          productId: item.productId,
          destinationBinId: item.binId,
          quantity: qty,
          referenceType: 'GENERAL_ISSUE_CANCEL',
          referenceId: issue.id,
          remarks: `Cancellation of issue ${issue.issueNumber}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, item.binId, item.productId],
        );
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: string) {
    const issue = await this.issueRepo.findOne({
      where: { id },
      relations: {
        items: {
          product: true,
          bin: true,
        },
        issuedBy: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`General Issue with ID "${id}" not found.`);
    }
    return issue;
  }
}
