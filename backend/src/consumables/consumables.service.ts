import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like, Raw } from 'typeorm';

import {
  ConsumableRequest,
  ConsumablePaymentMode,
} from './entities/consumable-request.entity.js';
import {
  ConsumableRequestItem,
  ConsumableItemTrack,
  ConsumableItemStatus,
  ConsumableApprovalStatus,
} from './entities/consumable-request-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from '../inventory/entities/stock-transaction.entity.js';

import {
  CreateConsumableRequestDto,
  CreateConsumableRequestItemDto,
} from './dto/create-consumable-request.dto.js';
import { ReceiveConsumablePurchaseDto } from './dto/receive-consumable-purchase.dto.js';
import { IssueConsumableToProductionDto } from './dto/issue-to-production.dto.js';
import { PrintPrDto } from './dto/print-pr.dto.js';
import { QueryConsumableItemsDto } from './dto/query-consumables.dto.js';
import { BulkApproveConsumablesDto } from './dto/bulk-approve-consumables.dto.js';
import { BulkRejectConsumablesDto } from './dto/bulk-reject-consumables.dto.js';
import { QueryConsumableApprovalsDto } from './dto/query-consumable-approvals.dto.js';
import { CommunicationService } from '../notifications/communication.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SystemSetting } from '../notifications/entities/system-setting.entity.js';
import { AlertDigestService, AlertDigestItem } from '../email/alert-digest.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ConsumablesBatchNotificationService } from './consumables-batch-notification.service.js';

export const STANDARD_CONSUMABLE_ITEMS: string[] = [
  'Gloves',
  'Drill Bit',
  'Safety Gloves',
  'Ear Plugs',
  'Brush',
  'Hacksaw Blade',
  'Cutting Wheel',
  'File',
  'Grinding Wheel',
  'Dressing Tool',
  'Insert',
  'Tap set',
  'Machine oil',
  'Hydralic oil',
  'Rust Oil',
  'Coolant Oil',
  'Ejector Pin',
  'Spray Paint',
  'IP',
  'Thinner',
  'M seal',
  'Locktite 641',
  'Anabond',
  'Grub Screw',
  'Allen Screw',
  'Waist Cloth',
  'Emery Wheel',
  'Emery Sheet',
  'Brass rod',
  'Centre Bit',
  'Carbide End mill',
  'Reamer',
  'Belt',
  'Blue Tube',
];

@Injectable()
export class ConsumablesService implements OnModuleInit {
  private readonly logger = new Logger(ConsumablesService.name);
  private standardConsumablesSeeded = false;

  async onModuleInit() {
    try {
      const { family } = await this.ensureConsumablesCategoryAndFamily();
      await this.ensureStandardConsumableProducts(family);
    } catch (err: any) {
      this.logger.warn(`Could not seed standard consumables on startup: ${err?.message}`);
    }
  }

