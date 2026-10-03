import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto.js';
import { VendorProcessCapability } from '../vendor/entities/vendor-process-capability.entity.js';
import { VendorSla } from '../vendor/entities/vendor-sla.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
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
        stockBalance.lastUpdatedById = userId;
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
      
      return this.challanRepo.findOne({
        where: { id: savedChallan.id },
        relations: { items: true },
      });
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
}
