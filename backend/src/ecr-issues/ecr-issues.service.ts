import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EcrMaterialPending } from './entities/ecr-material-pending.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue, MaterialIssueType } from '../material-issue/entities/material-issue.entity.js';
import { MaterialIssueItem } from '../material-issue/entities/material-issue-item.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { ReceiveEcrPendingDto } from './dto/receive-ecr-pending.dto.js';
import { IssueEcrMaterialDto } from './dto/issue-ecr-material.dto.js';

export interface RmIssuedItemDto {
  rmItemId: string;
  productId: string;
  productName: string;
  spec: string | null;
  binId: string;
  binCode: string;
  rackCode: string;
  originalIssuedQty: number;
  currentBinStock: number;
}

export interface AvailableProductBinDto {
  binId: string;
  binCode: string;
  rackCode: string;
  currentQty: number;
}

export interface AvailableProductDto {
  productId: string;
  productName: string;
  spec: string | null;
  totalStock: number;
  bins: AvailableProductBinDto[];
}

export interface EcrIssueDetailResponse {
  id: string;
  reportNumber: string;
  type: string;
  scNumber: string;
  poNumber: string;
  component: string;
  quantityAffected: number;
  status: string;
  issuedAt?: Date | null;
  issuedById?: string | null;
  stockTransactionId?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  rmItems: RmIssuedItemDto[];
  allAvailableProducts: AvailableProductDto[];
}

@Injectable()
export class EcrIssuesService {
  private readonly logger = new Logger(EcrIssuesService.name);

