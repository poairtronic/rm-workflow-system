import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MaterialReceipt, ReceiptStatus } from './entities/production-receipt.entity.js';
import { MaterialReceiptItem } from './entities/material-receipt-item.entity.js';
import { MaterialConsumption } from './entities/material-consumption.entity.js';
import { MaterialReturn, ReturnStatus } from './entities/material-return.entity.js';
import { MaterialReturnItem } from './entities/material-return-item.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
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
    const issue = await this.issueRepo.findOne({
      where: { id: dto.materialIssueId },
      relations: { salesOrderComponent: true, items: true },
    });
    if (!issue) {
      throw new NotFoundException(`Material Issue with ID "${dto.materialIssueId}" not found.`);
    }

    const sc = issue.salesOrderComponent;
    StateMachineValidator.assertScActive(sc.status, 'Receive Material');

    // Prevent over-receipt by querying all existing receipts for this issue
    const existingReceipts = await this.receiptRepo.find({
      where: { materialIssueId: issue.id },
      relations: { items: true },
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = this.receiptRepo.create({
        materialIssueId: issue.id,
        receivedById: actorId,
        status: ReceiptStatus.RECEIVED,
        remarks: dto.remarks,
      });
      const savedReceipt = await queryRunner.manager.save(MaterialReceipt, receipt);

      let hasPartial = false;

      for (const itemDto of dto.items) {
        QuantityCalculator.assertPositive(itemDto.quantityReceived, 'Quantity Received');

        const issueItem = issue.items.find(i => i.rmItemId === itemDto.rmItemId);
        if (!issueItem) {
          throw new BadRequestException(`RM Item "${itemDto.rmItemId}" was not part of Material Issue "${issue.id}".`);
        }

        let prevReceived = 0;
        for (const er of existingReceipts) {
          for (const eri of er.items) {
            if (eri.rmItemId === itemDto.rmItemId) {
              prevReceived += Number(eri.quantityReceived);
            }
          }
        }

        const maxAllowed = QuantityCalculator.roundDecimal(Number(issueItem.quantityIssued) - prevReceived);
        if (maxAllowed <= 0) {
           throw new BadRequestException(`Material Issue for RM Item "${itemDto.rmItemId}" has already been fully received.`);
        }
        
        const receivedQty = QuantityCalculator.roundDecimal(itemDto.quantityReceived);
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
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


  async recordConsumption(dto: CreateMaterialConsumptionDto, actorId: string) {
    QuantityCalculator.assertPositive(dto.quantityConsumed, 'Quantity Consumed');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock the SC to serialize all consumption for this component
      const sc = await queryRunner.manager.createQueryBuilder(SalesOrderComponent, 'sc')
        .where('sc.id = :id', { id: dto.scId })
        .setLock('pessimistic_write')
        .getOne();

      if (!sc) {
        throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
      }

      StateMachineValidator.assertScActive(sc.status, 'Record Consumption');

      const rmItem = await queryRunner.manager.findOneBy(RmItem, { id: dto.rmItemId });
      if (!rmItem) {
        throw new NotFoundException(`RM Item "${dto.rmItemId}" not found.`);
      }

      if (rmItem.salesOrderComponentId !== dto.scId && !rmItem.salesOrderComponent) {
        // Just extra safety if we need to verify relation
      }

      // 2. Fetch all valid receipts for this SC
      const receiptItems = await queryRunner.manager.createQueryBuilder(MaterialReceiptItem, 'mri')
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
      const previousConsumptions = await queryRunner.manager.find(MaterialConsumption, {
        where: { scId: dto.scId, rmItemId: dto.rmItemId }
      });

      let totalConsumed = 0;
      for (const pc of previousConsumptions) {
        totalConsumed += Number(pc.consumedQuantity) || 0;
      }
      totalConsumed = QuantityCalculator.roundDecimal(totalConsumed);

      // 4. Validate quantity
      const availableForConsumption = QuantityCalculator.roundDecimal(totalReceived - totalConsumed);

      QuantityCalculator.assertWithinLimit(
        dto.quantityConsumed,
        availableForConsumption,
        `Consumption quantity exceeds remaining received material for "${rmItem.material}".`,
      );

      // 5. Create consumption record
      const consumption = queryRunner.manager.create(MaterialConsumption, {
        scId: dto.scId,
        rmItemId: dto.rmItemId,
        consumedQuantity: QuantityCalculator.roundDecimal(dto.quantityConsumed),
        unit: 'NOS', // Keep same as before
        recordedById: actorId,
        remarks: dto.remarks,
      });

      const saved = await queryRunner.manager.save(MaterialConsumption, consumption);

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
    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
    }

    StateMachineValidator.assertScActive(sc.status, 'Record Return');

    const accounting = await this.getAccounting(dto.scId);

    const returnRec = this.returnRepo.create({
      scId: dto.scId,
      returnedById: actorId,
      status: ReturnStatus.PENDING_STORE_ACK,
      remarks: dto.remarks,
    });
    const savedReturn = await this.returnRepo.save(returnRec);

    for (const itemDto of dto.items) {
      QuantityCalculator.assertPositive(itemDto.quantityReturned, 'Quantity Returned');

      const itemAcc = accounting.items.find((i) => i.rmItemId === itemDto.rmItemId);
      const received = itemAcc ? itemAcc.received : 0;
      const consumed = itemAcc ? itemAcc.consumed : 0;
      const returned = itemAcc ? itemAcc.returned : 0;
      const unaccounted = QuantityCalculator.calculateUnaccounted(received, consumed, returned);

      QuantityCalculator.assertWithinLimit(
        itemDto.quantityReturned,
        unaccounted,
        `Returned quantity exceeds unaccounted material.`,
      );

      const returnItem = this.returnItemRepo.create({
        materialReturnId: savedReturn.id,
        rmItemId: itemDto.rmItemId,
        quantityReturned: QuantityCalculator.roundDecimal(itemDto.quantityReturned),
        remarks: itemDto.remarks,
      });
      await this.returnItemRepo.save(returnItem);
    }

    // CRITICAL: Stock is NOT restored here; Stores verification is required
    return this.returnRepo.findOne({
      where: { id: savedReturn.id },
      relations: { items: { rmItem: true }, returnedBy: true },
    });
  }

  async verifyReturn(returnId: string, dto: VerifyReturnDto, actorId: string) {
    const returnRec = await this.returnRepo.findOne({
      where: { id: returnId },
      relations: { items: true },
    });
    if (!returnRec) {
      throw new NotFoundException(`Material Return with ID "${returnId}" not found.`);
    }

    StateMachineValidator.assertReturnPending(returnRec.status);

    const destinationBin = await this.binRepo.findOneBy({ id: dto.destinationBinId });
    if (!destinationBin) {
      throw new NotFoundException(`Destination Bin "${dto.destinationBinId}" not found.`);
    }
    if (!destinationBin.isActive) {
      throw new BadRequestException(`Destination Bin "${destinationBin.code}" is inactive.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of returnRec.items) {
        const qtyToReturn = QuantityCalculator.roundDecimal(item.quantityReturned);

        // Atomic stock restoration at destination bin
        await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity + $1, updated_at = NOW() 
           WHERE bin_id = $2`,
          [qtyToReturn, dto.destinationBinId],
        );

        // Immutable StockTransaction for RETURN
        const tx = queryRunner.manager.create(StockTransaction, {
          transactionType: TransactionType.RETURN,
          destinationBinId: dto.destinationBinId,
          quantity: qtyToReturn,
          referenceType: 'MATERIAL_RETURN',
          referenceId: returnRec.id,
          remarks: dto.remarks || `Return verified for SC ${returnRec.scId}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);

        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2`,
          [savedTx.id, dto.destinationBinId],
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
        relations: { items: { rmItem: true }, returnedBy: true, confirmedBy: true },
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
      throw new NotFoundException(`Sales Order Component with ID "${scId}" not found.`);
    }

    const receiptItems = await this.dataSource.getRepository(MaterialReceiptItem)
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

      const unaccounted = QuantityCalculator.calculateUnaccounted(received, consumed, returned);

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

