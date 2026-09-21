import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  MaterialReceipt,
  ReceiptStatus,
} from './entities/production-receipt.entity.js';
import { MaterialReceiptItem } from './entities/material-receipt-item.entity.js';
import { MaterialConsumption } from './entities/material-consumption.entity.js';
import {
  MaterialReturn,
  ReturnStatus,
} from './entities/material-return.entity.js';
import { MaterialReturnItem } from './entities/material-return-item.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from '../inventory/entities/stock-transaction.entity.js';
import {
  CreateProductionReceiptDto,
  CreateMaterialConsumptionDto,
  CreateMaterialReturnDto,
  VerifyReturnDto,
} from './dto/production.dto.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';
import { StateMachineValidator } from '../common/utils/state-machine-validator.js';

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(MaterialReceipt)
    private readonly receiptRepo: Repository<MaterialReceipt>,
    @InjectRepository(MaterialReceiptItem)
    private readonly receiptItemRepo: Repository<MaterialReceiptItem>,
    @InjectRepository(MaterialConsumption)
    private readonly consumptionRepo: Repository<MaterialConsumption>,
    @InjectRepository(MaterialReturn)
    private readonly returnRepo: Repository<MaterialReturn>,
    @InjectRepository(MaterialReturnItem)
    private readonly returnItemRepo: Repository<MaterialReturnItem>,
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(MaterialIssue)
    private readonly issueRepo: Repository<MaterialIssue>,
    @InjectRepository(RmItem)
    private readonly rmItemRepo: Repository<RmItem>,
    @InjectRepository(Bin)
    private readonly binRepo: Repository<Bin>,
    private readonly dataSource: DataSource,
  ) {}

  async receiveMaterial(dto: CreateProductionReceiptDto, actorId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock the Material Issue to serialize all receipts for it
      const issue = await queryRunner.manager.findOne(MaterialIssue, {
        where: { id: dto.materialIssueId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!issue) {
        throw new NotFoundException(
          `Material Issue with ID "${dto.materialIssueId}" not found.`,
        );
      }

      const issueWithRelations = await queryRunner.manager.findOne(MaterialIssue, {
        where: { id: issue.id },
        relations: { salesOrderComponent: true, items: true },
      });

      const sc = issueWithRelations!.salesOrderComponent;
      if (dto.scId && sc.id !== dto.scId) {
        throw new BadRequestException(
          `Material Issue "${issue.id}" does not belong to SC "${dto.scId}".`,
        );
      }
      StateMachineValidator.assertScActive(sc.status, 'Receive Material');

      // 2. Prevent over-receipt by querying all existing receipts for this issue within the transaction
      const existingReceipts = await queryRunner.manager.find(MaterialReceipt, {
        where: { materialIssueId: issue.id },
        relations: { items: true },
      });

      const receipt = this.receiptRepo.create({
        materialIssueId: issue.id,
        receivedById: actorId,
        status: ReceiptStatus.RECEIVED,
        remarks: dto.remarks,
        idempotencyKey: dto.idempotencyKey,
      });
      const savedReceipt = await queryRunner.manager.save(
        MaterialReceipt,
        receipt,
      );

      let hasPartial = false;

      for (const itemDto of dto.items) {
        QuantityCalculator.assertPositive(
          itemDto.quantityReceived,
          'Quantity Received',
        );

        const issueItem = issueWithRelations!.items.find(
          (i) => i.rmItemId === itemDto.rmItemId,
        );
        if (!issueItem) {
          throw new BadRequestException(
            `RM Item "${itemDto.rmItemId}" was not part of Material Issue "${issue.id}".`,
          );
        }

        let prevReceived = 0;
        for (const er of existingReceipts) {
          for (const eri of er.items) {
            if (eri.rmItemId === itemDto.rmItemId) {
              prevReceived += Number(eri.quantityReceived);
            }
          }
        }

        const maxAllowed = QuantityCalculator.roundDecimal(
          Number(issueItem.quantityIssued) - prevReceived,
        );
        if (maxAllowed <= 0) {
          throw new BadRequestException(
            `Material Issue for RM Item "${itemDto.rmItemId}" has already been fully received.`,
          );
        }

        const receivedQty = QuantityCalculator.roundDecimal(
          itemDto.quantityReceived,
        );
        QuantityCalculator.assertWithinLimit(
          receivedQty,
          maxAllowed,
          `Cannot receive more than issued. Remaining to receive: ${maxAllowed}`,
        );

        if (receivedQty < maxAllowed) {
          hasPartial = true;
        }

        const receiptItem = this.receiptItemRepo.create({
          materialReceiptId: savedReceipt.id,
          rmItemId: itemDto.rmItemId,
          quantityReceived: receivedQty,
          remarks: itemDto.remarks,
        });
        await queryRunner.manager.save(MaterialReceiptItem, receiptItem);
      }

      if (hasPartial) {
        savedReceipt.status = ReceiptStatus.PARTIAL;
        await queryRunner.manager.save(MaterialReceipt, savedReceipt);
      }

      if (sc.status !== ScStatus.IN_PRODUCTION) {
        sc.status = ScStatus.IN_PRODUCTION;
        await queryRunner.manager.save(SalesOrderComponent, sc);
      }

      await queryRunner.commitTransaction();

      // CRITICAL: Production receipt DOES NOT alter inventory stock
      return this.receiptRepo.findOne({
        where: { id: savedReceipt.id },
        relations: { items: { rmItem: true }, receivedBy: true },
      });
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (
        error?.code === '23505' ||
        (error?.message && error.message.includes('UNIQUE constraint failed')) ||
        (error?.message && error.message.includes('idempotency_key'))
      ) {
        throw new ConflictException(
          `Production receipt with this idempotency key has already been processed.`,
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async recordConsumption(dto: CreateMaterialConsumptionDto, actorId: string) {
    QuantityCalculator.assertPositive(
      dto.quantityConsumed,
      'Quantity Consumed',
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock the SC to serialize all consumption for this component
      const sc = await queryRunner.manager
        .createQueryBuilder(SalesOrderComponent, 'sc')
        .where('sc.id = :id', { id: dto.scId })
        .setLock('pessimistic_write')
        .getOne();

      if (!sc) {
        throw new NotFoundException(
          `Sales Order Component with ID "${dto.scId}" not found.`,
        );
      }

      StateMachineValidator.assertScActive(sc.status, 'Record Consumption');

      const rmItem = await queryRunner.manager.findOneBy(RmItem, {
        id: dto.rmItemId,
      });
      if (!rmItem) {
        throw new NotFoundException(`RM Item "${dto.rmItemId}" not found.`);
      }

      if (rmItem.scId !== dto.scId) {
        require('fs').appendFileSync('debug_sc.txt', JSON.stringify({ location: 'consume', rmItem, dto }) + '\n');
        throw new BadRequestException(
          `RM Item "${dto.rmItemId}" does not belong to SC "${dto.scId}".`,
        );
      }

      // 2. Fetch all valid receipts for this SC
      const receiptItems = await queryRunner.manager
        .createQueryBuilder(MaterialReceiptItem, 'mri')
        .innerJoin('mri.materialReceipt', 'mr')
        .innerJoin('mr.materialIssue', 'mi')
        .where('mi.sc_id = :scId', { scId: dto.scId })
        .andWhere('mri.rm_item_id = :rmItemId', { rmItemId: dto.rmItemId })
        .getMany();

      let totalReceived = 0;
      for (const mri of receiptItems) {
        totalReceived += Number(mri.quantityReceived) || 0;
      }
      totalReceived = QuantityCalculator.roundDecimal(totalReceived);

      // 3. Fetch all previous consumptions for this SC/Item
      const previousConsumptions = await queryRunner.manager.find(
        MaterialConsumption,
        {
          where: { scId: dto.scId, rmItemId: dto.rmItemId },
        },
      );

      let totalConsumed = 0;
      for (const pc of previousConsumptions) {
        totalConsumed += Number(pc.consumedQuantity) || 0;
      }
      totalConsumed = QuantityCalculator.roundDecimal(totalConsumed);

      // 4. Fetch all previous valid returns for this SC/Item to deduct from WIP
      const allReturns = await queryRunner.manager.find(MaterialReturn, {
        where: { scId: dto.scId },
        relations: { items: true },
      });

      let totalReturned = 0;
      for (const ret of allReturns) {
        if (ret.status !== ReturnStatus.REJECTED) {
          for (const item of (ret.items || [])) {
            if (item.rmItemId === dto.rmItemId) {
              totalReturned += Number(item.quantityReturned) || 0;
            }
          }
        }
      }
      totalReturned = QuantityCalculator.roundDecimal(totalReturned);

      // 5. Validate quantity against WIP
      const availableWip = QuantityCalculator.calculateWip(
        totalReceived,
        totalConsumed,
        totalReturned,
      );

      QuantityCalculator.assertWithinLimit(
        dto.quantityConsumed,
        availableWip,
        `Consumption quantity exceeds remaining available WIP for "${rmItem.material}".`,
      );

      // 6. Create consumption record
      const consumption = queryRunner.manager.create(MaterialConsumption, {
        scId: dto.scId,
        rmItemId: dto.rmItemId,
        consumedQuantity: QuantityCalculator.roundDecimal(dto.quantityConsumed),
        unit: 'NOS', // Keep same as before
        recordedById: actorId,
        remarks: dto.remarks,
      });

      const saved = await queryRunner.manager.save(
        MaterialConsumption,
        consumption,
      );

      // CRITICAL: Production consumption DOES NOT alter inventory stock (prevents double-deduction)
      // Return is future workflow. No StockBalance or StockTransaction updates.

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async recordReturn(dto: CreateMaterialReturnDto, actorId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock the SC to serialize all return requests for this component
      const sc = await queryRunner.manager
        .createQueryBuilder(SalesOrderComponent, 'sc')
        .where('sc.id = :id', { id: dto.scId })
        .setLock('pessimistic_write')
        .getOne();

      if (!sc) {
        throw new NotFoundException(
          `Sales Order Component with ID "${dto.scId}" not found.`,
        );
      }

      StateMachineValidator.assertScActive(sc.status, 'Record Return');

      // 2. Fetch all valid receipts for this SC
      const receiptItems = await queryRunner.manager
        .createQueryBuilder(MaterialReceiptItem, 'mri')
        .innerJoin('mri.materialReceipt', 'mr')
        .innerJoin('mr.materialIssue', 'mi')
        .where('mi.sc_id = :scId', { scId: dto.scId })
        .getMany();

      // 3. Fetch all previous consumptions for this SC
      const previousConsumptions = await queryRunner.manager
        .createQueryBuilder(MaterialConsumption, 'mc')
        .where('mc.sc_id = :scId', { scId: dto.scId })
        .getMany();

      // 4. Fetch all previous returns for this SC
      const allReturns = await queryRunner.manager
        .createQueryBuilder(MaterialReturn, 'mr')
        .leftJoinAndSelect('mr.items', 'items')
        .where('mr.sc_id = :scId', { scId: dto.scId })
        .getMany();

      const returnRec = queryRunner.manager.create(MaterialReturn, {
        scId: dto.scId,
        returnedById: actorId,
        status: ReturnStatus.PENDING_STORE_ACK,
        remarks: dto.remarks,
      });
      const savedReturn = await queryRunner.manager.save(
        MaterialReturn,
        returnRec,
      );

      for (const itemDto of dto.items) {
        QuantityCalculator.assertPositive(
          itemDto.quantityReturned,
          'Quantity Returned',
        );

        const rmItem = await queryRunner.manager.findOneBy(RmItem, { id: itemDto.rmItemId });
        if (!rmItem) {
          throw new NotFoundException(`RM Item "${itemDto.rmItemId}" not found.`);
        }
        if (rmItem.scId !== dto.scId) {
          throw new BadRequestException(
            `RM Item "${itemDto.rmItemId}" does not belong to SC "${dto.scId}".`,
          );
        }

        // Calculate exactly how much is available
        let totalReceived = 0;
        for (const r of receiptItems) {
          if (r.rmItemId === itemDto.rmItemId) {
            totalReceived += Number(r.quantityReceived) || 0;
          }
        }

        let totalConsumed = 0;
        for (const c of previousConsumptions) {
          if (c.rmItemId === itemDto.rmItemId) {
            totalConsumed += Number(c.consumedQuantity) || 0;
          }
        }

        let totalReturned = 0;
        for (const ret of allReturns) {
          if (ret.status !== ReturnStatus.REJECTED) {
            for (const item of ret.items) {
              if (item.rmItemId === itemDto.rmItemId) {
                totalReturned += Number(item.quantityReturned) || 0;
              }
            }
          }
        }

        const availableWip = QuantityCalculator.calculateWip(
          totalReceived,
          totalConsumed,
          totalReturned,
        );

        QuantityCalculator.assertWithinLimit(
          itemDto.quantityReturned,
          availableWip,
          `Returned quantity exceeds available WIP material.`,
        );

        const returnItem = queryRunner.manager.create(MaterialReturnItem, {
          materialReturnId: savedReturn.id,
          rmItemId: itemDto.rmItemId,
          quantityReturned: QuantityCalculator.roundDecimal(
            itemDto.quantityReturned,
          ),
          remarks: itemDto.remarks,
        });
        await queryRunner.manager.save(MaterialReturnItem, returnItem);
      }

      await queryRunner.commitTransaction();

      // CRITICAL: Stock is NOT restored here; Stores verification is required
      return this.returnRepo.findOne({
        where: { id: savedReturn.id },
        relations: { items: { rmItem: true }, returnedBy: true },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async verifyReturn(returnId: string, dto: VerifyReturnDto, actorId: string) {
    const destinationBin = await this.binRepo.findOneBy({
      id: dto.destinationBinId,
    });
    if (!destinationBin) {
      throw new NotFoundException(
        `Destination Bin "${dto.destinationBinId}" not found.`,
      );
    }
    if (!destinationBin.isActive) {
      throw new BadRequestException(
        `Destination Bin "${destinationBin.code}" is inactive.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnRec = await queryRunner.manager
        .createQueryBuilder(MaterialReturn, 'mr')
        .innerJoinAndSelect('mr.items', 'items')
        .innerJoinAndSelect('items.rmItem', 'rmItem')
        .where('mr.id = :id', { id: returnId })
        .setLock('pessimistic_write')
        .getOne();

      if (!returnRec) {
        throw new NotFoundException(
          `Material Return with ID "${returnId}" not found.`,
        );
      }

      StateMachineValidator.assertReturnPending(returnRec.status);

      // Deterministically sort items by mapped product ID to prevent lock-ordering deadlocks
      // during ON CONFLICT DO UPDATE across concurrent return verifications hitting the same destination bin.
      const sortedItems = [...returnRec.items].sort((a, b) => {
        const prodA = a.rmItem.mappedProductId || '';
        const prodB = b.rmItem.mappedProductId || '';
        return prodA.localeCompare(prodB);
      });

      for (const item of sortedItems) {
        const qtyToReturn = QuantityCalculator.roundDecimal(
          item.quantityReturned,
        );

        if (!item.rmItem.mappedProductId) {
          throw new BadRequestException(
            `RM Item ${item.rmItem.id} has no mapped product ID. Cannot verify return.`,
          );
        }

        // Atomic stock restoration at destination bin. Use ON CONFLICT DO UPDATE to ensure balance row is created if missing.
        await queryRunner.manager.query(
          `INSERT INTO stock_balances (product_id, bin_id, current_quantity, created_at, updated_at) 
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (product_id, bin_id) 
           DO UPDATE SET current_quantity = stock_balances.current_quantity + EXCLUDED.current_quantity, updated_at = NOW()`,
          [item.rmItem.mappedProductId, dto.destinationBinId, qtyToReturn],
        );

        // Immutable StockTransaction for RETURN
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.RETURN,
          destinationBinId: dto.destinationBinId,
          productId: item.rmItem.mappedProductId,
          quantity: qtyToReturn,
          referenceType: 'MATERIAL_RETURN',
          referenceId: returnRec.id,
          remarks: dto.remarks || `Return verified for SC ${returnRec.scId}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, dto.destinationBinId, item.rmItem.mappedProductId],
        );
      }

      returnRec.status = ReturnStatus.ACKNOWLEDGED;
      returnRec.confirmedById = actorId;
      returnRec.confirmedAt = new Date();
      if (dto.remarks) {
        returnRec.remarks = `${returnRec.remarks || ''} [Verified: ${dto.remarks}]`;
      }

      await queryRunner.manager.save(MaterialReturn, returnRec);
      await queryRunner.commitTransaction();

      return this.returnRepo.findOne({
        where: { id: returnId },
        relations: {
          items: { rmItem: true },
          returnedBy: true,
          confirmedBy: true,
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAccounting(scId: string) {
    const sc = await this.scRepo.findOne({
      where: { id: scId },
      relations: {
        rmItems: true,
        materialIssues: { items: true },
        materialConsumptions: true,
        materialReturns: { items: true },
      },
    });

    if (!sc) {
      throw new NotFoundException(
        `Sales Order Component with ID "${scId}" not found.`,
      );
    }

    const receiptItems = await this.dataSource
      .getRepository(MaterialReceiptItem)
      .createQueryBuilder('mri')
      .innerJoin('mri.materialReceipt', 'mr')
      .innerJoin('mr.materialIssue', 'mi')
      .where('mi.sc_id = :scId', { scId })
      .getMany();

    const itemsSummary = (sc.rmItems || []).map((rmItem) => {
      const required = QuantityCalculator.roundDecimal(rmItem.quantity || 0);

      let issued = 0;
      (sc.materialIssues || []).forEach((issue) => {
        (issue.items || []).forEach((item) => {
          if (item.rmItemId === rmItem.id) {
            issued += Number(item.quantityIssued) || 0;
          }
        });
      });
      issued = QuantityCalculator.roundDecimal(issued);

      let received = 0;
      receiptItems.forEach((mri) => {
        if (mri.rmItemId === rmItem.id) {
          received += Number(mri.quantityReceived) || 0;
        }
      });
      received = QuantityCalculator.roundDecimal(received);

      let consumed = 0;
      (sc.materialConsumptions || []).forEach((c) => {
        if (c.rmItemId === rmItem.id) {
          consumed += Number(c.consumedQuantity) || 0;
        }
      });
      consumed = QuantityCalculator.roundDecimal(consumed);

      let returned = 0;
      (sc.materialReturns || []).forEach((ret) => {
        if (ret.status === ReturnStatus.ACKNOWLEDGED) {
          (ret.items || []).forEach((item) => {
            if (item.rmItemId === rmItem.id) {
              returned += Number(item.quantityReturned) || 0;
            }
          });
        }
      });
      returned = QuantityCalculator.roundDecimal(returned);

      let pendingReturned = 0;
      (sc.materialReturns || []).forEach((ret) => {
        if (ret.status === ReturnStatus.PENDING_STORE_ACK) {
          (ret.items || []).forEach((item) => {
            if (item.rmItemId === rmItem.id) {
              pendingReturned += Number(item.quantityReturned) || 0;
            }
          });
        }
      });
      pendingReturned = QuantityCalculator.roundDecimal(pendingReturned);

      const unaccounted = QuantityCalculator.calculateUnaccounted(
        received,
        consumed,
        returned,
      );

      const wip = QuantityCalculator.calculateWip(
        received,
        consumed,
        returned + pendingReturned,
      );

      return {
        rmItemId: rmItem.id,
        material: rmItem.material,
        grade: rmItem.grade,
        size: rmItem.size,
        required,
        issued,
        received,
        consumed,
        returned,
        pendingReturned,
        wip,
        unaccounted,
      };
    });

    return {
      scId: sc.id,
      scNumber: sc.scNumber,
      status: sc.status,
      items: itemsSummary,
    };
  }
}