  constructor(
    @InjectRepository(EcrMaterialPending)
    private readonly ecrPendingRepo: Repository<EcrMaterialPending>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(Bin)
    private readonly binRepo: Repository<Bin>,
    @InjectRepository(Rack)
    private readonly rackRepo: Repository<Rack>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(MaterialIssue)
    private readonly materialIssueRepo: Repository<MaterialIssue>,
    @InjectRepository(MaterialIssueItem)
    private readonly materialIssueItemRepo: Repository<MaterialIssueItem>,
    @InjectRepository(RmItem)
    private readonly rmItemRepo: Repository<RmItem>,
    @InjectRepository(RmRequest)
    private readonly rmRequestRepo: Repository<RmRequest>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  /**
   * Receives ECR material pending approval notification, records pending issue idempotently,
   * creates in-app notification records for Stores personnel, and emits real-time Socket.IO event.
   */
  async receivePending(dto: ReceiveEcrPendingDto): Promise<{ id: string; reportNumber: string; status: string }> {
    // 1. Idempotency check: if ecrId already exists, return existing record
    const existing = await this.ecrPendingRepo.findOne({
      where: { ecrId: dto.ecrId },
    });

    if (existing) {
      this.logger.log(`ECR pending issue already exists for ecrId "${dto.ecrId}" (ID: ${existing.id})`);
      return {
        id: existing.id,
        reportNumber: existing.reportNumber,
        status: existing.status,
      };
    }

    // 2. Insert new record into ecr_material_pending with status = 'PENDING'
    const newRecord = this.ecrPendingRepo.create({
      ecrId: dto.ecrId,
      reportNumber: dto.reportNumber,
      type: dto.type,
      scNumber: dto.scNumber,
      poNumber: dto.poNumber,
      component: dto.component,
      quantityAffected: dto.quantityAffected,
      status: 'PENDING',
      approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : new Date(),
    });

    const savedRecord = await this.ecrPendingRepo.save(newRecord);
    this.logger.log(
      `Created ecr_material_pending record ${savedRecord.id} for report ${savedRecord.reportNumber}`,
    );

    // 3. Query all users where role = STORES from users table
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

    // 4. Create in-app notification records for each Stores user
    const title = `ECR Material Pending: ${dto.reportNumber}`;
    const body = `${dto.type} approved for component "${dto.component}" (Qty: ${dto.quantityAffected}) under SC ${dto.scNumber}. Stores issue required.`;

    if (storesUsers && storesUsers.length > 0) {
      const notifications = storesUsers.map((user) =>
        this.notificationRepo.create({
          userId: user.id,
          title,
          message: body,
          type: 'ECR_ISSUE' as any,
          isRead: false,
        }),
      );
      try {
        await this.notificationRepo.save(notifications);
      } catch (err) {
        this.logger.warn(`Could not save in-app notifications: ${err}`);
      }
    }

    // 5. Emit Socket.IO event to room 'role:STORES'
    if (this.notificationsGateway) {
      try {
        const socketPayload = {
          type: 'ECR_ISSUE',
          title,
          body,
          reportNumber: dto.reportNumber,
          scNumber: dto.scNumber,
          component: dto.component,
          quantityAffected: dto.quantityAffected,
          createdAt: savedRecord.createdAt,
        };

        if (this.notificationsGateway.server) {
          this.notificationsGateway.server.to('role:STORES').emit('notification', socketPayload);
          this.logger.debug(
            `Emitted notification event to room role:STORES for report ${dto.reportNumber}`,
          );
        } else if (
          typeof (this.notificationsGateway as any).sendNotificationToRole === 'function'
        ) {
          this.notificationsGateway.sendNotificationToRole('STORES', socketPayload);
        }
      } catch (socketErr) {
        this.logger.warn(`Failed to emit socket notification to role:STORES: ${socketErr}`);
      }
    }

    // 6. Return { id, reportNumber, status: 'PENDING' }
    return {
      id: savedRecord.id,
      reportNumber: savedRecord.reportNumber,
      status: savedRecord.status,
    };
  }

    /**
   * Synchronizes approved defect reports from ECR system into ecr_material_pending.
   * Uses HTTP API endpoints first, then falls back to direct database query.
   */
  async syncFromEcr(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    let syncedCount = 0;
    let reports: any[] = [];
    const ecrApiUrl = (process.env.ECR_API_URL || 'https://error-correction-application.onrender.com').replace(/\/+$/, '');
    const secret = process.env.ECR_INTERNAL_SECRET || process.env.RM_INTERNAL_SECRET || 'vsmart_ecr_bridge_2026_secure';

    // Strategy 1: Try HTTP endpoints on ECR backend
    const candidateUrls = [
      `${ecrApiUrl}/api/internal/approved-reports`,
      `${ecrApiUrl}/internal/approved-reports`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            'x-internal-secret': secret,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data)) {
              reports = data;
              this.logger.log(`[ECR-Sync] Fetched ${reports.length} approved reports via HTTP from ${url}`);
              break;
            }
          }
        }
      } catch (httpErr: any) {
        this.logger.debug(`[ECR-Sync] HTTP fetch failed for ${url}: ${httpErr.message}`);
      }
    }

    // Strategy 2: If HTTP didn't yield reports, fallback to direct query of ECR database
    if (reports.length === 0) {
      try {
        const ecrDbUrl =
          process.env.ECR_DATABASE_URL ||
          'postgresql://neondb_owner:npg_pJA2XQNTY9Db@ep-winter-water-at1ihqar-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
        const pg = await import('pg');
        const Client = pg.default ? (pg.default.Client || pg.default) : (pg.Client || pg);
        const client = new (Client as any)({ connectionString: ecrDbUrl });
        await client.connect();
        const res = await client.query(
          `SELECT id, "reportNumber", "inspectionType", "scNo", "poNo", "scOrPoNo", "componentName", quantity, "createdAt", "updatedAt", "componentsIssued"
           FROM defect_reports
           WHERE status = 'APPROVED'
           ORDER BY "createdAt" DESC`
        );
        await client.end();

        if (res.rows && res.rows.length > 0) {
          reports = res.rows.map((r: any) => ({
            ecrId: r.id,
            reportNumber: r.reportNumber,
            type: r.inspectionType || 'REWORK',
            scNumber: r.scNo || r.scOrPoNo || 'N/A',
            poNumber: r.poNo || r.scOrPoNo || 'N/A',
            component: r.componentName || 'Unknown',
            quantityAffected: Number(r.quantity) || 1,
            approvedAt: r.updatedAt || r.createdAt,
            componentsIssued: !!r.componentsIssued,
          }));
          this.logger.log(`[ECR-Sync] Fetched ${reports.length} approved reports via direct DB fallback`);
        }
      } catch (dbErr: any) {
        this.logger.warn(`[ECR-Sync] Direct DB query fallback failed: ${dbErr.message}`);
      }
    }

    // Ingest or update ecr_material_pending records
    for (const r of reports) {
      if (!r.reportNumber) continue;
      const existing = await this.ecrPendingRepo.findOne({
        where: [{ reportNumber: r.reportNumber }, { ecrId: r.ecrId }],
      });

      if (!existing) {
        const pending = this.ecrPendingRepo.create({
          ecrId: r.ecrId || r.id,
          reportNumber: r.reportNumber,
          type: r.type || 'REWORK',
          scNumber: r.scNumber || 'N/A',
          poNumber: r.poNumber || 'N/A',
          component: r.component || 'Unknown',
          quantityAffected: Number(r.quantityAffected) || 1,
          status: r.componentsIssued ? 'ISSUED' : 'PENDING',
          approvedAt: r.approvedAt ? new Date(r.approvedAt) : new Date(),
        });
        await this.ecrPendingRepo.save(pending);
        syncedCount++;
        this.logger.log(`[ECR-Sync] Ingested approved report ${r.reportNumber} into ecr_material_pending`);
      } else if (r.componentsIssued && existing.status !== 'ISSUED') {
        existing.status = 'ISSUED';
        await this.ecrPendingRepo.save(existing);
      }
    }

    return {
      success: true,
      syncedCount,
      message:
        syncedCount > 0
          ? `Synced ${syncedCount} new approved report(s)`
          : 'All approved reports are up to date',
    };
  }

