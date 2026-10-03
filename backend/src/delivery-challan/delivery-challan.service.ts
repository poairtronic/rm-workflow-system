import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto.js';
import { ReturnDeliveryChallanDto } from './dto/return-delivery-challan.dto.js';
import { VendorProcessCapability } from '../vendor/entities/vendor-process-capability.entity.js';
import { VendorSla } from '../vendor/entities/vendor-sla.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DeliveryChallanService {
  private readonly logger = new Logger(DeliveryChallanService.name);

  constructor(
    @InjectRepository(DeliveryChallan)
    private readonly challanRepo: Repository<DeliveryChallan>,
    @InjectRepository(DeliveryChallanItem)
    private readonly challanItemRepo: Repository<DeliveryChallanItem>,
    private readonly dataSource: DataSource,
  ) {}

  async createType1Challan(dto: CreateDeliveryChallanDto, userId: string): Promise<DeliveryChallan> {
    if (dto.type !== DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD) {
      throw new BadRequestException('Invalid challan type for Type 1 creation');
    }
    if (!dto.scId || !dto.processId) {
      throw new BadRequestException('scId and processId are required for Type 1 challan');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Vendor Process Capability
      const capabilityRepo = queryRunner.manager.getRepository(VendorProcessCapability);
      const capability = await capabilityRepo.findOne({
        where: { vendorId: dto.vendorId, processId: dto.processId, isApproved: true },
      });

      if (!capability) {
        throw new BadRequestException('Vendor is not approved for the specified production process');
      }

      // 2. Compute Expected Return Date via Vendor SLA
      let expectedReturnDate = dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null;
      if (!expectedReturnDate) {
        const slaRepo = queryRunner.manager.getRepository(VendorSla);
        const sla = await slaRepo.findOne({
          where: { vendorId: dto.vendorId, processId: dto.processId, isActive: true },
        });

        if (sla && sla.slaDays) {
          const dispatch = new Date(dto.dispatchDate);
          expectedReturnDate = new Date(dispatch.getTime() + sla.slaDays * 24 * 60 * 60 * 1000);
        } else {
          throw new BadRequestException('No active SLA found. Explicit expectedReturnDate is mandatory.');
        }
      }

      // Generate Challan Number
      const challanNumber = `DC-${Date.now()}`;

      // 3. Create Delivery Challan
      const challan = queryRunner.manager.create(DeliveryChallan, {
        challanNumber,
        type: dto.type,
        vendorId: dto.vendorId,
        scId: dto.scId,
        processId: dto.processId,
        dispatchDate: new Date(dto.dispatchDate),
        expectedReturnDate,
        notes: dto.notes,
        createdById: userId,
        status: DeliveryChallanStatus.OPEN,
      });

      const savedChallan = await queryRunner.manager.save(challan);

      // 4. Atomic Inventory Stock Deduction
      const stockBalanceRepo = queryRunner.manager.getRepository(StockBalance);
      const stockTxRepo = queryRunner.manager.getRepository(StockTransaction);

      for (const itemDto of dto.items) {
        // Lock source bin
        const stockBalance = await stockBalanceRepo.createQueryBuilder('sb')
          .setLock('pessimistic_write')
          .where('sb.productId = :productId', { productId: itemDto.productId })
          .andWhere('sb.binId = :binId', { binId: itemDto.binId })
          .getOne();

        if (!stockBalance) {
          throw new BadRequestException(`Stock balance not found for product ${itemDto.productId} in bin ${itemDto.binId}`);
        }

        const quantityToDispatch = Number(itemDto.quantityDispatched);
        const currentQty = Number(stockBalance.currentQuantity);

        if (currentQty < quantityToDispatch) {
          throw new BadRequestException(`Insufficient stock for product ${itemDto.productId} in bin ${itemDto.binId}`);
        }

        // Deduct quantity
        stockBalance.currentQuantity = currentQty - quantityToDispatch;
        await stockBalanceRepo.save(stockBalance);

        // Write transaction
        const stockTx = stockTxRepo.create({
          productId: itemDto.productId,
          sourceBinId: itemDto.binId,
          transactionType: TransactionType.STOCK_OUT,
          quantity: quantityToDispatch,
          referenceType: 'DELIVERY_CHALLAN_TYPE_1',
          referenceId: savedChallan.id,
          createdById: userId,
          remarks: `Dispatched via Delivery Challan ${challanNumber}`,
        });
        await stockTxRepo.save(stockTx);

        // Create DC item
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          quantityDispatched: quantityToDispatch,
          quantityReturned: 0,
        });
        await queryRunner.manager.save(dcItem);
      }

      await queryRunner.commitTransaction();
      
      const savedChallanDetails = await this.challanRepo.findOne({
        where: { id: savedChallan.id },
        relations: { items: true },
      });
      if (!savedChallanDetails) {
        throw new Error('Challan not found after creation');
      }
      return savedChallanDetails;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createType2Challan(dto: CreateDeliveryChallanDto, userId: string): Promise<DeliveryChallan> {
    if (dto.type !== DeliveryChallanType.GENERAL_INVENTORY_OUTWARD) {
      throw new BadRequestException('Invalid challan type for Type 2 creation');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const vendorRepo = queryRunner.manager.getRepository(Vendor);
      const vendor = await vendorRepo.findOne({ where: { id: dto.vendorId, isActive: true } });
      if (!vendor) {
        throw new BadRequestException('Vendor not found or inactive');
      }

      const challanNumber = `DC-${Date.now()}`;
      const challan = queryRunner.manager.create(DeliveryChallan, {
        challanNumber,
        type: dto.type,
        vendorId: dto.vendorId,
        scId: dto.scId,
        processId: dto.processId,
        dispatchDate: new Date(dto.dispatchDate),
        expectedReturnDate: dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null,
        notes: dto.notes,
        createdById: userId,
        status: DeliveryChallanStatus.OPEN,
      });

      const savedChallan = await queryRunner.manager.save(challan);

      const stockBalanceRepo = queryRunner.manager.getRepository(StockBalance);
      const stockTxRepo = queryRunner.manager.getRepository(StockTransaction);

      for (const itemDto of dto.items) {
        const quantityToDispatch = Number(itemDto.quantityDispatched);

        const stockBalance = await stockBalanceRepo
          .createQueryBuilder('sb')
          .setLock('pessimistic_write')
          .where('sb.product_id = :productId', { productId: itemDto.productId })
          .andWhere('sb.bin_id = :binId', { binId: itemDto.binId })
          .getOne();

        if (!stockBalance) {
          throw new BadRequestException(`No stock found for product ${itemDto.productId} in bin ${itemDto.binId}`);
        }

        const currentQty = Number(stockBalance.currentQuantity);

        if (currentQty < quantityToDispatch) {
          throw new BadRequestException(`Insufficient stock for product ${itemDto.productId} in bin ${itemDto.binId}`);
        }

        // Deduct quantity
        stockBalance.currentQuantity = currentQty - quantityToDispatch;
        await stockBalanceRepo.save(stockBalance);

        // Write transaction
        const stockTx = stockTxRepo.create({
          productId: itemDto.productId,
          sourceBinId: itemDto.binId,
          transactionType: TransactionType.STOCK_OUT,
          quantity: quantityToDispatch,
          referenceType: 'DELIVERY_CHALLAN_TYPE_2',
          referenceId: savedChallan.id,
          createdById: userId,
          remarks: `Dispatched via Delivery Challan Type 2 ${challanNumber}`,
        });
        await stockTxRepo.save(stockTx);

        // Create DC item
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          quantityDispatched: quantityToDispatch,
          quantityReturned: 0,
        });
        await queryRunner.manager.save(dcItem);
      }

      await queryRunner.commitTransaction();
      
      const savedChallanDetails = await this.challanRepo.findOne({
        where: { id: savedChallan.id },
        relations: { items: true },
      });
      if (!savedChallanDetails) {
        throw new Error('Challan not found after creation');
      }
      return savedChallanDetails;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters?: { scId?: string; processId?: string; vendorId?: string; type?: DeliveryChallanType }) {
    const where: any = {};
    if (filters?.scId) where.scId = filters.scId;
    if (filters?.processId) where.processId = filters.processId;
    if (filters?.vendorId) where.vendorId = filters.vendorId;
    if (filters?.type) where.type = filters.type;

    return this.challanRepo.find({
      where,
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const challan = await this.challanRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!challan) {
      throw new NotFoundException(`Delivery Challan with ID ${id} not found`);
    }
    return challan;
  }

  async getVendorCustodySummary(vendorId: string) {
    const items = await this.dataSource.createQueryBuilder(DeliveryChallanItem, 'item')
      .innerJoinAndSelect('item.challan', 'dc')
      .innerJoinAndSelect('item.product', 'product')
      .where('dc.vendorId = :vendorId', { vendorId })
      .andWhere('dc.status != :status', { status: DeliveryChallanStatus.CLOSED })
      .andWhere('dc.status != :statusReturned', { statusReturned: DeliveryChallanStatus.RETURNED })
      .andWhere('item.quantity_dispatched > item.quantity_returned')
      .getMany();
    
    return items.map(item => ({
      challanId: item.challanId,
      challanNumber: item.challan.challanNumber,
      productId: item.productId,
      productName: item.product.name,
      binId: item.binId,
      quantityDispatched: Number(item.quantityDispatched),
      quantityReturned: Number(item.quantityReturned),
      outstandingQuantity: Number(item.quantityDispatched) - Number(item.quantityReturned),
      dispatchDate: item.challan.dispatchDate,
    }));
  }

  async getProductCustodyTotal(productId: string) {
    const qb = this.dataSource.createQueryBuilder()
      .select('SUM(item.quantity_dispatched - item.quantity_returned)', 'totalOutstanding')
      .from(DeliveryChallanItem, 'item')
      .innerJoin('item.challan', 'dc')
      .where('item.productId = :productId', { productId })
      .andWhere('dc.status != :status', { status: DeliveryChallanStatus.CLOSED })
      .andWhere('dc.status != :statusReturned', { statusReturned: DeliveryChallanStatus.RETURNED })
      .andWhere('item.quantity_dispatched > item.quantity_returned');

    const result = await qb.getRawOne();
    return {
      productId,
      totalOutstanding: result?.totalOutstanding ? Number(result.totalOutstanding) : 0,
    };
  }

  async processChallanReturn(challanId: string, dto: ReturnDeliveryChallanDto, userId: string): Promise<DeliveryChallan> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const challan = await queryRunner.manager.findOne(DeliveryChallan, {
        where: { id: challanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!challan) {
        throw new NotFoundException('Delivery Challan not found');
      }

      const items = await queryRunner.manager.find(DeliveryChallanItem, {
        where: { challanId: challan.id },
      });
      challan.items = items;

      if (challan.status === DeliveryChallanStatus.RETURNED || challan.status === DeliveryChallanStatus.CLOSED) {
        throw new BadRequestException('Challan is already fully returned or closed');
      }

      const stockRepo = queryRunner.manager.getRepository(StockBalance);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);
      const itemRepo = queryRunner.manager.getRepository(DeliveryChallanItem);

      for (const dtoItem of dto.items) {
        const challanItem = challan.items.find(i => i.id === dtoItem.itemId);
        if (!challanItem) {
          throw new BadRequestException(`Item ${dtoItem.itemId} not found in challan`);
        }

        const outstanding = Number(challanItem.quantityDispatched) - Number(challanItem.quantityReturned);
        if (dtoItem.quantityToReturn > outstanding) {
          throw new BadRequestException(`Cannot return more than outstanding quantity for item ${dtoItem.itemId}. Outstanding: ${outstanding}`);
        }

        // 2. Atomic Inventory Stock Restoration & Ledger Logging
        const balance = await stockRepo.findOne({
          where: { productId: challanItem.productId, binId: challanItem.binId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          throw new NotFoundException(`Stock balance for product ${challanItem.productId} in bin ${challanItem.binId} not found`);
        }

        balance.currentQuantity = Number(balance.currentQuantity) + dtoItem.quantityToReturn;
        await stockRepo.save(balance);

        const transaction = txRepo.create({
          productId: challanItem.productId,
          destinationBinId: challanItem.binId,
          transactionType: TransactionType.RETURN,
          quantity: dtoItem.quantityToReturn,
          referenceId: challanId,
          referenceType: 'DELIVERY_CHALLAN_RETURN',
          createdById: userId,
        });
        await txRepo.save(transaction);

        // Update returned quantity
        challanItem.quantityReturned = Number(challanItem.quantityReturned) + dtoItem.quantityToReturn;
        await itemRepo.save(challanItem);
      }

      // Refresh items to check status
      const updatedItems = await itemRepo.find({ where: { challanId } });
      const allFullyReturned = updatedItems.every(i => Number(i.quantityReturned) === Number(i.quantityDispatched));

      challan.status = allFullyReturned ? DeliveryChallanStatus.RETURNED : DeliveryChallanStatus.PARTIALLY_RETURNED;
      challan.actualReturnDate = new Date(dto.actualReceiptDate);
      challan.verifiedById = userId;
      challan.verificationRemarks = dto.verificationRemarks;

      await queryRunner.manager.save(challan);
      await queryRunner.commitTransaction();

      return challan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
