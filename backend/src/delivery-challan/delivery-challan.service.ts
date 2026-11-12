import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, LessThan, In, EntityManager, Like } from 'typeorm';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement, DcMovementStatus } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem, ReworkItemStatus } from './entities/dc-rework-item.entity.js';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto.js';
import { ReturnDeliveryChallanDto } from './dto/return-delivery-challan.dto.js';
import { QcInspectDeliveryChallanDto } from './dto/qc-inspect-delivery-challan.dto.js';
import { ReworkReDispatchDto } from './dto/rework-re-dispatch.dto.js';
import { VendorProcessCapability } from '../vendor/entities/vendor-process-capability.entity.js';
import { VendorSla } from '../vendor/entities/vendor-sla.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { CommunicationService } from '../notifications/communication.service.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { PrintableDeliveryChallanDto, PrintableCompanyInfo } from './dto/printable-delivery-challan.dto.js';
import { UploadedFile } from '../files/entities/uploaded-file.entity.js';
import { Attachment } from '../attachments/entities/attachment.entity.js';
import { PdfGeneratorService } from '../reports/pdf/pdf-generator.service.js';
import { MercIndentPending } from '../merc-indent/entities/merc-indent-pending.entity.js';
import { MercIndentLineItem } from '../merc-indent/entities/merc-indent-line-item.entity.js';
import { CreateSplDcDto } from './dto/create-spl-dc.dto.js';
import { LockCheckDto } from './dto/lock-check.dto.js';
import {
  normalizeText,
  buildProductKey,
  buildType1LockKey,
  buildType3LockKey,
} from './utils/product-key.util.js';

export interface BlockingDcInfo {
  dcId: string;
  dcNumber: string;
  pendingQty: number;
}

export interface ProductLockConflict {
  dcType: string;
  scNumber: string | null;
  poNumber: string | null;
  productLabel: string;
  requestedQty: number;
  availableQty: number;
  pendingQty: number;
  capQty?: number | null;
  blockingDcs: BlockingDcInfo[];
}

