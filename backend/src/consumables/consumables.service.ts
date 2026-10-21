import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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

@Injectable()
export class ConsumablesService {
  private readonly logger = new Logger(ConsumablesService.name);

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
  ) {}

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

    const latest = await this.requestRepo.findOne({
      where: { requestCode: Like(`${prefix}%`) },
      order: { requestCode: 'DESC' },
    });

    let nextSeq = 1;
    if (latest && latest.requestCode) {
      const parts = latest.requestCode.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
    }

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

      const lineItem = this.itemRepo.create({
        requestId: savedRequest.id,
        productId: product.id,
        productCode: product.code || itemDto.productCode || null,
        description: itemDto.description.trim(),
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
      });

      lineItems.push(lineItem);
    }

    savedRequest.items = await this.itemRepo.save(lineItems);
    this.logger.log(
      `[CONSUMABLE REQUEST CREATED] Code: ${savedRequest.requestCode}, Items: ${savedRequest.items.length}`,
    );

    return this.findOneRequest(savedRequest.id);
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

    // Verify items eligibility: must be OPEN or already have an assigned PR number
    const invalidItems = items.filter(
      (i) => i.status !== ConsumableItemStatus.OPEN && !i.prNumber,
    );
    if (invalidItems.length > 0) {
      throw new BadRequestException(
        `Cannot print PR: Line item "${invalidItems[0].description}" is in status "${invalidItems[0].status}". Only OPEN items or items with an assigned PR number can be printed.`,
      );
    }

    // Check if items already have a PR number assigned
    const alreadyPrAssigned = items.filter((i) => i.prNumber != null);
    const openItems = items.filter((i) => i.status === ConsumableItemStatus.OPEN);

    // If all requested items already have a PR number, return them gracefully for re-printing
    if (openItems.length === 0 && alreadyPrAssigned.length > 0) {
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
    }

    if (openItems.length > 0) {
      await this.itemRepo.save(openItems);
      this.logger.log(
        `[PR PRINTED] Assigned PR #${prNumber} to ${openItems.length} line item(s)`,
      );
    }

    return {
      prNumber,
      printedAt,
      items,
    };
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

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.prNumber) {
      qb.andWhere('item.prNumber = :prNumber', { prNumber: query.prNumber });
    }

    if (query.search) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(item.description) LIKE :term OR LOWER(item.productCode) LIKE :term OR LOWER(item.vendorName) LIKE :term OR LOWER(request.requestCode) LIKE :term OR LOWER(item.requestedBy) LIKE :term OR LOWER(item.prNumber) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('item.createdAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 50;
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
    const products = await this.productRepo.find({
      where: { isActive: true },
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
}

