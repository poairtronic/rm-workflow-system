import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
export class MercIndentService implements OnModuleInit {
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

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  /**
   * Automatically verifies and creates/migrates MERC Indent tables & columns
   * on app bootstrap without requiring manual TypeORM CLI migration commands.
   */
  private async ensureSchema(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "merc_indent_pending" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "indent_id" VARCHAR NOT NULL,
          "indent_number" VARCHAR NOT NULL,
          "po_number" VARCHAR,
          "customer_name" VARCHAR,
          "layout_number" VARCHAR,
          "status" VARCHAR NOT NULL DEFAULT 'PENDING',
          "merc_current_state" VARCHAR NOT NULL,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now()
        );
      `);

      await this.dataSource.query(`
        ALTER TABLE "merc_indent_pending" ADD COLUMN IF NOT EXISTS "po_number" VARCHAR;
        ALTER TABLE "merc_indent_pending" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR;
        ALTER TABLE "merc_indent_pending" ADD COLUMN IF NOT EXISTS "layout_number" VARCHAR;
        ALTER TABLE "merc_indent_pending" ADD COLUMN IF NOT EXISTS "merc_current_state" VARCHAR DEFAULT 'STORES_PENDING';
      `);

      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "merc_indent_line_items" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "merc_indent_pending_id" UUID NOT NULL REFERENCES "merc_indent_pending"("id") ON DELETE CASCADE,
          "merc_item_id" VARCHAR NOT NULL,
          "item_type" VARCHAR NOT NULL,
          "name" VARCHAR NOT NULL,
          "material" VARCHAR,
          "shape" VARCHAR,
          "length_mm" DECIMAL,
          "width_mm" DECIMAL,
          "height_mm" DECIMAL,
          "diameter_mm" DECIMAL,
          "quantity_required" DECIMAL NOT NULL,
          "quantity_issued" DECIMAL NOT NULL DEFAULT 0,
          "unit" VARCHAR,
          "vendor_name" VARCHAR(255),
          "source" VARCHAR(100),
          "status" VARCHAR NOT NULL DEFAULT 'PENDING',
          "rm_product_id" UUID,
          "rm_bin_id" UUID,
          "issued_at" TIMESTAMP,
          "issued_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" TIMESTAMP DEFAULT now()
        );
      `);

      await this.dataSource.query(`
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "material" VARCHAR;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "shape" VARCHAR;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "length_mm" DECIMAL;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "width_mm" DECIMAL;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "height_mm" DECIMAL;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "diameter_mm" DECIMAL;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "unit" VARCHAR;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "vendor_name" VARCHAR(255);
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "source" VARCHAR(100);
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "rm_product_id" UUID;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "rm_bin_id" UUID;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP;
        ALTER TABLE "merc_indent_line_items" ADD COLUMN IF NOT EXISTS "issued_by_id" UUID;
      `);

      try {
        await this.dataSource.query(`
          ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'MERC_INDENT_ISSUE';
        `);
      } catch {
        // Ignored if type does not exist or value already added
      }

      this.logger.log('MERC Indent schema verified successfully.');
    } catch (err: any) {
      this.logger.warn(`Could not verify MERC Indent schema on init: ${err?.message}`);
    }
  }

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
      // If existing record was missing poNumber/customerName/layoutNumber or line item vendorName/source, backfill them
      let updatedIndent = false;
      if (!existing.poNumber && dto.poNumber) {
        existing.poNumber = dto.poNumber;
        updatedIndent = true;
      }
      if (!existing.customerName && dto.customerName) {
        existing.customerName = dto.customerName;
        updatedIndent = true;
      }
      if (!existing.layoutNumber && dto.layoutNumber) {
        existing.layoutNumber = dto.layoutNumber;
        updatedIndent = true;
      }
      if (updatedIndent) {
        await this.mercIndentPendingRepo.save(existing);
      }

      if (Array.isArray(existing.lineItems) && Array.isArray(dto.lineItems)) {
        for (const line of existing.lineItems) {
          const incoming = dto.lineItems.find((d) => d.mercItemId === line.mercItemId);
          if (incoming) {
            let itemChanged = false;
            if (!line.vendorName && incoming.vendorName) {
              line.vendorName = incoming.vendorName;
              itemChanged = true;
            }
            if (!line.source && incoming.source) {
              line.source = incoming.source;
              itemChanged = true;
            }
            if (!line.shape && incoming.shape) {
              line.shape = incoming.shape;
              itemChanged = true;
            }
            if (!line.material && incoming.material) {
              line.material = incoming.material;
              itemChanged = true;
            }
            if (incoming.name && incoming.name !== 'Unknown' && (!line.name || line.name === line.material || line.name === 'Unknown')) {
              line.name = incoming.name;
              itemChanged = true;
            }
            if (itemChanged) {
              await this.mercIndentLineItemRepo.save(line);
            }
          }
        }
      }

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
          vendorName: item.vendorName ?? null,
          source: item.source ?? null,
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
    try {
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
          poNumber: r.poNumber ?? null,
          customerName: r.customerName ?? null,
          layoutNumber: r.layoutNumber ?? null,
          status: r.status,
          totalItems,
          issuedItems,
          createdAt: r.createdAt,
        };
      });
    } catch (err: any) {
      this.logger.error(`Error in getAll merc-indents: ${err?.message}`, err?.stack);
      try {
        const rawPending = await this.dataSource.query(`
          SELECT p.id, p.indent_number AS "indentNumber", p.po_number AS "poNumber",
                 p.customer_name AS "customerName", p.layout_number AS "layoutNumber",
                 p.status, p.created_at AS "createdAt",
                 COUNT(li.id) AS "totalItems",
                 COUNT(CASE WHEN li.status = 'ISSUED' THEN 1 END) AS "issuedItems"
          FROM "merc_indent_pending" p
          LEFT JOIN "merc_indent_line_items" li ON li.merc_indent_pending_id = p.id
          GROUP BY p.id, p.indent_number, p.po_number, p.customer_name, p.layout_number, p.status, p.created_at
          ORDER BY p.created_at DESC
        `);
        return rawPending.map((r: any) => ({
          id: r.id,
          indentNumber: r.indentNumber,
          poNumber: r.poNumber ?? null,
          customerName: r.customerName ?? null,
          layoutNumber: r.layoutNumber ?? null,
          status: r.status,
          totalItems: Number(r.totalItems) || 0,
          issuedItems: Number(r.issuedItems) || 0,
          createdAt: r.createdAt,
        }));
      } catch (fallbackErr: any) {
        this.logger.error(`Fallback failed in getAll: ${fallbackErr?.message}`);
        return [];
      }
    }
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
      poNumber: record.poNumber ?? null,
      customerName: record.customerName ?? null,
      layoutNumber: record.layoutNumber ?? null,
      status: record.status,
      mercCurrentState: record.mercCurrentState,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      totalItems: enrichedLineItems.length,
      issuedItems: enrichedLineItems.filter((i) => i.status === 'ISSUED').length,
      lineItems: (enrichedLineItems ?? []).map((item) => ({
        id: item.id,
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
        quantityIssued: Number(item.quantityIssued || 0),
        unit: item.unit ?? null,
        source: item.source ?? null,
        vendorName: item.vendorName ?? null,
        status: item.status,
        rmProductId: item.rmProductId ?? null,
        rmBinId: item.rmBinId ?? null,
        rmProduct: item.rmProduct ?? null,
        rmBin: item.rmBin ?? null,
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

      newItemStatus = (dto.shortClose || newQuantityIssued >= totalRequired) ? 'ISSUED' : 'PARTIAL';

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

    // 7. Emit Socket.IO event for real-time UI refresh across active clients
    if (this.notificationsGateway) {
      try {
        const socketPayload = {
          type: 'MERC_INDENT',
          indentId: pendingRecord.id,
          indentNumber: pendingRecord.indentNumber,
          message: `MERC line item "${lineItem.name}" issued (${dto.quantityIssued}). Indent status: ${newIndentStatus}.`,
        };
        if (this.notificationsGateway.server) {
          this.notificationsGateway.server.emit('notification', socketPayload);
        }
      } catch (err: any) {
        this.logger.warn(`Socket.IO emit error: ${err?.message}`);
      }
    }

    // 8. After commit — call MERC webhook to update external MERC order status live
    await this.sendIssueCallbackToMerc(
      pendingRecord,
      lineItem,
      Number(dto.quantityIssued),
      actorName,
      newItemStatus,
      newIndentStatus,
    );

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
   * Helper to resolve the correct MERC API base URL.
   * Gracefully falls back to the live deployed Render instance if unset or if localhost:3001 is offline.
   */
  getMercBaseUrl(): string {
    const raw = (process.env.MERC_API_URL || '').trim();
    if (!raw || raw.includes('localhost:3001')) {
      return 'https://indent-application.onrender.com';
    }
    return raw.replace(/\/+$/, '');
  }

  /**
   * Helper to resolve the shared internal secret for MERC communication.
   */
  getMercSecret(): string {
    return (
      process.env.MERC_INTERNAL_SECRET ||
      process.env.RM_INTERNAL_SECRET ||
      'vsmart_merc_bridge_2026_secure'
    );
  }

  /**
   * Sends an item-issued webhook callback to the MERC system with automatic retry and response tracking.
   */
  async sendIssueCallbackToMerc(
    pendingRecord: MercIndentPending,
    lineItem: MercIndentLineItem,
    quantityIssued: number,
    actorName: string,
    newItemStatus: string,
    newIndentStatus: string,
  ): Promise<boolean> {
    const mercUrl = this.getMercBaseUrl();
    const mercSecret = this.getMercSecret();

    const callbackPayload = {
      indentId: pendingRecord.indentId,
      indentNumber: pendingRecord.indentNumber,
      mercItemId: lineItem.mercItemId,
      itemType: lineItem.itemType,
      quantityIssued: Number(quantityIssued),
      issuedAt: new Date().toISOString(),
      issuedByName: actorName,
      newItemStatus,
      newIndentStatus,
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${mercUrl}/api/internal/rm/item-issued`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': mercSecret,
          },
          body: JSON.stringify(callbackPayload),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const body: any = await res.json().catch(() => null);
          this.logger.log(
            `[MERC-Integration] Successfully sent issue webhook to MERC for item ${lineItem.mercItemId}. Status: ${res.status}. Body: ${JSON.stringify(body)}`,
          );
          if (body?.updatedStatus) {
            pendingRecord.mercCurrentState = body.updatedStatus;
            await this.mercIndentPendingRepo.save(pendingRecord);
          }
          return true;
        } else {
          const errText = await res.text().catch(() => '');
          this.logger.warn(
            `[MERC-Integration] Attempt ${attempt} failed: HTTP ${res.status} - ${errText}`,
          );
        }
      } catch (err: any) {
        this.logger.warn(`[MERC-Integration] Attempt ${attempt} error: ${err?.message}`);
      }

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    return false;
  }

  /**
   * Reconciles all issued items of an indent with MERC.
   */
  async reconcileIssuedItemsWithMerc(pendingRecord: MercIndentPending): Promise<void> {
    try {
      const lineItems = await this.mercIndentLineItemRepo.find({
        where: { mercIndentPendingId: pendingRecord.id },
      });

      for (const item of lineItems) {
        const qtyIssued = Number(item.quantityIssued) || 0;
        if (item.status === 'ISSUED' || qtyIssued > 0) {
          await this.sendIssueCallbackToMerc(
            pendingRecord,
            item,
            qtyIssued,
            'Automated Sync Reconciler',
            item.status,
            pendingRecord.status,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `[MERC-Reconcile] Error reconciling items for indent ${pendingRecord.indentNumber}: ${err?.message}`,
      );
    }
  }

  /**
   * Background cron to keep indents automatically and lively in sync with MERC every 25 seconds.
   */
  @Cron(process.env.MERC_SYNC_CRON_SCHEDULE || '0 * * * *')
  async handleScheduledMercSync(): Promise<void> {
    // Only run if explicitly enabled to prevent keeping Neon serverless compute awake 24/7
    if (process.env.ENABLE_MERC_CRON !== 'true' && !process.env.MERC_SYNC_CRON_SCHEDULE) {
      return;
    }
    try {
      await this.syncFromMerc();
    } catch (err: any) {
      this.logger.warn(`[MERC-Sync-Cron] Scheduled sync error: ${err?.message}`);
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
    const mercBase = this.getMercBaseUrl();
    const mercSecret = this.getMercSecret();

    let newlyAdded = 0;
    let totalFetched = 0;
    let updatedCount = 0;

    // 1. Pull directly from MERC /api/internal/indents/pending
    try {
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
            } else {
              // Existing indent: sync latest poNumber, layoutNumber, and status
              let hasChanges = false;
              if (item.poNumber && exists.poNumber !== item.poNumber) {
                exists.poNumber = item.poNumber;
                hasChanges = true;
              }
              if (item.layoutNumber && exists.layoutNumber !== item.layoutNumber) {
                exists.layoutNumber = item.layoutNumber;
                hasChanges = true;
              }
              if (item.mercCurrentState && exists.mercCurrentState !== item.mercCurrentState) {
                exists.mercCurrentState = item.mercCurrentState;
                hasChanges = true;
              }
              if (hasChanges) {
                await this.mercIndentPendingRepo.save(exists);
                updatedCount++;
              }

              // RECONCILIATION: Check if RM has this indent marked as ISSUED or PARTIAL,
              // but MERC is still showing DESIGN_COMPLETED or STORES_PROCESSING!
              if (
                (exists.status === 'ISSUED' || exists.status === 'PARTIAL') &&
                (item.mercCurrentState === 'DESIGN_COMPLETED' ||
                  item.mercCurrentState === 'STORES_PROCESSING')
              ) {
                await this.reconcileIssuedItemsWithMerc(exists);
              }
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

    // 3. Emit real-time notification if new indents arrived or were updated
    if ((newlyAdded > 0 || updatedCount > 0) && this.notificationsGateway?.server) {
      this.notificationsGateway.server.emit('notification', {
        type: 'MERC_INDENT',
        message: `${newlyAdded} new / ${updatedCount} updated MERC indents synchronized lively.`,
      });
    }

    return {
      success: true,
      totalFetched,
      newlyAdded,
      message: `Synchronized from MERC: ${totalFetched} found, ${newlyAdded} newly added, ${updatedCount} updated.`,
    };
  }

  /**
   * Short-close a MERC line item without further inventory movements.
   * Marks line item as ISSUED and updates indent status accordingly.
   */
  async shortCloseMercItem(indentId: string, itemId: string, user: any) {
    const actorId = user?.sub || user?.id;
    const actorName = user?.name || user?.username || 'Stores Admin';

    const pendingRecord = await this.mercIndentPendingRepo.findOne({
      where: { id: indentId },
    });
    if (!pendingRecord) {
      throw new NotFoundException(`MERC indent record with ID ${indentId} not found`);
    }

    const lineItem = await this.mercIndentLineItemRepo.findOne({
      where: { id: itemId, mercIndentPendingId: pendingRecord.id },
    });
    if (!lineItem) {
      throw new NotFoundException(`MERC line item ${itemId} not found for this indent`);
    }

    lineItem.status = 'ISSUED';
    lineItem.issuedAt = new Date();
    lineItem.issuedById = actorId;
    await this.mercIndentLineItemRepo.save(lineItem);

    // Recalculate indent status
    const allItems = await this.mercIndentLineItemRepo.find({
      where: { mercIndentPendingId: pendingRecord.id },
    });
    const allIssued = allItems.every((item) => item.status === 'ISSUED');
    const anyIssued = allItems.some((item) => (Number(item.quantityIssued) || 0) > 0);
    const newIndentStatus = allIssued ? 'ISSUED' : (anyIssued ? 'PARTIAL' : 'PENDING');

    pendingRecord.status = newIndentStatus;
    await this.mercIndentPendingRepo.save(pendingRecord);

    // Socket.IO notification
    if (this.notificationsGateway) {
      try {
        const socketPayload = {
          type: 'MERC_INDENT',
          indentId: pendingRecord.id,
          indentNumber: pendingRecord.indentNumber,
          message: `MERC line item "${lineItem.name}" marked as fully issued (short-closed).`,
        };
        if (this.notificationsGateway.server) {
          this.notificationsGateway.server.emit('notification', socketPayload);
        }
      } catch (err: any) {
        this.logger.warn(`Socket.IO emit error: ${err?.message}`);
      }
    }

    // Call MERC webhook to update external MERC order status live
    await this.sendIssueCallbackToMerc(
      pendingRecord,
      lineItem,
      Number(lineItem.quantityIssued) || 0,
      actorName,
      'ISSUED',
      newIndentStatus,
    );

    return {
      success: true,
      message: `Line item "${lineItem.name}" marked as fully issued`,
      lineItem,
      indentStatus: newIndentStatus,
    };
  }

  /**
   * Administratively close an entire MERC indent and mark all pending/partial line items as ISSUED.
   */
  async closeMercIndent(indentId: string, user: any) {
    const actorId = user?.sub || user?.id;

    const pendingRecord = await this.mercIndentPendingRepo.findOne({
      where: { id: indentId },
    });
    if (!pendingRecord) {
      throw new NotFoundException(`MERC indent record with ID ${indentId} not found`);
    }

    const allItems = await this.mercIndentLineItemRepo.find({
      where: { mercIndentPendingId: pendingRecord.id },
    });

    for (const item of allItems) {
      if (item.status !== 'ISSUED') {
        item.status = 'ISSUED';
        item.issuedAt = new Date();
        item.issuedById = actorId;
        await this.mercIndentLineItemRepo.save(item);
      }
    }

    pendingRecord.status = 'ISSUED';
    await this.mercIndentPendingRepo.save(pendingRecord);

    if (this.notificationsGateway) {
      try {
        const socketPayload = {
          type: 'MERC_INDENT',
          indentId: pendingRecord.id,
          indentNumber: pendingRecord.indentNumber,
          message: `MERC indent ${pendingRecord.indentNumber} administratively closed/issued`,
        };
        if (this.notificationsGateway.server) {
          this.notificationsGateway.server.emit('notification', socketPayload);
        }
      } catch (err: any) {
        this.logger.warn(`Socket.IO emit error: ${err?.message}`);
      }
    }

    return {
      success: true,
      message: `MERC indent ${pendingRecord.indentNumber} marked as ISSUED`,
      indent: pendingRecord,
    };
  }
}

export default MercIndentService;
