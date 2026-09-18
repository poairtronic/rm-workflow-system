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
    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
    }

    StateMachineValidator.assertScActive(sc.status, 'Receive Material');

    const latestIssue = await this.issueRepo.findOne({
      where: { scId: dto.scId },
      order: { createdAt: 'DESC' },
    });
    if (!latestIssue) {
      throw new BadRequestException(`No Material Issue found for SC "${sc.scNumber}".`);
    }

    const receipt = this.receiptRepo.create({
      materialIssueId: latestIssue.id,
      receivedById: actorId,
      status: ReceiptStatus.RECEIVED,
      remarks: dto.remarks,
    });
    const savedReceipt = await this.receiptRepo.save(receipt);

    for (const itemDto of dto.items) {
      QuantityCalculator.assertPositive(itemDto.quantityReceived, 'Quantity Received');

      const rmItem = await this.rmItemRepo.findOneBy({ id: itemDto.rmItemId });
      if (!rmItem) {
        throw new NotFoundException(`RM Item "${itemDto.rmItemId}" not found.`);
      }

      const receiptItem = this.receiptItemRepo.create({
        materialReceiptId: savedReceipt.id,
        rmItemId: itemDto.rmItemId,
        quantityReceived: QuantityCalculator.roundDecimal(itemDto.quantityReceived),
        remarks: itemDto.remarks,
      });
      await this.receiptItemRepo.save(receiptItem);
    }

    sc.status = ScStatus.IN_PRODUCTION;
    await this.scRepo.save(sc);

    // CRITICAL: Production receipt DOES NOT alter inventory stock
    return this.receiptRepo.findOne({
      where: { id: savedReceipt.id },
      relations: { items: { rmItem: true }, receivedBy: true },
    });
  }

  async recordConsumption(dto: CreateMaterialConsumptionDto, actorId: string) {
    QuantityCalculator.assertPositive(dto.quantityConsumed, 'Quantity Consumed');

    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${dto.scId}" not found.`);
    }

    StateMachineValidator.assertScActive(sc.status, 'Record Consumption');

    const rmItem = await this.rmItemRepo.findOneBy({ id: dto.rmItemId });
    if (!rmItem) {
      throw new NotFoundException(`RM Item "${dto.rmItemId}" not found.`);
    }

    // Material accounting validation
    const accounting = await this.getAccounting(dto.scId);
    const itemAcc = accounting.items.find((i) => i.rmItemId === dto.rmItemId);

    const receivedQty = itemAcc ? itemAcc.received : 0;
    const consumedQty = itemAcc ? itemAcc.consumed : 0;
    const availableForConsumption = QuantityCalculator.roundDecimal(receivedQty - consumedQty);

    QuantityCalculator.assertWithinLimit(
      dto.quantityConsumed,
      availableForConsumption,
      `Consumption quantity exceeds remaining received material for "${rmItem.material}".`,
    );

    const consumption = this.consumptionRepo.create({
      scId: dto.scId,
      rmItemId: dto.rmItemId,
      consumedQuantity: QuantityCalculator.roundDecimal(dto.quantityConsumed),
      unit: 'NOS',
      recordedById: actorId,
      remarks: dto.remarks,
    });

    // CRITICAL: Production consumption DOES NOT alter inventory stock (prevents double-deduction)
    return this.consumptionRepo.save(consumption);
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

      const received = issued;

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

