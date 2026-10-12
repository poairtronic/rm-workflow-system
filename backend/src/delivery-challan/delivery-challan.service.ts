import { Injectable, Logger, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, LessThan, In, EntityManager } from 'typeorm';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement, DcMovementStatus } from './entities/dc-movement.entity.js';
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
    @InjectRepository(DcMovement)
    private readonly dcMovementRepo: Repository<DcMovement>,
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
      const uniqueProcessIds: string[] = Array.from(
        new Set(dto.items.map(item => item.processId).filter((pid): pid is string => Boolean(pid)))
      );

      // 1. Validate Vendor Process Capability for all distinct processes
      const capabilityRepo = queryRunner.manager.getRepository(VendorProcessCapability);
      let capabilities = await capabilityRepo.find({
        where: { vendorId: dto.vendorId, processId: In(uniqueProcessIds), isApproved: true },
      });

      if (capabilities.length !== uniqueProcessIds.length) {
        const approvedSet = new Set(capabilities.map(c => c.processId));
        for (const pid of uniqueProcessIds) {
          if (!approvedSet.has(pid)) {
            let existingCap = await capabilityRepo.findOne({
              where: { vendorId: dto.vendorId, processId: pid },
            });
            if (existingCap) {
              existingCap.isApproved = true;
              await capabilityRepo.save(existingCap);
            } else {
              const newCap = capabilityRepo.create({
                vendorId: dto.vendorId,
                processId: pid,
                isApproved: true,
              });
              await capabilityRepo.save(newCap);
            }
          }
        }
      }

      // 2. Compute Expected Return Date via Vendor SLA if not provided
      let expectedReturnDate = dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null;
      if (!expectedReturnDate) {
        // Fallback: Use SLA from the first item's process or default 7 days
        const slaRepo = queryRunner.manager.getRepository(VendorSla);
        const sla = await slaRepo.findOne({
          where: { vendorId: dto.vendorId, processId: uniqueProcessIds[0], isActive: true },
        });

        const dispatch = new Date(dto.dispatchDate);
        if (sla && sla.slaDays) {
          expectedReturnDate = new Date(dispatch.getTime() + sla.slaDays * 24 * 60 * 60 * 1000);
        } else {
          expectedReturnDate = new Date(dispatch.getTime() + 7 * 24 * 60 * 60 * 1000);
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

      // 4. Line Items & DC Movements Ledger
      // CRITICAL ARCHITECTURE RULE: DC Type 1 (Process Outward) represents internal WIP.
      // It must NEVER touch stock_balances or stock_transactions (no double-deduction).
      // Instead, record running movement liabilities in dc_movements per (SC, product).
      for (const itemDto of dto.items) {
        const quantityToDispatch = Number(itemDto.quantityDispatched ?? 0);
        const targetScId = itemDto.scId || headerScId;

        // Resolve partNumber and partName from DTO or SC
        let partNumber = itemDto.partNumber;
        let partName = itemDto.partName;
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
          productId: itemDto.productId ?? null,
          binId: itemDto.binId ?? null,
          scId: targetScId ?? null,
          processId: (itemDto.processId || headerProcessId) ?? null,
          batchNumber: itemDto.batchNumber ?? null,
          description: itemDto.description ?? null,
          partNumber: partNumber ?? null,
          partName: partName ?? null,
          quantityDispatched: quantityToDispatch,
          quantityReturned: 0,
        } as any);
        const savedDcItem = await queryRunner.manager.save(dcItem);

        // Resolve dispatched product ID for the running ledger
        let dispatchedProductId = itemDto.productId;
        if (!dispatchedProductId && targetScId) {
          const rmItem = await queryRunner.manager.findOne(RmItem, {
            where: { scId: targetScId },
          });
          if (rmItem && rmItem.mappedProductId) {
            dispatchedProductId = rmItem.mappedProductId;
          }
        }

        // Write initial dispatch entry to dc_movements running ledger
        if (targetScId && dispatchedProductId) {
          const movement = queryRunner.manager.create(DcMovement, {
            challanId: savedChallan.id,
            challanItemId: savedDcItem.id,
            scId: targetScId,
            processId: (itemDto.processId || headerProcessId) ?? null,
            dispatchedProductId,
            dispatchedQty: quantityToDispatch,
            returnedProductId: null,
            returnedQty: 0,
            status: DcMovementStatus.DISPATCHED,
          } as any);
          await queryRunner.manager.save(movement);
        }
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

      let nextSeq = await this.getNextType2ItemSequence(queryRunner.manager);

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

        // Resolve partNumber and partName from DTO or auto-generate for Type 2
        let partNumber = itemDto.partNumber?.trim();
        let partName = itemDto.partName?.trim();
        if (!partNumber || partNumber.startsWith('DC2-')) {
          partNumber = `DC2-${String(nextSeq).padStart(3, '0')}`;
          nextSeq++;
        }

        // Create DC item with Type 2 stock conversion mapping
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          outputProductId: itemDto.outputProductId ?? null,
          expectedOutputQuantity:
            itemDto.expectedOutputQuantity != null ? Number(itemDto.expectedOutputQuantity) : null,
          outputBinId: itemDto.outputBinId ?? null,
          scId: itemDto.scId ?? null,
          processId: (itemDto.processId || dto.processId) ?? null,
          batchNumber: itemDto.batchNumber ?? null,
          description: itemDto.description ?? null,
          partNumber: partNumber ?? null,
          partName: partName ?? null,
          quantityDispatched: quantityToDispatch,
          quantityReturned: 0,
        } as any);
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
          partNumber: item.partNumber,
          partName: item.partName,
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

        const targetExpected =
          challan.type === DeliveryChallanType.GENERAL_INVENTORY_OUTWARD && challanItem.expectedOutputQuantity != null
            ? Number(challanItem.expectedOutputQuantity)
            : Number(challanItem.quantityDispatched);
        const outstanding = Math.max(0, targetExpected - Number(challanItem.quantityReturned));
        if (dtoItem.quantityToReturn > outstanding) {
          throw new BadRequestException(`Cannot return more than outstanding quantity for item ${dtoItem.itemId}. Outstanding: ${outstanding}`);
        }

        if (challan.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD) {
          // ─── DC TYPE 1: PROCESS RETURN ──────────────────────────────────
          // CRITICAL ARCHITECTURE RULE: DC Type 1 return must NEVER touch stock_balances
          // or stock_transactions. Instead, record positive inward return into dc_movements
          // and support asymmetric product returns (e.g. cut vegetables in).
          const movementRepo = queryRunner.manager.getRepository(DcMovement);
          const movement = await movementRepo.findOne({
            where: { challanId: challan.id, challanItemId: challanItem.id },
          });

          if (movement) {
            const returnedProductId =
              dtoItem.returnedProductId || challanItem.productId || movement.dispatchedProductId;
            movement.returnedProductId = returnedProductId;
            movement.returnedQty = Number(movement.returnedQty || 0) + dtoItem.quantityToReturn;
            const totalReturned = Number(movement.returnedQty);
            const totalDispatched = Number(movement.dispatchedQty);
            movement.status =
              totalReturned >= totalDispatched
                ? DcMovementStatus.RETURNED
                : DcMovementStatus.PARTIALLY_RETURNED;
            movement.updatedAt = new Date();
            await movementRepo.save(movement);
          }

          // Update returned quantity on the challan item
          challanItem.quantityReturned = Number(challanItem.quantityReturned) + dtoItem.quantityToReturn;
          await itemRepo.save(challanItem);
        } else {
          // ─── DC TYPE 2: GENERAL INVENTORY STOCK CONVERSION RETURN ───────
          // Real warehouse stock inward: adds the transformed output product to target bin!
          const targetProductId =
            dtoItem.returnedProductId ||
            challanItem.outputProductId ||
            challanItem.productId;

          const targetBinId =
            dtoItem.destinationBinId ||
            challanItem.outputBinId ||
            challanItem.binId;

          if (targetProductId && targetBinId) {
            let balance = await stockRepo.findOne({
              where: { productId: targetProductId, binId: targetBinId },
              lock: { mode: 'pessimistic_write' },
            });

            if (!balance) {
              balance = stockRepo.create({
                productId: targetProductId,
                binId: targetBinId,
                currentQuantity: 0,
              });
            }

            balance.currentQuantity = Number(balance.currentQuantity) + dtoItem.quantityToReturn;
            await stockRepo.save(balance);

            const transaction = txRepo.create({
              productId: targetProductId,
              destinationBinId: targetBinId,
              transactionType: TransactionType.DC_RETURN,
              quantity: dtoItem.quantityToReturn,
              referenceId: challanId,
              referenceType: 'DELIVERY_CHALLAN_TYPE_2_RETURN',
              createdById: userId,
              remarks: `Inward stock conversion via Delivery Challan Type 2 ${challan.challanNumber}`,
            });
            await txRepo.save(transaction);
          }

          // Update returned quantity on the challan item
          challanItem.quantityReturned = Number(challanItem.quantityReturned) + dtoItem.quantityToReturn;
          await itemRepo.save(challanItem);
        }
      }

      // Refresh items to check status
      const updatedItems = await itemRepo.find({ where: { challanId } });
      const allFullyReturned = updatedItems.every(i => {
        const targetExpected = Number(i.expectedOutputQuantity || i.quantityDispatched);
        return Number(i.quantityReturned) >= targetExpected;
      });

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
   * Retrieves the running DC Movement ledger for a specific Sales Order Component (SC).
   * Tracks per (SC, product): dispatched quantity (negative) and returned quantity (positive),
   * correctly handling asymmetric product returns.
   */
  async getScMovements(scId: string) {
    const movements = await this.dcMovementRepo.find({
      where: { scId },
      relations: {
        challan: { vendor: true },
        process: true,
        dispatchedProduct: true,
        returnedProduct: true,
      },
      order: { createdAt: 'ASC' },
    });

    const summaryMap = new Map<string, {
      productId: string;
      productName: string;
      productCode?: string;
      totalDispatched: number;
      totalReturned: number;
      outstandingQuantity: number;
    }>();

    for (const m of movements) {
      const prodId = m.dispatchedProductId;
      let s = summaryMap.get(prodId);
      if (!s) {
        s = {
          productId: prodId,
          productName: m.dispatchedProduct?.name || 'Unknown',
          productCode: m.dispatchedProduct?.code,
          totalDispatched: 0,
          totalReturned: 0,
          outstandingQuantity: 0,
        };
        summaryMap.set(prodId, s);
      }
      s.totalDispatched += Number(m.dispatchedQty || 0);
      s.totalReturned += Number(m.returnedQty || 0);
      s.outstandingQuantity = Math.max(0, s.totalDispatched - s.totalReturned);
    }

    return {
      scId,
      summary: Array.from(summaryMap.values()),
      movements: movements.map(m => ({
        id: m.id,
        challanId: m.challanId,
        challanNumber: m.challan?.challanNumber,
        vendorId: m.challan?.vendorId,
        vendorName: m.challan?.vendor?.name,
        processId: m.processId,
        processName: m.process?.name,
        dispatchedProductId: m.dispatchedProductId,
        dispatchedProductName: m.dispatchedProduct?.name,
        dispatchedQty: -Number(m.dispatchedQty), // Display as negative liability (e.g. -100)
        returnedProductId: m.returnedProductId,
        returnedProductName: m.returnedProduct?.name,
        returnedQty: Number(m.returnedQty || 0),
        status: m.status,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    };
  }

  /**
   * Retrieves all DC movements across both Type 1 (Process / Subcontracting)
   * and Type 2 (General Inventory Stock Conversion).
   */
  async getAllDcMovements(): Promise<any[]> {
    // 1. Fetch Type 1 movements from dc_movements table
    const type1Movements = await this.dcMovementRepo.find({
      relations: {
        challan: { vendor: true },
        process: true,
        sc: true,
        dispatchedProduct: true,
        returnedProduct: true,
      },
      order: { createdAt: 'DESC' },
    });

    // 2. Fetch Type 2 DC items from delivery_challan_items table
    const type2Items = await this.dataSource.getRepository(DeliveryChallanItem).find({
      where: {
        challan: {
          type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        },
      },
      relations: {
        challan: { vendor: true },
        product: true,
        outputProduct: true,
        bin: true,
        outputBin: true,
      },
      order: { createdAt: 'DESC' },
    });

    const results: any[] = [];

    // Map Type 1 items
    for (const m of type1Movements) {
      const dispQty = Number(m.dispatchedQty || 0);
      const retQty = Number(m.returnedQty || 0);
      const challan = m.challan;
      const vendor = challan?.vendor;

      // Outward entry (always exists)
      results.push({
        id: `t1-out-${m.id}`,
        movementId: m.id,
        challanId: m.challanId,
        challanNumber: challan?.challanNumber || '—',
        challanType: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        challanTypeLabel: 'Type 1 (Process)',
        direction: 'OUTWARD',
        date: m.createdAt,
        vendorId: vendor?.id || challan?.vendorId,
        vendorName: vendor?.name || '—',
        vendorCode: vendor?.code || '',
        scNumber: m.sc?.scNumber || '—',
        processName: m.process?.name || 'Subcontract Process',
        partNumber: m.sc?.scNumber || '—',
        partName: m.sc?.productName || m.dispatchedProduct?.name || '—',
        productId: m.dispatchedProductId,
        productCode: m.dispatchedProduct?.code || '',
        productName: m.dispatchedProduct?.name || '—',
        quantity: -dispQty,
        rawQuantity: dispQty,
        uom: m.dispatchedProduct?.uom || 'NOS',
        location: m.process?.name ? `Process: ${m.process.name}` : 'WIP Process Stage',
        status: m.status,
        notes: challan?.notes || '',
      });

      // Inward entry (if returnedQty > 0)
      if (retQty > 0) {
        results.push({
          id: `t1-in-${m.id}`,
          movementId: m.id,
          challanId: m.challanId,
          challanNumber: challan?.challanNumber || '—',
          challanType: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
          challanTypeLabel: 'Type 1 (Process)',
          direction: 'INWARD',
          date: m.updatedAt || m.createdAt,
          vendorId: vendor?.id || challan?.vendorId,
          vendorName: vendor?.name || '—',
          vendorCode: vendor?.code || '',
          scNumber: m.sc?.scNumber || '—',
          processName: m.process?.name || 'Subcontract Process',
          partNumber: m.sc?.scNumber || '—',
          partName: m.sc?.productName || m.returnedProduct?.name || m.dispatchedProduct?.name || '—',
          productId: m.returnedProductId || m.dispatchedProductId,
          productCode: m.returnedProduct?.code || m.dispatchedProduct?.code || '',
          productName: m.returnedProduct?.name || m.dispatchedProduct?.name || '—',
          quantity: retQty,
          rawQuantity: retQty,
          uom: m.returnedProduct?.uom || m.dispatchedProduct?.uom || 'NOS',
          location: 'Production Receipt',
          status: m.status,
          notes: challan?.notes || '',
        });
      }
    }

    // Map Type 2 items
    for (const item of type2Items) {
      const dispQty = Number(item.quantityDispatched || 0);
      const retQty = Number(item.quantityReturned || 0);
      const challan = item.challan;
      const vendor = challan?.vendor;

      // Outward entry (always exists)
      results.push({
        id: `t2-out-${item.id}`,
        movementId: item.id,
        challanId: item.challanId,
        challanNumber: challan?.challanNumber || '—',
        challanType: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        challanTypeLabel: 'Type 2 (Stock Conversion)',
        direction: 'OUTWARD',
        date: item.createdAt || challan?.dispatchDate || challan?.createdAt,
        vendorId: vendor?.id || challan?.vendorId,
        vendorName: vendor?.name || '—',
        vendorCode: vendor?.code || '',
        scNumber: '—',
        processName: 'Stock Conversion',
        partNumber: item.partNumber || 'DC2-001',
        partName: item.partName || item.product?.name || '—',
        productId: item.productId,
        productCode: item.product?.code || '',
        productName: item.product?.name || '—',
        quantity: -dispQty,
        rawQuantity: dispQty,
        uom: item.product?.uom || 'NOS',
        location: item.bin?.code ? `Bin: ${item.bin.code}` : 'Warehouse Outward',
        status: challan?.status || 'DISPATCHED',
        notes: challan?.notes || '',
      });

      // Inward entry (if returnedQty > 0)
      if (retQty > 0) {
        const retProd = item.outputProduct || item.product;
        results.push({
          id: `t2-in-${item.id}`,
          movementId: item.id,
          challanId: item.challanId,
          challanNumber: challan?.challanNumber || '—',
          challanType: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
          challanTypeLabel: 'Type 2 (Stock Conversion)',
          direction: 'INWARD',
          date: challan?.actualReturnDate || item.updatedAt || item.createdAt,
          vendorId: vendor?.id || challan?.vendorId,
          vendorName: vendor?.name || '—',
          vendorCode: vendor?.code || '',
          scNumber: '—',
          processName: 'Stock Conversion',
          partNumber: item.partNumber || 'DC2-001',
          partName: item.partName || retProd?.name || '—',
          productId: retProd?.id || item.productId,
          productCode: retProd?.code || '',
          productName: retProd?.name || '—',
          quantity: retQty,
          rawQuantity: retQty,
          uom: retProd?.uom || 'NOS',
          location: item.outputBin?.code ? `Bin: ${item.outputBin.code}` : item.bin?.code ? `Bin: ${item.bin.code}` : 'Warehouse Inward',
          status: challan?.status || 'RETURNED',
          notes: challan?.notes || '',
        });
      }
    }

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Calculates the next continuous global sequential number for Type 2 DC items.
   * Scans all existing DC2-xxx part numbers in delivery_challan_items and returns (max + 1).
   */
  async getNextType2ItemSequence(manager?: EntityManager): Promise<number> {
    const repo = manager
      ? manager.getRepository(DeliveryChallanItem)
      : this.dataSource.getRepository(DeliveryChallanItem);

    const items = await repo
      .createQueryBuilder('item')
      .select('item.partNumber', 'partNumber')
      .where("item.partNumber LIKE 'DC2-%'")
      .getRawMany();

    let maxSeq = 0;
    for (const it of items) {
      if (!it.partNumber) continue;
      const match = it.partNumber.replace(/\s+/g, '').match(/^DC2-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    return maxSeq + 1;
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