  /**
   * Helper: Ensures standard consumable products exist in DB under the Consumables family.
   */
  async ensureStandardConsumableProducts(family: ProductFamily): Promise<void> {
    if (this.standardConsumablesSeeded) return;
    try {
      for (const itemName of STANDARD_CONSUMABLE_ITEMS) {
        const trimmedName = itemName.trim();
        const existing = await this.productRepo.findOne({
          where: { name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name: trimmedName }) },
        });

        if (!existing) {
          const barcodeCandidate = `PRD-${trimmedName}`;
          let finalBarcode = barcodeCandidate;
          const existingBarcode = await this.productRepo.findOne({
            where: { barcode: barcodeCandidate },
          });
          if (existingBarcode) {
            finalBarcode = `${barcodeCandidate}-${Date.now().toString().slice(-4)}`;
          }

          const newProd = this.productRepo.create({
            code: trimmedName,
            name: trimmedName,
            barcode: finalBarcode,
            familyId: family.id,
            uom: 'NOS',
            minimumInventory: 0,
            isActive: true,
          });
          await this.productRepo.save(newProd);
          this.logger.log(`[CONSUMABLES-SEED] Seeded standard consumable product: "${trimmedName}"`);
        } else if (existing.familyId !== family.id) {
          existing.familyId = family.id;
          await this.productRepo.save(existing);
        }
      }
      this.standardConsumablesSeeded = true;
    } catch (err: any) {
      this.logger.warn(`Error during ensureStandardConsumableProducts: ${err?.message}`);
    }
  }

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ConsumableRequest)
    private readonly requestRepo: Repository<ConsumableRequest>,
    @InjectRepository(ConsumableRequestItem)
    private readonly itemRepo: Repository<ConsumableRequestItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(ProductFamily)
    private readonly familyRepo: Repository<ProductFamily>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(Bin)
    private readonly binRepo: Repository<Bin>,
    @InjectRepository(StockBalance)
    private readonly balanceRepo: Repository<StockBalance>,
    @InjectRepository(StockTransaction)
    private readonly transactionRepo: Repository<StockTransaction>,
    @Optional() private readonly communicationService?: CommunicationService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly alertDigestService?: AlertDigestService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly batchNotificationService?: ConsumablesBatchNotificationService,
  ) {}

  /**
   * Phase P2: Reads CONSUMABLE_SM_APPROVAL_MODE (OFF|ON, default OFF) and
   * CONSUMABLE_SM_APPROVAL_SCOPE (ALL|PURCHASE_ONLY, default ALL).
   * Checks database system_settings first, then falls back to environment variables.
   * Invalid values fall back to OFF/ALL with a logged warning.
   */
  async getApprovalConfig(): Promise<{ mode: 'OFF' | 'ON'; scope: 'ALL' | 'PURCHASE_ONLY' }> {
    let dbMode: string | null = null;
    let dbScope: string | null = null;

    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        const settingRepo = this.dataSource.getRepository(SystemSetting);
        const settings = await settingRepo.find({
          where: [
            { key: 'CONSUMABLE_SM_APPROVAL_MODE' },
            { key: 'CONSUMABLE_SM_APPROVAL_SCOPE' },
          ],
        });
        for (const s of settings) {
          if (s.key === 'CONSUMABLE_SM_APPROVAL_MODE') dbMode = s.value;
          if (s.key === 'CONSUMABLE_SM_APPROVAL_SCOPE') dbScope = s.value;
        }
      }
    } catch {
      // Non-blocking fallback
    }

    // In automated unit/e2e test runner, prefer process.env if explicitly set
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const envMode = process.env.CONSUMABLE_SM_APPROVAL_MODE;
    const envScope = process.env.CONSUMABLE_SM_APPROVAL_SCOPE;

    const rawMode = (
      (isTestEnv && envMode !== undefined ? envMode : (dbMode || envMode)) ||
      this.configService?.get<string>('CONSUMABLE_SM_APPROVAL_MODE') ||
      'OFF'
    ).trim().toUpperCase();

    const rawScope = (
      (isTestEnv && envScope !== undefined ? envScope : (dbScope || envScope)) ||
      this.configService?.get<string>('CONSUMABLE_SM_APPROVAL_SCOPE') ||
      'ALL'
    ).trim().toUpperCase();

    let mode: 'OFF' | 'ON' = 'OFF';
    if (rawMode === 'ON' || rawMode === 'TRUE') {
      mode = 'ON';
    } else if (rawMode !== 'OFF' && rawMode !== 'FALSE' && rawMode !== '') {
      this.logger.warn(
        `[SM-APPROVAL-CONFIG] Invalid CONSUMABLE_SM_APPROVAL_MODE "${rawMode}". Falling back to OFF.`,
      );
    }

    let scope: 'ALL' | 'PURCHASE_ONLY' = 'ALL';
    if (rawScope === 'PURCHASE_ONLY') {
      scope = 'PURCHASE_ONLY';
    } else if (rawScope !== 'ALL' && rawScope !== '') {
      this.logger.warn(
        `[SM-APPROVAL-CONFIG] Invalid CONSUMABLE_SM_APPROVAL_SCOPE "${rawScope}". Falling back to ALL.`,
      );
    }

    return { mode, scope };
  }

  /**
   * Updates consumable SM approval configuration in system_settings table.
   * Allowed for ADMIN and GENERAL_MANAGER.
   */
  async setApprovalConfig(
    mode: 'OFF' | 'ON',
    scope?: 'ALL' | 'PURCHASE_ONLY',
    actorId?: string,
  ): Promise<{ mode: 'OFF' | 'ON'; scope: 'ALL' | 'PURCHASE_ONLY' }> {
    const settingRepo = this.dataSource.getRepository(SystemSetting);

    let modeSetting = await settingRepo.findOne({ where: { key: 'CONSUMABLE_SM_APPROVAL_MODE' } });
    if (!modeSetting) {
      modeSetting = settingRepo.create({
        key: 'CONSUMABLE_SM_APPROVAL_MODE',
        value: mode,
        updatedBy: actorId || 'ADMIN',
      });
    } else {
      modeSetting.value = mode;
      if (actorId) modeSetting.updatedBy = actorId;
    }
    await settingRepo.save(modeSetting);

    if (scope) {
      let scopeSetting = await settingRepo.findOne({ where: { key: 'CONSUMABLE_SM_APPROVAL_SCOPE' } });
      if (!scopeSetting) {
        scopeSetting = settingRepo.create({
          key: 'CONSUMABLE_SM_APPROVAL_SCOPE',
          value: scope,
          updatedBy: actorId || 'ADMIN',
        });
      } else {
        scopeSetting.value = scope;
        if (actorId) scopeSetting.updatedBy = actorId;
      }
      await settingRepo.save(scopeSetting);
    }

    // Keep process.env in sync for immediate consistency
    process.env.CONSUMABLE_SM_APPROVAL_MODE = mode;
    if (scope) {
      process.env.CONSUMABLE_SM_APPROVAL_SCOPE = scope;
    }

    this.logger.log(`[SM-APPROVAL-CONFIG] Configuration updated: MODE=${mode}, SCOPE=${scope || 'ALL'} by ${actorId || 'ADMIN'}`);

    if (this.auditService) {
      try {
        await this.auditService.logEvent({
          entityName: 'ApplicationSetting',
          entityId: 'ConsumableSmApprovalConfig',
          actionType: 'UPDATE',
          actorId,
          newValues: { mode, scope: scope || 'ALL' },
          metadata: { mode, scope: scope || 'ALL' },
        });
      } catch {
        // Non-blocking
      }
    }

    return await this.getApprovalConfig();
  }

  /**
   * Helper: Ensures 'CONSUMABLES' category and 'General Consumables' family exist.
   */
  async ensureConsumablesCategoryAndFamily(): Promise<{
    category: ProductCategory;
    family: ProductFamily;
  }> {
    let category = await this.categoryRepo.findOne({
      where: { name: Raw((alias) => `LOWER(${alias}) = 'consumables'`) },
    });

    if (!category) {
      category = this.categoryRepo.create({
        name: 'CONSUMABLES',
        isActive: true,
      });
      category = await this.categoryRepo.save(category);
      this.logger.log(`Created new ProductCategory: "CONSUMABLES" (${category.id})`);
    }

    let family = await this.familyRepo.findOne({
      where: {
        categoryId: category.id,
        name: Raw((alias) => `LOWER(${alias}) = 'general consumables'`),
      },
    });

    if (!family) {
      family = this.familyRepo.create({
        categoryId: category.id,
        name: 'General Consumables',
        isActive: true,
      });
      family = await this.familyRepo.save(family);
      this.logger.log(`Created new ProductFamily: "General Consumables" (${family.id})`);
    }

    return { category, family };
  }

  /**
   * Helper: Calculates current stock across all bins for a product.
   */
  async getAvailableStock(productId: string): Promise<number> {
    const balances = await this.balanceRepo.find({
      where: { productId },
    });
    return balances.reduce(
      (sum, b) => sum + (Number(b.currentQuantity) || 0),
      0,
    );
  }

  /**
   * Helper: Generates next sequential request code: CR-YYYY-XXXX
   */
  async generateNextRequestCode(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `CR-${currentYear}-`;

    const allRequests = await this.requestRepo.find({
      where: { requestCode: Like(`${prefix}%`) },
      select: { requestCode: true },
    });

    let maxSeq = 0;
    for (const req of allRequests) {
      if (req.requestCode) {
        const parts = req.requestCode.split('-');
        if (parts.length >= 3) {
          const seq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Helper: Generates next sequential PR number (starts at 1).
   */
  async generateNextPrNumber(): Promise<string> {
    const items = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.prNumber', 'prNumber')
      .where('item.prNumber IS NOT NULL')
      .getRawMany();

    let maxPr = 0;
    for (const row of items) {
      const num = parseInt(row.prNumber, 10);
      if (!isNaN(num) && num > maxPr) {
        maxPr = num;
      }
    }

    return String(maxPr + 1);
  }

  /**
   * Helper: Resolves a valid user ID for StockTransaction attribution,
   * falling back to the first active user if not provided or invalid.
   */
  async resolveEffectiveUserId(userId?: string): Promise<string> {
    if (userId) {
      try {
        const userCheck = await this.dataSource.query(
          'SELECT id FROM users WHERE id = $1',
          [userId],
        );
        if (userCheck && userCheck.length > 0) {
          return userCheck[0].id;
        }
      } catch {
        // Fall through to fallback
      }
    }

    try {
      const fallback = await this.dataSource.query(
        'SELECT id FROM users WHERE is_active = true ORDER BY created_at ASC LIMIT 1',
      );
      if (fallback && fallback.length > 0) {
        return fallback[0].id;
      }
    } catch {
      // Fall through
    }

    return userId || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Phase 24.2.1: Creates a Consumable Request with auto-master creation & dual-track routing.
   */
  async createRequest(
    dto: CreateConsumableRequestDto,
    userId?: string,
  ): Promise<ConsumableRequest> {
    const { family } = await this.ensureConsumablesCategoryAndFamily();
    const requestCode = await this.generateNextRequestCode();

    const request = this.requestRepo.create({
      requestCode,
      paymentMode: dto.paymentMode || ConsumablePaymentMode.CASH,
      endUserInVelan: dto.endUserInVelan || null,
      requestedBy: dto.requestedBy,
      createdByUserId: userId || null,
      preparedBy: dto.preparedBy || null,
      verifiedBy: dto.verifiedBy || null,
      approvedBy: dto.approvedBy || null,
      remarks: dto.remarks || null,
      requestDate: new Date(),
    });

    const savedRequest = await this.requestRepo.save(request);
    const lineItems: ConsumableRequestItem[] = [];

    for (const itemDto of dto.items) {
      let product: Product | null = null;
      let isNewProduct = Boolean(itemDto.isNewProduct);

      // 1. Resolve or Auto-Create Product Master (Idempotent by name)
      if (isNewProduct || !itemDto.productId) {
        const trimmedName = itemDto.description.trim();
        let existingProduct = await this.productRepo.findOne({
          where: { name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name: trimmedName }) },
        });

        if (existingProduct) {
          product = existingProduct;
          this.logger.log(
            `[AUTO-MASTER] Found existing Product for "${trimmedName}" (${product.code}), re-using ID: ${product.id}`,
          );
        } else {
          // Requirement: Product Code and Product Name are identical, and Barcode is PRD-{name}
          const code = itemDto.productCode?.trim() || trimmedName;
          const barcodeCandidate = `PRD-${trimmedName}`;

          let finalBarcode = barcodeCandidate;
          const existingBarcode = await this.productRepo.findOne({
            where: { barcode: barcodeCandidate },
          });
          if (existingBarcode) {
            finalBarcode = `${barcodeCandidate}-${Date.now().toString().slice(-4)}`;
          }

          product = this.productRepo.create({
            code,
            name: trimmedName,
            barcode: finalBarcode,
            familyId: family.id,
            uom: itemDto.uom || 'NOS',
            minimumInventory: 0,
            isActive: true,
          });
          product = await this.productRepo.save(product);
          this.logger.log(
            `[AUTO-MASTER] Created Consumable Product: "${product.name}" (Code: ${product.code}, Barcode: ${product.barcode})`,
          );
        }
        isNewProduct = true;
      } else {
        product = await this.productRepo.findOne({
          where: { id: itemDto.productId },
        });
        if (!product) {
          throw new NotFoundException(
            `Product with ID "${itemDto.productId}" was not found.`,
          );
        }
      }

      // 2. Resolve or Auto-Create Vendor Master (Idempotent by name)
      let vendorId: string | null = itemDto.vendorId || null;
      let vendorName: string | null = itemDto.vendorName || null;
      let isNewVendor = Boolean(itemDto.isNewVendor);

      if (isNewVendor && itemDto.newVendorName) {
        const trimmedVendorName = itemDto.newVendorName.trim();
        let existingVendor = await this.vendorRepo.findOne({
          where: { name: Raw((alias) => `LOWER(${alias}) = LOWER(:vname)`, { vname: trimmedVendorName }) },
        });

        if (existingVendor) {
          vendorId = existingVendor.id;
          vendorName = existingVendor.name;
          this.logger.log(
            `[AUTO-MASTER] Found existing Vendor for "${trimmedVendorName}" (${existingVendor.code}), re-using ID: ${existingVendor.id}`,
          );
        } else {
          const vCode = `VND-CNS-${Date.now().toString().slice(-4)}`;
          let newVendor = this.vendorRepo.create({
            code: vCode,
            name: trimmedVendorName,
            address: itemDto.newVendorAddress || null,
            phone: itemDto.newVendorMobile || null,
            category: 'CONSUMABLES',
            isActive: true,
          });
          newVendor = await this.vendorRepo.save(newVendor);
          vendorId = newVendor.id;
          vendorName = newVendor.name;
          this.logger.log(
            `[AUTO-MASTER] Created Consumable Vendor: "${newVendor.name}" (${newVendor.code})`,
          );
        }
      } else if (vendorId && !vendorName) {
        const existingVendor = await this.vendorRepo.findOne({
          where: { id: vendorId },
        });
        if (existingVendor) {
          vendorName = existingVendor.name;
        }
      }

      // 3. Dual-Track Live Stock Evaluation
      const availableStock = await this.getAvailableStock(product.id);
      const requestedQty = Number(itemDto.requestedQty) || 0;

      let itemCategoryTrack: ConsumableItemTrack;
      let status: ConsumableItemStatus;

      if (!isNewProduct && availableStock >= requestedQty && requestedQty > 0) {
        // Track A: In-Stock Queue
        itemCategoryTrack = ConsumableItemTrack.STOCK_ITEM;
        status = ConsumableItemStatus.READY_FOR_ISSUE;
      } else {
        // Track B: Purchase Queue
        itemCategoryTrack = ConsumableItemTrack.NON_STOCK_OR_NEW;
        status = ConsumableItemStatus.OPEN;
      }

      // 4. SM Approval Flag & Scope Evaluation (Phase P2)
      const { mode, scope } = await this.getApprovalConfig();
      let approvalStatus: ConsumableApprovalStatus = ConsumableApprovalStatus.APPROVED;
      let approvedAt: Date | null = new Date();

      if (mode === 'ON') {
        if (scope === 'ALL') {
          approvalStatus = ConsumableApprovalStatus.PENDING_SM_APPROVAL;
          approvedAt = null;
        } else if (scope === 'PURCHASE_ONLY') {
          if (itemCategoryTrack === ConsumableItemTrack.STOCK_ITEM) {
            approvalStatus = ConsumableApprovalStatus.APPROVED;
            approvedAt = new Date();
          } else {
            approvalStatus = ConsumableApprovalStatus.PENDING_SM_APPROVAL;
            approvedAt = null;
          }
        }
      }

      const trimmedLineDesc = itemDto.lineDescription?.trim();
      if (!trimmedLineDesc || trimmedLineDesc.length < 3 || trimmedLineDesc.length > 800) {
        throw new BadRequestException('Line item description is required and must be between 3 and 800 characters.');
      }

      const lineItem = this.itemRepo.create({
        requestId: savedRequest.id,
        productId: product.id,
        productCode: product.code || itemDto.productCode || null,
        description: itemDto.description.trim(),
        lineDescription: trimmedLineDesc,
        uom: itemDto.uom || product.uom || 'NOS',
        isNewProduct,
        itemCategoryTrack,
        stockAvailableAtRequest: availableStock,
        requestedQty,
        realReceivedQty: 0,
        issuedQty: 0,
        vendorId,
        vendorName,
        unitPrice: itemDto.unitPrice ?? itemDto.newVendorPrice ?? null,
        isNewVendor,
        newVendorName: itemDto.newVendorName || null,
        newVendorAddress: itemDto.newVendorAddress || null,
        newVendorMobile: itemDto.newVendorMobile || null,
        newVendorPrice: itemDto.newVendorPrice ?? null,
        endUserInVelan: itemDto.endUserInVelan || dto.endUserInVelan || null,
        requestedBy: itemDto.requestedBy || dto.requestedBy,
        status,
        approvalStatus,
        approvedAt,
      });

      lineItems.push(lineItem);
    }

    savedRequest.items = await this.itemRepo.save(lineItems);
    this.logger.log(
      `[CONSUMABLE REQUEST CREATED] Code: ${savedRequest.requestCode}, Items: ${savedRequest.items.length}`,
    );

    // Phase P5: Dispatch notification to approvers (SENIOR_MANAGER and ADMIN) if MODE=ON and >= 1 pending line
    if (this.batchNotificationService) {
      try {
        await this.batchNotificationService.notifyApprovalRequested(
          savedRequest,
          savedRequest.items,
          userId,
        );
      } catch (notifyErr: any) {
        this.logger.warn(`Failed to dispatch approval requested notification: ${notifyErr?.message || notifyErr}`);
      }
    }

    return this.findOneRequest(savedRequest.id);
  }

  /**
   * Phase P2: Bulk approves up to 200 consumable request line items in a single transaction.
   * Optimistic guard: only items in PENDING_SM_APPROVAL status are modified.
   * For STOCK_ITEM lines, re-checks live stock availability with an in-batch running tally.
   * If stock is depleted, switches line to NON_STOCK_OR_NEW (OPEN) and creates an audit entry.
   */
  async bulkApprove(
    dto: BulkApproveConsumablesDto,
    approverId?: string,
  ): Promise<{
    batchId: string;
    approvedCount: number;
    ignoredCount: number;
    switchedToPurchase: Array<{ id: string; description: string }>;
  }> {
    if (!dto.itemIds || dto.itemIds.length === 0) {
      throw new BadRequestException('At least 1 item ID must be provided');
    }
    if (dto.itemIds.length > 200) {
      throw new BadRequestException('Cannot approve more than 200 items in a single batch');
    }

    const batchId = randomUUID();
    const switchedToPurchase: Array<{ id: string; description: string }> = [];
    let approvedCount = 0;
    let ignoredCount = 0;
    const effectiveApproverId = approverId || (await this.resolveEffectiveUserId(approverId));

    await this.dataSource.transaction(async (manager) => {
      const items = await manager
        .createQueryBuilder(ConsumableRequestItem, 'item')
        .setLock('pessimistic_write')
        .where('item.id IN (:...ids)', { ids: dto.itemIds })
        .andWhere('item.approval_status = :pendingStatus', {
          pendingStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
        })
        .getMany();

      const foundPendingIds = new Set(items.map((i) => i.id));
      ignoredCount = dto.itemIds.length - foundPendingIds.size;

      if (items.length === 0) {
        return;
      }

      const now = new Date();
      const batchAllocatedMap = new Map<string, number>();

      for (const item of items) {
        if (item.itemCategoryTrack === ConsumableItemTrack.STOCK_ITEM && item.productId) {
          const balances = await manager.find(StockBalance, {
            where: { productId: item.productId },
          });
          const liveStock = balances.reduce(
            (sum, b) => sum + (Number(b.currentQuantity) || 0),
            0,
          );
          const allocatedSoFar = batchAllocatedMap.get(item.productId) || 0;
          const availableStock = liveStock - allocatedSoFar;
          const requestedQty = Number(item.requestedQty) || 0;

          if (availableStock < requestedQty) {
            const oldTrack = item.itemCategoryTrack;
            const oldStatus = item.status;
            item.itemCategoryTrack = ConsumableItemTrack.NON_STOCK_OR_NEW;
            item.status = ConsumableItemStatus.OPEN;

            switchedToPurchase.push({ id: item.id, description: item.description });

            if (this.auditService) {
              await this.auditService.logEvent({
                entityName: 'CONSUMABLE_REQUEST_ITEM',
                entityId: item.id,
                actionType: 'CONSUMABLE_TRACK_SWITCHED',
                actorId: effectiveApproverId,
                oldValues: { itemCategoryTrack: oldTrack, status: oldStatus },
                newValues: { itemCategoryTrack: ConsumableItemTrack.NON_STOCK_OR_NEW, status: ConsumableItemStatus.OPEN },
                metadata: {
                  batchId,
                  reason: 'Insufficient stock during approval re-check',
                  liveStock,
                  allocatedSoFar,
                  requestedQty,
                },
              }).catch((err) => this.logger.warn(`Audit log failed: ${err?.message}`));
            }
          } else {
            batchAllocatedMap.set(item.productId, allocatedSoFar + requestedQty);
          }
        }

        item.approvalStatus = ConsumableApprovalStatus.APPROVED;
        item.approvedById = effectiveApproverId;
        item.approvedAt = now;
        item.approvalBatchId = batchId;

        if (this.auditService) {
          await this.auditService.logEvent({
            entityName: 'CONSUMABLE_REQUEST_ITEM',
            entityId: item.id,
            actionType: 'CONSUMABLE_APPROVED',
            actorId: effectiveApproverId,
            oldValues: { approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL },
            newValues: {
              approvalStatus: ConsumableApprovalStatus.APPROVED,
              approvedAt: now,
              approvalBatchId: batchId,
              itemCategoryTrack: item.itemCategoryTrack,
            },
            metadata: { batchId },
          }).catch((err) => this.logger.warn(`Audit log failed: ${err?.message}`));
        }
      }

      await manager.save(ConsumableRequestItem, items);
      approvedCount = items.length;
    });

    // Phase P5: Batch notification dispatched AFTER commit inside try/catch
    if (this.batchNotificationService && approvedCount > 0) {
      try {
        await this.batchNotificationService.notifyBulkApproved(batchId, dto.itemIds, {
          approverId: effectiveApproverId,
          switchedToPurchase,
        });
      } catch (notifyErr: any) {
        this.logger.warn(`Failed to dispatch bulk approve notifications: ${notifyErr?.message || notifyErr}`);
      }
    }

    return {
      batchId,
      approvedCount,
      ignoredCount,
      switchedToPurchase,
    };
  }

  /**
   * Phase P2: Bulk rejects up to 200 consumable request line items with a mandatory reason.
   * Optimistic guard: only items in PENDING_SM_APPROVAL status are modified.
   */
  async bulkReject(
    dto: BulkRejectConsumablesDto,
    rejecterId?: string,
  ): Promise<{
    batchId: string;
    rejectedCount: number;
    ignoredCount: number;
  }> {
    if (!dto.itemIds || dto.itemIds.length === 0) {
      throw new BadRequestException('At least 1 item ID must be provided');
    }
    if (dto.itemIds.length > 200) {
      throw new BadRequestException('Cannot reject more than 200 items in a single batch');
    }
    if (!dto.rejectionReason || dto.rejectionReason.trim().length < 5) {
      throw new BadRequestException('Rejection reason must be at least 5 characters long');
    }

    const batchId = randomUUID();
    const reason = dto.rejectionReason.trim();
    let rejectedCount = 0;
    let ignoredCount = 0;
    const effectiveRejecterId = rejecterId || (await this.resolveEffectiveUserId(rejecterId));

    await this.dataSource.transaction(async (manager) => {
      const items = await manager
        .createQueryBuilder(ConsumableRequestItem, 'item')
        .setLock('pessimistic_write')
        .where('item.id IN (:...ids)', { ids: dto.itemIds })
        .andWhere('item.approval_status = :pendingStatus', {
          pendingStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
        })
        .getMany();

      const foundPendingIds = new Set(items.map((i) => i.id));
      ignoredCount = dto.itemIds.length - foundPendingIds.size;

      if (items.length === 0) {
        return;
      }

      const now = new Date();

      for (const item of items) {
        item.approvalStatus = ConsumableApprovalStatus.REJECTED;
        item.rejectedById = effectiveRejecterId;
        item.rejectedAt = now;
        item.rejectionReason = reason;
        item.approvalBatchId = batchId;

        if (this.auditService) {
          await this.auditService.logEvent({
            entityName: 'CONSUMABLE_REQUEST_ITEM',
            entityId: item.id,
            actionType: 'CONSUMABLE_REJECTED',
            actorId: effectiveRejecterId,
            oldValues: { approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL },
            newValues: {
              approvalStatus: ConsumableApprovalStatus.REJECTED,
              rejectedAt: now,
              rejectionReason: reason,
              approvalBatchId: batchId,
            },
            metadata: { batchId, rejectionReason: reason },
          }).catch((err) => this.logger.warn(`Audit log failed: ${err?.message}`));
        }
      }

      await manager.save(ConsumableRequestItem, items);
      rejectedCount = items.length;
    });

    // Phase P5: Batch notification dispatched AFTER commit inside try/catch
    if (this.batchNotificationService && rejectedCount > 0) {
      try {
        await this.batchNotificationService.notifyBulkRejected(batchId, dto.itemIds, {
          rejecterId: effectiveRejecterId,
          rejectionReason: reason,
        });
      } catch (notifyErr: any) {
        this.logger.warn(`Failed to dispatch bulk reject notifications: ${notifyErr?.message || notifyErr}`);
      }
    }

    return {
      batchId,
      rejectedCount,
      ignoredCount,
    };
  }

  /**
   * Phase P2: Queries consumable line items for Senior Manager approval views.
   * Supports filtering by approval status, track, search query, date ranges, and pagination.
   */
  async queryApprovals(dto: QueryConsumableApprovalsDto) {
    const page = Math.max(1, Number(dto.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(dto.pageSize) || 25));
    const skip = (page - 1) * pageSize;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.request', 'request')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.approvedBy', 'approvedBy')
      .leftJoinAndSelect('item.rejectedBy', 'rejectedBy');

    const statusParam = (dto.status || 'PENDING').trim().toUpperCase();
    if (statusParam === 'PENDING' || statusParam === 'PENDING_SM_APPROVAL') {
      qb.andWhere('item.approval_status = :pendingStatus', {
        pendingStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL,
      });
    } else if (statusParam === 'APPROVED') {
      qb.andWhere('item.approval_status = :approvedStatus', {
        approvedStatus: ConsumableApprovalStatus.APPROVED,
      });
    } else if (statusParam === 'REJECTED') {
      qb.andWhere('item.approval_status = :rejectedStatus', {
        rejectedStatus: ConsumableApprovalStatus.REJECTED,
      });
    }

    if (dto.track) {
      qb.andWhere('item.item_category_track = :track', { track: dto.track });
    }

    if (dto.search && dto.search.trim()) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(item.description ILIKE :term OR item.line_description ILIKE :term OR item.product_code ILIKE :term OR request.request_code ILIKE :term OR request.requested_by ILIKE :term OR item.requested_by ILIKE :term)',
        { term },
      );
    }

    if (dto.from) {
      qb.andWhere('item.created_at >= :from', { from: new Date(dto.from) });
    }
    if (dto.to) {
      const toDate = new Date(dto.to);
      if (dto.to.length === 10) {
        toDate.setHours(23, 59, 59, 999);
      }
      qb.andWhere('item.created_at <= :to', { to: toDate });
    }

    qb.orderBy('item.created_at', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    const mapped = items.map((item) => {
      const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : null;
      const requestedQty = Number(item.requestedQty) || 0;
      const estimatedTotal = unitPrice != null ? Number((unitPrice * requestedQty).toFixed(2)) : null;

      return {
        id: item.id,
        requestCode: item.request?.requestCode || null,
        description: item.description,
        lineDescription: item.lineDescription || null,
        productCode: item.productCode || item.product?.code || null,
        itemCategoryTrack: item.itemCategoryTrack,
        status: item.status,
        requestedQty,
        uom: item.uom,
        unitPrice,
        estimatedTotal,
        requestedBy: item.request?.requestedBy || item.requestedBy || null,
        endUserInVelan: item.request?.endUserInVelan || item.endUserInVelan || null,
        createdAt: item.createdAt,
        approvalStatus: item.approvalStatus,
        approvedById: item.approvedById,
        approvedBy: item.approvedBy
          ? { id: item.approvedBy.id, name: item.approvedBy.name, email: item.approvedBy.email }
          : null,
        approvedAt: item.approvedAt,
        rejectedById: item.rejectedById,
        rejectedBy: item.rejectedBy
          ? { id: item.rejectedBy.id, name: item.rejectedBy.name, email: item.rejectedBy.email }
          : null,
        rejectedAt: item.rejectedAt,
        rejectionReason: item.rejectionReason,
        approvalBatchId: item.approvalBatchId,
      };
    });

    return {
      items: mapped,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Phase P2: Get count of consumable items pending Senior Manager approval (for badge).
   */
  async getPendingApprovalsCount(): Promise<{ count: number }> {
    try {
      const count = await this.itemRepo.count({
        where: { approvalStatus: ConsumableApprovalStatus.PENDING_SM_APPROVAL },
      });
      return { count };
    } catch (err: any) {
      if (err?.message?.includes('approval_status') || err?.code === '42703') {
        return { count: 0 };
      }
      throw err;
    }
  }

  /**
   * Phase 24.2.2: Assigns next sequential PR Number (starts at 151) and marks items PURCHASE_REQUESTED.
   */
  async printPurchaseRequisition(
    dto: PrintPrDto,
    userId?: string,
  ): Promise<{
    prNumber: string;
    printedAt: Date;
    items: ConsumableRequestItem[];
  }> {
    const rawIds = (dto.itemIds && dto.itemIds.length > 0)
      ? dto.itemIds
      : (dto.lineItemIds && dto.lineItemIds.length > 0)
      ? dto.lineItemIds
      : [];

    if (rawIds.length === 0) {
      throw new BadRequestException('At least one line item ID must be specified.');
    }

    const items = await this.itemRepo.find({
      where: { id: In(rawIds) },
      relations: { request: true, product: true, vendor: true },
    });

    if (items.length === 0) {
      throw new NotFoundException('None of the specified line items were found.');
    }

    // Phase P2: SM Approval Gate - Unapproved lines cannot be printed into PR (NULL counts as APPROVED)
    const unapprovedItems = items.filter(
      (i) =>
        i.approvalStatus !== null &&
        i.approvalStatus !== undefined &&
        i.approvalStatus !== ConsumableApprovalStatus.APPROVED,
    );
    if (unapprovedItems.length > 0) {
      const ids = unapprovedItems.map((i) => i.id).join(', ');
      throw new BadRequestException(
        `Cannot print PR for unapproved consumable line items: [${ids}] (Status: ${unapprovedItems[0].approvalStatus}). Approval is required before purchase requisition.`,
      );
    }

    // Verify items eligibility: must be OPEN or already have an assigned PR number
    const invalidItems = items.filter(
      (i) => i.status !== ConsumableItemStatus.OPEN && !i.prNumber,
    );
    if (invalidItems.length > 0) {
      throw new BadRequestException(
        `Cannot print PR: Line item "${invalidItems[0].description}" is in status "${invalidItems[0].status}". Only OPEN items or items with an assigned PR number can be printed.`,
      );
    }

    // Apply safety stock / purchase quantity adjustments from stores if provided
    const updatesMap = new Map<string, { purchaseQty?: number; unitPrice?: number; vendorId?: string }>();
    if (dto.itemUpdates && Array.isArray(dto.itemUpdates)) {
      for (const u of dto.itemUpdates) {
        if (u.id) updatesMap.set(u.id, u);
      }
    }
    if (dto.itemQuantities && typeof dto.itemQuantities === 'object') {
      for (const [id, qty] of Object.entries(dto.itemQuantities)) {
        const existing = updatesMap.get(id) || {};
        updatesMap.set(id, { ...existing, purchaseQty: Number(qty) });
      }
    }

    const itemsToSave: ConsumableRequestItem[] = [];
    for (const item of items) {
      const update = updatesMap.get(item.id);
      if (update && update.purchaseQty != null && Number(update.purchaseQty) > 0) {
        item.purchaseQty = Number(update.purchaseQty);
        if (!itemsToSave.includes(item)) itemsToSave.push(item);
      }
      if (update && update.unitPrice != null && Number(update.unitPrice) >= 0) {
        item.unitPrice = Number(update.unitPrice);
        if (!itemsToSave.includes(item)) itemsToSave.push(item);
      }
    }

    // Check if items already have a PR number assigned
    const alreadyPrAssigned = items.filter((i) => i.prNumber != null);
    const openItems = items.filter((i) => i.status === ConsumableItemStatus.OPEN);

    // If all requested items already have a PR number, return them gracefully for re-printing
    if (openItems.length === 0 && alreadyPrAssigned.length > 0) {
      if (itemsToSave.length > 0) {
        await this.itemRepo.save(itemsToSave);
      }
      const existingPr = alreadyPrAssigned[0].prNumber!;
      this.logger.log(
        `[PR RE-PRINT] Returning PR #${existingPr} for ${items.length} existing line item(s)`,
      );
      return {
        prNumber: existingPr,
        printedAt: alreadyPrAssigned[0].printedAt || new Date(),
        items,
      };
    }

    // Determine PR number: reuse from selected group if any, otherwise generate next sequential PR number
    const prNumber = alreadyPrAssigned.length > 0
      ? alreadyPrAssigned[0].prNumber!
      : await this.generateNextPrNumber();

    const printedAt = new Date();

    for (const item of openItems) {
      item.prNumber = prNumber;
      item.status = ConsumableItemStatus.PURCHASE_REQUESTED;
      item.printedAt = printedAt;
      if (!itemsToSave.includes(item)) itemsToSave.push(item);
    }

    if (itemsToSave.length > 0) {
      await this.itemRepo.save(itemsToSave);
      this.logger.log(
        `[PR PRINTED] Assigned PR #${prNumber} to ${openItems.length} line item(s), saved ${itemsToSave.length} item(s)`,
      );
    }

    return {
      prNumber,
      printedAt,
      items,
    };
  }

  /**
   * Fetches PR items for PDF archiving — used by archive-pr-pdf endpoint
   */
  async getPrItemsForArchive(
    prNumber: string,
    itemIds: string[],
  ): Promise<{
    preparedBy: string;
    items: Array<{
      description: string;
      productCode?: string;
      requestedQty?: number;
      purchaseQty?: number;
      uom?: string;
      unitPrice?: number;
      vendorName?: string;
      endUserInVelan?: string;
      requestedBy?: string;
    }>;
  }> {
    const where: any = {};
    if (itemIds && itemIds.length > 0) {
      where.id = In(itemIds);
    } else if (prNumber) {
      where.prNumber = prNumber;
    }
    const items = await this.itemRepo.find({
      where,
      relations: { product: true, vendor: true, request: true },
    });
    const mappedItems = items.map((item) => ({
      description: item.description || item.product?.name || 'N/A',
      productCode: item.product?.code,
      requestedQty: Number(item.requestedQty ?? 0),
      purchaseQty: item.purchaseQty != null ? Number(item.purchaseQty) : undefined,
      uom: item.uom || 'NOS',
      unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
      vendorName: item.vendor?.name || undefined,
      endUserInVelan: item.endUserInVelan || undefined,
      requestedBy: item.requestedBy || undefined,
    }));
    const preparedBy =
      items[0]?.requestedBy ||
      (items[0]?.request as any)?.createdByName ||
      items[0]?.request?.preparedBy ||
      items[0]?.request?.requestedBy ||
      'Production User';
    return { preparedBy, items: mappedItems };
  }

  /**
   * Phase 24.2.3: Stores receives purchased item into a selected bin with real quantity,
   * atomic STOCK_IN, and optional immediate auto-issue to production.
   */
  async receivePurchase(
    dto: ReceiveConsumablePurchaseDto,
    userId?: string,
  ): Promise<ConsumableRequestItem> {
    const firstNested = Array.isArray(dto.items) && dto.items.length > 0 ? dto.items[0] : null;
    const resolvedItemId = dto.itemId || dto.lineItemId || firstNested?.itemId || firstNested?.lineItemId;
    const resolvedBinId = dto.binId || firstNested?.binId;
    const resolvedRealQty = Number(dto.realReceivedQty != null ? dto.realReceivedQty : (firstNested?.realReceivedQty != null ? firstNested.realReceivedQty : 0));
    const resolvedAutoIssue = dto.autoIssue !== undefined ? dto.autoIssue : Boolean(firstNested?.autoIssue);
    const resolvedRemarks = dto.remarks || firstNested?.remarks;

    if (!resolvedItemId) {
      throw new BadRequestException('Line item ID must be provided.');
    }

    const item = await this.itemRepo.findOne({
      where: { id: resolvedItemId },
      relations: { product: true, request: true },
    });

    if (!item) {
      throw new NotFoundException(`Line item "${resolvedItemId}" was not found.`);
    }

    // Phase P2: SM Approval Gate - Unapproved lines cannot be received (NULL counts as APPROVED)
    if (
      item.approvalStatus !== null &&
      item.approvalStatus !== undefined &&
      item.approvalStatus !== ConsumableApprovalStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot receive purchase for unapproved consumable line "${item.id}" (Status: ${item.approvalStatus}).`,
      );
    }

    if (
      item.status !== ConsumableItemStatus.PURCHASE_REQUESTED &&
      item.status !== ConsumableItemStatus.OPEN
    ) {
      throw new BadRequestException(
        `Cannot receive item: status is "${item.status}". Expected "PURCHASE_REQUESTED" or "OPEN".`,
      );
    }

    if (!resolvedBinId) {
      throw new BadRequestException('Target warehouse bin ID must be specified.');
    }

    const bin = await this.binRepo.findOne({ where: { id: resolvedBinId } });
    if (!bin) {
      throw new NotFoundException(`Target Bin with ID "${resolvedBinId}" was not found.`);
    }

    const realQty = resolvedRealQty;
    if (realQty <= 0) {
      throw new BadRequestException('Real received quantity must be greater than zero.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      const effectiveUserId = await this.resolveEffectiveUserId(userId);

      // 1. Update Line Item fields
      item.realReceivedQty = realQty;
      item.binId = bin.id;
      item.purchaseReceivedAt = now;

      // 2. Atomic Stock-In to Target Bin
      let balance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: item.productId, binId: bin.id },
      });

      if (!balance) {
        balance = queryRunner.manager.create(StockBalance, {
          productId: item.productId,
          binId: bin.id,
          currentQuantity: realQty,
        });
      } else {
        balance.currentQuantity = Number(balance.currentQuantity) + realQty;
      }
      await queryRunner.manager.save(balance);

      // 3. Log Immutable STOCK_IN Ledger Entry
      const stockInTx = queryRunner.manager.create(StockTransaction, {
        productId: item.productId,
        destinationBinId: bin.id,
        transactionType: TransactionType.STOCK_IN,
        quantity: realQty,
        referenceType: 'CONSUMABLE_PURCHASE',
        referenceId: item.id,
        reason:
          resolvedRemarks?.trim() ||
          `Consumable Purchase Inward (PR #${item.prNumber || 'N/A'}) - ${realQty} ${item.uom} received from Vendor`,
        createdById: effectiveUserId,
      });
      await queryRunner.manager.save(stockInTx);

      // 4. Handle Immediate Auto-Issue to Production (delivers requested quantity, retains remaining stock in bin)
      if (resolvedAutoIssue) {
        // Calculate the exact quantity to issue to production:
        // Defaults to item.requestedQty (or remaining needed), capped at realQty received from vendor
        const currentIssued = Number(item.issuedQty || 0);
        const requestedQty = Number(item.requestedQty || 1);
        const remainingNeeded = Math.max(0, requestedQty - currentIssued);
        const defaultIssueQty = Math.min(remainingNeeded > 0 ? remainingNeeded : requestedQty, realQty);
        const resolvedIssueQty =
          dto.issueQty != null && Number(dto.issueQty) > 0
            ? Number(dto.issueQty)
            : firstNested?.issueQty != null && Number(firstNested.issueQty) > 0
            ? Number(firstNested.issueQty)
            : defaultIssueQty;

        if (resolvedIssueQty > realQty) {
          throw new BadRequestException(
            `Cannot issue ${resolvedIssueQty} ${item.uom} to production: only ${realQty} ${item.uom} was received from vendor.`,
          );
        }

        if (resolvedIssueQty > 0) {
          // Atomic Stock-Out for the requested/issued portion ONLY
          balance.currentQuantity = Number(balance.currentQuantity) - resolvedIssueQty;
          await queryRunner.manager.save(balance);

          const stockOutTx = queryRunner.manager.create(StockTransaction, {
            productId: item.productId,
            sourceBinId: bin.id,
            transactionType: TransactionType.STOCK_OUT,
            quantity: resolvedIssueQty,
            referenceType: 'CONSUMABLE_ISSUE',
            referenceId: item.id,
            reason:
              resolvedRemarks?.trim() ||
              `Issued to Production (Req #${item.request?.requestCode || 'N/A'}) - ${resolvedIssueQty} ${item.uom} dispatched to ${item.endUserInVelan || 'Shop Floor'}`,
            createdById: effectiveUserId,
          });
          await queryRunner.manager.save(stockOutTx);

          const newTotalIssued = currentIssued + resolvedIssueQty;
          item.issuedQty = newTotalIssued;
          item.issuedAt = now;
          if (requestedQty > 0 && newTotalIssued < requestedQty) {
            item.status = ConsumableItemStatus.PARTIALLY_ISSUED;
          } else {
            item.status = ConsumableItemStatus.ISSUED_TO_PRODUCTION;
          }

          const retainedInStore = realQty - resolvedIssueQty;
          this.logger.log(
            `[PURCHASE RECEIVED & DISPATCHED] Item: "${item.description}", Inwarded: ${realQty}, Issued to Floor: ${resolvedIssueQty} (Total Issued: ${newTotalIssued}/${requestedQty}), Retained in Stores: ${retainedInStore}, Status: ${item.status}, Bin: ${bin.code}`,
          );
        } else {
          item.status = ConsumableItemStatus.PURCHASE_RECEIVED;
          item.issuedQty = currentIssued;
        }
      } else {
        item.status = ConsumableItemStatus.PURCHASE_RECEIVED;
        item.issuedQty = Number(item.issuedQty || 0);
        this.logger.log(
          `[PURCHASE RECEIVED IN STORE] Item: "${item.description}", Inwarded: ${realQty}, Retained 100% in Bin: ${bin.code}`,
        );
      }

      const savedItem = await queryRunner.manager.save(item);
      await queryRunner.commitTransaction();

      return this.findOneItem(savedItem.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to receive purchase: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Phase 24.2.4: Stores issues an in-stock or received consumable to production.
   * If partially issued, status transitions to PARTIALLY_ISSUED so the item remains open for remaining quantity.
   */
  async issueToProduction(
    itemId: string,
    dto: IssueConsumableToProductionDto,
    userId?: string,
  ): Promise<ConsumableRequestItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: { product: true, request: true },
    });

    if (!item) {
      throw new NotFoundException(`Line item "${itemId}" was not found.`);
    }

    // Phase P2: SM Approval Gate - Unapproved lines cannot be issued to production (NULL counts as APPROVED)
    if (
      item.approvalStatus !== null &&
      item.approvalStatus !== undefined &&
      item.approvalStatus !== ConsumableApprovalStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot issue to production for unapproved consumable line "${item.id}" (Status: ${item.approvalStatus}).`,
      );
    }

    if (
      item.status !== ConsumableItemStatus.READY_FOR_ISSUE &&
      item.status !== ConsumableItemStatus.PURCHASE_RECEIVED &&
      item.status !== ConsumableItemStatus.PARTIALLY_ISSUED
    ) {
      throw new BadRequestException(
        `Cannot issue item: status is "${item.status}". Expected "READY_FOR_ISSUE", "PURCHASE_RECEIVED", or "PARTIALLY_ISSUED".`,
      );
    }

    const bin = await this.binRepo.findOne({ where: { id: dto.binId } });
    if (!bin) {
      throw new NotFoundException(`Source Bin with ID "${dto.binId}" was not found.`);
    }

    const issueQty = Number(dto.issueQty);
    if (issueQty <= 0) {
      throw new BadRequestException('Issue quantity must be greater than zero.');
    }

    const currentIssued = Number(item.issuedQty || 0);
    const requestedQty = Number(item.requestedQty || 0);
    const remainingNeeded = Math.max(0, requestedQty - currentIssued);

    if (requestedQty > 0 && issueQty > remainingNeeded) {
      throw new BadRequestException(
        `Cannot issue ${issueQty} ${item.uom}. Remaining quantity needed is only ${remainingNeeded} ${item.uom}.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const effectiveUserId = await this.resolveEffectiveUserId(userId);

      // 1. Verify and decrement stock balance
      const balance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: item.productId, binId: bin.id },
      });

      const currentBalance = Number(balance?.currentQuantity) || 0;
      if (!balance || currentBalance < issueQty) {
        throw new BadRequestException(
          `Insufficient stock in Bin "${bin.code}". Available: ${currentBalance}, Requested: ${issueQty}.`,
        );
      }

      balance.currentQuantity = currentBalance - issueQty;
      await queryRunner.manager.save(balance);

      // 2. Log Immutable STOCK_OUT Ledger Entry
      const stockOutTx = queryRunner.manager.create(StockTransaction, {
        productId: item.productId,
        sourceBinId: bin.id,
        transactionType: TransactionType.STOCK_OUT,
        quantity: issueQty,
        referenceType: 'CONSUMABLE_ISSUE',
        referenceId: item.id,
        reason: dto.remarks?.trim() || `Issued to Production for ${item.endUserInVelan || 'Shop Floor'}`,
        createdById: effectiveUserId,
      });
      await queryRunner.manager.save(stockOutTx);

      // 3. Update line item state (accumulate issuedQty and transition status)
      item.binId = bin.id;
      const newTotalIssued = currentIssued + issueQty;
      item.issuedQty = newTotalIssued;
      item.issuedAt = new Date();
      if (requestedQty > 0 && newTotalIssued < requestedQty) {
        item.status = ConsumableItemStatus.PARTIALLY_ISSUED;
      } else {
        item.status = ConsumableItemStatus.ISSUED_TO_PRODUCTION;
      }

      const savedItem = await queryRunner.manager.save(item);
      await queryRunner.commitTransaction();

      this.logger.log(
        `[ISSUED TO PRODUCTION] Item: "${item.description}", Qty: ${issueQty} (Total Issued: ${newTotalIssued}/${requestedQty}), Status: ${item.status}, Bin: ${bin.code}`,
      );

      return this.findOneItem(savedItem.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to issue to production: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Phase 24.2.5: Closed loop - Production explicitly confirms receipt on shop floor.
   */
  async confirmProductionReceipt(
    itemId: string,
    userId?: string,
  ): Promise<ConsumableRequestItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: { product: true, request: true },
    });

    if (!item) {
      throw new NotFoundException(`Line item "${itemId}" was not found.`);
    }

    if (item.status !== ConsumableItemStatus.ISSUED_TO_PRODUCTION) {
      throw new BadRequestException(
        `Cannot confirm receipt: item status is "${item.status}". Expected "ISSUED_TO_PRODUCTION".`,
      );
    }

    item.status = ConsumableItemStatus.RECEIVED_BY_PRODUCTION;
    item.productionReceivedAt = new Date();
    item.productionReceivedById = userId || null;

    const saved = await this.itemRepo.save(item);
    this.logger.log(
      `[RECEIVED BY PRODUCTION] Item "${saved.description}" closed loop verified by user "${userId || 'Operator'}"`,
    );

    return this.findOneItem(saved.id);
  }

  /**
   * Delete a single consumable line item.
   * If stock was already received into a bin (realReceivedQty > 0) but not yet issued to production (issuedQty === 0),
   * this safely reverses the bin stock balance and records an atomic STOCK_OUT ledger reversal.
   * If issuedQty > 0, deletion is blocked because goods have physically left stores.
   * If this line item was the only item in its parent ConsumableRequest, the parent request is cleanly removed.
   */
  async deleteLineItem(
    id: string,
    userId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    deletedItemId: string;
    requestDeleted: boolean;
  }> {
    const item = await this.itemRepo.findOne({
      where: { id },
      relations: { request: true },
    });

    if (!item) {
      throw new NotFoundException(`Consumable line item "${id}" was not found.`);
    }

    // Phase P2: Rejected items cannot be deleted directly
    if (item.approvalStatus === ConsumableApprovalStatus.REJECTED) {
      throw new BadRequestException(
        `Rejected consumable line item "${id}" cannot be deleted. Rejected records are preserved for audit history.`,
      );
    }

    const issuedQty = Number(item.issuedQty || 0);
    if (issuedQty > 0) {
      throw new BadRequestException(
        'Cannot delete line item: Material has already been issued to production.',
      );
    }

    const realReceivedQty = Number(item.realReceivedQty || 0);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const effectiveUserId = await this.resolveEffectiveUserId(userId);

      // If item was already inwarded to a bin, reverse the stock
      if (realReceivedQty > 0 && item.binId && item.productId) {
        const balance = await queryRunner.manager.findOne(StockBalance, {
          where: { productId: item.productId, binId: item.binId },
        });

        const currentBalance = Number(balance?.currentQuantity) || 0;
        if (!balance || currentBalance < realReceivedQty) {
          throw new BadRequestException(
            `Cannot delete line item: Stock balance in bin (${currentBalance}) is less than received quantity (${realReceivedQty}). Stock may have already been moved or consumed.`,
          );
        }

        balance.currentQuantity = currentBalance - realReceivedQty;
        await queryRunner.manager.save(balance);

        const reversalTx = queryRunner.manager.create(StockTransaction, {
          productId: item.productId,
          sourceBinId: item.binId,
          transactionType: TransactionType.STOCK_OUT,
          quantity: realReceivedQty,
          referenceType: 'CONSUMABLE_DELETION',
          referenceId: item.id,
          reason: `Reversal of purchase receipt for deleted consumable item: ${item.description || item.id}`,
          createdById: effectiveUserId,
        });
        await queryRunner.manager.save(reversalTx);
      }

      const requestId = item.requestId;

      // Delete the line item
      await queryRunner.manager.delete(ConsumableRequestItem, { id: item.id });

      // Check if parent request is now empty
      let requestDeleted = false;
      if (requestId) {
        const remainingCount = await queryRunner.manager.count(ConsumableRequestItem, {
          where: { requestId },
        });
        if (remainingCount === 0) {
          await queryRunner.manager.delete(ConsumableRequest, { id: requestId });
          requestDeleted = true;
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `[CONSUMABLES-DELETE] Line item "${item.description}" (${id}) deleted successfully. Request deleted: ${requestDeleted}`,
      );

      return {
        success: true,
        message: `Consumable line item "${item.description || id}" was deleted successfully.`,
        deletedItemId: id,
        requestDeleted,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk delete multiple consumable line items.
   */
  async bulkDeleteLineItems(
    itemIds: string[],
    userId?: string,
  ): Promise<{
    success: boolean;
    deletedCount: number;
    deletedIds: string[];
    errors: { id: string; error: string }[];
  }> {
    // Phase P2: Reject upfront if any item is REJECTED
    const items = await this.itemRepo.find({ where: { id: In(itemIds) } });
    const rejectedItems = items.filter((i) => i.approvalStatus === ConsumableApprovalStatus.REJECTED);
    if (rejectedItems.length > 0) {
      const rejectedIds = rejectedItems.map((i) => i.id).join(', ');
      throw new BadRequestException(
        `Cannot delete rejected consumable line items: [${rejectedIds}]. Rejected records are preserved for audit history.`,
      );
    }

    const deletedIds: string[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const id of itemIds) {
      try {
        await this.deleteLineItem(id, userId);
        deletedIds.push(id);
      } catch (err: any) {
        errors.push({ id, error: err?.message || 'Failed to delete line item' });
      }
    }

    return {
      success: errors.length === 0,
      deletedCount: deletedIds.length,
      deletedIds,
      errors,
    };
  }

  /**
   * Delete an entire consumable request document if none of its items have been issued.
   */
  async deleteRequest(
    id: string,
    userId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    deletedRequestId: string;
    deletedItemsCount: number;
  }> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!request) {
      throw new NotFoundException(`Consumable request "${id}" was not found.`);
    }

    const issuedItems = (request.items || []).filter((it) => Number(it.issuedQty || 0) > 0);
    if (issuedItems.length > 0) {
      throw new BadRequestException(
        `Cannot delete request "${request.requestCode}": ${issuedItems.length} item(s) have already been issued to production.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const effectiveUserId = await this.resolveEffectiveUserId(userId);

      // Revert stock for any items that were received
      for (const it of request.items || []) {
        const realQty = Number(it.realReceivedQty || 0);
        if (realQty > 0 && it.binId && it.productId) {
          const balance = await queryRunner.manager.findOne(StockBalance, {
            where: { productId: it.productId, binId: it.binId },
          });
          const currentBalance = Number(balance?.currentQuantity) || 0;
          if (balance && currentBalance >= realQty) {
            balance.currentQuantity = currentBalance - realQty;
            await queryRunner.manager.save(balance);

            const reversalTx = queryRunner.manager.create(StockTransaction, {
              productId: it.productId,
              sourceBinId: it.binId,
              transactionType: TransactionType.STOCK_OUT,
              quantity: realQty,
              referenceType: 'CONSUMABLE_DELETION',
              referenceId: it.id,
              reason: `Reversal of purchase receipt for deleted request ${request.requestCode}`,
              createdById: effectiveUserId,
            });
            await queryRunner.manager.save(reversalTx);
          }
        }
      }

      const count = request.items?.length || 0;
      await queryRunner.manager.delete(ConsumableRequestItem, { requestId: request.id });
      await queryRunner.manager.delete(ConsumableRequest, { id: request.id });

      await queryRunner.commitTransaction();

      this.logger.log(
        `[CONSUMABLES-DELETE] Request "${request.requestCode}" (${id}) and ${count} line item(s) deleted.`,
      );

      return {
        success: true,
        message: `Consumable request "${request.requestCode}" and its ${count} item(s) were deleted successfully.`,
        deletedRequestId: id,
        deletedItemsCount: count,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Queries all consumable requests with header details and line item counts.
   */
  async findAllRequests(): Promise<ConsumableRequest[]> {
    return this.requestRepo.find({
      relations: { items: { product: true, vendor: true, bin: true } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Queries single request by ID.
   */
  async findOneRequest(id: string): Promise<ConsumableRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: { items: { product: true, vendor: true, bin: true } },
    });
    if (!request) {
      throw new NotFoundException(`Consumable Request with ID "${id}" was not found.`);
    }
    return request;
  }

  /**
   * Queries line items with flexible filtering (Track A In-Stock vs Track B Purchase).
   */
  async findAllLineItems(query: QueryConsumableItemsDto): Promise<{
    items: ConsumableRequestItem[];
    total: number;
  }> {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.request', 'request')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.vendor', 'vendor')
      .leftJoinAndSelect('item.bin', 'bin');

    if (query.track) {
      qb.andWhere('item.itemCategoryTrack = :track', { track: query.track });
    }

    if (query.approvedOnly) {
      qb.andWhere('(item.approvalStatus IS NULL OR item.approvalStatus = :approvedStatus)', {
        approvedStatus: ConsumableApprovalStatus.APPROVED,
      });
    } else if (query.approvalStatus) {
      qb.andWhere('item.approvalStatus = :approvalStatus', {
        approvalStatus: query.approvalStatus,
      });
    }

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.prNumber) {
      qb.andWhere('item.prNumber = :prNumber', { prNumber: query.prNumber });
    }

    if (query.search) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(item.description) LIKE :term OR LOWER(item.lineDescription) LIKE :term OR LOWER(item.productCode) LIKE :term OR LOWER(item.vendorName) LIKE :term OR LOWER(request.requestCode) LIKE :term OR LOWER(item.requestedBy) LIKE :term OR LOWER(item.prNumber) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('item.createdAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 500;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Auto-resolve binId for items that don't have an explicit bin assigned yet
    const missingBinProductIds = items
      .filter((i) => !i.binId && i.productId)
      .map((i) => i.productId);

    if (missingBinProductIds.length > 0) {
      try {
        const balances = await this.balanceRepo.find({
          where: { productId: In(missingBinProductIds) },
          relations: { bin: { rack: true } },
          order: { currentQuantity: 'DESC' },
        });

        const primaryBinMap = new Map<string, StockBalance>();
        for (const b of balances) {
          if (Number(b.currentQuantity) > 0 && b.bin && b.productId && !primaryBinMap.has(b.productId)) {
            primaryBinMap.set(b.productId, b);
          }
        }

        for (const item of items) {
          if (!item.binId && item.productId && primaryBinMap.has(item.productId)) {
            const bal = primaryBinMap.get(item.productId)!;
            item.binId = bal.binId;
            item.bin = bal.bin;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-resolve stock bins: ${err}`);
      }
    }

    return { items, total };
  }

  /**
   * Retrieves all warehouse bins that currently hold positive stock for a given product,
   * sorted by current quantity descending.
   */
  async getProductStockBins(productId: string): Promise<
    Array<{
      binId: string;
      binCode: string;
      binName?: string;
      rackName?: string;
      currentQuantity: number;
    }>
  > {
    const balances = await this.balanceRepo.find({
      where: { productId },
      relations: { bin: { rack: true } },
      order: { currentQuantity: 'DESC' },
    });

    const results: Array<{
      binId: string;
      binCode: string;
      binName?: string;
      rackName?: string;
      currentQuantity: number;
    }> = [];

    for (const b of balances) {
      if (Number(b.currentQuantity) > 0 && b.bin && b.binId) {
        results.push({
          binId: b.binId,
          binCode: b.bin.code,
          binName: b.bin.name || undefined,
          rackName: b.bin.rack?.name || undefined,
          currentQuantity: Number(b.currentQuantity),
        });
      }
    }

    return results;
  }

  /**
   * Queries active products with real-time aggregated warehouse stock balances.
   * Restricts results to consumables only: standard consumable items + user-created consumable products.
   */
  async getCatalogWithStock(): Promise<
    Array<{
      id: string;
      name: string;
      code?: string;
      uom?: string;
      availableStock: number;
      category?: string;
    }>
  > {
    const { category, family } = await this.ensureConsumablesCategoryAndFamily();
    await this.ensureStandardConsumableProducts(family);

    const products = await this.productRepo.find({
      where: [
        { familyId: family.id, isActive: true },
        { family: { categoryId: category.id }, isActive: true },
      ],
      relations: { family: { category: true } },
      order: { name: 'ASC' },
    });

    const balances = await this.balanceRepo.find();
    const stockMap = new Map<string, number>();
    for (const b of balances) {
      if (b.productId) {
        const current = stockMap.get(b.productId) || 0;
        stockMap.set(b.productId, current + (Number(b.currentQuantity) || 0));
      }
    }

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code || undefined,
      uom: p.uom || 'NOS',
      availableStock: stockMap.get(p.id) || 0,
      category: p.family?.category?.name || 'CONSUMABLES',
    }));
  }

  /**
   * Queries a single line item by ID.
   */
  async findOneItem(id: string): Promise<ConsumableRequestItem> {
    const item = await this.itemRepo.findOne({
      where: { id },
      relations: { request: true, product: true, vendor: true, bin: true },
    });
    if (!item) {
      throw new NotFoundException(`Consumable line item "${id}" was not found.`);
    }
    return item;
  }

  /**
   * Retrieves all active warehouse bins with rack and location context,
   * sorted cleanly by bin code ascending.
   */
  async getAllWarehouseBins(): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      rack?: {
        id: string;
        code: string;
        name: string;
        location?: {
          id: string;
          name: string;
          warehouse?: { id: string; name: string };
        };
      };
    }>
  > {
    const bins = await this.binRepo.find({
      where: { isActive: true },
      relations: {
        rack: {
          location: {
            warehouse: true,
          },
        },
      },
      order: { code: 'ASC' },
    });

    return bins.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name || b.code,
      rack: b.rack
        ? {
            id: b.rack.id,
            code: b.rack.code,
            name: b.rack.name,
            location: b.rack.location
              ? {
                  id: b.rack.location.id,
                  name: b.rack.location.name,
                  warehouse: b.rack.location.warehouse
                    ? {
                        id: b.rack.location.warehouse.id,
                        name: b.rack.location.warehouse.name,
                      }
                    : undefined,
                }
              : undefined,
          }
        : undefined,
    }));
  }

  /**
   * Enterprise Automated Sweep: Evaluates active consumable items:
   * 1. Consumable not received >24 hours from creation -> CONSUMABLE_RECEIPT_OVERDUE (In-app + Email)
   * 2. Consumable partially issued -> CONSUMABLE_PARTIALLY_ISSUED_OVERDUE (In-app + Email)
   * Admin can toggle email alerts ON/OFF.
   */
  @Cron(process.env.CONSUMABLE_SLA_CRON_SCHEDULE || CronExpression.EVERY_HOUR)
  async checkAndAlertConsumableSlas(): Promise<{
    overdueReceiptCount: number;
    partiallyIssuedCount: number;
    checkedCount: number;
    timestamp: string;
  }> {
    this.logger.log('Starting automated Consumables SLA and Fulfillment alert sweep.');
    if (!this.communicationService) {
      this.logger.warn('CommunicationService not available. Skipping consumable SLA sweep.');
      return { overdueReceiptCount: 0, partiallyIssuedCount: 0, checkedCount: 0, timestamp: new Date().toISOString() };
    }

    try {
      const alertSettings = this.notificationsService
        ? await this.notificationsService.getConsumableAlertSettings()
        : {
            consumableEmailAlertsEnabled: true,
            consumableReceiptOverdueAlertsEnabled: true,
            consumablePartiallyIssuedAlertsEnabled: true,
          };

      // 1. Fetch pending items
      const pendingItems = await this.itemRepo.find({
        where: {
          status: In([
            ConsumableItemStatus.OPEN,
            ConsumableItemStatus.PURCHASE_REQUESTED,
            ConsumableItemStatus.PARTIALLY_ISSUED,
            ConsumableItemStatus.READY_FOR_ISSUE,
          ]),
        },
        relations: {
          request: true,
          product: true,
          vendor: true,
        },
      });

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      let overdueReceiptCount = 0;
      let partiallyIssuedCount = 0;

      const digestMode = this.alertDigestService ? await this.alertDigestService.getMode() : 'OFF';
      const receiptOverdueDigestItems: AlertDigestItem[] = [];
      const partiallyIssuedDigestItems: AlertDigestItem[] = [];

      for (const item of pendingItems) {
        // Exclude lines that are not approved (treat NULL as APPROVED for legacy rows)
        if (item.approvalStatus && item.approvalStatus !== ConsumableApprovalStatus.APPROVED) {
          continue;
        }

        // --- CHECK A: NOT RECEIVED WITHIN 24 HOURS OF APPROVAL / CREATION ---
        const isNotReceived =
          !item.purchaseReceivedAt &&
          (item.status === ConsumableItemStatus.OPEN ||
            item.status === ConsumableItemStatus.PURCHASE_REQUESTED ||
            (Number(item.realReceivedQty || 0) === 0 && item.itemCategoryTrack === ConsumableItemTrack.NON_STOCK_OR_NEW));

        if (isNotReceived && alertSettings.consumableReceiptOverdueAlertsEnabled) {
          const effectiveDate = item.approvedAt ? new Date(item.approvedAt) : new Date(item.createdAt);
          const elapsedMs = now.getTime() - effectiveDate.getTime();
          const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));

          if (elapsedHours >= 24) {
            overdueReceiptCount++;
            const pendingQty = Number(item.purchaseQty ?? item.requestedQty ?? 0);

            receiptOverdueDigestItems.push({
              entityId: item.id,
              entityType: 'CONSUMABLE_REQUEST_ITEM',
              itemRef: item.prNumber ? `PR. No. ${item.prNumber} (${item.description})` : item.description,
              ageOrOverdue: `${elapsedHours}h overdue`,
              ownerOrVendor: item.newVendorName || item.vendorName || item.vendor?.name || 'Open Sourcing',
              directLink: '/consumables/purchase-store',
              metadata: {
                purchaseQty: pendingQty,
                requestedQty: item.requestedQty,
                uom: item.uom,
              },
            });

            if (digestMode === 'OFF' || digestMode === 'SHADOW') {
              try {
                await this.communicationService.sendEvent({
                  eventType: 'CONSUMABLE_RECEIPT_OVERDUE',
                  entityType: 'CONSUMABLE_REQUEST_ITEM',
                  entityId: `${item.id}_${todayStr}`, // Unique key per day ensures no flood
                  metadata: {
                    description: item.description,
                    prNumber: item.prNumber ? `PR. No. ${item.prNumber}` : 'N/A',
                    requestCode: item.request?.requestCode || 'N/A',
                    hoursElapsed: elapsedHours,
                    vendorName: item.newVendorName || item.vendorName || item.vendor?.name || 'Open Sourcing',
                    purchaseQty: pendingQty,
                    requestedQty: item.requestedQty,
                    uom: item.uom,
                    endUser: item.endUserInVelan || 'Plant Floor',
                  },
                });
              } catch (err: any) {
                this.logger.error(`Failed to dispatch 24h receipt overdue alert for item ${item.id}: ${err?.message}`);
              }
            }
          }
        }

        // --- CHECK B: PARTIALLY ISSUED ALERT ---
        const isPartiallyIssued =
          item.status === ConsumableItemStatus.PARTIALLY_ISSUED ||
          (Number(item.issuedQty || 0) > 0 && Number(item.issuedQty || 0) < Number(item.requestedQty || 0));

        if (isPartiallyIssued && alertSettings.consumablePartiallyIssuedAlertsEnabled) {
          partiallyIssuedCount++;
          const remainingQty = Math.max(0, Number(item.requestedQty) - Number(item.issuedQty || 0));

          partiallyIssuedDigestItems.push({
            entityId: item.id,
            entityType: 'CONSUMABLE_REQUEST_ITEM',
            itemRef: item.prNumber ? `PR. No. ${item.prNumber} (${item.description})` : item.description,
            ageOrOverdue: `Rem: ${remainingQty} ${item.uom || 'NOS'}`,
            ownerOrVendor: item.endUserInVelan || 'Plant Floor',
            directLink: '/consumables/requests',
            metadata: {
              issuedQty: item.issuedQty,
              requestedQty: item.requestedQty,
            },
          });

          if (digestMode === 'OFF' || digestMode === 'SHADOW') {
            try {
              await this.communicationService.sendEvent({
                eventType: 'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
                entityType: 'CONSUMABLE_REQUEST_ITEM',
                entityId: `${item.id}_part_${todayStr}`,
                metadata: {
                  description: item.description,
                  prNumber: item.prNumber ? `PR. No. ${item.prNumber}` : 'N/A',
                  requestCode: item.request?.requestCode || 'N/A',
                  issuedQty: item.issuedQty,
                  requestedQty: item.requestedQty,
                  remainingQty,
                  uom: item.uom,
                  endUser: item.endUserInVelan || 'Plant Floor',
                },
              });
            } catch (err: any) {
              this.logger.error(`Failed to dispatch partially issued alert for item ${item.id}: ${err?.message}`);
            }
          }
        }
      }

      // If SHADOW or ON, invoke AlertDigestService
      if ((digestMode === 'SHADOW' || digestMode === 'ON') && this.alertDigestService) {
        if (receiptOverdueDigestItems.length > 0) {
          await this.alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', receiptOverdueDigestItems);
        }
        if (partiallyIssuedDigestItems.length > 0) {
          await this.alertDigestService.buildDigests('CONSUMABLE_PARTIALLY_ISSUED_OVERDUE', partiallyIssuedDigestItems);
        }
      }

      this.logger.log(
        `Consumables SLA sweep completed: ${overdueReceiptCount} overdue receipt(s), ${partiallyIssuedCount} partially issued item(s) checked against ${pendingItems.length} total active items.`,
      );

      return {
        overdueReceiptCount,
        partiallyIssuedCount,
        checkedCount: pendingItems.length,
        timestamp: now.toISOString(),
      };
    } catch (err: any) {
      this.logger.error(`Error executing consumable SLA sweep: ${err?.message}`, err?.stack);
      return {
        overdueReceiptCount: 0,
        partiallyIssuedCount: 0,
        checkedCount: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getAlertSettings() {
    if (this.notificationsService) {
      return this.notificationsService.getConsumableAlertSettings();
    }
    return {
      consumableEmailAlertsEnabled: true,
      consumableReceiptOverdueAlertsEnabled: true,
      consumablePartiallyIssuedAlertsEnabled: true,
    };
  }

  async updateAlertSettings(
    payload: {
      consumableEmailAlertsEnabled?: boolean;
      consumableReceiptOverdueAlertsEnabled?: boolean;
      consumablePartiallyIssuedAlertsEnabled?: boolean;
    },
    actorId?: string,
  ) {
    if (this.notificationsService) {
      return this.notificationsService.setConsumableAlertSettings(payload, actorId);
    }
    return payload;
  }
}

