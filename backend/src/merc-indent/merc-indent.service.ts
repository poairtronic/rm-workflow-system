import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Raw } from 'typeorm';
import { MercIndentPending } from './entities/merc-indent-pending.entity.js';
import { MercIndentLineItem } from './entities/merc-indent-line-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from '../inventory/entities/stock-transaction.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { ReceiveMercIndentDto } from './dto/receive-merc-indent.dto.js';
import { IssueMercItemDto } from './dto/issue-merc-item.dto.js';
import { CreateMercProductDto } from './dto/create-merc-product.dto.js';

export interface SuggestedProductBinDto {
  binId: string;
  binCode: string;
  rackCode: string;
  currentQty: number;
}

export interface SuggestedProductDto {
  productId: string;
  productName: string;
  totalStock: number;
  uom: string;
  bins: SuggestedProductBinDto[];
  isSuggested?: boolean;
}

export interface MercIndentItemDetailResponse {
  suggestedProducts: SuggestedProductDto[];
  [key: string]: any;
}

@Injectable()
export class MercIndentService {
  private readonly logger = new Logger(MercIndentService.name);

  constructor(
    @InjectRepository(MercIndentPending)
    private readonly mercIndentPendingRepo: Repository<MercIndentPending>,
    @InjectRepository(MercIndentLineItem)
    private readonly mercIndentLineItemRepo: Repository<MercIndentLineItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  /**
   * Receives MERC indent payload and saves to merc_indent_pending and merc_indent_line_items.
   * Notifies Stores personnel via in-app notification records and real-time Socket.IO event.
   * Idempotent: returns existing record if indentId already exists.
   */
  async receiveMercIndent(dto: ReceiveMercIndentDto): Promise<{
    id: string;
    indentNumber: string;
    status: string;
    itemCount: number;
  }> {
    // 1. Idempotency check: if indentId already exists, return existing record
    const existing = await this.mercIndentPendingRepo.findOne({
      where: { indentId: dto.indentId },
      relations: { lineItems: true },
    });

    if (existing) {
      this.logger.log(
        `MERC indent pending already exists for indentId "${dto.indentId}" (ID: ${existing.id})`,
      );
      return {
        id: existing.id,
        indentNumber: existing.indentNumber,
        status: existing.status,
        itemCount: existing.lineItems ? existing.lineItems.length : dto.lineItems.length,
      };
    }

    // 2. Transactional insertion using QueryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPending: MercIndentPending;
    try {
      const pendingEntity = queryRunner.manager.create(MercIndentPending, {
        indentId: dto.indentId,
        indentNumber: dto.indentNumber,
        poNumber: dto.poNumber || null,
        customerName: dto.customerName || null,
        layoutNumber: dto.layoutNumber || null,
        status: 'PENDING',
        mercCurrentState: dto.mercCurrentState,
      });
      savedPending = await queryRunner.manager.save(MercIndentPending, pendingEntity);

      const lineItemEntities = dto.lineItems.map((item) =>
        queryRunner.manager.create(MercIndentLineItem, {
          mercIndentPendingId: savedPending.id,
          mercItemId: item.mercItemId,
          itemType: item.itemType,
          name: item.name,
          material: item.material || null,
          shape: item.shape || null,
          lengthMm: item.lengthMm != null ? Number(item.lengthMm) : null,
          widthMm: item.widthMm != null ? Number(item.widthMm) : null,
          heightMm: item.heightMm != null ? Number(item.heightMm) : null,
          diameterMm: item.diameterMm != null ? Number(item.diameterMm) : null,
          quantityRequired: Number(item.quantityRequired),
          quantityIssued: 0,
          unit: item.unit || null,
          status: 'PENDING',
        }),
      );

      await queryRunner.manager.save(MercIndentLineItem, lineItemEntities);
      await queryRunner.commitTransaction();
      this.logger.log(
        `Successfully saved MERC indent ${savedPending.indentNumber} with ${lineItemEntities.length} line items`,
      );
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to save MERC indent: ${err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 3. After commit — notify Stores
    const title = `MERC Indent Received: ${dto.indentNumber}`;
    const body = `New indent ${dto.indentNumber} received with ${dto.lineItems.length} line items for Stores processing.`;

    try {
      let storesUsers: User[] = [];
      try {
        storesUsers = await this.userRepo.find({
          where: [
            { role: { name: 'STORES' } as any },
            { roleId: 'STORES' as any },
          ],
          relations: { role: true },
        });
      } catch {
        try {
          storesUsers = await this.userRepo.find({
            where: { role: 'STORES' as any },
          });
        } catch {
          storesUsers = [];
        }
      }

      if (!storesUsers || storesUsers.length === 0) {
        try {
          storesUsers = await this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.role', 'role')
            .where('LOWER(role.name) = LOWER(:roleName)', { roleName: 'STORES' })
            .orWhere('LOWER(user.roleId) = LOWER(:roleName)', { roleName: 'STORES' })
            .getMany();
        } catch {
          storesUsers = [];
        }
      }

      if (storesUsers && storesUsers.length > 0) {
        const notifications = storesUsers.map((user) =>
          this.notificationRepo.create({
            userId: user.id,
            title,
            message: body,
            type: 'MERC_INDENT',
            targetEntity: 'merc_indent_pending',
            targetId: savedPending.id,
            isRead: false,
          }),
        );
        await this.notificationRepo.save(notifications);
        this.logger.debug(`Created ${notifications.length} in-app notification records for STORES users`);
      }
    } catch (notifErr: any) {
      this.logger.warn(`Could not save in-app notifications for STORES: ${notifErr?.message}`);
    }

    // 4. Emit Socket.IO event to room 'role:STORES'
    if (this.notificationsGateway) {
      try {
        const socketPayload = {
          type: 'MERC_INDENT',
          title,
          body,
          indentId: dto.indentId,
          indentNumber: dto.indentNumber,
          poNumber: dto.poNumber,
          customerName: dto.customerName,
          layoutNumber: dto.layoutNumber,
          itemCount: dto.lineItems.length,
          createdAt: savedPending.createdAt,
        };

        if (this.notificationsGateway.server) {
          this.notificationsGateway.server.to('role:STORES').emit('notification', socketPayload);
          this.logger.debug(
            `Emitted socket notification event to room role:STORES for indent ${dto.indentNumber}`,
          );
        } else if (
          typeof (this.notificationsGateway as any).sendNotificationToRole === 'function'
        ) {
          this.notificationsGateway.sendNotificationToRole('STORES', socketPayload);
        }
      } catch (socketErr: any) {
        this.logger.warn(`Failed to emit socket notification to role:STORES: ${socketErr?.message}`);
      }
    }

    // 5. Return result
    return {
      id: savedPending.id,
      indentNumber: savedPending.indentNumber,
      status: savedPending.status,
      itemCount: dto.lineItems.length,
    };
  }

  /**
   * Fetches all records from merc_indent_pending ordered by created_at DESC.
   * For each, computes total line items vs issued line items.
   */
  async getAll(): Promise<any[]> {
    const records = await this.mercIndentPendingRepo.find({
      order: { createdAt: 'DESC' },
      relations: { lineItems: true },
    });

    return records.map((r) => {
      const items = r.lineItems || [];
      const totalItems = items.length;
      const issuedItems = items.filter((i) => i.status === 'ISSUED').length;

      return {
        id: r.id,
        indentNumber: r.indentNumber,
        poNumber: r.poNumber,
        customerName: r.customerName,
        status: r.status,
        totalItems,
        issuedItems,
        createdAt: r.createdAt,
      };
    });
  }

  /**
   * Fetches single merc_indent_pending record with all line items.
   * If rm_product_id is already set on a line item, calculates and returns current stock.
   */
  async getOne(id: string): Promise<any> {
    const record = await this.mercIndentPendingRepo.findOne({
      where: { id },
      relations: {
        lineItems: {
          rmProduct: true,
          rmBin: true,
          issuedBy: true,
        },
      },
      order: {
        lineItems: {
          createdAt: 'ASC',
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`MERC indent record not found with id "${id}"`);
    }

    const productIdsWithRm = (record.lineItems || [])
      .map((item) => item.rmProductId)
      .filter((pid): pid is string => !!pid);

    const stockMap = new Map<string, number>();
    if (productIdsWithRm.length > 0) {
      const balances = await this.stockBalanceRepo.find({
        where: { productId: In(productIdsWithRm) },
      });
      for (const sb of balances) {
        if (sb.productId) {
          const qty = Number(sb.currentQuantity) || 0;
          stockMap.set(sb.productId, (stockMap.get(sb.productId) || 0) + qty);
        }
      }
    }

    const lineItemsWithStock = (record.lineItems || []).map((item) => {
      const currentStock = item.rmProductId ? (stockMap.get(item.rmProductId) || 0) : 0;
      return {
        ...item,
        currentStock,
      };
    });

    return {
      ...record,
      lineItems: lineItemsWithStock ?? [],
    };
  }

  /**
   * Fetches full detail of a MERC indent: indent metadata + all line items,
   * with suggested products and their available bins & stock computed in bulk (zero N+1).
   */
  async getFullDetail(id: string): Promise<any> {
    const record = await this.mercIndentPendingRepo.findOne({
      where: { id },
      relations: {
        lineItems: {
          rmProduct: true,
          rmBin: true,
          issuedBy: true,
        },
      },
      order: {
        lineItems: {
          createdAt: 'ASC',
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`MERC indent record not found with id "${id}"`);
    }

    // 1. Bulk fetch all active products
    const allProducts = await this.productRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    // 2. Bulk fetch all positive stock balances joined with bin and rack
    const positiveStockBalances = await this.stockBalanceRepo
      .createQueryBuilder('sb')
      .innerJoinAndSelect('sb.bin', 'bin')
      .leftJoinAndSelect('bin.rack', 'rack')
      .where('sb.current_quantity > 0')
      .orderBy('sb.current_quantity', 'DESC')
      .getMany();

    // Map bins and total positive stock by product
    const binsByProduct = new Map<string, SuggestedProductBinDto[]>();
    for (const sb of positiveStockBalances) {
      if (!sb.productId) continue;
      const binList = binsByProduct.get(sb.productId) || [];
      binList.push({
        binId: sb.binId || sb.bin?.id || '',
        binCode: sb.bin?.code || 'N/A',
        rackCode: sb.bin?.rack?.code || 'N/A',
        currentQty: Number(sb.currentQuantity) || 0,
      });
      binsByProduct.set(sb.productId, binList);
    }

    // 3. For each line item, perform fuzzy match in memory
    const enrichedLineItems = (record.lineItems || []).map((item) => {
      const searchTerms: string[] = [];
      if (item.name && item.name.trim()) {
        searchTerms.push(item.name.trim().toLowerCase());
      }
      if (
        item.material &&
        item.material.trim() &&
        item.material.trim().toLowerCase() !== (item.name ? item.name.trim().toLowerCase() : '')
      ) {
        searchTerms.push(item.material.trim().toLowerCase());
      }

      const nameWords = (item.name || '')
        .split(/\s+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 3);

      for (const w of nameWords) {
        if (!searchTerms.includes(w)) {
          searchTerms.push(w);
        }
      }

      // Filter products matching search terms (fuzzy match)
      const matchedSet = new Set<string>();
      let matchedProducts: Product[] = [];
      if (searchTerms.length > 0) {
        matchedProducts = allProducts.filter((p) => {
          const lowerName = (p.name || '').toLowerCase();
          return searchTerms.some((term) => lowerName.includes(term));
        });
      }

      // Sort matched products: prioritize ones with stock > 0
      matchedProducts.sort((a, b) => {
        const stockA = (binsByProduct.get(a.id) || []).reduce((s, x) => s + x.currentQty, 0);
        const stockB = (binsByProduct.get(b.id) || []).reduce((s, x) => s + x.currentQty, 0);
        return stockB - stockA;
      });
      matchedProducts.forEach((p) => matchedSet.add(p.id));

      // All other products sorted alphabetically
      const remainingProducts = allProducts.filter((p) => !matchedSet.has(p.id));

      // Combine: matched products first, then all remaining catalog products
      const allProductItems = [
        ...matchedProducts.map((p) => ({ product: p, isSuggested: true })),
        ...remainingProducts.map((p) => ({ product: p, isSuggested: false })),
      ];

      // Map to SuggestedProductDto shape
      const suggestedProducts: SuggestedProductDto[] = allProductItems.map(({ product: p, isSuggested }) => {
        const bins = binsByProduct.get(p.id) || [];
        const totalStock = bins.reduce((sum, b) => sum + b.currentQty, 0);
        return {
          productId: p.id,
          productName: p.name,
          totalStock,
          uom: p.uom || 'NOS',
          bins,
          isSuggested,
        };
      });

      return {
        ...item,
        suggestedProducts,
      };
    });

    return {
      id: record.id,
      indentId: record.indentId,
      indentNumber: record.indentNumber,
      poNumber: record.poNumber,
      customerName: record.customerName,
      layoutNumber: record.layoutNumber,
      status: record.status,
      mercCurrentState: record.mercCurrentState,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      totalItems: enrichedLineItems.length,
      issuedItems: enrichedLineItems.filter((i) => i.status === 'ISSUED').length,
      lineItems: (enrichedLineItems ?? []).map((item) => ({
        ...item,
        suggestedProducts: (item.suggestedProducts ?? []).map((p) => ({
          ...p,
          uom: p.uom || 'NOS',
          bins: p.bins ?? [],
        })),
      })),
    };
  }

  /**
   * Fetches single merc_indent_line_items record and performs fuzzy matching
   * against products table to suggest matching inventory products and their available bins with stock > 0.
   */
  async getItemDetail(id: string, itemId: string): Promise<MercIndentItemDetailResponse> {
    const lineItem = await this.mercIndentLineItemRepo.findOne({
      where: [
        { id: itemId, mercIndentPendingId: id },
        { id: itemId },
      ],
      relations: {
        rmProduct: true,
        rmBin: true,
        issuedBy: true,
      },
    });

    if (!lineItem) {
      throw new NotFoundException(`MERC indent line item not found with id "${itemId}"`);
    }

    // Build fuzzy match conditions against products table
    const searchTerms: string[] = [];
    if (lineItem.name && lineItem.name.trim()) {
      searchTerms.push(lineItem.name.trim().toLowerCase());
    }
    if (
      lineItem.material &&
      lineItem.material.trim() &&
      lineItem.material.trim().toLowerCase() !== (lineItem.name ? lineItem.name.trim().toLowerCase() : '')
    ) {
      searchTerms.push(lineItem.material.trim().toLowerCase());
    }

    // Add individual words with length >= 3 for better matching recall
    const nameWords = (lineItem.name || '')
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 3);
    for (const word of nameWords) {
      if (!searchTerms.includes(word)) {
        searchTerms.push(word);
      }
    }

    let matchedProducts: Product[] = [];
    if (searchTerms.length > 0) {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.is_active = true');

      const conditions: string[] = [];
      const parameters: Record<string, string> = {};

      searchTerms.forEach((term, idx) => {
        conditions.push(`LOWER(product.name) LIKE :term${idx}`);
        parameters[`term${idx}`] = `%${term}%`;
      });

      qb.andWhere(`(${conditions.join(' OR ')})`, parameters);
      matchedProducts = await qb.take(20).getMany();
    }

    // If no match found through terms, fetch top active products as fallback suggestion
    if (matchedProducts.length === 0) {
      matchedProducts = await this.productRepo.find({
        where: { isActive: true },
        take: 10,
        order: { name: 'ASC' },
      });
    }

    // For matched products, query all bins where current_quantity > 0
    let suggestedProducts: SuggestedProductDto[] = [];
    if (matchedProducts.length > 0) {
      const productIds = matchedProducts.map((p) => p.id);
      const stockBalances = await this.stockBalanceRepo
        .createQueryBuilder('sb')
        .innerJoinAndSelect('sb.bin', 'bin')
        .leftJoinAndSelect('bin.rack', 'rack')
        .where('sb.product_id IN (:...productIds)', { productIds })
        .andWhere('sb.current_quantity > 0')
        .orderBy('sb.current_quantity', 'DESC')
        .getMany();

      const binsByProduct = new Map<string, SuggestedProductBinDto[]>();
      for (const sb of stockBalances) {
        if (!sb.productId) continue;
        const binList = binsByProduct.get(sb.productId) || [];
        binList.push({
          binId: sb.binId || sb.bin?.id || '',
          binCode: sb.bin?.code || 'N/A',
          rackCode: sb.bin?.rack?.code || 'N/A',
          currentQty: Number(sb.currentQuantity) || 0,
        });
        binsByProduct.set(sb.productId, binList);
      }

      suggestedProducts = matchedProducts.map((p) => {
        const bins = binsByProduct.get(p.id) || [];
        const totalStock = bins.reduce((sum, b) => sum + b.currentQty, 0);
        return {
          productId: p.id,
          productName: p.name,
          totalStock,
          uom: p.uom || 'NOS',
          bins,
        };
      });
    }

    return {
      ...lineItem,
      suggestedProducts,
    };
  }

  /**
   * Issues inventory stock for a single MERC indent line item atomically,
   * records a stock_transaction, updates line item & indent statuses,
   * and dispatches a webhook callback to MERC.
   */
  async issueMercItem(
    id: string,
    itemId: string,
    dto: IssueMercItemDto,
    currentUser: any,
  ): Promise<{
    success: boolean;
    newItemStatus: string;
    newIndentStatus: string;
    stockTransactionId: string;
  }> {
    const actorId = currentUser?.id || currentUser?.userId || null;
    const actorName = currentUser?.name || currentUser?.email || 'Stores User';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedTxId: string;
    let pendingRecord: MercIndentPending;
    let lineItem: MercIndentLineItem;
    let newItemStatus: string;
    let newIndentStatus: string;

    try {
      // 1. Fetch line item with pessimistic write lock
      const foundItem = await queryRunner.manager.findOne(MercIndentLineItem, {
        where: [
          { id: itemId, mercIndentPendingId: id },
          { id: itemId },
        ],
        lock: { mode: 'pessimistic_write' },
      });

      if (!foundItem) {
        throw new NotFoundException(`MERC indent line item "${itemId}" not found`);
      }
      if (foundItem.status === 'ISSUED') {
        throw new BadRequestException(`MERC indent line item "${itemId}" is already fully ISSUED`);
      }
      lineItem = foundItem;

      // 2. Fetch pending indent record with pessimistic write lock
      const foundPending = await queryRunner.manager.findOne(MercIndentPending, {
        where: { id: lineItem.mercIndentPendingId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!foundPending) {
        throw new NotFoundException(
          `MERC indent pending record "${lineItem.mercIndentPendingId}" not found`,
        );
      }
      pendingRecord = foundPending;

      // 3. Atomic stock decrement
      const updateResult = await queryRunner.manager.query(
        `UPDATE stock_balances
         SET current_quantity = current_quantity - $1, updated_at = NOW()
         WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1`,
        [dto.quantityIssued, dto.binId, dto.productId],
      );

      const affectedRows =
        Array.isArray(updateResult) && typeof updateResult[1] === 'number'
          ? updateResult[1]
          : (typeof updateResult?.affected === 'number'
              ? updateResult.affected
              : (updateResult === 1 ? 1 : 0));

      if (affectedRows !== 1) {
        throw new BadRequestException('Insufficient stock in selected bin');
      }

      // 4. Insert stock_transactions (quantity must be positive per CHECK constraint)
      const reasonText = `MERC Indent Issue | Indent: ${pendingRecord.indentNumber} | Item: ${lineItem.name}`;
      const newTransaction = queryRunner.manager.create(StockTransaction, {
        productId: dto.productId,
        sourceBinId: dto.binId,
        transactionType: 'MERC_INDENT_ISSUE' as any,
        quantity: Math.abs(dto.quantityIssued),
        referenceType: 'MERC_INDENT_ISSUE',
        referenceId: lineItem.id,
        reason: reasonText,
        remarks: reasonText,
        createdById: actorId,
      });

      const savedTx = await queryRunner.manager.save(StockTransaction, newTransaction);
      savedTxId = savedTx.id;

      // Update last_transaction_id on stock_balances
      await queryRunner.manager.query(
        `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
        [savedTx.id, dto.binId, dto.productId],
      );

      // 5. Update merc_indent_line_items
      const prevQuantityIssued = Number(lineItem.quantityIssued) || 0;
      const newQuantityIssued = prevQuantityIssued + Number(dto.quantityIssued);
      const quantityRequired = Number(lineItem.quantityRequired) || 0;

      // Determine required total based on product UOM and line item dimensions
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
      });
      const isMmUom = (product?.uom || '').toUpperCase() === 'MM';
      const itemLength = Number(lineItem.lengthMm) || 0;
      const totalRequired =
        isMmUom && itemLength > 0
          ? itemLength * quantityRequired
          : quantityRequired;

      newItemStatus = newQuantityIssued >= totalRequired ? 'ISSUED' : 'PARTIAL';

      lineItem.quantityIssued = newQuantityIssued;
      lineItem.status = newItemStatus;
      lineItem.rmProductId = dto.productId;
      lineItem.rmBinId = dto.binId;
      lineItem.issuedAt = new Date();
      lineItem.issuedById = actorId;

      await queryRunner.manager.save(MercIndentLineItem, lineItem);

      // 6. Recount all line items for this merc_indent_pending
      const allItems = await queryRunner.manager.find(MercIndentLineItem, {
        where: { mercIndentPendingId: pendingRecord.id },
      });

      const allIssued = allItems.every((item) => item.status === 'ISSUED');
      const anyIssued = allItems.some((item) => (Number(item.quantityIssued) || 0) > 0);
      newIndentStatus = allIssued ? 'ISSUED' : (anyIssued ? 'PARTIAL' : 'PENDING');

      pendingRecord.status = newIndentStatus;
      await queryRunner.manager.save(MercIndentPending, pendingRecord);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error during issueMercItem: ${err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 7. After commit — call MERC webhook (outside transaction, non-blocking)
    try {
      const mercUrl = (process.env.MERC_API_URL || '').replace(/\/+$/, '');
      const mercSecret = process.env.MERC_INTERNAL_SECRET || process.env.RM_INTERNAL_SECRET || '';

      if (!mercUrl || !mercSecret) {
        this.logger.warn('[MERC-Integration] MERC_API_URL or MERC_INTERNAL_SECRET not set');
      } else {
        const callbackPayload = {
          indentId: pendingRecord.indentId,
          indentNumber: pendingRecord.indentNumber,
          mercItemId: lineItem.mercItemId,
          itemType: lineItem.itemType,
          quantityIssued: dto.quantityIssued,
          issuedAt: new Date().toISOString(),
          issuedByName: actorName,
          newItemStatus,
          newIndentStatus,
        };

        await fetch(`${mercUrl}/api/internal/rm/item-issued`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': mercSecret,
          },
          body: JSON.stringify(callbackPayload),
        });

        this.logger.log(
          `[MERC-Integration] Successfully sent issue webhook to MERC for item ${lineItem.mercItemId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`[MERC-Integration] Callback failed: ${err?.message}`);
    }

    return {
      success: true,
      newItemStatus,
      newIndentStatus,
      stockTransactionId: savedTxId,
    };
  }

  /**
   * Creates a new product in the products table and optionally initializes its stock
   * in the specified bin with an initial stock transaction.
   */
  async createAndStockProduct(dto: CreateMercProductDto, currentUser: any): Promise<any> {
    const actorId = currentUser?.id || currentUser?.userId || null;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const trimmedName = dto.name.trim();

      // Check if product with identical name already exists
      let product = await queryRunner.manager.findOne(Product, {
        where: { name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name: trimmedName }) },
      });

      if (!product) {
        // Find or ensure a ProductFamily
        let family = await queryRunner.manager.findOne(ProductFamily, {
          where: { isActive: true },
          order: { createdAt: 'ASC' },
        });

        if (!family) {
          let category = await queryRunner.manager.findOne(ProductCategory, {
            where: { isActive: true },
          });
          if (!category) {
            const newCat = queryRunner.manager.create(ProductCategory, {
              name: 'RAW MATERIALS',
              isActive: true,
            });
            category = await queryRunner.manager.save(ProductCategory, newCat);
          }
          const newFam = queryRunner.manager.create(ProductFamily, {
            categoryId: category.id,
            name: 'General Materials',
            isActive: true,
          });
          family = await queryRunner.manager.save(ProductFamily, newFam);
        }

        // Generate barcode candidate
        const barcodeCandidate = `PRD-${trimmedName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}`;
        let finalBarcode = barcodeCandidate;
        const existingBarcode = await queryRunner.manager.findOne(Product, {
          where: { barcode: barcodeCandidate },
        });
        if (existingBarcode) {
          finalBarcode = `${barcodeCandidate}-${Date.now().toString().slice(-4)}`;
        }

        const newProd = queryRunner.manager.create(Product, {
          name: trimmedName,
          code: trimmedName.slice(0, 100),
          barcode: finalBarcode,
          familyId: family.id,
          uom: dto.unitId || 'NOS',
          minimumInventory: 0,
          isActive: true,
        });
        product = await queryRunner.manager.save(Product, newProd);
        this.logger.log(`Created new product: "${product.name}" (${product.id})`);
      }

      let initialStockCreated = 0;
      let savedTxId: string | null = null;

      // If initialStock and binId are provided and initialStock > 0
      if (dto.initialStock && Number(dto.initialStock) > 0 && dto.binId) {
        const bin = await queryRunner.manager.findOne(Bin, {
          where: { id: dto.binId },
        });
        if (!bin) {
          throw new NotFoundException(`Bin with id "${dto.binId}" not found`);
        }

        const stockQty = Number(dto.initialStock);
        initialStockCreated = stockQty;

        // Update or insert stock_balances
        const existingBalance = await queryRunner.manager.findOne(StockBalance, {
          where: { productId: product.id, binId: dto.binId },
        });

        if (existingBalance) {
          await queryRunner.manager.query(
            `UPDATE stock_balances
             SET current_quantity = current_quantity + $1, updated_at = NOW()
             WHERE product_id = $2 AND bin_id = $3`,
            [stockQty, product.id, dto.binId],
          );
        } else {
          const newBalance = queryRunner.manager.create(StockBalance, {
            productId: product.id,
            binId: dto.binId,
            currentQuantity: stockQty,
            openingBalance: stockQty,
          });
          await queryRunner.manager.save(StockBalance, newBalance);
        }

        // Insert stock_transactions type STOCK_IN
        const tx = queryRunner.manager.create(StockTransaction, {
          productId: product.id,
          destinationBinId: dto.binId,
          transactionType: TransactionType.STOCK_IN,
          quantity: stockQty,
          referenceType: 'MANUAL_STOCK_IN',
          referenceId: product.id,
          reason: `Initial stock for product: ${product.name}`,
          remarks: dto.description || `Initial stock creation for product: ${product.name}`,
          createdById: actorId,
        });
        const savedTx = await queryRunner.manager.save(StockTransaction, tx);
        savedTxId = savedTx.id;

        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, dto.binId, product.id],
        );
      }

      await queryRunner.commitTransaction();

      return {
        id: product.id,
        name: product.name,
        code: product.code,
        uom: product.uom,
        initialStock: initialStockCreated,
        binId: dto.binId || null,
        stockTransactionId: savedTxId,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create and stock product: ${err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Actively synchronizes pending indents directly from MERC application.
   * Calls MERC's /api/internal/indents/pending endpoint and imports any new indents.
   * Also triggers MERC's outbox retry to flush any pending webhooks.
   */
  async syncFromMerc(): Promise<{
    success: boolean;
    totalFetched: number;
    newlyAdded: number;
    message: string;
  }> {
    const mercBase = (process.env.MERC_API_URL || 'https://indent-application.onrender.com').replace(/\/+$/, '');
    const mercSecret =
      process.env.MERC_INTERNAL_SECRET ||
      process.env.RM_INTERNAL_SECRET ||
      'vsmart_merc_bridge_2026_secure';

    let newlyAdded = 0;
    let totalFetched = 0;

    // 1. Pull directly from MERC /api/internal/indents/pending
    try {
      this.logger.log(`[MERC-Sync] Pulling pending indents from ${mercBase}/api/internal/indents/pending`);
      const res = await fetch(`${mercBase}/api/internal/indents/pending`, {
        method: 'GET',
        headers: {
          'x-internal-secret': mercSecret,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const body: any = await res.json();
        const indents = Array.isArray(body) ? body : body?.data ?? [];
        if (Array.isArray(indents)) {
          totalFetched = indents.length;
          for (const item of indents) {
            if (
              !item?.indentId ||
              !item?.indentNumber ||
              !Array.isArray(item?.lineItems) ||
              item.lineItems.length === 0
            ) {
              continue;
            }
            const exists = await this.mercIndentPendingRepo.findOne({
              where: { indentId: item.indentId },
            });
            if (!exists) {
              await this.receiveMercIndent({
                indentId: item.indentId,
                indentNumber: item.indentNumber,
                poNumber: item.poNumber || undefined,
                customerName: item.customerName || undefined,
                layoutNumber: item.layoutNumber || undefined,
                mercCurrentState: item.mercCurrentState || 'DESIGN_COMPLETED',
                lineItems: item.lineItems,
              });
              newlyAdded++;
            }
          }
        }
      } else {
        this.logger.warn(`[MERC-Sync] Pull endpoint returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`[MERC-Sync] Pull error: ${err?.message}`);
    }

    // 2. Also trigger MERC's outbox retry to flush any pending webhook entries
    try {
      await fetch(`${mercBase}/api/internal/rm/retry-outbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': mercSecret,
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Non-fatal background trigger
    }

    return {
      success: true,
      totalFetched,
      newlyAdded,
      message: `Synchronized from MERC: ${totalFetched} found, ${newlyAdded} newly added.`,
    };
  }
}

export default MercIndentService;
