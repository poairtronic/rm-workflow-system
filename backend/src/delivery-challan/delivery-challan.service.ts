import { Injectable, Logger, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, LessThan, In } from 'typeorm';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto.js';
import { ReturnDeliveryChallanDto } from './dto/return-delivery-challan.dto.js';
import { VendorProcessCapability } from '../vendor/entities/vendor-process-capability.entity.js';
import { VendorSla } from '../vendor/entities/vendor-sla.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { CommunicationService } from '../notifications/communication.service.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { PrintableDeliveryChallanDto, PrintableCompanyInfo } from './dto/printable-delivery-challan.dto.js';


@Injectable()
export class DeliveryChallanService {
  private readonly logger = new Logger(DeliveryChallanService.name);

  constructor(
    @InjectRepository(DeliveryChallan)
    private readonly challanRepo: Repository<DeliveryChallan>,
    @InjectRepository(DeliveryChallanItem)
    private readonly challanItemRepo: Repository<DeliveryChallanItem>,
    private readonly dataSource: DataSource,
    @Optional() private readonly communicationService?: CommunicationService,
  ) {}

  /**
   * Generates supplier DC number format: SDC/2627/0001 (prefix SDC / 2-digit financial year / 4-digit sequential)
   */
  private async generateNextChallanNumber(queryRunner: QueryRunner, dispatchDate?: Date): Promise<string> {
    const d = dispatchDate && !isNaN(dispatchDate.getTime()) ? dispatchDate : new Date();
    const currentYear = d.getFullYear() % 100;
    const currentMonth = d.getMonth() + 1; // 1-12
    const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    const fyStr = `${startYear.toString().padStart(2, '0')}${endYear.toString().padStart(2, '0')}`;
    const prefix = `SDC/${fyStr}/`;

    // Query latest challan number matching this prefix to increment
    const latestChallan = await queryRunner.manager
      .getRepository(DeliveryChallan)
      .createQueryBuilder('dc')
      .setLock('pessimistic_write')
      .where('dc.challanNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('dc.challanNumber', 'DESC')
      .getOne();

    let seq = 1;
    if (latestChallan && latestChallan.challanNumber) {
      const parts = latestChallan.challanNumber.split('/');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }

  async createType1Challan(dto: CreateDeliveryChallanDto, userId: string): Promise<DeliveryChallan> {
    if (dto.type !== DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD) {
      throw new BadRequestException('Invalid challan type for Type 1 creation');
    }
    if (dto.items.some(item => !item.scId || !item.processId)) {
      throw new BadRequestException('scId and processId are required for all items in Type 1 challan');
    }

    if (!dto.dispatchDate) {
      throw new BadRequestException('Dispatch date is required');
    }
    const dispatchDate = new Date(dto.dispatchDate);
    if (isNaN(dispatchDate.getTime())) {
      throw new BadRequestException('Invalid dispatch date format');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dispatchDay = new Date(dispatchDate);
    dispatchDay.setHours(0, 0, 0, 0);
    if (dispatchDay < today) {
      throw new BadRequestException('Dispatch date cannot be set in the past');
    }
    if (dto.expectedReturnDate) {
      const expDate = new Date(dto.expectedReturnDate);
      if (expDate < dispatchDate) {
        throw new BadRequestException('Expected return date cannot be before dispatch date');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Extract unique process IDs from items
      const uniqueProcessIds = Array.from(new Set(dto.items.map(item => item.processId)));

      // 1. Validate Vendor Process Capability for all distinct processes
      const capabilityRepo = queryRunner.manager.getRepository(VendorProcessCapability);
      const capabilities = await capabilityRepo.find({
        where: { vendorId: dto.vendorId, processId: In(uniqueProcessIds), isApproved: true },
      });

      if (capabilities.length !== uniqueProcessIds.length) {
        throw new BadRequestException('Vendor is not approved for all specified production processes');
      }

      // 2. Compute Expected Return Date via Vendor SLA if not provided
      let expectedReturnDate = dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null;
      if (!expectedReturnDate) {
        // Fallback: Use SLA from the first item's process
        const slaRepo = queryRunner.manager.getRepository(VendorSla);
        const sla = await slaRepo.findOne({
          where: { vendorId: dto.vendorId, processId: uniqueProcessIds[0], isActive: true },
        });

        if (sla && sla.slaDays) {
          const dispatch = new Date(dto.dispatchDate);
          expectedReturnDate = new Date(dispatch.getTime() + sla.slaDays * 24 * 60 * 60 * 1000);
        } else {
          throw new BadRequestException('No active SLA found. Explicit expectedReturnDate is mandatory.');
        }
      }

      // Generate Challan Number: SDC/2627/0001
      const challanNumber = await this.generateNextChallanNumber(queryRunner, dispatchDate);

      // 3. Create Delivery Challan
      const uniqueScIds = new Set(dto.items.map(item => item.scId).filter(Boolean));
      const headerScId = uniqueScIds.size === 1 ? Array.from(uniqueScIds)[0] : null;
      
      const uniqueProcessIdsSet = new Set(dto.items.map(item => item.processId).filter(Boolean));
      const headerProcessId = uniqueProcessIdsSet.size === 1 ? Array.from(uniqueProcessIdsSet)[0] : null;

      const challan = queryRunner.manager.create(DeliveryChallan, {
        challanNumber,
        type: dto.type,
        vendorId: dto.vendorId,
        scId: headerScId,
        processId: headerProcessId,
        dispatchDate: new Date(dto.dispatchDate),
        expectedReturnDate,
        notes: dto.notes,
        createdById: userId,
        status: DeliveryChallanStatus.DISPATCHED,
      });

      const savedChallan = await queryRunner.manager.save(challan);

      // 4. Atomic Inventory Stock Deduction
      const stockBalanceRepo = queryRunner.manager.getRepository(StockBalance);
      const stockTxRepo = queryRunner.manager.getRepository(StockTransaction);

      for (const itemDto of dto.items) {
        const quantityToDispatch = Number(itemDto.quantityDispatched ?? 0);
        if (itemDto.productId && itemDto.binId) {
          // Lock source bin
          const stockBalance = await stockBalanceRepo.createQueryBuilder('sb')
            .setLock('pessimistic_write')
            .where('sb.productId = :productId', { productId: itemDto.productId })
            .andWhere('sb.binId = :binId', { binId: itemDto.binId })
            .getOne();

          if (!stockBalance) {
            throw new BadRequestException(`Stock balance not found for product ${itemDto.productId} in bin ${itemDto.binId}`);
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
            transactionType: TransactionType.DC_DISPATCH,
            quantity: quantityToDispatch,
            referenceType: 'DELIVERY_CHALLAN_TYPE_1',
            referenceId: savedChallan.id,
            createdById: userId,
            remarks: `Dispatched via Delivery Challan ${challanNumber}`,
          });
          await stockTxRepo.save(stockTx);
        }

        // Resolve partNumber and partName from DTO or SC RM Item
        let partNumber = itemDto.partNumber;
        let partName = itemDto.partName;
        if ((!partNumber || !partName) && itemDto.scId) {
          const sc = await queryRunner.manager.findOne(SalesOrderComponent, {
            where: { id: itemDto.scId },
          });
          if (sc) {
            if (!partNumber) partNumber = sc.scNumber;
            if (!partName) partName = sc.productName;
          }
        }

        // Create DC item
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          scId: itemDto.scId,
          processId: itemDto.processId,
          batchNumber: itemDto.batchNumber,
          description: itemDto.description,
          partNumber: partNumber ?? undefined,
          partName: partName ?? undefined,
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
      // Fire-and-forget DC_CREATED notification (non-critical — must not roll back transaction)
      this.fireNotification('DC_CREATED', savedChallanDetails, userId);
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

    if (!dto.dispatchDate) {
      throw new BadRequestException('Dispatch date is required');
    }
    const dispatchDate = new Date(dto.dispatchDate);
    if (isNaN(dispatchDate.getTime())) {
      throw new BadRequestException('Invalid dispatch date format');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dispatchDay = new Date(dispatchDate);
    dispatchDay.setHours(0, 0, 0, 0);
    if (dispatchDay < today) {
      throw new BadRequestException('Dispatch date cannot be set in the past');
    }
    if (dto.expectedReturnDate) {
      const expDate = new Date(dto.expectedReturnDate);
      if (expDate < dispatchDate) {
        throw new BadRequestException('Expected return date cannot be before dispatch date');
      }
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

      const challanNumber = await this.generateNextChallanNumber(queryRunner, dispatchDate);
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
        status: DeliveryChallanStatus.DISPATCHED,
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
          transactionType: TransactionType.DC_DISPATCH,
          quantity: quantityToDispatch,
          referenceType: 'DELIVERY_CHALLAN_TYPE_2',
          referenceId: savedChallan.id,
          createdById: userId,
          remarks: `Dispatched via Delivery Challan Type 2 ${challanNumber}`,
        });
        await stockTxRepo.save(stockTx);

        // Resolve partNumber and partName from DTO or SC RM Item
        let partNumber = itemDto.partNumber;
        let partName = itemDto.partName;
        const targetScId = itemDto.scId || dto.scId;
        if ((!partNumber || !partName) && targetScId) {
          const sc = await queryRunner.manager.findOne(SalesOrderComponent, {
            where: { id: targetScId },
          });
          if (sc) {
            if (!partNumber) partNumber = sc.scNumber;
            if (!partName) partName = sc.productName;
          }
        }

        // Create DC item
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          scId: targetScId,
          processId: itemDto.processId || dto.processId,
          batchNumber: itemDto.batchNumber,
          description: itemDto.description,
          partNumber: partNumber ?? undefined,
          partName: partName ?? undefined,
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
      // Fire-and-forget DC_CREATED notification for Type 2
      this.fireNotification('DC_CREATED', savedChallanDetails, userId);
      return savedChallanDetails;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters?: { scId?: string; processId?: string; vendorId?: string; type?: DeliveryChallanType; isOverdue?: boolean; status?: DeliveryChallanStatus }) {
    const baseWhere: any = {};
    if (filters?.vendorId) baseWhere.vendorId = filters.vendorId;
    if (filters?.type) baseWhere.type = filters.type;
    if (filters?.status && !filters?.isOverdue) {
      baseWhere.status = filters.status;
    }
    if (filters?.isOverdue) {
      baseWhere.status = In([
        DeliveryChallanStatus.OPEN,
        DeliveryChallanStatus.DISPATCHED,
        DeliveryChallanStatus.PARTIALLY_RETURNED,
      ]);
      baseWhere.expectedReturnDate = LessThan(new Date());
    }

    let where: any = baseWhere;

    if (filters?.scId || filters?.processId) {
      const condition1 = { ...baseWhere };
      const condition2 = { ...baseWhere, items: {} as any };
      
      if (filters?.scId) {
        condition1.scId = filters.scId;
        condition2.items.scId = filters.scId;
      }
      if (filters?.processId) {
        condition1.processId = filters.processId;
        condition2.items.processId = filters.processId;
      }
      where = [condition1, condition2];
    }

    return this.challanRepo.find({
      where,
      relations: {
        items: {
          product: true,
          bin: true,
          sc: {
            purchaseOrder: true,
          },
          process: true,
        },
        vendor: true,
        sc: {
          purchaseOrder: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  isOverdue(challan: DeliveryChallan): boolean {
    if (challan.status === DeliveryChallanStatus.RETURNED || challan.status === DeliveryChallanStatus.CLOSED) {
      return false;
    }
    if (!challan.expectedReturnDate) {
      return false;
    }
    return new Date() > new Date(challan.expectedReturnDate);
  }

  async getOverdueChallans(): Promise<DeliveryChallan[]> {
    return this.findAll({ isOverdue: true });
  }

  async findOne(id: string) {
    const challan = await this.challanRepo.findOne({
      where: { id },
      relations: { items: { product: true, bin: true }, vendor: true },
    });
    if (!challan) {
      throw new NotFoundException(`Delivery Challan with ID ${id} not found`);
    }
    return challan;
  }

  /**
   * Phase 19.9 — Returns the complete, printer-ready data contract for a Delivery Challan.
   * Eagerly loads all relational data required for a physical or PDF printout:
   *   Challan → Items → Product, Bin, Vendor, SC → PO, ProductionProcess, CreatedBy, VerifiedBy
   */
  async getPrintableChallanData(id: string): Promise<PrintableDeliveryChallanDto> {
    const challan = await this.challanRepo.findOne({
      where: { id },
      relations: {
        vendor: true,
        sc: true,
        process: true,
        createdBy: true,
        verifiedBy: true,
        items: {
          product: true,
          bin: true,
          sc: {
            purchaseOrder: true,
          },
          process: true,
        },
      },
    });

    if (!challan) {
      throw new NotFoundException(`Delivery Challan with ID ${id} not found`);
    }

    const enrichedItems = challan.items || [];

    // Resolve SC → PO references (Type 1 challans)
    const posSet = new Map<string, any>();
    
    // Check header SC
    if (challan.sc && (challan.sc as any).purchaseOrder) {
      const po = (challan.sc as any).purchaseOrder;
      posSet.set(po.id, {
        poId: po.id,
        poNumber: po.poNumber,
        externalReference: po.externalReference ?? null,
        referenceDate: po.referenceDate ?? null,
      });
    }

    // Check items SC
    enrichedItems.forEach(item => {
      const sc = (item as any).sc;
      if (sc && sc.purchaseOrder) {
        const po = sc.purchaseOrder;
        posSet.set(po.id, {
          poId: po.id,
          poNumber: po.poNumber,
          externalReference: po.externalReference ?? null,
          referenceDate: po.referenceDate ?? null,
        });
      }
    });

    const posArray = Array.from(posSet.values());

    // ─── Company Info (Velan Metrology India Private Limited default) ───────────
    const companyInfo: PrintableCompanyInfo = {
      name: process.env.COMPANY_NAME || 'VELAN METROLOGY INDIA PRIVATE LIMITED',
      address: process.env.COMPANY_ADDRESS || 'NO 146/87 A&B, Jayaram Nagar Main Road ,\nVanagaram , Chennai - 600095',
      gstin: process.env.COMPANY_GSTIN || '33AAICV7596H1ZR',
      state: 'Tamil Nadu',
      stateCode: '33',
      phone: process.env.COMPANY_PHONE || '9600703283',
      email: process.env.COMPANY_EMAIL || 'velanmetrology@gmail.com',
      website: process.env.COMPANY_WEBSITE ?? null,
    };

    // ─── Vendor Info ──────────────────────────────────────────────────────────
    const vendor = challan.vendor;
    const vendorInfo: PrintableDeliveryChallanDto['vendor'] = {
      id: vendor?.id ?? challan.vendorId,
      code: vendor?.code ?? '',
      name: vendor?.name ?? '',
      address: vendor?.address ?? null,
      contactPerson: vendor?.contactPerson ?? null,
      phone: vendor?.phone ?? null,
      email: vendor?.email ?? null,
      category: vendor?.category ?? null,
    };

    // ─── References ───────────────────────────────────────────────────────────
    const sc = challan.sc as any;
    const productionProcess = challan.process as any;

    const references: PrintableDeliveryChallanDto['references'] = {
      sc: sc
        ? {
            scId: sc.id,
            scNumber: sc.scNumber,
            productName: sc.productName,
            drawingNumber: sc.drawingNumber ?? null,
            description: sc.description ?? null,
          }
        : null,
      pos: posArray,
      process: productionProcess
        ? {
            processId: productionProcess.id,
            processCode: productionProcess.code,
            processName: productionProcess.name,
            sequenceNumber: productionProcess.sequenceNumber,
            category: productionProcess.category ?? null,
          }
        : null,
    };

    // ─── Line Items ───────────────────────────────────────────────────────────
    const lineItems: PrintableDeliveryChallanDto['lineItems'] = enrichedItems.map((item: any) => {
      const dispatched = Number(item.quantityDispatched ?? 0);
      const returned = Number(item.quantityReturned ?? 0);
      const resolvedPartNo = item.partNumber || item.product?.code || '—';
      const resolvedPartName = item.partName || item.product?.name || item.productId;
      return {
        id: item.id,
        productId: item.productId,
        productCode: resolvedPartNo,
        productName: resolvedPartName,
        partNumber: resolvedPartNo,
        partName: resolvedPartName,
        binId: item.binId,
        binCode: item.bin?.code ?? '',
        binName: item.bin?.name ?? '',
        quantityDispatched: dispatched,
        quantityReturned: returned,
        quantityOutstanding: Math.max(0, dispatched - returned),
        uom: item.product?.uom || (item.product?.name?.toUpperCase().includes('BAR') || item.product?.name?.toUpperCase().includes('ROD') ? 'MM' : 'NOS'),
        scNumber: item.sc?.scNumber ?? sc?.scNumber,
        poNumber: item.sc?.purchaseOrder?.poNumber ?? (sc as any)?.purchaseOrder?.poNumber,
        processName: item.process?.name ?? productionProcess?.name,
        batchNumber: item.batchNumber,
        description: item.description ?? null,
      };
    });


    // ─── Groups (Type 1 only) ─────────────────────────────────────────────────
    // Type 2 / legacy DCs have no SC/PO/process context; leave groups empty so
    // the frontend renders the flat-table fallback (one ungrouped block).
    const isType1 = challan.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
    let groups: PrintableDeliveryChallanDto['groups'] = [];

    if (isType1) {
      const groupsMap = new Map<string, any>();
      for (const item of lineItems) {
        const groupKey = `${item.scNumber || 'N/A'}|${item.poNumber || 'N/A'}|${item.processName || 'N/A'}`;
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            scNumber: item.scNumber || null,
            poNumber: item.poNumber || null,
            processName: item.processName || null,
            items: [],
            groupTotal: 0,
          });
        }
        const group = groupsMap.get(groupKey);
        group.items.push({
          productCode: item.productCode,
          productName: item.productName,
          binCode: item.binCode,
          batchNumber: item.batchNumber,
          description: item.description,
          quantityDispatched: item.quantityDispatched,
          uom: item.uom,
        });
        group.groupTotal += item.quantityDispatched;
      }
      groups = Array.from(groupsMap.values());
    }

    // ─── Audit & Sign-off ─────────────────────────────────────────────────────
    const audit: PrintableDeliveryChallanDto['audit'] = {
      createdById: challan.createdById ?? null,
      createdByName: (challan.createdBy as any)?.name ?? null,
      createdAt: challan.createdAt,
      verifiedById: challan.verifiedById ?? null,
      verifiedByName: (challan.verifiedBy as any)?.name ?? null,
      verificationRemarks: challan.verificationRemarks ?? null,
      authorizedSignatory: '___________________________',
      termsAndConditions:
        'All materials dispatched under this challan remain the property of ' +
        (companyInfo.name) +
        ' until formally returned and verified. The vendor is responsible for safe custody of all goods. ' +
        'Any damage, loss, or discrepancy must be reported within 24 hours of receipt.',
    };

    return {
      company: companyInfo,
      challan: {
        id: challan.id,
        challanNumber: challan.challanNumber,
        type: challan.type,
        status: challan.status,
        dispatchDate: challan.dispatchDate ?? null,
        expectedReturnDate: challan.expectedReturnDate ?? null,
        actualReturnDate: challan.actualReturnDate ?? null,
        notes: challan.notes ?? null,
      },
      vendor: vendorInfo,
      references,
      lineItems,
      groups,
      audit,
      generatedAt: new Date().toISOString(),
    };
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
      productName: item.product?.name ?? 'Unknown',
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
        let balance = await stockRepo.findOne({
          where: { productId: challanItem.productId, binId: challanItem.binId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          balance = stockRepo.create({
            productId: challanItem.productId,
            binId: challanItem.binId,
            currentQuantity: 0,
          });
        }

        balance.currentQuantity = Number(balance.currentQuantity) + dtoItem.quantityToReturn;
        await stockRepo.save(balance);

        const transaction = txRepo.create({
          productId: challanItem.productId,
          destinationBinId: challanItem.binId,
          transactionType: TransactionType.DC_RETURN,
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

      // Determine which event type to fire (PARTIALLY_RETURNED vs RETURNED)
      const returnEventType = challan.status === DeliveryChallanStatus.RETURNED
        ? 'DC_RETURNED'
        : 'DC_PARTIALLY_RETURNED';
      this.fireNotification(returnEventType, challan, userId);

      return challan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async closeChallan(challanId: string, userId: string): Promise<DeliveryChallan> {
    const challan = await this.challanRepo.findOne({
      where: { id: challanId },
    });

    if (!challan) {
      throw new NotFoundException('Delivery Challan not found');
    }

    if (challan.status === DeliveryChallanStatus.CLOSED) {
      throw new BadRequestException('Challan is already closed');
    }

    if (challan.status === DeliveryChallanStatus.OPEN) {
      throw new BadRequestException('Cannot close an OPEN challan. It must be dispatched first.');
    }

    challan.status = DeliveryChallanStatus.CLOSED;
    // We could track closedBy if there was a field, but currently we just set status to CLOSED.
    const saved = await this.challanRepo.save(challan);
    // Fire-and-forget DC_CLOSED notification
    this.fireNotification('DC_CLOSED', saved, userId);
    return saved;
  }

  /**
   * Fire-and-forget DC lifecycle event notification.
   * Errors are swallowed to ensure they never roll back or fail the primary operation.
   */
  private fireNotification(
    eventType: string,
    challan: DeliveryChallan,
    actorUserId?: string,
  ): void {
    if (!this.communicationService) return;
    this.communicationService
      .sendEvent({
        eventType,
        entityType: 'DELIVERY_CHALLAN',
        entityId: challan.id,
        createdById: actorUserId,
        metadata: {
          challanNumber: challan.challanNumber,
          vendorId: challan.vendorId,
          dispatchDate: challan.dispatchDate ? String(challan.dispatchDate) : undefined,
          expectedReturnDate: challan.expectedReturnDate ? String(challan.expectedReturnDate) : undefined,
          actualReturnDate: challan.actualReturnDate ? String(challan.actualReturnDate) : undefined,
        },
      })
      .catch((err: any) => {
        this.logger.error(
          `Non-critical: DC notification fire failed for event "${eventType}" on challan ${challan.id}: ${err?.message || err}`,
        );
      });
  }
}