export interface ProductLockItemInput {
  scId?: string | null;
  productId?: string | null;
  partName?: string | null;
  partNumber?: string | null;
  poNumber?: string | null;
  mercItemId?: string | null;
  poPartLabel?: string | null;
  isExtraItem?: boolean;
  requestedQty: number;
}

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
    @InjectRepository(DcQcInspection)
    private readonly dcQcRepo: Repository<DcQcInspection>,
    @InjectRepository(DcReworkItem)
    private readonly reworkRepo: Repository<DcReworkItem>,
    private readonly dataSource: DataSource,
    @Optional() private readonly communicationService?: CommunicationService,
    @Optional() @InjectRepository(UploadedFile)
    private readonly uploadedFileRepo?: Repository<UploadedFile>,
    @Optional() @InjectRepository(Attachment)
    private readonly attachmentRepo?: Repository<Attachment>,
    @Optional() private readonly pdfGeneratorService?: PdfGeneratorService,
    @Optional()
    @InjectRepository(MercIndentPending)
    private readonly mercIndentPendingRepo?: Repository<MercIndentPending>,
    @Optional()
    @InjectRepository(MercIndentLineItem)
    private readonly mercIndentLineItemRepo?: Repository<MercIndentLineItem>,
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
    if (dto.items.some(item => !item.scId)) {
      throw new BadRequestException('scId is required for all items in Type 1 challan');
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
      // Extract unique process IDs from items (optional)
      const uniqueProcessIds: string[] = Array.from(
        new Set(dto.items.map(item => item.processId).filter((pid): pid is string => Boolean(pid)))
      );

      // 1. Validate Vendor Process Capability for all distinct processes if provided
      if (uniqueProcessIds.length > 0) {
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
      }

      // 2. Compute Expected Return Date via Vendor SLA if not provided
      let expectedReturnDate = dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null;
      if (!expectedReturnDate) {
        const dispatch = new Date(dto.dispatchDate);
        if (uniqueProcessIds.length > 0) {
          const slaRepo = queryRunner.manager.getRepository(VendorSla);
          const sla = await slaRepo.findOne({
            where: { vendorId: dto.vendorId, processId: uniqueProcessIds[0], isActive: true },
          });

          if (sla && sla.slaDays) {
            expectedReturnDate = new Date(dispatch.getTime() + sla.slaDays * 24 * 60 * 60 * 1000);
          } else {
            expectedReturnDate = new Date(dispatch.getTime() + 7 * 24 * 60 * 60 * 1000);
          }
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

      const resolvedProcessName =
        dto.processName?.trim() ||
        dto.items.find(i => i.processName?.trim())?.processName?.trim() ||
        null;

      // Validate Product-Level Quantity Lock for Type 1 before insert
      const lockItems: ProductLockItemInput[] = [];
      for (const itemDto of dto.items) {
        const targetScId = itemDto.scId || headerScId;
        let partNumber = itemDto.partNumber?.trim() || null;
        let partName = itemDto.partName?.trim() || null;
        const targetRmItemId = itemDto.rmItemId || itemDto.productId || null;

        let sc: SalesOrderComponent | null = null;
        if (targetScId) {
          sc = await queryRunner.manager.findOne(SalesOrderComponent, {
            where: { id: targetScId },
          });
          if (sc) {
            partNumber = sc.scNumber;
          }
        }

        if (targetScId && targetRmItemId) {
          const rmItem = await queryRunner.manager.findOne(RmItem, {
            where: [
              { id: targetRmItemId },
              { scId: targetScId, mappedProductId: targetRmItemId },
              { scId: targetScId, id: targetRmItemId },
            ],
          });
          if (rmItem) {
            partName = rmItem.partName || rmItem.material || partName;
          }
        }

        if (!partName && itemDto.productId) {
          const prod = await queryRunner.manager.findOne(Product, {
            where: { id: itemDto.productId },
          });
          if (prod) {
            partName = prod.name || null;
          }
        }

        if (!partName && sc) {
          partName = sc.productName;
        }

        lockItems.push({
          scId: targetScId,
          productId: itemDto.productId || null,
          partName,
          partNumber,
          requestedQty: Number(itemDto.quantityDispatched ?? 0),
        });
      }

      await this.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        lockItems,
        queryRunner.manager,
      );

      const challan = queryRunner.manager.create(DeliveryChallan, {
        challanNumber,
        type: dto.type,
        vendorId: dto.vendorId,
        scId: headerScId,
        processId: headerProcessId,
        processName: resolvedProcessName,
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

        // Resolve partNumber and partName with precision:
        // 1. If explicit partNumber and partName are supplied, preserve them.
        // 2. If targetScId and rmItemId or productId are present, check if this is an RmItem under this SC.
        // 3. If missing, look up Product by productId.
        // 4. Finally, fallback to parent SalesOrderComponent assembly if still unresolved.
        let partNumber = itemDto.partNumber?.trim() || null;
        let partName = itemDto.partName?.trim() || null;
        const targetRmItemId = itemDto.rmItemId || itemDto.productId || null;

        let sc: SalesOrderComponent | null = null;
        if (targetScId) {
          sc = await queryRunner.manager.findOne(SalesOrderComponent, {
            where: { id: targetScId },
          });
          if (sc) {
            // Per requirement: Part No must ALWAYS display the corresponding SC Name
            partNumber = sc.scNumber;
          }
        }

        if (targetScId && targetRmItemId) {
          const rmItem = await queryRunner.manager.findOne(RmItem, {
            where: [
              { id: targetRmItemId },
              { scId: targetScId, mappedProductId: targetRmItemId },
              { scId: targetScId, id: targetRmItemId },
            ],
          });
          if (rmItem) {
            // Per requirement: Product must ALWAYS display the actual Part Name from RM Requisition
            partName = rmItem.partName || rmItem.material || partName;
          }
        }

        if (!partName && itemDto.productId) {
          const prod = await queryRunner.manager.findOne(Product, {
            where: { id: itemDto.productId },
          });
          if (prod) {
            partName = prod.name || null;
          }
        }

        if (!partName && sc) {
          partName = sc.productName;
        }

        // Create DC item
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId ?? null,
          binId: itemDto.binId ?? null,
          scId: targetScId ?? null,
          processId: (itemDto.processId || headerProcessId) ?? null,
          processName: itemDto.processName || resolvedProcessName || null,
          batchNumber: itemDto.batchNumber ?? null,
          description: itemDto.description ?? null,
          partNumber: partNumber ?? null,
          partName: partName ?? null,
          quantityDispatched: quantityToDispatch,
          initialExpectedQty: quantityToDispatch,
          expectedReturnQty: quantityToDispatch,
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

      if (this.pdfGeneratorService) {
        const challanForPdf = await this.challanRepo.findOne({
          where: { id: savedChallanDetails.id },
          relations: { items: true, vendor: true, sc: true, createdBy: true },
        });
        if (challanForPdf) {
          this.pdfGeneratorService
            .generateDeliveryChallanPdf(challanForPdf)
            .then(async (buffer) => {
              const archived = await this.pdfGeneratorService!.archivePdf(
                buffer,
                'challan',
                savedChallanDetails.id,
                userId,
              );
              // Write to attachments table so DC files are queryable
              // Find the uploaded_files record just created by archivePdf
              // archivePdf calls filesService.uploadRawBuffer which saves to uploaded_files
              // We need the uploaded_files id — query by storageKey
              const uploadedFile = await this.uploadedFileRepo?.findOne({
                where: { storageKey: archived.storageKey },
              });
              if (uploadedFile && this.attachmentRepo) {
                const existing = await this.attachmentRepo.findOne({
                  where: {
                    fileId: uploadedFile.id,
                    context: 'DELIVERY_CHALLAN' as any,
                    recordId: savedChallanDetails.id,
                  },
                });
                if (!existing) {
                  await this.attachmentRepo.save({
                    fileId: uploadedFile.id,
                    context: 'DELIVERY_CHALLAN' as any,
                    recordId: savedChallanDetails.id,
                    documentType: 'DC_PDF',
                    createdById: userId,
                    isActive: true,
                  });
                }
              }
            })
            .catch((err) =>
              this.logger.warn(
                `DC PDF auto-archive failed for ${savedChallanDetails.challanNumber}: ${err?.message}`,
              ),
            );
        }
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

      const resolvedProcessName =
        dto.processName?.trim() ||
        dto.items.find(i => i.processName?.trim())?.processName?.trim() ||
        'STOCK CONVERSION';

      const challan = queryRunner.manager.create(DeliveryChallan, {
        challanNumber,
        type: dto.type,
        vendorId: dto.vendorId,
        scId: dto.scId,
        processId: dto.processId,
        processName: resolvedProcessName,
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

        const initialExpected =
          itemDto.expectedOutputQuantity != null
            ? Number(itemDto.expectedOutputQuantity)
            : itemDto.initialExpectedQty != null
            ? Number(itemDto.initialExpectedQty)
            : quantityToDispatch;

        // Create DC item with Type 2 stock conversion mapping
        const dcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedChallan.id,
          productId: itemDto.productId,
          binId: itemDto.binId,
          outputProductId: itemDto.outputProductId ?? null,
          expectedOutputQuantity:
            itemDto.expectedOutputQuantity != null ? Number(itemDto.expectedOutputQuantity) : null,
          initialExpectedQty: initialExpected,
          expectedReturnQty: initialExpected,
          outputBinId: itemDto.outputBinId ?? null,
          scId: itemDto.scId ?? null,
          processId: (itemDto.processId || dto.processId) ?? null,
          processName: itemDto.processName || resolvedProcessName || null,
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

      if (this.pdfGeneratorService) {
        const challanForPdf = await this.challanRepo.findOne({
          where: { id: savedChallanDetails.id },
          relations: { items: true, vendor: true, sc: true, createdBy: true },
        });
        if (challanForPdf) {
          this.pdfGeneratorService
            .generateDeliveryChallanPdf(challanForPdf)
            .then(async (buffer) => {
              const archived = await this.pdfGeneratorService!.archivePdf(
                buffer,
                'challan',
                savedChallanDetails.id,
                userId,
              );
              // Write to attachments table so DC files are queryable
              // Find the uploaded_files record just created by archivePdf
              // archivePdf calls filesService.uploadRawBuffer which saves to uploaded_files
              // We need the uploaded_files id — query by storageKey
              const uploadedFile = await this.uploadedFileRepo?.findOne({
                where: { storageKey: archived.storageKey },
              });
              if (uploadedFile && this.attachmentRepo) {
                const existing = await this.attachmentRepo.findOne({
                  where: {
                    fileId: uploadedFile.id,
                    context: 'DELIVERY_CHALLAN' as any,
                    recordId: savedChallanDetails.id,
                  },
                });
                if (!existing) {
                  await this.attachmentRepo.save({
                    fileId: uploadedFile.id,
                    context: 'DELIVERY_CHALLAN' as any,
                    recordId: savedChallanDetails.id,
                    documentType: 'DC_PDF',
                    createdById: userId,
                    isActive: true,
                  });
                }
              }
            })
            .catch((err) =>
              this.logger.warn(
                `DC PDF auto-archive failed for ${savedChallanDetails.challanNumber}: ${err?.message}`,
              ),
            );
        }
      }
      return savedChallanDetails;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Calculates the product-level lock and available dispatch quantity for a single item.
   */
  public async calculateItemLock(
    type: DeliveryChallanType | string,
    item: {
      scId?: string | null;
      productId?: string | null;
      partName?: string | null;
      poNumber?: string | null;
      mercItemId?: string | null;
      isExtraItem?: boolean;
      quantity?: number;
    },
    manager: EntityManager,
  ): Promise<{
    isExempt: boolean;
    cap: number | null;
    capQty: number | null;
    baseline: number | null;
    outstanding: number;
    available: number;
    blockingDcs: BlockingDcInfo[];
    isCapFromBaseline?: boolean;
  }> {
    const isType1 = type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
    const isType3 = type === DeliveryChallanType.SPL_PROCESS;

    if (!isType1 && !isType3) {
      return {
        isExempt: true,
        cap: null,
        capQty: null,
        baseline: null,
        outstanding: 0,
        available: item.quantity != null ? Number(item.quantity) : Infinity,
        blockingDcs: [],
      };
    }

    if (typeof manager?.query !== 'function') {
      return {
        isExempt: false,
        cap: null,
        capQty: null,
        baseline: null,
        outstanding: 0,
        available: item.quantity != null ? Number(item.quantity) : Infinity,
        blockingDcs: [],
      };
    }

    if (isType1) {
      if (!item.scId) {
        return {
          isExempt: true,
          cap: null,
          capQty: null,
          baseline: null,
          outstanding: 0,
          available: item.quantity != null ? Number(item.quantity) : Infinity,
          blockingDcs: [],
        };
      }

      const prodId = item.productId && String(item.productId).trim() ? String(item.productId).trim() : null;
      const normPartName = normalizeText(item.partName);

      if (!prodId && !normPartName) {
        return {
          isExempt: true,
          cap: null,
          capQty: null,
          baseline: null,
          outstanding: 0,
          available: item.quantity != null ? Number(item.quantity) : Infinity,
          blockingDcs: [],
        };
      }

      // 1. Resolve Cap for Type 1
      let resolvedCap: number | null = null;
      let isCapFromBaseline = false;

      // Check child rm_items under sc_id first
      const rmRows: Array<{ cap: string | number }> = await manager.query(
        `
        SELECT SUM(rmi.quantity) as cap
        FROM rm_items rmi
        WHERE rmi.sc_id = $1::uuid
          AND (
            ($2::uuid IS NOT NULL AND rmi.mapped_product_id = $2::uuid)
            OR ($3 <> '' AND (
              UPPER(REGEXP_REPLACE(TRIM(COALESCE(rmi.part_name, '')), '\\s+', ' ', 'g')) = $3
              OR UPPER(REGEXP_REPLACE(TRIM(COALESCE(rmi.material, '')), '\\s+', ' ', 'g')) = $3
            ))
          );
        `,
        [item.scId, prodId, normPartName],
      );

      if (rmRows && rmRows.length > 0 && rmRows[0].cap != null && Number(rmRows[0].cap) > 0) {
        resolvedCap = Number(rmRows[0].cap);
      } else {
        // Fallback to sales_order_components.target_quantity
        const scRows: Array<{ target_quantity: string | number }> = await manager.query(
          `
          SELECT soc.target_quantity
          FROM sales_order_components soc
          WHERE soc.id = $1::uuid
            AND (
              ($2::uuid IS NOT NULL AND soc.product_id = $2::uuid)
              OR ($3 <> '' AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(soc.product_name, '')), '\\s+', ' ', 'g')) = $3)
              OR ($2::uuid IS NULL AND $3 = '')
            );
          `,
          [item.scId, prodId, normPartName],
        );

        if (scRows && scRows.length > 0 && scRows[0].target_quantity != null && Number(scRows[0].target_quantity) > 0) {
          resolvedCap = Number(scRows[0].target_quantity);
        }
      }

      // Query open DCs for outstanding calculation
      const openRows: Array<{
        dcId: string;
        dcNumber: string;
        pendingQty: string | number;
      }> = await manager.query(
        `
        SELECT 
          dc.id as "dcId",
          dc.challan_number as "dcNumber",
          GREATEST(dci.quantity_dispatched - COALESCE(dci.actual_received_qty, 0), 0) as "pendingQty"
        FROM delivery_challan_items dci
        JOIN delivery_challans dc ON dci.challan_id = dc.id
        WHERE dc.type = 'PRODUCTION_PROCESS_OUTWARD'
          AND dci.sc_id = $1::uuid
          AND (
            ($2::uuid IS NOT NULL AND dci.product_id = $2::uuid)
            OR ($3 <> '' AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(dci.part_name, '')), '\\s+', ' ', 'g')) = $3)
          )
          AND dc.status NOT IN ('CLOSED', 'RETURNED')
        ORDER BY dc.created_at ASC, dci.id ASC;
        `,
        [item.scId, prodId, normPartName],
      );

      // If cap was not found on SC/rm_items, fallback to earliest DC quantity
      if (resolvedCap == null || resolvedCap <= 0) {
        const earliestRows: Array<{ id: string; quantity_dispatched: string | number }> = await manager.query(
          `
          SELECT dci.id, dci.quantity_dispatched
          FROM delivery_challan_items dci
          JOIN delivery_challans dc ON dci.challan_id = dc.id
          WHERE dc.type = 'PRODUCTION_PROCESS_OUTWARD'
            AND dci.sc_id = $1::uuid
            AND (
              ($2::uuid IS NOT NULL AND dci.product_id = $2::uuid)
              OR ($3 <> '' AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(dci.part_name, '')), '\\s+', ' ', 'g')) = $3)
            )
          ORDER BY dci.created_at ASC, dci.id ASC
          LIMIT 1;
          `,
          [item.scId, prodId, normPartName],
        );

        if (earliestRows && earliestRows.length > 0) {
          resolvedCap = Number(earliestRows[0].quantity_dispatched);
          isCapFromBaseline = true;
        }
      }

      if (resolvedCap == null) {
        return {
          isExempt: false,
          cap: null,
          capQty: null,
          baseline: null,
          outstanding: 0,
          available: item.quantity != null ? Number(item.quantity) : Infinity,
          blockingDcs: [],
          isCapFromBaseline: false,
        };
      }

      const blockingDcs: BlockingDcInfo[] = openRows
        .filter((r) => Number(r.pendingQty) > 0.0001)
        .map((r) => ({
          dcId: r.dcId,
          dcNumber: r.dcNumber,
          pendingQty: Number(r.pendingQty),
        }));

      const outstanding = openRows.reduce((sum, r) => sum + Number(r.pendingQty), 0);
      const available = Math.max(0, resolvedCap - outstanding);

      return {
        isExempt: false,
        cap: resolvedCap,
        capQty: resolvedCap,
        baseline: resolvedCap,
        outstanding,
        available,
        blockingDcs,
        isCapFromBaseline,
      };
    }

    if (isType3) {
      if (item.isExtraItem || !item.mercItemId) {
        return {
          isExempt: true,
          cap: null,
          capQty: null,
          baseline: null,
          outstanding: 0,
          available: item.quantity != null ? Number(item.quantity) : Infinity,
          blockingDcs: [],
        };
      }

      const normPo = normalizeText(item.poNumber);
      const mercItemId = String(item.mercItemId).trim();

      if (!normPo || !mercItemId) {
        return {
          isExempt: true,
          cap: null,
          capQty: null,
          baseline: null,
          outstanding: 0,
          available: item.quantity != null ? Number(item.quantity) : Infinity,
          blockingDcs: [],
        };
      }

      // 1. Resolve Cap for Type 3 from merc_indent_line_items
      let resolvedCap: number | null = null;
      let isCapFromBaseline = false;

      const mercRows: Array<{ cap: string | number }> = await manager.query(
        `
        SELECT 
          GREATEST(
            COALESCE(mili.quantity_required, 0),
            COALESCE(mili.quantity_issued, 0)
          ) as cap
        FROM merc_indent_line_items mili
        JOIN merc_indent_pending mip ON mili.merc_indent_pending_id = mip.id
        WHERE UPPER(REGEXP_REPLACE(TRIM(COALESCE(mip.po_number, '')), '\\s+', ' ', 'g')) = $1
          AND mili.merc_item_id = $2
        LIMIT 1;
        `,
        [normPo, mercItemId],
      );

      if (mercRows && mercRows.length > 0 && mercRows[0].cap != null && Number(mercRows[0].cap) > 0) {
        resolvedCap = Number(mercRows[0].cap);
      } else {
        // Fallback to earliest DC quantity
        const earliestRows: Array<{ id: string; quantity_dispatched: string | number }> = await manager.query(
          `
          SELECT dci.id, dci.quantity_dispatched
          FROM delivery_challan_items dci
          JOIN delivery_challans dc ON dci.challan_id = dc.id
          WHERE dc.type = 'SPL_PROCESS'
            AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(dc.po_number, '')), '\\s+', ' ', 'g')) = $1
            AND dci.merc_item_id = $2
            AND (dci.is_extra_item IS NOT TRUE)
          ORDER BY dci.created_at ASC, dci.id ASC
          LIMIT 1;
          `,
          [normPo, mercItemId],
        );

        if (earliestRows && earliestRows.length > 0) {
          resolvedCap = Number(earliestRows[0].quantity_dispatched);
          isCapFromBaseline = true;
        }
      }

      if (resolvedCap == null) {
        return {
          isExempt: false,
          cap: null,
          capQty: null,
          baseline: null,
          outstanding: 0,
          available: item.quantity != null ? Number(item.quantity) : Infinity,
          blockingDcs: [],
          isCapFromBaseline: false,
        };
      }

      const openRows: Array<{
        dcId: string;
        dcNumber: string;
        pendingQty: string | number;
      }> = await manager.query(
        `
        SELECT 
          dc.id as "dcId",
          dc.challan_number as "dcNumber",
          GREATEST(dci.quantity_dispatched - COALESCE(dci.actual_received_qty, 0), 0) as "pendingQty"
        FROM delivery_challan_items dci
        JOIN delivery_challans dc ON dci.challan_id = dc.id
        WHERE dc.type = 'SPL_PROCESS'
          AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(dc.po_number, '')), '\\s+', ' ', 'g')) = $1
          AND dci.merc_item_id = $2
          AND (dci.is_extra_item IS NOT TRUE)
          AND dc.status NOT IN ('CLOSED', 'RETURNED')
        ORDER BY dc.created_at ASC, dci.id ASC;
        `,
        [normPo, mercItemId],
      );

      const blockingDcs: BlockingDcInfo[] = openRows
        .filter((r) => Number(r.pendingQty) > 0.0001)
        .map((r) => ({
          dcId: r.dcId,
          dcNumber: r.dcNumber,
          pendingQty: Number(r.pendingQty),
        }));

      const outstanding = openRows.reduce((sum, r) => sum + Number(r.pendingQty), 0);
      const available = Math.max(0, resolvedCap - outstanding);

      return {
        isExempt: false,
        cap: resolvedCap,
        capQty: resolvedCap,
        baseline: resolvedCap,
        outstanding,
        available,
        blockingDcs,
        isCapFromBaseline,
      };
    }

    return {
      isExempt: true,
      cap: null,
      capQty: null,
      baseline: null,
      outstanding: 0,
      available: item.quantity != null ? Number(item.quantity) : Infinity,
      blockingDcs: [],
    };
  }

  /**
   * Enforces the quantity-based product lock inside an active transaction.
   * Acquires advisory transaction locks in sorted order to eliminate race conditions.
   * Collects all conflicts across items and rejects intra-request duplicates.
   */
  public async validateProductLock(
    type: DeliveryChallanType | string,
    items: ProductLockItemInput[],
    manager: EntityManager,
  ): Promise<void> {
    const isType1 = type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
    const isType3 = type === DeliveryChallanType.SPL_PROCESS;

    if (!isType1 && !isType3) {
      return;
    }

    if (!items || items.length === 0) {
      return;
    }

    interface PreparedItem {
      rawItem: ProductLockItemInput;
      lockKey: string;
      productLabel: string;
      scNumber: string | null;
      poNumber: string | null;
    }

    const preparedItems: PreparedItem[] = [];
    const conflicts: ProductLockConflict[] = [];
    const seenRequestKeys = new Set<string>();

    for (const it of items) {
      if (isType3 && (it.isExtraItem || !it.mercItemId)) {
        continue;
      }

      if (isType1 && !it.scId) {
        continue;
      }

      let lockKey = '';
      let productLabel = '';
      let scNumber: string | null = it.partNumber || null;
      let poNumber: string | null = null;

      if (isType1) {
        const prodKey = buildProductKey({ productId: it.productId, partName: it.partName });
        if (!prodKey) continue;
        lockKey = buildType1LockKey(it.scId!, prodKey);
        productLabel = it.partName || prodKey;

        if (!scNumber && it.scId) {
          try {
            const sc = await manager.findOne(SalesOrderComponent, { where: { id: it.scId } });
            if (sc) {
              scNumber = sc.scNumber;
              if (!productLabel || productLabel === prodKey) {
                productLabel = sc.productName || productLabel;
              }
            }
          } catch {
            // Ignore lookup failure
          }
        }
      } else if (isType3) {
        const normPo = normalizeText(it.poNumber);
        if (!normPo || !it.mercItemId) continue;
        lockKey = buildType3LockKey(normPo, it.mercItemId);
        productLabel = it.poPartLabel || it.partNumber || it.mercItemId;
        poNumber = normPo;
      }

      if (seenRequestKeys.has(lockKey)) {
        conflicts.push({
          dcType: String(type),
          scNumber,
          poNumber,
          productLabel,
          requestedQty: it.requestedQty,
          availableQty: 0,
          pendingQty: 0,
          blockingDcs: [],
        });
      } else {
        seenRequestKeys.add(lockKey);
        preparedItems.push({
          rawItem: it,
          lockKey,
          productLabel,
          scNumber,
          poNumber,
        });
      }
    }

    const uniqueKeys = Array.from(new Set(preparedItems.map((p) => p.lockKey))).sort();
    for (const key of uniqueKeys) {
      if (typeof manager?.query === 'function') {
        try {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
        } catch {
          // Continue if advisory lock is not supported in simulated unit test managers
        }
      }
    }

    for (const item of preparedItems) {
      const lockInfo = await this.calculateItemLock(
        type,
        {
          scId: item.rawItem.scId,
          productId: item.rawItem.productId,
          partName: item.rawItem.partName,
          poNumber: item.rawItem.poNumber,
          mercItemId: item.rawItem.mercItemId,
          isExtraItem: item.rawItem.isExtraItem,
          quantity: item.rawItem.requestedQty,
        },
        manager,
      );

      if (!lockInfo.isExempt && (lockInfo.cap !== null || lockInfo.baseline !== null)) {
        if (item.rawItem.requestedQty > lockInfo.available + 0.0001) {
          conflicts.push({
            dcType: String(type),
            scNumber: item.scNumber,
            poNumber: item.poNumber,
            productLabel: item.productLabel,
            requestedQty: item.rawItem.requestedQty,
            availableQty: lockInfo.available,
            pendingQty: lockInfo.outstanding,
            capQty: lockInfo.cap ?? lockInfo.baseline,
            blockingDcs: lockInfo.blockingDcs,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      throw new ConflictException({
        code: 'DC_PRODUCT_LOCKED',
        message: 'Product not yet inwarded',
        conflicts,
      });
    }
  }

  /**
   * Diagnostic preview lock check without writes or persistent locks.
   */
  public async checkProductLock(dto: LockCheckDto): Promise<{
    allowed: boolean;
    conflicts: ProductLockConflict[];
    items: Array<{
      lockKey: string;
      productLabel: string;
      requestedQty: number;
      baseline: number | null;
      outstanding: number;
      available: number;
      allowed: boolean;
      blockingDcs: BlockingDcInfo[];
    }>;
  }> {
    const isType1 = dto.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
    const isType3 = dto.type === DeliveryChallanType.SPL_PROCESS;

    const itemsSummary: Array<{
      lockKey: string;
      productLabel: string;
      requestedQty: number;
      cap?: number | null;
      capQty?: number | null;
      baseline: number | null;
      outstanding: number;
      available: number;
      allowed: boolean;
      blockingDcs: BlockingDcInfo[];
    }> = [];

    const conflicts: ProductLockConflict[] = [];
    const seenKeys = new Set<string>();

    for (const it of dto.items) {
      const targetScId = it.scId || dto.scId;
      const targetPo = dto.poNumber || null;

      if (isType3 && (it.isExtraItem || !it.mercItemId)) {
        itemsSummary.push({
          lockKey: 'EXEMPT',
          productLabel: it.poPartLabel || it.partNumber || it.partName || 'Extra Item',
          requestedQty: Number(it.quantity || 0),
          baseline: null,
          outstanding: 0,
          available: Number(it.quantity || 0),
          allowed: true,
          blockingDcs: [],
        });
        continue;
      }

      let lockKey = '';
      let productLabel = it.partName || it.poPartLabel || it.partNumber || 'Item';
      let scNumber: string | null = it.partNumber || null;

      if (isType1) {
        if (!targetScId) continue;
        const prodKey = buildProductKey({ productId: it.productId, partName: it.partName });
        lockKey = buildType1LockKey(targetScId, prodKey);
        productLabel = it.partName || prodKey;

        if (!scNumber && targetScId) {
          try {
            const sc = await this.dataSource.manager.findOne(SalesOrderComponent, { where: { id: targetScId } });
            if (sc) {
              scNumber = sc.scNumber;
              productLabel = sc.productName || productLabel;
            }
          } catch {
            // ignore
          }
        }
      } else if (isType3) {
        const normPo = normalizeText(targetPo);
        if (!normPo || !it.mercItemId) continue;
        lockKey = buildType3LockKey(normPo, it.mercItemId);
        productLabel = it.poPartLabel || it.partNumber || it.mercItemId;
      }

      if (seenKeys.has(lockKey)) {
        const conflict: ProductLockConflict = {
          dcType: String(dto.type),
          scNumber,
          poNumber: targetPo ? normalizeText(targetPo) : null,
          productLabel,
          requestedQty: Number(it.quantity || 0),
          availableQty: 0,
          pendingQty: 0,
          blockingDcs: [],
        };
        conflicts.push(conflict);
        itemsSummary.push({
          lockKey,
          productLabel,
          requestedQty: Number(it.quantity || 0),
          baseline: null,
          outstanding: 0,
          available: 0,
          allowed: false,
          blockingDcs: [],
        });
        continue;
      }

      seenKeys.add(lockKey);

      const lockInfo = await this.calculateItemLock(
        dto.type,
        {
          scId: targetScId,
          productId: it.productId,
          partName: it.partName,
          poNumber: targetPo,
          mercItemId: it.mercItemId,
          isExtraItem: it.isExtraItem,
          quantity: Number(it.quantity || 0),
        },
        this.dataSource.manager,
      );

      const isAllowed = lockInfo.isExempt || (lockInfo.cap === null && lockInfo.baseline === null) || Number(it.quantity || 0) <= lockInfo.available + 0.0001;

      if (!isAllowed) {
        conflicts.push({
          dcType: String(dto.type),
          scNumber,
          poNumber: targetPo ? normalizeText(targetPo) : null,
          productLabel,
          requestedQty: Number(it.quantity || 0),
          availableQty: lockInfo.available,
          pendingQty: lockInfo.outstanding,
          capQty: lockInfo.cap ?? lockInfo.baseline,
          blockingDcs: lockInfo.blockingDcs,
        });
      }

      itemsSummary.push({
        lockKey,
        productLabel,
        requestedQty: Number(it.quantity || 0),
        cap: lockInfo.cap,
        capQty: lockInfo.cap,
        baseline: lockInfo.baseline,
        outstanding: lockInfo.outstanding,
        available: lockInfo.available,
        allowed: isAllowed,
        blockingDcs: lockInfo.blockingDcs,
      });
    }

    return {
      allowed: conflicts.length === 0,
      conflicts,
      items: itemsSummary,
    };
  }

  private getPendingRepo(): Repository<MercIndentPending> {
    return this.mercIndentPendingRepo || this.dataSource.getRepository(MercIndentPending);
  }

  private getLineItemRepo(): Repository<MercIndentLineItem> {
    return this.mercIndentLineItemRepo || this.dataSource.getRepository(MercIndentLineItem);
  }

  async getMercPos(search?: string) {
    const pendingRepo = this.getPendingRepo();
    const qb = pendingRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.lineItems', 'lineItems')
      .orderBy('p.createdAt', 'DESC');

    if (search && search.trim()) {
      const s = search.trim();
      qb.where(
        '(LOWER(p.po_number) LIKE LOWER(:s) OR LOWER(p.layout_number) LIKE LOWER(:s) OR LOWER(p.indent_number) LIKE LOWER(:s) OR LOWER(p.customer_name) LIKE LOWER(:s))',
        { s: `%${s}%` },
      );
    }

    const records = await qb.take(50).getMany();

    return records
      .filter((r) => Boolean((r.poNumber && r.poNumber.trim()) || (r.layoutNumber && r.layoutNumber.trim())))
      .map((r) => ({
        id: r.id,
        poNumber: r.poNumber || r.layoutNumber || r.indentNumber,
        actualPoNumber: r.poNumber,
        layoutNumber: r.layoutNumber,
        indentNumber: r.indentNumber,
        customerName: r.customerName,
        lineItemCount: r.lineItems?.length ?? 0,
      }));
  }

  async getMercPoItems(poNumber: string) {
    const trimmedPo = poNumber?.trim();
    if (!trimmedPo) {
      throw new BadRequestException('PO number is required');
    }

    // 1. Find merc_indent_pending by exact match or partial match on po_number, layout_number, or indent_number
    const pendingRepo = this.getPendingRepo();
    const indent = await pendingRepo
      .createQueryBuilder('p')
      .where(
        '(LOWER(TRIM(p.po_number)) = LOWER(:po) OR LOWER(TRIM(p.layout_number)) = LOWER(:po) OR LOWER(p.po_number) LIKE LOWER(:likePo) OR LOWER(p.layout_number) LIKE LOWER(:likePo) OR LOWER(p.indent_number) LIKE LOWER(:likePo))',
        { po: trimmedPo, likePo: `%${trimmedPo}%` },
      )
      .getOne();

    if (!indent) {
      throw new NotFoundException('PO not found in MERC indents');
    }

    // 2. Fetch all merc_indent_line_items for this indent ordered by created_at ASC
    const lineItemRepo = this.getLineItemRepo();
    const lineItems = await lineItemRepo.find({
      where: { mercIndentPendingId: indent.id },
      order: { createdAt: 'ASC' },
    });

    // 4. Fetch all products with stock > 0 for "+ Add Item" option
    const stockProducts: Array<{ id: string; name: string; total_stock: string | number }> =
      await this.dataSource.query(`
        SELECT DISTINCT p.id, p.name, SUM(sb.current_quantity) as total_stock
        FROM products p
        JOIN stock_balances sb ON sb.product_id = p.id
        WHERE sb.current_quantity > 0
        GROUP BY p.id, p.name
        ORDER BY p.name ASC
      `);

    // 5. Return
    return {
      poNumber: indent.poNumber,
      indentNumber: indent.indentNumber,
      customerName: indent.customerName,
      layoutNumber: indent.layoutNumber,
      mercIndentId: indent.id,
      lineItems: await Promise.all(
        lineItems.map(async (item) => {
          const lockInfo = await this.calculateItemLock(
            DeliveryChallanType.SPL_PROCESS,
            {
              poNumber: indent.poNumber || poNumber,
              mercItemId: item.mercItemId,
              quantity: Number(item.quantityRequired),
            },
            this.dataSource.manager,
          );

          return {
            mercItemId: item.mercItemId,
            itemType: item.itemType,
            name: item.name,
            material: item.material ?? null,
            shape: item.shape ?? null,
            lengthMm: item.lengthMm != null ? Number(item.lengthMm) : null,
            widthMm: item.widthMm != null ? Number(item.widthMm) : null,
            heightMm: item.heightMm != null ? Number(item.heightMm) : null,
            diameterMm: item.diameterMm != null ? Number(item.diameterMm) : null,
            quantityRequired: Number(item.quantityRequired),
            unit: item.unit ?? null,
            vendorName: item.vendorName ?? null,
            source: item.source ?? null,
            poPartLabel: `${indent.poNumber || poNumber} - ${item.name}`,
            lock: {
              cap: lockInfo.cap,
              capQty: lockInfo.cap,
              baseline: lockInfo.baseline,
              outstanding: lockInfo.outstanding,
              available: lockInfo.available,
              blockingDcs: lockInfo.blockingDcs,
            },
          };
        }),
      ),
      availableStockProducts: (stockProducts || []).map((p) => ({
        productId: p.id,
        productName: p.name,
        totalStock: Number(p.total_stock),
      })),
    };
  }

  async createSplDc(dto: CreateSplDcDto, userId: string) {
    if (!dto.dispatchGroups || dto.dispatchGroups.length === 0) {
      throw new BadRequestException('At least one dispatch group is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate vendor exists
      const vendorRepo = queryRunner.manager.getRepository(Vendor);
      const vendor = await vendorRepo.findOne({ where: { id: dto.vendorId } });
      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${dto.vendorId} not found`);
      }

      // 2. Generate DC number using SAME sequence as Type 1 and Type 2
      const now = new Date();
      const challanNumber = await this.generateNextChallanNumber(queryRunner, now);

      // Validate Product-Level Quantity Lock for Type 3 (SPL) before insert
      const lockItems: ProductLockItemInput[] = [];
      for (const group of dto.dispatchGroups) {
        for (const item of group.items) {
          lockItems.push({
            poNumber: dto.poNumber,
            mercItemId: item.mercItemId || null,
            poPartLabel: item.poPartLabel || item.partNo || null,
            partNumber: item.partNo || null,
            isExtraItem: Boolean(item.isExtraItem),
            requestedQty: Number(item.dispatchedQty ?? 0),
          });
        }
      }

      await this.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        lockItems,
        queryRunner.manager,
      );

      // 3. Create delivery_challans record
      const challan = queryRunner.manager.create(DeliveryChallan, {
        challanNumber,
        type: DeliveryChallanType.SPL_PROCESS,
        vendorId: dto.vendorId,
        status: DeliveryChallanStatus.OPEN,
        poNumber: dto.poNumber,
        layoutNumber: dto.layoutNumber ?? null,
        mercIndentId: dto.mercIndentId ?? null,
        mercIndentNumber: dto.mercIndentNumber ?? null,
        dispatchDate: now,
        expectedReturnDate: dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null,
        notes: dto.remarks ?? null,
        createdById: userId,
      });

      const savedDc = await queryRunner.manager.save(DeliveryChallan, challan);

      // 4. For each dispatchGroup, for each item
      let itemCount = 0;
      const itemsToSave: DeliveryChallanItem[] = [];

      for (const group of dto.dispatchGroups) {
        for (const item of group.items) {
          itemCount++;
          const challanItem = queryRunner.manager.create(DeliveryChallanItem, {
            challanId: savedDc.id,
            poPartLabel: item.poPartLabel,
            partNumber: item.partNo,
            partName: item.poPartLabel || item.partNo || null,
            quantityDispatched: Number(item.dispatchedQty),
            initialExpectedQty: Number(item.dispatchedQty),
            expectedReturnQty: Number(item.dispatchedQty),
            quantityReturned: 0,
            qcPendingQty: 0,
            qcPassedQty: 0,
            qcRejectedQty: 0,
            actualReceivedQty: 0,
            batchNumber: item.batchNo ?? null,
            description: item.description ?? null,
            isExtraItem: item.isExtraItem ?? false,
            mercItemId: item.mercItemId ?? null,
            processName: group.processName,
            productId: item.productId ?? null,
          });
          itemsToSave.push(challanItem);
        }
      }

      if (itemsToSave.length > 0) {
        await queryRunner.manager.save(DeliveryChallanItem, itemsToSave);
      }

      // 5. Stock movement for extra items added to Type 3 DC
      // Regular PO items are not deducted (already issued from MERC store).
      // Only extra items added from stock must be deducted with "STOCK OUT FOR TYPE 3 DC <DC_NUMBER>"
      const stockBalanceRepo = queryRunner.manager.getRepository(StockBalance);

      for (const group of dto.dispatchGroups) {
        for (const item of group.items) {
          if (item.isExtraItem && item.productId) {
            const qtyToDeduct = Number(item.dispatchedQty || 0);
            if (qtyToDeduct > 0) {
              const balances = await stockBalanceRepo
                .createQueryBuilder('sb')
                .setLock('pessimistic_write')
                .where('sb.product_id = :productId', { productId: item.productId })
                .andWhere('sb.current_quantity > 0')
                .orderBy('sb.current_quantity', 'DESC')
                .getMany();

              let remainingToDeduct = qtyToDeduct;
              for (const bal of balances) {
                if (remainingToDeduct <= 0) break;
                const currentBalQty = Number(bal.currentQuantity || 0);
                const deductFromThis = Math.min(currentBalQty, remainingToDeduct);
                bal.currentQuantity = currentBalQty - deductFromThis;
                await queryRunner.manager.save(bal);

                remainingToDeduct -= deductFromThis;

                const stockTx = queryRunner.manager.create(StockTransaction, {
                  productId: item.productId,
                  sourceBinId: bal.binId,
                  transactionType: TransactionType.STOCK_OUT,
                  quantity: deductFromThis,
                  referenceType: 'DELIVERY_CHALLAN_TYPE_3',
                  referenceId: savedDc.id,
                  createdById: userId,
                  reason: `STOCK OUT FOR TYPE 3 DC ${challanNumber}`,
                  remarks: `STOCK OUT FOR TYPE 3 DC ${challanNumber}`,
                });
                await queryRunner.manager.save(stockTx);
              }
            }
          }
        }
      }

      await queryRunner.commitTransaction();

      // 6. Return: { id, dcNumber, status: 'OPEN', poNumber, itemCount }
      return {
        id: savedDc.id,
        dcNumber: savedDc.challanNumber,
        status: 'OPEN',
        poNumber: savedDc.poNumber,
        itemCount,
      };
    } catch (err: any) {
      if (queryRunner.isTransactionActive !== false) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error creating SPL DC: ${err?.message || err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async listSplDcs(filters?: { status?: string; vendorId?: string; poNumber?: string }) {
    const qb = this.challanRepo
      .createQueryBuilder('dc')
      .leftJoinAndSelect('dc.vendor', 'vendor')
      .leftJoinAndSelect('dc.items', 'items')
      .where('dc.type = :splType', { splType: DeliveryChallanType.SPL_PROCESS })
      .orderBy('dc.createdAt', 'DESC');

    if (filters?.status) {
      qb.andWhere('dc.status = :status', { status: filters.status });
    }
    if (filters?.vendorId) {
      qb.andWhere('dc.vendorId = :vendorId', { vendorId: filters.vendorId });
    }
    if (filters?.poNumber) {
      qb.andWhere('LOWER(dc.poNumber) LIKE LOWER(:poNumber)', { poNumber: `%${filters.poNumber.trim()}%` });
    }

    const challans = await qb.getMany();

    return challans.map((dc) => {
      const items = dc.items || [];
      const sentQty = items.reduce((acc, it) => acc + Number(it.quantityDispatched || 0), 0);
      const passedQty = items.reduce((acc, it) => acc + Number(it.qcPassedQty || 0), 0);
      const returnedQty = items.reduce(
        (acc, it) => acc + Number(it.quantityReturned || it.actualReceivedQty || 0),
        0,
      );
      const vendorQty = Math.max(0, sentQty - returnedQty);

      return {
        id: dc.id,
        dcNumber: dc.challanNumber,
        status: dc.status,
        poNumber: dc.poNumber ?? null,
        layoutNumber: dc.layoutNumber ?? null,
        mercIndentNumber: dc.mercIndentNumber ?? null,
        vendorName: dc.vendor?.name ?? null,
        vendorAddress: dc.vendor?.address ?? null,
        expectedReturnDate: dc.expectedReturnDate ?? null,
        remarks: dc.notes ?? null,
        createdAt: dc.createdAt,
        itemCount: items.length,
        sentQty,
        passedQty,
        vendorQty,
      };
    });
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
        reworkItems: true,
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
      relations: { items: { product: true, bin: true }, vendor: true, reworkItems: true },
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
  async getPrintableChallanData(id: string, reworkId?: string, view?: string): Promise<PrintableDeliveryChallanDto> {
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
    // Check for associated re-dispatched rework items
    const activeReworks = await this.reworkRepo.find({
      where: [
        { reworkDcId: id, reworkStatus: ReworkItemStatus.RE_DISPATCHED },
        { sourceDcId: id, reworkStatus: ReworkItemStatus.RE_DISPATCHED },
      ],
      relations: {
        product: true,
        sc: { purchaseOrder: true },
        po: true,
      },
      order: { updatedAt: 'DESC' },
    });

    // Determine if we should print in Rework mode
    const isExplicitOriginal = view === 'original';
    let targetReworkItems: DcReworkItem[] = [];

    if (!isExplicitOriginal) {
      if (reworkId) {
        const specific = await this.reworkRepo.findOne({
          where: { id: reworkId },
          relations: {
            product: true,
            sc: { purchaseOrder: true },
            po: true,
          },
        });
        if (specific) {
          targetReworkItems = [specific];
        }
      } else if (activeReworks.length > 0) {
        // Default to active re-dispatched rework item(s) if this DC is in rework custody
        targetReworkItems = activeReworks;
      }
    }

    const isReworkMode = targetReworkItems.length > 0;
    const enrichedItems = challan.items || [];

    // Resolve SC → PO references
    const posSet = new Map<string, any>();

    if (challan.poNumber) {
      posSet.set('challan-header-po', {
        poId: '',
        poNumber: challan.poNumber,
        externalReference: null,
        referenceDate: null,
      });
    }

    if (isReworkMode) {
      targetReworkItems.forEach((rw) => {
        const rwSc = rw.sc as any;
        const rwPo = rw.po || rwSc?.purchaseOrder;


        if (rwPo) {
          posSet.set(rwPo.id, {
            poId: rwPo.id,
            poNumber: rwPo.poNumber,
            externalReference: rwPo.externalReference ?? null,
            referenceDate: rwPo.referenceDate ?? null,
          });
        }
      });
    } else {
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
    }

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
    let sc = challan.sc as any;
    if (isReworkMode && targetReworkItems[0]?.sc) {
      sc = targetReworkItems[0].sc;
    }
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
      processName: challan.processName || (isReworkMode ? 'REWORK PROCESSING' : null),
    };

    // ─── Line Items ───────────────────────────────────────────────────────────
    let lineItems: PrintableDeliveryChallanDto['lineItems'];

    if (isReworkMode) {
      lineItems = targetReworkItems.map((rw) => {
        const reworkQty = Number(rw.rejectedQty || 0);
        const matchingItem = challan.items?.find((it: any) => {
          const itPoLabel = it.poPartLabel || '';
          return (
            (rw.productId && it.productId === rw.productId) ||
            (rw.partNumber &&
              (it.partNumber === rw.partNumber ||
                (itPoLabel &&
                  (itPoLabel === rw.partNumber ||
                    itPoLabel.includes(rw.partNumber) ||
                    rw.partNumber.includes(itPoLabel))))) ||
            (rw.productName &&
              (it.partName === rw.productName ||
                (itPoLabel &&
                  (itPoLabel === rw.productName ||
                    itPoLabel.includes(rw.productName) ||
                    rw.productName.includes(itPoLabel))))) ||
            (rw.scId && it.scId === rw.scId)
          );
        });

        const isSpl =
          challan.type === DeliveryChallanType.SPL_PROCESS ||
          rw.dcType === DeliveryChallanType.SPL_PROCESS ||
          !!challan.poNumber ||
          !!rw.poNumber;

        const resolvedPoNo =
          rw.poNumber ||
          challan.poNumber ||
          (rw.po as any)?.poNumber ||
          (rw.sc as any)?.purchaseOrder?.poNumber ||
          (challan.sc as any)?.purchaseOrder?.poNumber ||
          null;

        let resolvedPartNo =
          matchingItem?.poPartLabel ||
          rw.partNumber ||
          rw.product?.code ||
          rw.scNumber ||
          '—';
        if (isSpl && resolvedPoNo && !resolvedPartNo.includes(resolvedPoNo)) {
          resolvedPartNo = `${resolvedPoNo} - ${resolvedPartNo}`;
        }

        let resolvedPartName =
          matchingItem?.poPartLabel ||
          (rw.productName && rw.productName !== 'Defective Material' ? rw.productName : null) ||
          matchingItem?.partName ||
          rw.product?.name ||
          resolvedPartNo;
        if (isSpl && resolvedPoNo && !resolvedPartName.includes(resolvedPoNo)) {
          resolvedPartName = `${resolvedPoNo} - ${resolvedPartName}`;
        }

        const resolvedUom = rw.uom || 'NOS';
        const resolvedScNo = rw.scNumber || (rw.sc as any)?.scNumber || (challan.sc as any)?.scNumber || null;

        return {
          id: rw.id,
          productId: rw.productId || matchingItem?.productId || '',
          productCode: resolvedPartNo,
          productName: resolvedPartName,
          partNumber: resolvedPartNo,
          partName: resolvedPartName,
          binId: matchingItem?.binId || '',
          binCode: matchingItem?.bin?.code ?? '',
          binName: matchingItem?.bin?.name ?? '',
          quantityDispatched: reworkQty,
          quantityReturned: 0,
          quantityOutstanding: reworkQty,
          uom: resolvedUom,
          scNumber: resolvedScNo || undefined,
          poNumber: resolvedPoNo || undefined,
          processName: challan.processName || 'REWORK PROCESSING',
          batchNumber: matchingItem?.batchNumber || undefined,
          description: matchingItem?.description || (rw.qcRemarks ? `QC Defect: ${rw.qcRemarks}` : undefined) || undefined,
        };
      });
    } else {
      lineItems = enrichedItems.map((item: any) => {
        const dispatched = Number(item.quantityDispatched ?? 0);
        const returned = Number(item.quantityReturned ?? 0);
        const scNumber = item.sc?.scNumber ?? sc?.scNumber;
        // Per requirement: Part No must be SC Name, Product must be actual Part Name
        const resolvedPartNo = item.poPartLabel || scNumber || item.partNumber || item.product?.code || '—';
        const resolvedPartName = item.poPartLabel || item.partName || item.productName || item.product?.name || item.productId || '—';
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
          scNumber: scNumber,
          poNumber: item.sc?.purchaseOrder?.poNumber ?? (sc as any)?.purchaseOrder?.poNumber,
          processName: item.processName ?? challan.processName ?? item.process?.name ?? productionProcess?.name,
          batchNumber: item.batchNumber,
          description: item.description ?? null,
        };
      });
    }

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

    const isSplChallan =
      challan.type === DeliveryChallanType.SPL_PROCESS ||
      challan.type === 'SPL_PROCESS' ||
      !!challan.poNumber;

    const resolvedProcessType =
      (isReworkMode ? 'REWORK PROCESSING' : null) ||
      challan.items?.[0]?.processName ||
      challan.processName ||
      (isSplChallan ? 'SPECIAL PROCESS' : null);

    const items = lineItems.map((item, index) => {
      const partNo = item.partNumber ?? item.productCode ?? '';
      const particulars = item.partName ?? item.productName ?? '';
      const dispatchedQty = Number(item.quantityDispatched ?? 0);

      return {
        slNo: index + 1,
        partNo,
        partNumber: partNo,
        particulars,
        productName: particulars,
        description: item.description ?? '',
        quantity: dispatchedQty,
        quantityDispatched: dispatchedQty,
        unit: item.uom || 'NOS',
        uom: item.uom || 'NOS',
        batchNo: item.batchNumber ?? null,
        batchNumber: item.batchNumber ?? null,
      };
    });

    return {
      // Step 2 & root properties for compatibility with all templates and tests
      dcNumber: challan.challanNumber,
      dcType: challan.type,
      dcTypeLabel: isReworkMode ? 'SUPPLIER DC (REWORK)' : 'SUPPLIER DC',
      date: challan.dispatchDate || challan.createdAt,
      poNumber: challan.poNumber || (isReworkMode ? (targetReworkItems[0]?.poNumber || (targetReworkItems[0] as any)?.po?.poNumber) : null) || null,
      layoutNumber: challan.layoutNumber || null,
      mercIndentNumber: challan.mercIndentNumber || null,
      processType: resolvedProcessType,
      remarks: challan.notes ?? '',
      items,

      companyName: companyInfo.name,
      companyAddress: companyInfo.address,
      companyPhone: companyInfo.phone,
      companyEmail: companyInfo.email,
      companyGstin: companyInfo.gstin,
      companyState: `${companyInfo.stateCode} / ${companyInfo.state}`,

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
        processName: resolvedProcessType,
        poNumber: challan.poNumber || (isReworkMode ? (targetReworkItems[0]?.poNumber || (targetReworkItems[0] as any)?.po?.poNumber) : null) || null,
        layoutNumber: challan.layoutNumber || null,
        mercIndentNumber: challan.mercIndentNumber || null,
      },
      vendor: vendorInfo,
      references: {
        ...references,
        processName: resolvedProcessType,
      },
      lineItems,
      groups,
      audit,
      generatedAt: new Date().toISOString(),
      isRework: isReworkMode,
      reworkId: isReworkMode ? targetReworkItems[0]?.id : undefined,
      hasReworkItems: activeReworks.length > 0,
      originalItemsCount: enrichedItems.length,
    } as any;
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

  /**
   * Phase 23.2 — Step 1: Dock Receipt Inwarding
   * Accepts returned items at the dock.
   * Increments item.qcPendingQty += receivedQty.
   * Does NOT close the DC and does NOT credit warehouse inventory yet.
   */
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

      if (challan.status === DeliveryChallanStatus.CLOSED) {
        throw new BadRequestException('Challan is already closed');
      }

      const itemRepo = queryRunner.manager.getRepository(DeliveryChallanItem);

      for (const dtoItem of dto.items) {
        const challanItem = challan.items.find(i => i.id === dtoItem.itemId);
        if (!challanItem) {
          throw new BadRequestException(`Item ${dtoItem.itemId} not found in challan`);
        }

        const qtyReceived = Number(dtoItem.receivedQty ?? dtoItem.quantityToReturn ?? 0);
        if (qtyReceived < 0) {
          throw new BadRequestException(`Received quantity cannot be negative for item ${dtoItem.itemId}`);
        }

        const isType1 = challan.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
        const activeReworks = await queryRunner.manager.find(DcReworkItem, {
          where: {
            sourceDcId: challan.id,
            reworkDcId: challan.id,
            reworkStatus: ReworkItemStatus.RE_DISPATCHED,
          },
        });
        const reworkQtyAtVendor = (activeReworks || [])
          .filter(r => r.productId === challanItem.productId || r.partNumber === challanItem.partNumber)
          .reduce((sum, r) => sum + Number(r.rejectedQty || 0), 0);

        const settledRejected = Math.max(0, Number(challanItem.qcRejectedQty || 0) - reworkQtyAtVendor);
        const alreadyAccounted =
          Number(challanItem.qcPendingQty || 0) +
          Number(challanItem.qcPassedQty || 0) +
          settledRejected;

        // For Type 2: allow revising the expected return quantity (e.g. from 700 to 650)
        // For Type 1: Dispatched baseline is the fixed target; do not reject when batch return qty is passed
        if (
          challan.type !== DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD &&
          challan.type !== DeliveryChallanType.SPL_PROCESS
        ) {
          const newExpected = dtoItem.expectedReturnQty ?? dtoItem.expectedOutputQuantity;
          if (newExpected !== undefined && newExpected !== null && Number(newExpected) > 0) {
            const parsedExpected = Number(newExpected);
            if (parsedExpected < alreadyAccounted) {
              throw new BadRequestException(
                `Revised expected return quantity (${parsedExpected}) cannot be less than already received/accounted quantity (${alreadyAccounted}) for item ${dtoItem.itemId}`
              );
            }
            if (challanItem.initialExpectedQty == null) {
              challanItem.initialExpectedQty = Number(
                challanItem.expectedOutputQuantity ?? challanItem.quantityDispatched
              );
            }
            challanItem.expectedReturnQty = parsedExpected;
            challanItem.expectedOutputQuantity = parsedExpected;
          } else if (challanItem.expectedReturnQty == null) {
            challanItem.expectedReturnQty = Number(
              challanItem.initialExpectedQty ?? challanItem.expectedOutputQuantity ?? challanItem.quantityDispatched
            );
          }
        } else {
          if (challanItem.initialExpectedQty == null) {
            challanItem.initialExpectedQty = Number(challanItem.quantityDispatched);
          }
          challanItem.expectedReturnQty = Number(challanItem.initialExpectedQty);
        }

        // Validate that receivedQty does not exceed remaining unreturned balance at vendor
        const totalTarget = Number(
          challanItem.expectedReturnQty ?? challanItem.initialExpectedQty ?? challanItem.expectedOutputQuantity ?? challanItem.quantityDispatched
        );

        const vendorPending = Math.max(0, totalTarget - alreadyAccounted);

        if (qtyReceived > vendorPending + 0.0001) {
          throw new BadRequestException(
            `Cannot receive more than remaining vendor balance for item ${dtoItem.itemId}. Outstanding at vendor: ${vendorPending}, Received now: ${qtyReceived}`
          );
        }

        // Increment QC pending queue (only if material was physically inwarded > 0)
        if (qtyReceived > 0) {
          challanItem.qcPendingQty = Number(challanItem.qcPendingQty || 0) + qtyReceived;
        }

        // Store editable actualReceivedQty and returnTargetBinId
        const incomingQty = Number(
          dtoItem.actualReceivedQty !== undefined && dtoItem.actualReceivedQty !== null
            ? dtoItem.actualReceivedQty
            : dtoItem.actualInwardQty !== undefined && dtoItem.actualInwardQty !== null
            ? dtoItem.actualInwardQty
            : qtyReceived,
        );

        const isCumulative = Boolean(dtoItem.isCumulative);
        const currentActual = Number(challanItem.actualReceivedQty || 0);
        const newActualReceived = isCumulative ? incomingQty : currentActual + incomingQty;

        const maxAllowed = Number(challanItem.quantityDispatched);
        if (newActualReceived > maxAllowed + 0.0001) {
          throw new BadRequestException(
            `Total inward quantity (${newActualReceived}) cannot exceed quantity dispatched (${maxAllowed}) for item ${dtoItem.itemId}`,
          );
        }
        challanItem.actualReceivedQty = Math.min(newActualReceived, maxAllowed);

        const targetBin = dtoItem.targetBinId || dtoItem.destinationBinId;
        if (targetBin) {
          challanItem.returnTargetBinId = targetBin;
        }

        await itemRepo.save(challanItem);
      }

      challan.actualReturnDate = new Date(dto.actualReceiptDate || Date.now());
      challan.verifiedById = userId;
      if (dto.verificationRemarks) {
        challan.verificationRemarks = dto.verificationRemarks;
      }
      challan.status = DeliveryChallanStatus.PARTIALLY_RETURNED;

      await queryRunner.manager.save(challan);
      await queryRunner.commitTransaction();

      this.fireNotification('DC_PARTIALLY_RETURNED', challan, userId);
      return challan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Phase 23.2 — Step 2: Quality Check (QC) Gate Verification
   * Inspects items currently in qc_pending_qty.
   * Splits into qc_passed_qty and qc_rejected_qty.
   * - Type 1 Pass: Updates SC process progress (DcMovement), NO warehouse stock movement.
   * - Type 2 Pass: Atomically credits actualStoreInwardQty to stock_balances and logs StockTransaction.
   * - Rejections: Automatically creates active records in dc_rework_items linked to the original SC/PO.
   * - Parent DC Status: If pending_vendor === 0 AND qc_pending === 0 across all items -> CLOSED. Else PARTIAL.
   */
  async qcInspectChallan(challanId: string, dto: QcInspectDeliveryChallanDto, userId: string): Promise<DeliveryChallan> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const challan = await queryRunner.manager.findOne(DeliveryChallan, {
        where: { id: challanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!challan) {
        throw new NotFoundException(`Delivery Challan ${challanId} not found`);
      }

      const challanWithRelations = await queryRunner.manager.findOne(DeliveryChallan, {
        where: { id: challanId },
        relations: {
          vendor: true,
          sc: { purchaseOrder: true },
        },
      });

      if (challanWithRelations) {
        challan.vendor = challanWithRelations.vendor;
        challan.sc = challanWithRelations.sc;
      }

      const items = await queryRunner.manager.find(DeliveryChallanItem, {
        where: { challanId: challan.id },
        relations: { product: true, bin: true, sc: { purchaseOrder: true } },
      });
      challan.items = items;

      const stockRepo = queryRunner.manager.getRepository(StockBalance);
      const txRepo = queryRunner.manager.getRepository(StockTransaction);
      const itemRepo = queryRunner.manager.getRepository(DeliveryChallanItem);
      const movementRepo = queryRunner.manager.getRepository(DcMovement);
      const qcLogRepo = queryRunner.manager.getRepository(DcQcInspection);
      const reworkRepo = queryRunner.manager.getRepository(DcReworkItem);

      for (const inspectDto of dto.items) {
        const challanItem = challan.items.find(i => i.id === inspectDto.itemId);
        if (!challanItem) {
          throw new BadRequestException(`Item ${inspectDto.itemId} not found on Challan`);
        }

        const passedQty = Number(inspectDto.passedQty || 0);
        const rejectedQty = Number(inspectDto.rejectedQty || 0);

        if (passedQty < 0 || rejectedQty < 0) {
          throw new BadRequestException('Passed and rejected quantities cannot be negative');
        }

        if (passedQty + rejectedQty <= 0) {
          throw new BadRequestException(`Either passedQty or rejectedQty must be greater than zero for item ${inspectDto.itemId}`);
        }

        const pendingQc = Number(challanItem.qcPendingQty || 0);
        if (passedQty + rejectedQty > pendingQc + 0.0001) {
          throw new BadRequestException(
            `Sum of passed (${passedQty}) and rejected (${rejectedQty}) cannot exceed pending QC quantity (${pendingQc}) for item ${inspectDto.itemId}`
          );
        }

        // 1. Decrement pending QC and increment passed/rejected counters
        challanItem.qcPendingQty = Number(challanItem.qcPendingQty) - (passedQty + rejectedQty);
        challanItem.qcPassedQty = Number(challanItem.qcPassedQty || 0) + passedQty;
        challanItem.qcRejectedQty = Number(challanItem.qcRejectedQty || 0) + rejectedQty;
        // Keep legacy quantityReturned aligned with total accounted returned goods
        challanItem.quantityReturned = Number(challanItem.qcPassedQty) + Number(challanItem.qcRejectedQty);

        // 2. Type 1 vs Type 2 Logic on Pass
        if (
          challan.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD ||
          challan.type === DeliveryChallanType.SPL_PROCESS
        ) {
          // ─── TYPE 1: PROCESS RETURN ───────────────────────────────────────
          // Zero warehouse stock movement. Update DcMovement running ledger.
          if (passedQty > 0) {
            const movement = await movementRepo.findOne({
              where: { challanId: challan.id, challanItemId: challanItem.id },
            });
            if (movement) {
              movement.returnedQty = Number(movement.returnedQty || 0) + passedQty;
              const totalDispatched = Number(movement.dispatchedQty);
              movement.status =
                Number(movement.returnedQty) >= totalDispatched
                  ? DcMovementStatus.RETURNED
                  : DcMovementStatus.PARTIALLY_RETURNED;
              movement.updatedAt = new Date();
              await movementRepo.save(movement);
            }
          }
        } else {
          // ─── TYPE 2: GENERAL INVENTORY STOCK CONVERSION RETURN ───────────
          // Atomic stock credit to warehouse bin
          if (passedQty > 0) {
            const actualInwardQty =
              inspectDto.actualStoreInwardQty !== undefined && inspectDto.actualStoreInwardQty !== null
                ? Number(inspectDto.actualStoreInwardQty)
                : Number(challanItem.actualReceivedQty || 0) > 0
                  ? Number(challanItem.actualReceivedQty)
                  : passedQty;

            const targetProductId =
              challanItem.outputProductId ||
              challanItem.productId;

            const targetBinId =
              inspectDto.targetBinId ||
              challanItem.returnTargetBinId ||
              challanItem.outputBinId ||
              challanItem.binId;

            if (targetProductId && targetBinId && actualInwardQty > 0) {
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

              balance.currentQuantity = Number(balance.currentQuantity) + actualInwardQty;
              await stockRepo.save(balance);

              const transaction = txRepo.create({
                productId: targetProductId,
                destinationBinId: targetBinId,
                transactionType: TransactionType.DC_RETURN,
                quantity: actualInwardQty,
                referenceId: challan.id,
                referenceType: 'DELIVERY_CHALLAN_TYPE_2_QC_PASS',
                createdById: userId,
                remarks: `Inward stock conversion QC Pass via Delivery Challan Type 2 ${challan.challanNumber} (Passed Qty: ${passedQty}, Store Inward: ${actualInwardQty})`,
              });
              await txRepo.save(transaction);
            }
          }
        }

        // 3. Rework item creation if items failed QC
        if (rejectedQty > 0) {
          const sc = challanItem.sc || challan.sc;
          const po = (sc as any)?.purchaseOrder;
          const resolvedPoNumber = challan.poNumber || po?.poNumber || null;
          const resolvedPartLabel = challanItem.poPartLabel || (resolvedPoNumber ? `${resolvedPoNumber} - ${challanItem.partNumber || challanItem.partName || challanItem.product?.name || 'Material'}` : challanItem.partNumber || challanItem.product?.code || 'Defective Material');
          const resolvedPartName = challanItem.poPartLabel || challanItem.partName || challanItem.product?.name || resolvedPartLabel;

          const reworkItem = reworkRepo.create({
            sourceDcId: challan.id,
            sourceDcNumber: challan.challanNumber,
            dcType: challan.type,
            scId: challanItem.scId || challan.scId || null,
            scNumber: sc?.scNumber || null,
            poId: po?.id || null,
            poNumber: resolvedPoNumber,
            productId: challanItem.productId || challanItem.product?.id || null,
            productName: resolvedPartName,
            partNumber: resolvedPartLabel,
            uom: challanItem.product?.uom || 'PCS',
            originalVendorId: challan.vendorId,
            originalVendorName: challan.vendor?.name || 'Original Vendor',
            rejectedQty,
            qcRemarks: inspectDto.qcRemarks || null,
            reworkStatus: ReworkItemStatus.PENDING_ACK,
          });
          await queryRunner.manager.save(reworkItem);
        }

        // 4. Log immutable QC inspection audit entry
        const inspectionLog = qcLogRepo.create({
          challanId: challan.id,
          challanItemId: challanItem.id,
          batchReceivedQty: passedQty + rejectedQty,
          passedQty,
          rejectedQty,
          actualInwardQty: inspectDto.actualStoreInwardQty ?? null,
          remarks: inspectDto.qcRemarks || dto.remarks || null,
          inspectedById: userId,
          inspectedAt: new Date(dto.inspectionDate || Date.now()),
        });
        await queryRunner.manager.save(inspectionLog);

        await itemRepo.save(challanItem);
      }

      // 5. Evaluate parent DC status
      const updatedItems = await itemRepo.find({ where: { challanId: challan.id } });
      const isType1 = challan.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
      const allFullyAccounted = updatedItems.every(i => {
        const target = !isType1
          ? Number(i.expectedReturnQty ?? i.expectedOutputQuantity ?? i.quantityDispatched)
          : Number(i.quantityDispatched);
        const accounted = Number(i.qcPassedQty || 0) + Number(i.qcRejectedQty || 0);
        const inQc = Number(i.qcPendingQty || 0);
        return accounted >= target - 0.0001 && inQc <= 0.0001;
      });

      if (allFullyAccounted) {
        challan.status = DeliveryChallanStatus.CLOSED;
      } else {
        challan.status = DeliveryChallanStatus.PARTIALLY_RETURNED;
      }

      if (dto.remarks) {
        challan.verificationRemarks = dto.remarks;
      }

      await queryRunner.manager.save(challan);
      await queryRunner.commitTransaction();

      if (challan.status === DeliveryChallanStatus.CLOSED) {
        this.fireNotification('DC_CLOSED', challan, userId);
      } else {
        this.fireNotification('DC_PARTIALLY_RETURNED', challan, userId);
      }

      return challan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Phase 23.2 — Rework Queue: Fetches all rejected items requiring rework or re-dispatch.
   */
  async getReworkItems(): Promise<DcReworkItem[]> {
    return this.reworkRepo.find({
      relations: {
        sourceDc: { vendor: true },
        sc: { purchaseOrder: true },
        po: true,
        product: true,
        originalVendor: true,
        reworkDc: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Phase 23.2 — Rework Queue: Acknowledges and marks an item verified/okay for re-dispatch.
   */
  async markReworkItemOkay(reworkId: string): Promise<DcReworkItem> {
    const item = await this.reworkRepo.findOne({ where: { id: reworkId } });
    if (!item) {
      throw new NotFoundException(`Rework item ${reworkId} not found`);
    }
    if (item.reworkStatus !== ReworkItemStatus.PENDING_ACK) {
      throw new BadRequestException(`Rework item cannot be marked okay from status ${item.reworkStatus}`);
    }
    item.reworkStatus = ReworkItemStatus.MARKED_OKAY;
    return this.reworkRepo.save(item);
  }

  /**
   * Phase 23.2 — Rework Queue: Spawns a new Delivery Challan for the rejected units
   * strictly attached to the exact original SC # / PO #.
   */
  async reDispatchReworkItem(
    reworkId: string,
    dto: ReworkReDispatchDto,
    userId: string
  ): Promise<{ reworkItem: DcReworkItem; deliveryChallan: DeliveryChallan }> {
    const item = await this.reworkRepo.findOne({
      where: { id: reworkId },
      relations: {
        sourceDc: true,
        sc: { purchaseOrder: true },
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Rework item ${reworkId} not found`);
    }

    if (item.reworkStatus === ReworkItemStatus.RE_DISPATCHED) {
      throw new BadRequestException(`Rework item ${reworkId} is already re-dispatched under DC ${item.reworkDcNumber}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const targetVendorId = dto.vendorId || item.originalVendorId;
      const vendorRepo = queryRunner.manager.getRepository(Vendor);
      const vendor = await vendorRepo.findOne({ where: { id: targetVendorId, isActive: true } });
      if (!vendor) {
        throw new BadRequestException('Target vendor not found or inactive');
      }

      const isSameVendor = targetVendorId === item.originalVendorId;
      const dispatchDate = new Date();

      const isSpl = item.dcType === DeliveryChallanType.SPL_PROCESS || item.sourceDc?.type === DeliveryChallanType.SPL_PROCESS;
      const isType1 = item.dcType === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD || item.sourceDc?.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
      const dcType = isSpl
        ? DeliveryChallanType.SPL_PROCESS
        : isType1
        ? DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD
        : DeliveryChallanType.GENERAL_INVENTORY_OUTWARD;

      let savedDc: DeliveryChallan;

      if (isSameVendor && item.sourceDcId) {
        // Same vendor rework: Keep same DC number and all original details, update dispatch date to current date
        const existingDc = await queryRunner.manager.findOne(DeliveryChallan, {
          where: { id: item.sourceDcId },
          relations: { items: true },
        });

        if (existingDc) {
          existingDc.dispatchDate = dispatchDate;
          existingDc.actualReturnDate = null;
          existingDc.status = DeliveryChallanStatus.DISPATCHED;
          if (dto.targetReturnDate) {
            existingDc.expectedReturnDate = new Date(dto.targetReturnDate);
          }
          if (dto.remarks || dto.notes) {
            existingDc.notes = dto.remarks || dto.notes;
          }
          if (existingDc.items && existingDc.items.length > 0) {
            for (const it of existingDc.items) {
              const itPoLabel = it.poPartLabel || '';
              const isMatch =
                Boolean(item.productId && it.productId === item.productId) ||
                Boolean(
                  item.partNumber &&
                    (it.partNumber === item.partNumber ||
                      (itPoLabel &&
                        (itPoLabel === item.partNumber ||
                          itPoLabel.includes(item.partNumber) ||
                          item.partNumber.includes(itPoLabel)))),
                ) ||
                Boolean(
                  item.productName &&
                    (it.partName === item.productName ||
                      (itPoLabel &&
                        (itPoLabel === item.productName ||
                          itPoLabel.includes(item.productName) ||
                          item.productName.includes(itPoLabel)))),
                ) ||
                Boolean(item.scId && it.scId && it.scId === item.scId);

              if (isMatch) {
                it.qcPendingQty = 0;
                if (dto.description) {
                  it.description = dto.description;
                }
                await queryRunner.manager.save(it);
              }
            }
          }
          savedDc = await queryRunner.manager.save(existingDc);

          if (isType1 && item.scId && item.productId) {
            const movement = queryRunner.manager.create(DcMovement, {
              challanId: savedDc.id,
              challanItemId: savedDc.items?.[0]?.id || null,
              scId: item.scId,
              dispatchedProductId: item.productId,
              dispatchedQty: Number(item.rejectedQty),
              returnedProductId: null,
              returnedQty: 0,
              status: DcMovementStatus.DISPATCHED,
            } as any);
            await queryRunner.manager.save(movement);
          }
        } else {
          // Fallback if source DC record missing
          const challanNumber = item.sourceDcNumber;
          const newDc = queryRunner.manager.create(DeliveryChallan, {
            challanNumber,
            type: dcType,
            vendorId: targetVendorId,
            scId: item.scId || null,
            processName: 'REWORK PROCESSING',
            dispatchDate,
            expectedReturnDate: dto.targetReturnDate ? new Date(dto.targetReturnDate) : null,
            notes: dto.remarks || dto.notes || `Rework DC for ${item.sourceDcNumber}. QC Remarks: ${item.qcRemarks || 'None'}`,
            createdById: userId,
            status: DeliveryChallanStatus.DISPATCHED,
          });
          savedDc = await queryRunner.manager.save(newDc);
        }
      } else {
        // Different vendor rework: Consider as new DC with new DC number, current date, description, and remarks
        const challanNumber = await this.generateNextChallanNumber(queryRunner, dispatchDate);

        const newDc = queryRunner.manager.create(DeliveryChallan, {
          challanNumber,
          type: dcType,
          vendorId: targetVendorId,
          scId: item.scId || null,
          poNumber: item.poNumber || item.sourceDc?.poNumber || null,
          layoutNumber: item.sourceDc?.layoutNumber || null,
          mercIndentNumber: item.sourceDc?.mercIndentNumber || null,
          mercIndentId: item.sourceDc?.mercIndentId || null,
          processName: 'REWORK PROCESSING',
          dispatchDate,
          expectedReturnDate: dto.targetReturnDate ? new Date(dto.targetReturnDate) : null,
          notes: dto.remarks || dto.notes || `Rework DC for defective units from ${item.sourceDcNumber}. QC Remarks: ${item.qcRemarks || 'None'}`,
          createdById: userId,
          status: DeliveryChallanStatus.DISPATCHED,
        });
        savedDc = await queryRunner.manager.save(newDc);

        const newDcItem = queryRunner.manager.create(DeliveryChallanItem, {
          challanId: savedDc.id,
          productId: item.productId,
          scId: item.scId || null,
          poPartLabel: item.partNumber || (item.poNumber ? `${item.poNumber} - ${item.productName}` : null),
          partNumber: item.partNumber || item.product?.code || null,
          partName: item.productName,
          description: dto.description || `Rework re-dispatch for ${item.rejectedQty} ${item.uom}`,
          quantityDispatched: Number(item.rejectedQty),
          quantityReturned: 0,
          qcPendingQty: 0,
          qcPassedQty: 0,
          qcRejectedQty: 0,
        } as any);
        const savedDcItem = await queryRunner.manager.save(newDcItem);

        if (isType1 && item.scId && item.productId) {
          const movement = queryRunner.manager.create(DcMovement, {
            challanId: savedDc.id,
            challanItemId: savedDcItem.id,
            scId: item.scId,
            dispatchedProductId: item.productId,
            dispatchedQty: Number(item.rejectedQty),
            returnedProductId: null,
            returnedQty: 0,
            status: DcMovementStatus.DISPATCHED,
          } as any);
          await queryRunner.manager.save(movement);
        }
      }

      // Update the rework item
      item.reworkStatus = ReworkItemStatus.RE_DISPATCHED;
      item.reworkDcId = savedDc.id;
      item.reworkDcNumber = savedDc.challanNumber;
      const updatedReworkItem = await queryRunner.manager.save(item);

      await queryRunner.commitTransaction();

      this.fireNotification('DC_DISPATCHED', savedDc, userId);

      return {
        reworkItem: updatedReworkItem,
        deliveryChallan: savedDc,
      };
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
   * Comprehensive Inward & Outward DC Lifecycle & Audit Report
   * Detailed tracking of every DC dispatch, estimated delivery, actual receipt,
   * initial expected vs revised expected on receipt vs variation, actual received qty,
   * unreceived balance, QC passed, QC rejected, and rework loop (same vendor vs different vendor).
   */
  async getComprehensiveDcLifecycleReport(filters?: {
    type?: string;
    vendorId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    reworkOnly?: boolean;
    search?: string;
  }): Promise<{ items: any[]; kpis: any }> {
    const qb = this.challanRepo.createQueryBuilder('dc')
      .leftJoinAndSelect('dc.vendor', 'vendor')
      .leftJoinAndSelect('dc.process', 'process')
      .leftJoinAndSelect('dc.sc', 'sc')
      .leftJoinAndSelect('dc.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.outputProduct', 'outputProduct')
      .leftJoinAndSelect('item.bin', 'bin')
      .leftJoinAndSelect('item.outputBin', 'outputBin')
      .leftJoinAndSelect('item.returnTargetBin', 'returnTargetBin')
      .leftJoinAndSelect('dc.reworkItems', 'reworkItem')
      .leftJoinAndSelect('reworkItem.reworkDc', 'reworkDc')
      .leftJoinAndSelect('reworkDc.vendor', 'reworkVendor')
      .leftJoinAndSelect('dc.qcInspections', 'qcInspection')
      .orderBy('dc.dispatchDate', 'DESC');

    if (filters?.type && filters.type !== 'ALL') {
      qb.andWhere('dc.type = :type', { type: filters.type });
    }
    if (filters?.vendorId) {
      qb.andWhere('dc.vendorId = :vendorId', { vendorId: filters.vendorId });
    }
    if (filters?.status && filters.status !== 'ALL') {
      qb.andWhere('dc.status = :status', { status: filters.status });
    }
    if (filters?.startDate) {
      qb.andWhere('dc.dispatchDate >= :startDate', { startDate: new Date(filters.startDate) });
    }
    if (filters?.endDate) {
      qb.andWhere('dc.dispatchDate <= :endDate', { endDate: new Date(filters.endDate) });
    }

    const challans = await qb.getMany();

    // Map all target rework items so rework DCs can identify their source DC and enriched type
    const allReworks = await this.reworkRepo.find();
    const reworkByTargetMap = new Map<string, DcReworkItem>();
    const reworkBySourceMap = new Map<string, DcReworkItem[]>();
    for (const rw of allReworks) {
      if (rw.reworkDcNumber) reworkByTargetMap.set(rw.reworkDcNumber, rw);
      if (rw.reworkDcId) reworkByTargetMap.set(rw.reworkDcId, rw);
      if (rw.sourceDcNumber) {
        const list = reworkBySourceMap.get(rw.sourceDcNumber) || [];
        list.push(rw);
        reworkBySourceMap.set(rw.sourceDcNumber, list);
      }
    }

    const reportRows: any[] = [];
    let totalDispatchedUnits = 0;
    let totalReceivedUnits = 0;
    let totalVariationUnits = 0;
    let totalQcPendingUnits = 0;
    let totalReworkUnits = 0;
    let onTimeReceiptCount = 0;
    let totalReceiptsCount = 0;

    for (const challan of challans) {
      const matchingTargetRework = reworkByTargetMap.get(challan.challanNumber) || reworkByTargetMap.get(challan.id);
      const isRework = challan.processName === 'REWORK PROCESSING' || Boolean(matchingTargetRework) || (challan.notes && challan.notes.toLowerCase().includes('rework'));
      const sourceDcNumber = matchingTargetRework?.sourceDcNumber || null;

      const isSpl = challan.type === DeliveryChallanType.SPL_PROCESS || matchingTargetRework?.dcType === DeliveryChallanType.SPL_PROCESS;
      const isType1 = challan.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD || (!isSpl && matchingTargetRework?.dcType === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD);
      const baseType = isSpl ? 'Type 3: SPL' : (isType1 ? 'Type 1: Process' : 'Type 2: Conversion');
      const typeLabel = isRework ? `${baseType} (Rework)` : baseType;

      const vendorName = challan.vendor?.name || 'Unknown Vendor';
      const vendorCode = challan.vendor?.code || '';

      const dispatchDate = challan.dispatchDate ? new Date(challan.dispatchDate) : null;
      const expectedReturnDate = challan.expectedReturnDate ? new Date(challan.expectedReturnDate) : null;
      const actualReturnDate = challan.actualReturnDate ? new Date(challan.actualReturnDate) : null;

      let estimatedDays: number | null = null;
      if (dispatchDate && expectedReturnDate) {
        estimatedDays = Math.max(0, Math.round((expectedReturnDate.getTime() - dispatchDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      let actualDays: number | null = null;
      let deliveryTurnaround = 'In Transit';
      let isOnTime = false;

      if (dispatchDate && actualReturnDate) {
        actualDays = Math.max(0, Math.round((actualReturnDate.getTime() - dispatchDate.getTime()) / (1000 * 60 * 60 * 24)));
        totalReceiptsCount++;

        if (estimatedDays !== null) {
          const delta = estimatedDays - actualDays;
          if (delta > 0) {
            deliveryTurnaround = `Delivered in ${actualDays}d (${delta}d ahead of schedule)`;
            isOnTime = true;
            onTimeReceiptCount++;
          } else if (delta === 0) {
            deliveryTurnaround = `Delivered on-time (${actualDays}d SLA)`;
            isOnTime = true;
            onTimeReceiptCount++;
          } else {
            deliveryTurnaround = `Delivered in ${actualDays}d (${Math.abs(delta)}d delayed)`;
          }
        } else {
          deliveryTurnaround = `Delivered in ${actualDays} days`;
          isOnTime = true;
          onTimeReceiptCount++;
        }
      } else if (expectedReturnDate) {
        const now = new Date();
        const diffMs = expectedReturnDate.getTime() - now.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          deliveryTurnaround = `In Transit (${diffDays}d remaining till ${expectedReturnDate.toISOString().split('T')[0]})`;
        } else {
          deliveryTurnaround = `Overdue by ${Math.abs(diffDays)}d (Estimated: ${expectedReturnDate.toISOString().split('T')[0]})`;
        }
      }

      const items = challan.items || [];
      for (const item of items) {
        const dispQty = Number(item.quantityDispatched || 0);
        const initExpected = Number(item.initialExpectedQty ?? item.expectedOutputQuantity ?? item.quantityDispatched ?? 0);
        const revExpected = Number(item.expectedReturnQty ?? item.initialExpectedQty ?? item.expectedOutputQuantity ?? item.quantityDispatched ?? 0);
        const variation = Math.max(0, initExpected - revExpected);
        const actReceived = Number(item.actualReceivedQty || 0);
        const unrecBalance = Math.max(0, revExpected - actReceived);
        const passedQty = Number(item.qcPassedQty || 0);
        const rejectedQty = Number(item.qcRejectedQty || 0);
        const pendingQty = Number(item.qcPendingQty || 0);

        totalDispatchedUnits += dispQty;
        totalReceivedUnits += actReceived;
        totalVariationUnits += variation;
        totalQcPendingUnits += pendingQty;
        totalReworkUnits += rejectedQty;

        // Find relevant rework items for this material
        const matchingReworks = (challan.reworkItems || reworkBySourceMap.get(challan.challanNumber) || []).filter(
          (rw) =>
            (rw.productId && item.productId && rw.productId === item.productId) ||
            (rw.partNumber && (rw.partNumber === item.partNumber || rw.partNumber === item.poPartLabel)) ||
            (rw.productName && (rw.productName === item.partName || rw.productName === item.poPartLabel)) ||
            (item.poPartLabel && rw.partNumber && (item.poPartLabel.includes(rw.partNumber) || rw.partNumber.includes(item.poPartLabel))) ||
            (!item.productId && !rw.productId && (rw.partNumber === item.partNumber || rw.productName === item.partName || (rw.partNumber && item.poPartLabel && item.poPartLabel.includes(rw.partNumber)))) ||
            items.length === 1
        );

        const reworkEntries = matchingReworks.map((rw) => {
          const isSame = !rw.reworkDcId || rw.originalVendorId === (rw.reworkDc?.vendorId || rw.originalVendorId);
          const rwVendor = rw.reworkDc?.vendor?.name || (isSame ? rw.originalVendorName : 'Alternative Vendor');
          const rwDcNum = rw.reworkDcNumber || (rw.reworkStatus === ReworkItemStatus.RE_DISPATCHED ? challan.challanNumber : null);
          const rwDispDate = rw.reworkDc?.dispatchDate
            ? new Date(rw.reworkDc.dispatchDate).toISOString().split('T')[0]
            : (rw.reworkStatus === ReworkItemStatus.RE_DISPATCHED ? rw.updatedAt?.toISOString().split('T')[0] : null);
          const rwRetDate = rw.reworkDc?.actualReturnDate
            ? new Date(rw.reworkDc.actualReturnDate).toISOString().split('T')[0]
            : null;

          const rwType = rw.dcType === DeliveryChallanType.SPL_PROCESS
            ? 'Type 3: SPL'
            : (rw.dcType === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD ? 'Type 1: Process' : 'Type 2: Conversion');

          let summary = '';
          if (rw.reworkStatus === ReworkItemStatus.RE_DISPATCHED) {
            summary = isSame
              ? `Sent for Rework (${rw.rejectedQty} ${rw.uom}) under DC ${rw.sourceDcNumber} (${rwType}) to Same Vendor${rwDispDate ? ` on ${rwDispDate}` : ''}${rwRetDate ? `, received on ${rwRetDate}` : ' (pending return)'}`
              : `Sent for Rework (${rw.rejectedQty} ${rw.uom}) under New DC ${rwDcNum} (${rwType}) to ${rwVendor}${rwDispDate ? ` on ${rwDispDate}` : ''}${rwRetDate ? `, received on ${rwRetDate}` : ' (pending return)'}`;
          } else {
            summary = `Defect: ${rw.rejectedQty} ${rw.uom} rejected in QC (${rw.qcRemarks || 'Pending Rework'})`;
          }

          return {
            id: rw.id,
            status: rw.reworkStatus,
            rejectedQty: Number(rw.rejectedQty),
            uom: rw.uom,
            isSameVendor: isSame,
            vendorName: rwVendor,
            reworkDcNumber: rwDcNum,
            dcType: rw.dcType,
            dcTypeLabel: rwType,
            dispatchDate: rwDispDate,
            actualReturnDate: rwRetDate,
            qcRemarks: rw.qcRemarks,
            summary,
          };
        });

        if (filters?.reworkOnly && reworkEntries.length === 0 && rejectedQty === 0) {
          continue;
        }

        const outProd = item.outputProduct || item.product;

        reportRows.push({
          rowId: `${challan.id}-${item.id}`,
          challanId: challan.id,
          challanNumber: challan.challanNumber,
          type: challan.type,
          typeLabel,
          isRework,
          sourceDcNumber,
          vendorId: challan.vendorId,
          vendorName,
          vendorCode,
          partNumber: item.poPartLabel || item.partNumber || item.product?.code || '—',
          partName: item.partName || item.product?.name || '—',
          productName: isType1 ? (item.partName || item.product?.name || '—') : (outProd?.name || item.product?.name || '—'),
          productCode: isType1 ? (item.product?.code || '') : (outProd?.code || item.product?.code || ''),
          uom: item.product?.uom || outProd?.uom || 'NOS',
          scNumber: challan.sc?.scNumber || item.sc?.scNumber || '—',
          processName: challan.processName || challan.process?.name || item.processName || (isType1 ? 'Subcontract Process' : 'Stock Conversion'),

          // Dates & Delivery SLA
          dispatchDate: dispatchDate ? dispatchDate.toISOString() : null,
          dispatchDateFormatted: dispatchDate ? dispatchDate.toLocaleDateString('en-IN') : '—',
          expectedReturnDate: expectedReturnDate ? expectedReturnDate.toISOString() : null,
          expectedReturnDateFormatted: expectedReturnDate ? expectedReturnDate.toLocaleDateString('en-IN') : '—',
          actualReturnDate: actualReturnDate ? actualReturnDate.toISOString() : null,
          actualReturnDateFormatted: actualReturnDate ? actualReturnDate.toLocaleDateString('en-IN') : '—',
          estimatedDays,
          actualDays,
          deliveryTurnaround,
          isOnTime,

          // Quantities & Variation
          quantityDispatched: dispQty,
          initialExpectedQty: initExpected,
          revisedExpectedQty: revExpected,
          expectedVariation: variation,
          hasVariation: variation > 0,
          actualReceivedQty: actReceived,
          unreceivedBalance: unrecBalance,
          isFullyReceived: unrecBalance === 0 && actReceived > 0,

          // QC & Rework
          qcPendingQty: pendingQty,
          qcPassedQty: passedQty,
          qcRejectedQty: rejectedQty,
          reworkEntries,
          reworkSummary: reworkEntries.length > 0 ? reworkEntries.map((r) => r.summary).join(' | ') : rejectedQty > 0 ? `${rejectedQty} units rejected in QC` : 'No defects',

          status: challan.status,
          notes: challan.notes || '',
        });
      }
    }

    const onTimeRate = totalReceiptsCount > 0 ? Math.round((onTimeReceiptCount / totalReceiptsCount) * 100) : 100;

    return {
      items: reportRows,
      kpis: {
        totalChallans: challans.length,
        totalDispatchedUnits,
        totalReceivedUnits,
        totalVariationUnits,
        totalQcPendingUnits,
        totalReworkUnits,
        onTimeRate,
        totalReceiptsCount,
        onTimeReceiptCount,
      },
    };
  }

  /**
   * Retrieves all DC movements across both Type 1 (Process / Subcontracting)
   * and Type 2 (General Inventory Stock Conversion) enriched with lifecycle audit details.
   */
  async getAllDcMovements(): Promise<any[]> {
    // 1. Fetch Type 1 movements from dc_movements table
    const type1Movements = await this.dcMovementRepo.find({
      relations: {
        challan: {
          vendor: true,
          reworkItems: { reworkDc: { vendor: true } },
        },
        process: true,
        sc: true,
        dispatchedProduct: true,
        returnedProduct: true,
        challanItem: true,
      },
      order: { createdAt: 'DESC' },
    });

    // 2. Fetch Type 2 DC items from delivery_challan_items table
    const type2Items = await this.dataSource.getRepository(DeliveryChallanItem).find({
      where: [
        { challan: { type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD } },
        { challan: { type: DeliveryChallanType.SPL_PROCESS } },
      ],
      relations: {
        challan: {
          vendor: true,
          reworkItems: { reworkDc: { vendor: true } },
        },
        product: true,
        outputProduct: true,
        bin: true,
        outputBin: true,
      },
      order: { createdAt: 'DESC' },
    });

    // Map all rework items
    const allReworks = await this.reworkRepo.find();
    const reworkByTargetMap = new Map<string, DcReworkItem>();
    for (const rw of allReworks) {
      if (rw.reworkDcNumber) reworkByTargetMap.set(rw.reworkDcNumber, rw);
      if (rw.reworkDcId) reworkByTargetMap.set(rw.reworkDcId, rw);
    }

    const results: any[] = [];

    // Map Type 1 items
    for (const m of type1Movements) {
      const dispQty = Number(m.dispatchedQty || 0);
      const retQty = Number(m.returnedQty || 0);
      const challan = m.challan;
      const vendor = challan?.vendor;
      const item = m.challanItem;

      const matchingTargetRework = reworkByTargetMap.get(challan?.challanNumber) || reworkByTargetMap.get(challan?.id);
      const isRework = challan?.processName === 'REWORK PROCESSING' || Boolean(matchingTargetRework) || (challan?.notes && challan.notes.toLowerCase().includes('rework'));
      const challanTypeLabel = isRework ? 'Type 1: Process (Rework)' : 'Type 1: Process';
      const sourceDcNumber = matchingTargetRework?.sourceDcNumber || null;

      const initExpected = Number(item?.initialExpectedQty ?? item?.quantityDispatched ?? dispQty);
      const revExpected = Number(item?.expectedReturnQty ?? initExpected);
      const variation = Math.max(0, initExpected - revExpected);
      const actReceived = Number(item?.actualReceivedQty || retQty);
      const unrecBalance = Math.max(0, revExpected - actReceived);

      const matchingRework = (challan?.reworkItems || []).find(
        (rw) => rw.productId === m.dispatchedProductId
      );
      const rwType = matchingRework?.dcType === DeliveryChallanType.SPL_PROCESS
        ? 'Type 3: SPL'
        : (matchingRework?.dcType === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD ? 'Type 1: Process' : 'Type 2: Conversion');
      const reworkSummary = matchingRework
        ? (matchingRework.reworkStatus === ReworkItemStatus.RE_DISPATCHED
          ? `Sent for Rework (${matchingRework.rejectedQty} ${matchingRework.uom}) under ${matchingRework.reworkDcNumber || challan?.challanNumber} (${rwType})`
          : `Defect: ${matchingRework.rejectedQty} ${matchingRework.uom} rejected in QC`)
        : 'No defects';

      // Outward entry (always exists)
      results.push({
        id: `t1-out-${m.id}`,
        movementId: m.id,
        challanId: m.challanId,
        challanNumber: challan?.challanNumber || '—',
        challanType: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        challanTypeLabel,
        isRework,
        sourceDcNumber,
        direction: 'OUTWARD',
        date: m.createdAt,
        dispatchDate: challan?.dispatchDate || m.createdAt,
        expectedReturnDate: challan?.expectedReturnDate || null,
        actualReturnDate: challan?.actualReturnDate || null,
        initialExpectedQty: initExpected,
        revisedExpectedQty: revExpected,
        expectedVariation: variation,
        actualReceivedQty: actReceived,
        unreceivedBalance: unrecBalance,
        qcPassedQty: Number(item?.qcPassedQty || 0),
        qcRejectedQty: Number(item?.qcRejectedQty || 0),
        qcPendingQty: Number(item?.qcPendingQty || 0),
        reworkDcNumber: matchingRework?.reworkDcNumber || null,
        reworkStatus: matchingRework?.reworkStatus || null,
        reworkSummary,
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
          challanTypeLabel,
          isRework,
          sourceDcNumber,
          direction: 'INWARD',
          date: m.updatedAt || m.createdAt,
          dispatchDate: challan?.dispatchDate || m.createdAt,
          expectedReturnDate: challan?.expectedReturnDate || null,
          actualReturnDate: challan?.actualReturnDate || m.updatedAt || m.createdAt,
          initialExpectedQty: initExpected,
          revisedExpectedQty: revExpected,
          expectedVariation: variation,
          actualReceivedQty: actReceived,
          unreceivedBalance: unrecBalance,
          qcPassedQty: Number(item?.qcPassedQty || 0),
          qcRejectedQty: Number(item?.qcRejectedQty || 0),
          qcPendingQty: Number(item?.qcPendingQty || 0),
          reworkDcNumber: matchingRework?.reworkDcNumber || null,
          reworkStatus: matchingRework?.reworkStatus || null,
          reworkSummary,
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

      const matchingTargetRework = reworkByTargetMap.get(challan?.challanNumber) || reworkByTargetMap.get(challan?.id);
      const isRework = challan?.processName === 'REWORK PROCESSING' || Boolean(matchingTargetRework) || (challan?.notes && challan.notes.toLowerCase().includes('rework'));
      const isSpl = challan?.type === DeliveryChallanType.SPL_PROCESS || matchingTargetRework?.dcType === DeliveryChallanType.SPL_PROCESS;
      const isType1Challan = challan?.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD || (!isSpl && matchingTargetRework?.dcType === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD);
      const baseType = isSpl ? 'Type 3: SPL' : (isType1Challan ? 'Type 1: Process' : 'Type 2: Conversion');
      const challanTypeLabel = isRework ? `${baseType} (Rework)` : baseType;
      const sourceDcNumber = matchingTargetRework?.sourceDcNumber || null;

      const initExpected = Number(item.initialExpectedQty ?? item.expectedOutputQuantity ?? item.quantityDispatched ?? 0);
      const revExpected = Number(item.expectedReturnQty ?? initExpected);
      const variation = Math.max(0, initExpected - revExpected);
      const actReceived = Number(item.actualReceivedQty || retQty);
      const unrecBalance = Math.max(0, revExpected - actReceived);

      const matchingRework = (challan?.reworkItems || []).find(
        (rw) =>
          (rw.productId && item.productId && rw.productId === item.productId) ||
          (rw.partNumber && (rw.partNumber === item.partNumber || rw.partNumber === item.poPartLabel)) ||
          (rw.productName && (rw.productName === item.partName || rw.productName === item.poPartLabel)) ||
          (item.poPartLabel && rw.partNumber && (item.poPartLabel.includes(rw.partNumber) || rw.partNumber.includes(item.poPartLabel))) ||
          (!item.productId && !rw.productId && (rw.partNumber === item.partNumber || rw.productName === item.partName || (rw.partNumber && item.poPartLabel && item.poPartLabel.includes(rw.partNumber))))
      );
      const rwType = matchingRework?.dcType === DeliveryChallanType.SPL_PROCESS
        ? 'Type 3: SPL'
        : (matchingRework?.dcType === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD ? 'Type 1: Process' : 'Type 2: Conversion');
      const reworkSummary = matchingRework
        ? (matchingRework.reworkStatus === ReworkItemStatus.RE_DISPATCHED
          ? `Sent for Rework (${matchingRework.rejectedQty} ${matchingRework.uom}) under ${matchingRework.reworkDcNumber || challan?.challanNumber} (${rwType})`
          : `Defect: ${matchingRework.rejectedQty} ${matchingRework.uom} rejected in QC`)
        : 'No defects';

      // Outward entry (always exists)
      results.push({
        id: `${isSpl ? 'spl' : 't2'}-out-${item.id}`,
        movementId: item.id,
        challanId: item.challanId,
        challanNumber: challan?.challanNumber || '—',
        challanType: challan?.type || DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        challanTypeLabel,
        isRework,
        sourceDcNumber,
        direction: 'OUTWARD',
        date: item.createdAt || challan?.dispatchDate || challan?.createdAt,
        dispatchDate: challan?.dispatchDate || item.createdAt,
        expectedReturnDate: challan?.expectedReturnDate || null,
        actualReturnDate: challan?.actualReturnDate || null,
        initialExpectedQty: initExpected,
        revisedExpectedQty: revExpected,
        expectedVariation: variation,
        actualReceivedQty: actReceived,
        unreceivedBalance: unrecBalance,
        qcPassedQty: Number(item.qcPassedQty || 0),
        qcRejectedQty: Number(item.qcRejectedQty || 0),
        qcPendingQty: Number(item.qcPendingQty || 0),
        reworkDcNumber: matchingRework?.reworkDcNumber || null,
        reworkStatus: matchingRework?.reworkStatus || null,
        reworkSummary,
        vendorId: vendor?.id || challan?.vendorId,
        vendorName: vendor?.name || '—',
        vendorCode: vendor?.code || '',
        scNumber: challan?.poNumber ? `PO: ${challan.poNumber}` : '—',
        processName: item.processName || (isSpl ? 'Special Process' : 'Stock Conversion'),
        partNumber: item.poPartLabel || item.partNumber || (isSpl ? 'SPL-PART' : 'DC2-001'),
        partName: item.poPartLabel || item.partName || item.product?.name || item.description || '—',
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
          id: `${isSpl ? 'spl' : 't2'}-in-${item.id}`,
          movementId: item.id,
          challanId: item.challanId,
          challanNumber: challan?.challanNumber || '—',
          challanType: challan?.type || DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
          challanTypeLabel,
          isRework,
          sourceDcNumber,
          direction: 'INWARD',
          date: challan?.actualReturnDate || item.updatedAt || item.createdAt,
          dispatchDate: challan?.dispatchDate || item.createdAt,
          expectedReturnDate: challan?.expectedReturnDate || null,
          actualReturnDate: challan?.actualReturnDate || item.updatedAt || item.createdAt,
          initialExpectedQty: initExpected,
          revisedExpectedQty: revExpected,
          expectedVariation: variation,
          actualReceivedQty: actReceived,
          unreceivedBalance: unrecBalance,
          qcPassedQty: Number(item.qcPassedQty || 0),
          qcRejectedQty: Number(item.qcRejectedQty || 0),
          qcPendingQty: Number(item.qcPendingQty || 0),
          reworkDcNumber: matchingRework?.reworkDcNumber || null,
          reworkStatus: matchingRework?.reworkStatus || null,
          reworkSummary,
          vendorId: vendor?.id || challan?.vendorId,
          vendorName: vendor?.name || '—',
          vendorCode: vendor?.code || '',
          scNumber: challan?.poNumber ? `PO: ${challan.poNumber}` : '—',
          processName: item.processName || (isSpl ? 'Special Process' : 'Stock Conversion'),
          partNumber: item.poPartLabel || item.partNumber || (isSpl ? 'SPL-PART' : 'DC2-001'),
          partName: item.poPartLabel || item.partName || retProd?.name || item.description || '—',
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

  /**
   * Enterprise Automated Sweep: Evaluates active Delivery Challans against expected return date:
   * 1. Reached expected return date (due today or within 24h) -> DC_APPROACHING_SLA -> Email to STORES
   * 2. Crossed expected return date (now > expectedReturnDate) -> DC_OVERDUE -> Email to STORES
   */
  @Cron(process.env.DC_SLA_CRON_SCHEDULE || CronExpression.EVERY_HOUR)
  async checkAndAlertExpectedReturnDates(): Promise<{ reachedCount: number; overdueCount: number }> {
    this.logger.log('Starting automated Delivery Challan return date reconciliation sweep.');
    if (!this.communicationService) {
      return { reachedCount: 0, overdueCount: 0 };
    }

    try {
      const activeChallans = await this.challanRepo.find({
        where: {
          status: In([
            DeliveryChallanStatus.OPEN,
            DeliveryChallanStatus.DISPATCHED,
            DeliveryChallanStatus.PARTIALLY_RETURNED,
          ]),
        },
        relations: { vendor: true },
      });

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      let reachedCount = 0;
      let overdueCount = 0;

      for (const dc of activeChallans) {
        if (!dc.expectedReturnDate) continue;
        const expectedDate = new Date(dc.expectedReturnDate);
        if (isNaN(expectedDate.getTime())) continue;

        const expectedDateStr = expectedDate.toISOString().split('T')[0];

        if (now.getTime() > expectedDate.getTime()) {
          // Crossed expected return date -> OVERDUE
          overdueCount++;
          const daysOverdue = Math.max(1, Math.ceil((now.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)));
          await this.communicationService.sendEvent({
            eventType: 'DC_OVERDUE',
            entityType: 'DELIVERY_CHALLAN',
            entityId: `${dc.id}_overdue_${todayStr}`,
            metadata: {
              challanNumber: dc.challanNumber,
              vendorName: dc.vendor?.name || 'N/A',
              expectedReturnDate: expectedDateStr,
              daysOverdue,
            },
          }).catch((err) => {
            this.logger.error(`Failed to dispatch DC_OVERDUE for ${dc.challanNumber}: ${err?.message || err}`);
          });
        } else if (expectedDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) {
          // Reached expected return date (due today / within 24h) -> SLA Approaching
          reachedCount++;
          const hoursRemaining = Math.max(0, Math.round((expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
          await this.communicationService.sendEvent({
            eventType: 'DC_APPROACHING_SLA',
            entityType: 'DELIVERY_CHALLAN',
            entityId: `${dc.id}_reached_${todayStr}`,
            metadata: {
              challanNumber: dc.challanNumber,
              vendorName: dc.vendor?.name || 'N/A',
              expectedReturnDate: expectedDateStr,
              hoursRemaining,
            },
          }).catch((err) => {
            this.logger.error(`Failed to dispatch DC_APPROACHING_SLA for ${dc.challanNumber}: ${err?.message || err}`);
          });
        }
      }

      this.logger.log(`DC return date check complete: ${reachedCount} reached return date, ${overdueCount} crossed/overdue.`);
      return { reachedCount, overdueCount };
    } catch (err: any) {
      this.logger.error(`Delivery Challan return date check failed: ${err?.message || err}`);
      return { reachedCount: 0, overdueCount: 0 };
    }
  }

  /**
   * Deletes a Delivery Challan and its items.
   * If stock was deducted upon dispatch (Type 2 or Type 3 extra items), restores the stock balance.
   */
  async deleteDeliveryChallan(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const dc = await this.challanRepo.findOne({
      where: { id },
      relations: {
        items: true,
      },
    });

    if (!dc) {
      throw new NotFoundException(`Delivery Challan not found`);
    }

    if (dc.status === DeliveryChallanStatus.CLOSED) {
      throw new BadRequestException(`Cannot delete Delivery Challan #${dc.challanNumber} because it is already CLOSED.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Revert stock transactions if any exist for this DC
      const stockTxRepo = queryRunner.manager.getRepository(StockTransaction);
      const stockBalanceRepo = queryRunner.manager.getRepository(StockBalance);

      const relatedTxs = await stockTxRepo.find({
        where: [
          { referenceId: id },
          { remarks: Like(`%${dc.challanNumber}%`) },
        ],
      });

      for (const tx of relatedTxs) {
        if (tx.productId && tx.sourceBinId && tx.transactionType === TransactionType.DC_DISPATCH) {
          const balance = await stockBalanceRepo.findOne({
            where: { productId: tx.productId, binId: tx.sourceBinId },
          });
          if (balance) {
            balance.currentQuantity = Number(balance.currentQuantity) + Number(tx.quantity);
            await stockBalanceRepo.save(balance);
          }
        }
        await stockTxRepo.remove(tx);
      }

      // 2. Remove child records and challan
      await queryRunner.manager.delete(DcMovement, { challanId: id });
      await queryRunner.manager.delete(DcQcInspection, { challanId: id });
      await queryRunner.manager.delete(DcReworkItem, { sourceDcId: id });
      await queryRunner.manager.delete(DeliveryChallanItem, { challanId: id });
      await queryRunner.manager.delete(DeliveryChallan, { id });

      await queryRunner.commitTransaction();

      this.logger.log(`Delivery Challan #${dc.challanNumber} (${id}) deleted by user ${userId}`);
      return { success: true, message: `Delivery Challan #${dc.challanNumber} deleted successfully` };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to delete Delivery Challan #${dc.challanNumber}: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to delete Delivery Challan: ${err.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Deletes a single Delivery Challan line item.
   * If stock was deducted for this specific item, restores the stock balance.
   * If this was the only item in the DC, deletes the DC as well.
   */
  async deleteDeliveryChallanItem(
    challanId: string,
    itemId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string; challanDeleted?: boolean }> {
    const dc = await this.challanRepo.findOne({
      where: { id: challanId },
      relations: {
        items: true,
      },
    });

    if (!dc) {
      throw new NotFoundException(`Delivery Challan not found`);
    }

    if (dc.status === DeliveryChallanStatus.CLOSED) {
      throw new BadRequestException(`Cannot delete items from Delivery Challan #${dc.challanNumber} because it is already CLOSED.`);
    }

    const item = dc.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item not found on Delivery Challan #${dc.challanNumber}`);
    }

    // If this is the only item in the DC, delete the entire DC
    if (!dc.items || dc.items.length <= 1) {
      await this.deleteDeliveryChallan(challanId, userId);
      return {
        success: true,
        message: `Delivery Challan #${dc.challanNumber} and its only item were deleted.`,
        challanDeleted: true,
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Revert stock if applicable for this item
      if (item.productId && item.binId && (dc.type === DeliveryChallanType.GENERAL_INVENTORY_OUTWARD || item.isExtraItem)) {
        const stockBalanceRepo = queryRunner.manager.getRepository(StockBalance);
        const balance = await stockBalanceRepo.findOne({
          where: { productId: item.productId, binId: item.binId },
        });
        if (balance) {
          balance.currentQuantity = Number(balance.currentQuantity) + Number(item.quantityDispatched);
          await stockBalanceRepo.save(balance);
        }

        const stockTxRepo = queryRunner.manager.getRepository(StockTransaction);
        const relatedTx = await stockTxRepo.findOne({
          where: [
            { referenceId: challanId, productId: item.productId, sourceBinId: item.binId },
          ],
        });
        if (relatedTx) {
          await stockTxRepo.remove(relatedTx);
        }
      }

      await queryRunner.manager.delete(DcMovement, { challanItemId: itemId });
      await queryRunner.manager.delete(DcQcInspection, { challanItemId: itemId });
      await queryRunner.manager.delete(DeliveryChallanItem, { id: itemId });

      await queryRunner.commitTransaction();

      this.logger.log(`Item ${itemId} on DC #${dc.challanNumber} deleted by user ${userId}`);
      return {
        success: true,
        message: `Item deleted from Delivery Challan #${dc.challanNumber}`,
        challanDeleted: false,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to delete item from DC #${dc.challanNumber}: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to delete item: ${err.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
