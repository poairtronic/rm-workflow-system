import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MaterialIssue, MaterialIssueType } from './entities/material-issue.entity.js';
import { MaterialIssueItem } from './entities/material-issue-item.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { CreateMaterialIssueDto } from './dto/material-issue.dto.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';
import { StateMachineValidator } from '../common/utils/state-machine-validator.js';

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
  ) {}

  async createIssue(dto: CreateMaterialIssueDto, actorId: string) {
    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
    }

    StateMachineValidator.assertScActive(sc.status, 'Material Issue');

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(`Material issue must contain at least one item.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issueNumber = `ISS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const issue = this.issueRepo.create({
        scId: dto.scId,
        issueNumber,
        issueType: MaterialIssueType.INITIAL_ISSUE,
        issuedById: actorId,
        remarks: dto.remarks,
      });

      const savedIssue = await queryRunner.manager.save(MaterialIssue, issue);
      const issueItems: MaterialIssueItem[] = [];

      for (const itemDto of dto.items) {
        QuantityCalculator.assertPositive(itemDto.quantityIssued, 'Quantity Issued');

        const rmItem = await queryRunner.manager.findOne(RmItem, {
          where: { id: itemDto.rmItemId },
        });
        if (!rmItem) {
          throw new NotFoundException(`RM Item "${itemDto.rmItemId}" not found.`);
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

        // Check bin stock balance
        let balance = await queryRunner.manager.findOne(StockBalance, {
          where: { binId: itemDto.binId },
        });
        if (!balance && rmItem.material) {
          balance = await queryRunner.manager.findOne(StockBalance, {
            where: { id: itemDto.binId },
          });
        }

        const availQty = balance ? QuantityCalculator.roundDecimal(Number(balance.currentQuantity)) : 0;
        const requestedQty = QuantityCalculator.roundDecimal(itemDto.quantityIssued);

        QuantityCalculator.assertWithinLimit(
          requestedQty,
          availQty,
          `Insufficient stock in bin "${bin.code}". Available: ${availQty}, Required: ${requestedQty}`,
        );

        // Atomic stock decrement
        const updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, updated_at = NOW() 
           WHERE bin_id = $2 AND current_quantity >= $1`,
          [requestedQty, itemDto.binId],
        );

        if (updateResult[1] === 0) {
          throw new BadRequestException(`Insufficient stock in bin "${bin.code}".`);
        }

        // Log immutable StockTransaction
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.STORES_ISSUE,
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
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2`,
          [savedTx.id, itemDto.binId],
        );

        const issueItem = queryRunner.manager.create(MaterialIssueItem, {
          materialIssueId: savedIssue.id,
          rmItemId: itemDto.rmItemId,
          quantityIssued: requestedQty,
          heatNumber: itemDto.heatNumber,
          batchNumber: itemDto.batchNumber,
          remarks: itemDto.remarks,
        });
        issueItems.push(await queryRunner.manager.save(MaterialIssueItem, issueItem));
      }

      // Update SC status
      sc.status = ScStatus.ISSUED;
      await queryRunner.manager.save(SalesOrderComponent, sc);

      await queryRunner.commitTransaction();

      return this.findOne(savedIssue.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
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
      .leftJoinAndSelect('issue.issuedBy', 'issuedBy');

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
      },
    });

    if (!issue) {
      throw new NotFoundException(`Material Issue with ID "${id}" not found.`);
    }
    return issue;
  }
}