/**
   * Fetches all records from ecr_material_pending ordered by created_at DESC.
   * Matches product by component name (case-insensitive) and computes currentStock
   * summed across all bins. Zero N+1 queries.
   */
  async getAll(): Promise<any[]> {
    try {
      await this.syncFromEcr();
    } catch (syncErr: any) {
      this.logger.warn(`[ECR-Sync] Auto-sync in getAll failed: ${syncErr.message}`);
    }

    const records = await this.ecrPendingRepo.find({
      order: { createdAt: 'DESC' },
    });

    if (!records || records.length === 0) {
      return [];
    }

    const [products, stockBalances] = await Promise.all([
      this.productRepo.find(),
      this.stockBalanceRepo.find(),
    ]);

    const productMap = new Map<string, Product>();
    for (const p of products) {
      if (p.name) {
        productMap.set(p.name.trim().toLowerCase(), p);
      }
    }

    const stockMap = new Map<string, number>();
    for (const sb of stockBalances) {
      if (sb.productId) {
        const qty = Number(sb.currentQuantity) || 0;
        stockMap.set(sb.productId, (stockMap.get(sb.productId) || 0) + qty);
      }
    }

    return records.map((record) => {
      const compKey = record.component ? record.component.trim().toLowerCase() : '';
      const matchedProduct = compKey ? productMap.get(compKey) : undefined;
      const currentStock = matchedProduct ? (stockMap.get(matchedProduct.id) || 0) : 0;

      return {
        ...record,
        currentStock,
      };
    });
  }

  /**
   * Fetches single ecr_material_pending record by id.
   * Returns:
   * - rmItems: All RM items previously issued to this SC (deduplicated by product+bin)
   * - allAvailableProducts: All other products with current_quantity > 0
   */
  async getOne(id: string): Promise<EcrIssueDetailResponse> {
    const record = await this.ecrPendingRepo.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`ECR material pending record not found with id "${id}"`);
    }

    // 1. Find the SC by sc_number
    let sc: SalesOrderComponent | null = null;
    const cleanScNumber = record.scNumber ? record.scNumber.trim() : '';

    if (cleanScNumber) {
      sc = await this.scRepo
        .createQueryBuilder('sc')
        .where('LOWER(TRIM(sc.sc_number)) = LOWER(TRIM(:scNumber))', { scNumber: cleanScNumber })
        .getOne();
    }

    // 2. Query rmItems previously issued to this SC
    let rmItems: RmIssuedItemDto[] = [];
    const issuedProductIds = new Set<string>();

    if (sc) {
      const rawRmItems = await this.dataSource.query(
        `SELECT
          MIN(mii.id::text) as "rmItemId",
          p.id as "productId",
          p.name as "productName",
          COALESCE(NULLIF(TRIM(MIN(rmi.size)), ''), NULLIF(TRIM(MIN(rmi.material)), ''), MIN(p.code)) as "spec",
          COALESCE(st.source_bin_id, (SELECT bin_id FROM stock_balances WHERE product_id = p.id AND current_quantity > 0 ORDER BY current_quantity DESC LIMIT 1)) as "binId",
          COALESCE(b.code, fb.code, 'N/A') as "binCode",
          COALESCE(r.code, fr.code, 'N/A') as "rackCode",
          SUM(mii.quantity_issued)::numeric as "originalIssuedQty",
          COALESCE(sb.current_quantity, fsb.current_quantity, 0)::numeric as "currentBinStock"
        FROM material_issues mi
        JOIN material_issue_items mii ON mii.material_issue_id = mi.id
        JOIN rm_items rmi ON rmi.id = mii.rm_item_id
        JOIN products p ON p.id = rmi.mapped_product_id
        LEFT JOIN stock_transactions st ON (st.reference_id = mi.id::text) AND st.product_id = p.id
        LEFT JOIN bins b ON b.id = st.source_bin_id
        LEFT JOIN racks r ON r.id = b.rack_id
        LEFT JOIN stock_balances sb ON sb.product_id = p.id AND sb.bin_id = st.source_bin_id
        LEFT JOIN bins fb ON fb.id = (SELECT bin_id FROM stock_balances WHERE product_id = p.id AND current_quantity > 0 ORDER BY current_quantity DESC LIMIT 1)
        LEFT JOIN racks fr ON fr.id = fb.rack_id
        LEFT JOIN stock_balances fsb ON fsb.product_id = p.id AND fsb.bin_id = fb.id
        WHERE mi.sc_id = $1
        GROUP BY 
          p.id, 
          p.name, 
          COALESCE(st.source_bin_id, (SELECT bin_id FROM stock_balances WHERE product_id = p.id AND current_quantity > 0 ORDER BY current_quantity DESC LIMIT 1)),
          COALESCE(b.code, fb.code, 'N/A'),
          COALESCE(r.code, fr.code, 'N/A'),
          COALESCE(sb.current_quantity, fsb.current_quantity, 0)
        ORDER BY p.name ASC`,
        [sc.id],
      );

      rmItems = (rawRmItems || []).map((row: any) => {
        if (row.productId) {
          issuedProductIds.add(row.productId);
        }
        return {
          rmItemId: row.rmItemId,
          productId: row.productId,
          productName: row.productName,
          spec: row.spec || null,
          binId: row.binId || '',
          binCode: row.binCode || 'N/A',
          rackCode: row.rackCode || 'N/A',
          originalIssuedQty: Number(row.originalIssuedQty) || 0,
          currentBinStock: Number(row.currentBinStock) || 0,
        };
      });
    }

    // 3. Query allAvailableProducts: products with stock > 0 excluding issuedProductIds
    const rawAvailable = await this.dataSource.query(
      `SELECT
        p.id as "productId",
        p.name as "productName",
        p.code as "spec",
        b.id as "binId",
        b.code as "binCode",
        r.code as "rackCode",
        sb.current_quantity as "currentQty"
      FROM stock_balances sb
      JOIN products p ON p.id = sb.product_id
      JOIN bins b ON b.id = sb.bin_id
      LEFT JOIN racks r ON r.id = b.rack_id
      WHERE sb.current_quantity > 0
      ORDER BY p.name ASC, sb.current_quantity DESC`,
    );

    const productMap = new Map<string, AvailableProductDto>();
    for (const row of rawAvailable || []) {
      if (issuedProductIds.has(row.productId)) {
        continue;
      }
      if (!productMap.has(row.productId)) {
        productMap.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          spec: row.spec || null,
          totalStock: 0,
          bins: [],
        });
      }
      const prod = productMap.get(row.productId)!;
      const qty = Number(row.currentQty) || 0;
      prod.totalStock += qty;
      prod.bins.push({
        binId: row.binId,
        binCode: row.binCode || 'N/A',
        rackCode: row.rackCode || 'N/A',
        currentQty: qty,
      });
    }

    const allAvailableProducts = Array.from(productMap.values());

    return {
      id: record.id,
      reportNumber: record.reportNumber,
      type: record.type,
      scNumber: record.scNumber,
      poNumber: record.poNumber,
      component: record.component,
      quantityAffected: record.quantityAffected,
      status: record.status,
      issuedAt: record.issuedAt,
      issuedById: record.issuedById,
      stockTransactionId: record.stockTransactionId,
      approvedAt: record.approvedAt,
      createdAt: record.createdAt,
      rmItems,
      allAvailableProducts,
    };
  }

  /**
   * Issues replacement material for an approved ECR rework/rejection record in a single atomic transaction.
   * Updates stock balances, creates stock transactions, creates material_issues and material_issue_items records,
   * marks ecr_material_pending as ISSUED, and calls ECR webhook.
   */
  async issue(
    id: string,
    dto: IssueEcrMaterialDto,
    currentUser: { id?: string; userId?: string; name?: string; email?: string; [key: string]: any },
  ): Promise<{ success: boolean; itemsIssued: number; materialIssueId: string; issuedAt: Date }> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be selected for issue');
    }

    const actorId = currentUser.id || currentUser.userId || 'SYSTEM';
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let pendingRecord: EcrMaterialPending;
    let savedMaterialIssue: MaterialIssue;
    const savedTransactionIds: string[] = [];
    const issuedAt = new Date();

    try {
      // 1. Fetch ecr_material_pending by id with pessimistic write lock
      const foundRecord = await queryRunner.manager.findOne(EcrMaterialPending, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!foundRecord) {
        throw new NotFoundException(`ECR material pending record not found with id "${id}"`);
      }

      if (foundRecord.status === 'ISSUED') {
        throw new BadRequestException('Already issued');
      }

      pendingRecord = foundRecord;

      // 2. Find SalesOrderComponent by scNumber
      const cleanScNumber = pendingRecord.scNumber ? pendingRecord.scNumber.trim() : '';
      const sc = await queryRunner.manager
        .createQueryBuilder(SalesOrderComponent, 'sc')
        .where('LOWER(TRIM(sc.sc_number)) = LOWER(TRIM(:scNumber))', { scNumber: cleanScNumber })
        .setLock('pessimistic_write')
        .getOne();

      if (!sc) {
        throw new NotFoundException(
          `Sales order component "${pendingRecord.scNumber}" not found. Cannot link material issue.`,
        );
      }

      // 3. Create one material_issues record with issue_type = 'ADDITIONAL_ISSUE'
      const issueNumber = `ISS-ECR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const issueReason = `ECR Rework/Rejection Material Issue | Report: ${pendingRecord.reportNumber} | SC: ${pendingRecord.scNumber}`;

      const newMaterialIssue = queryRunner.manager.create(MaterialIssue, {
        scId: sc.id,
        issueNumber,
        issueType: MaterialIssueType.ADDITIONAL_ISSUE,
        issuedById: actorId,
        remarks: issueReason,
      });

      savedMaterialIssue = await queryRunner.manager.save(MaterialIssue, newMaterialIssue);

      // Pre-fetch products for all items
      const productIds = dto.items.map((i) => i.productId);
      const products = await queryRunner.manager.find(Product, {
        where: { id: In(productIds) },
      });
      const productMap = new Map<string, Product>();
      products.forEach((p) => productMap.set(p.id, p));

      // 4. Process each item atomically
      for (const item of dto.items) {
        const product = productMap.get(item.productId);
        const productName = product?.name || item.productId;

        // Atomic stock decrement
        const updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances
           SET current_quantity = current_quantity - $1, updated_at = NOW()
           WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1`,
          [item.quantityIssued, item.binId, item.productId],
        );

        const affectedRows = Array.isArray(updateResult) && typeof updateResult[1] === 'number'
          ? updateResult[1]
          : (typeof updateResult?.affected === 'number' ? updateResult.affected : (updateResult === 1 ? 1 : 0));

        if (affectedRows !== 1) {
          throw new BadRequestException(
            `Insufficient stock for product: ${productName} in selected bin`,
          );
        }

        // Insert stock_transactions record (quantity must be positive per CHECK constraint)
        const reasonText = `ECR Rework Issue for SC: ${pendingRecord.scNumber} | Report: ${pendingRecord.reportNumber}`;
        const newTransaction = queryRunner.manager.create(StockTransaction, {
          productId: item.productId,
          sourceBinId: item.binId,
          transactionType: 'ECR_REWORK_ISSUE' as any,
          quantity: item.quantityIssued,
          referenceType: 'ECR_REWORK_ISSUE',
          referenceId: savedMaterialIssue.id,
          reason: reasonText,
          remarks: reasonText,
          createdById: actorId,
        });

        const savedTx = await queryRunner.manager.save(StockTransaction, newTransaction);
        savedTransactionIds.push(savedTx.id);

        // Update last_transaction_id on stock_balances
        await queryRunner.manager.query(
          `UPDATE stock_balances SET last_transaction_id = $1 WHERE bin_id = $2 AND product_id = $3`,
          [savedTx.id, item.binId, item.productId],
        );

        // Ensure an RmItem exists for this product on this SC
        let rmItem = await queryRunner.manager.findOne(RmItem, {
          where: { scId: sc.id, mappedProductId: item.productId },
        });

        if (!rmItem) {
          const rmReq = await queryRunner.manager.findOne(RmRequest, {
            where: { scId: sc.id },
          });
          const rmFormId = rmReq?.id || sc.id;

          const createdRmItem = queryRunner.manager.create(RmItem, {
            rmFormId,
            scId: sc.id,
            mappedProductId: item.productId,
            material: productName,
            materialType: 'RAW_MATERIAL',
            grade: product?.code || 'STANDARD',
            size: product?.code || 'N/A',
            quantity: item.quantityIssued,
            weightUnit: product?.uom || 'KG',
            remarks: `ECR replacement issue for Report ${pendingRecord.reportNumber}`,
          });
          rmItem = await queryRunner.manager.save(RmItem, createdRmItem);
        }

        // Insert material_issue_items
        const issueItem = queryRunner.manager.create(MaterialIssueItem, {
          materialIssueId: savedMaterialIssue.id,
          rmItemId: rmItem.id,
          quantityIssued: item.quantityIssued,
          remarks: `ECR replacement issue for Report ${pendingRecord.reportNumber}`,
        });
        await queryRunner.manager.save(MaterialIssueItem, issueItem);
      }

      // 5. Update ecr_material_pending record
      pendingRecord.status = 'ISSUED';
      pendingRecord.issuedAt = issuedAt;
      pendingRecord.issuedById = actorId;
      pendingRecord.stockTransactionId = savedTransactionIds[0] || null;

      await queryRunner.manager.save(EcrMaterialPending, pendingRecord);

      // Commit transaction
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 6. After commit — Call ECR webhook (outside transaction, non-blocking)
    try {
      const ecrApiUrl = (process.env.ECR_API_URL || 'https://error-correction-application.onrender.com').replace(/\/+$/, '');
      const secret = process.env.ECR_INTERNAL_SECRET || process.env.RM_INTERNAL_SECRET || 'vsmart_ecr_bridge_2026_secure';
      const totalQty = dto.items.reduce((sum, i) => sum + i.quantityIssued, 0);

      let webhookSuccess = false;
      try {
        const webhookRes = await fetch(`${ecrApiUrl}/api/internal/material-issued`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': secret,
          },
          body: JSON.stringify({
            ecrId: pendingRecord.ecrId,
            reportNumber: pendingRecord.reportNumber,
            issuedAt: issuedAt.toISOString(),
            issuedQty: totalQty,
            stockTransactionId: savedTransactionIds[0] || '',
            stockTransactionIds: savedTransactionIds,
            issuedByName: currentUser.name ?? currentUser.email ?? 'Stores',
            itemsSummary: dto.items.map((i) => ({ productId: i.productId, qty: i.quantityIssued })),
          }),
        });
        if (webhookRes.ok) {
          webhookSuccess = true;
          this.logger.log(
            `[ECR-Integration] Successfully sent material-issued webhook for report ${pendingRecord.reportNumber}`,
          );
        } else {
          this.logger.warn(
            `[ECR-Integration] Webhook returned status ${webhookRes.status} for report ${pendingRecord.reportNumber}`,
          );
        }
      } catch (httpPostErr: any) {
        this.logger.warn(`[ECR-Integration] Webhook fetch error: ${httpPostErr.message}`);
      }

      // If webhook was not acknowledged, execute direct DB update fallback
      if (!webhookSuccess) {
        try {
          const ecrDbUrl =
            process.env.ECR_DATABASE_URL ||
            'postgresql://neondb_owner:npg_pJA2XQNTY9Db@ep-winter-water-at1ihqar-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
          const pg = await import('pg');
          const Client = pg.default ? (pg.default.Client || pg.default) : (pg.Client || pg);
          const client = new (Client as any)({ connectionString: ecrDbUrl });
          await client.connect();
          await client.query(
            `UPDATE defect_reports
             SET "componentsIssued" = true,
                 "componentsIssuedAt" = NOW(),
                 "componentsIssuedById" = 'RM_SYSTEM',
                 status = 'COMPONENTS_ISSUED'
             WHERE "reportNumber" = $1 OR id = $2`,
            [pendingRecord.reportNumber, pendingRecord.ecrId]
          );
          await client.end();
          this.logger.log(`[ECR-Integration] Direct ECR DB fallback updated report ${pendingRecord.reportNumber} to COMPONENTS_ISSUED`);
        } catch (dbFallbackErr: any) {
          this.logger.warn(`[ECR-Integration] Direct ECR DB fallback failed: ${dbFallbackErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error('[ECR-Integration] Webhook processing failed', {
        ecrId: pendingRecord.ecrId,
        reportNumber: pendingRecord.reportNumber,
        error: err?.message || String(err),
      });
    }

    // 7. Return response
    return {
      success: true,
      itemsIssued: dto.items.length,
      materialIssueId: savedMaterialIssue.id,
      issuedAt,
    };
  }
}

export default EcrIssuesService;
