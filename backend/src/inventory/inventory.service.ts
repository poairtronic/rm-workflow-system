import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
  AdjustmentDirection,
} from './entities/stock-transaction.entity.js';
import { MslTriggerService } from './msl-trigger.service.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto.js';
import { CreateStockInDto } from './dto/create-stock-in.dto.js';
import { CreateStockOutDto } from './dto/create-stock-out.dto.js';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto.js';
import { Product } from './entities/product.entity.js';
import { Bin } from './entities/bin.entity.js';
import { ModernStockInDto } from './dto/modern-stock-in.dto.js';
import { ModernStockOutDto } from './dto/modern-stock-out.dto.js';
import { ModernStockAdjustmentDto } from './dto/modern-stock-adjustment.dto.js';
import {
  GetInventoryFilterDto,
  StockStatusFilter,
} from './dto/get-inventory-filter.dto.js';
import { GetBalancesFilterDto } from './dto/get-balances-filter.dto.js';
import { GetTransactionFilterDto } from './dto/get-transaction-filter.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';
import {
  ReconciliationResultDto,
  ReconciliationStatus,
} from './dto/reconciliation-result.dto.js';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepository: Repository<StockBalance>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly mslTriggerService?: MslTriggerService,
  ) {}

  /**
   * Post-commit safe MSL evaluation trigger.
   */
  private triggerMslCheck(productId?: string | null) {
    if (productId && this.mslTriggerService) {
      this.mslTriggerService.triggerProductEvaluation(productId).catch((err) => {
        this.logger.error(
          `[MSL TRIGGER ISOLATION] Post-commit check failed for product ${productId}: ${err?.message || err}`,
        );
      });
    }
  }

  
  async getBalancesByProduct(productId: string) {
    const balances = await this.stockBalanceRepository
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.bin', 'bin')
      .leftJoinAndSelect('bin.rack', 'rack')
      .leftJoinAndSelect('rack.location', 'location')
      .leftJoinAndSelect('location.warehouse', 'warehouse')
      .where('sb.product_id = :productId', { productId })
      .andWhere('sb.current_quantity > 0')
      .getMany();

    return balances.map(b => ({
      binId: b.binId,
      binCode: b.bin?.code,
      warehouseName: b.bin?.rack?.location?.warehouse?.name || 'Unknown',
      productId: b.productId,
      currentQuantity: Number(b.currentQuantity)
    }));
  }

  async getAllBalances(filterDto: GetBalancesFilterDto) {
    const { search, productId, binId, page = 1, pageSize = 10 } = filterDto;
    
    const query = this.stockBalanceRepository
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.product', 'product')
      .leftJoinAndSelect('sb.bin', 'bin')
      .leftJoinAndSelect('bin.rack', 'rack')
      .leftJoinAndSelect('rack.location', 'location')
      .leftJoinAndSelect('location.warehouse', 'warehouse')
      .where('sb.current_quantity > 0');

    if (productId) {
      query.andWhere('sb.product_id = :productId', { productId });
    }
    
    if (binId) {
      query.andWhere('sb.bin_id = :binId', { binId });
    }

    if (search) {
      query.andWhere(
        '(product.name ILIKE :search OR product.code ILIKE :search OR bin.code ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const skip = (page - 1) * pageSize;
    query.orderBy('product.name', 'ASC')
         .addOrderBy('bin.code', 'ASC')
         .skip(skip)
         .take(pageSize);

    const [balances, total] = await query.getManyAndCount();

    const data = await Promise.all(balances.map(async b => {
      const latestTx = await this.stockTransactionRepository.findOne({
        where: [
          { productId: b.productId, destinationBinId: b.binId, lotBatchNumber: Not(IsNull()) },
          { productId: b.productId, sourceBinId: b.binId, lotBatchNumber: Not(IsNull()) }
        ],
        order: { createdAt: 'DESC' }
      });

      return {
        id: b.id,
        productId: b.productId,
        productCode: b.product?.code,
        productName: b.product?.name,
        uom: b.product?.uom,
        msl: b.product?.minimumInventory,
        binId: b.binId,
        binCode: b.bin?.code,
        warehouseName: b.bin?.rack?.location?.warehouse?.name || 'Unknown',
        currentQuantity: Number(b.currentQuantity),
        latestLotBatchNumber: latestTx?.lotBatchNumber || null
      };
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findAll(
    filterDto?: GetInventoryFilterDto,
  ): Promise<PaginatedResponseDto<InventoryItem>> {
    const {
      search,
      stockStatus,
      isActive,
      page = 1,
      pageSize = 10,
    } = filterDto || {};

    const query = this.inventoryItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.stockBalance', 'balance')
      .orderBy('item.material', 'ASC')
      .addOrderBy('item.size', 'ASC');

    if (search) {
      const searchPattern = `%${search}%`;
      query.andWhere(
        '(item.material ILIKE :search OR item.materialType ILIKE :search OR item.grade ILIKE :search OR item.size ILIKE :search)',
        { search: searchPattern },
      );
    }

    if (isActive !== undefined) {
      query.andWhere('item.isActive = :isActive', { isActive });
    }

    if (stockStatus) {
      if (stockStatus === StockStatusFilter.LOW_STOCK) {
        query.andWhere(
          'COALESCE(balance.current_quantity, 0) < item.minimum_stock_level',
        );
      } else if (stockStatus === StockStatusFilter.NORMAL) {
        query.andWhere(
          'COALESCE(balance.current_quantity, 0) >= item.minimum_stock_level',
        );
      }
    }

    const skip = (page - 1) * pageSize;
    query.skip(skip).take(pageSize);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const item = await this.inventoryItemRepository.findOne({
      where: { id },
      relations: { stockBalance: true },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return item;
  }

  async create(createDto: CreateInventoryItemDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = this.inventoryItemRepository.create(createDto);
      const savedItem = await queryRunner.manager.save(item);

      const balance = this.stockBalanceRepository.create({
        inventoryItemId: savedItem.id,
        currentQuantity: 0,
        openingBalance: 0,
      });
      await queryRunner.manager.save(balance);

      await queryRunner.commitTransaction();
      return this.findOne(savedItem.id);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (error.code === '23505') {
        throw new ConflictException(
          'An inventory item with this exact combination of material, type, grade, and size already exists.',
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, updateDto: UpdateInventoryItemDto) {
    const item = await this.findOne(id);
    Object.assign(item, updateDto);
    try {
      return await this.inventoryItemRepository.save(item);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'An inventory item with this exact combination of material, type, grade, and size already exists.',
        );
      }
      throw error;
    }
  }

  async getStockBalance(inventoryItemId: string) {
    const balance = await this.stockBalanceRepository.findOne({
      where: { inventoryItemId },
    });
    if (!balance) {
      throw new NotFoundException(
        `Stock balance for item ${inventoryItemId} not found`,
      );
    }
    return balance;
  }

  async getTransactions(
    inventoryItemId: string,
    filterDto?: GetTransactionFilterDto,
  ): Promise<PaginatedResponseDto<StockTransaction>> {
    const {
      transactionType,
      adjustmentDirection,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = filterDto || {};

    const query = this.stockTransactionRepository
      .createQueryBuilder('tx')
      .where('tx.inventory_item_id = :inventoryItemId', { inventoryItemId })
      .leftJoin('tx.createdBy', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .orderBy('tx.createdAt', 'DESC')
      .addOrderBy('tx.id', 'DESC');

    if (transactionType) {
      query.andWhere('tx.transactionType = :transactionType', {
        transactionType,
      });
    }

    if (adjustmentDirection && transactionType === TransactionType.ADJUSTMENT) {
      query.andWhere('tx.adjustmentDirection = :adjustmentDirection', {
        adjustmentDirection,
      });
    }

    if (startDate) {
      query.andWhere('tx.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('tx.createdAt <= :endDate', { endDate });
    }

    const skip = (page - 1) * pageSize;
    query.skip(skip).take(pageSize);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getAllTransactions(
    filterDto?: GetTransactionFilterDto,
  ): Promise<PaginatedResponseDto<StockTransaction>> {
    const {
      productId,
      binId,
      transactionType,
      adjustmentDirection,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = filterDto || {};

    const query = this.stockTransactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.product', 'product')
      .leftJoinAndSelect('tx.sourceBin', 'sourceBin')
      .leftJoinAndSelect('tx.destinationBin', 'destinationBin')
      .leftJoin('tx.createdBy', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .orderBy('tx.createdAt', 'DESC')
      .addOrderBy('tx.id', 'DESC');

    if (productId) {
      query.andWhere('tx.productId = :productId', { productId });
    }
    
    if (binId) {
      query.andWhere('(tx.sourceBinId = :binId OR tx.destinationBinId = :binId)', { binId });
    }

    if (transactionType) {
      query.andWhere('tx.transactionType = :transactionType', { transactionType });
    }

    if (adjustmentDirection && transactionType === TransactionType.ADJUSTMENT) {
      query.andWhere('tx.adjustmentDirection = :adjustmentDirection', { adjustmentDirection });
    }

    if (startDate) {
      query.andWhere('tx.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('tx.createdAt <= :endDate', { endDate });
    }

    const skip = (page - 1) * pageSize;
    query.skip(skip).take(pageSize);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getReconciliation(
    inventoryItemId?: string,
  ): Promise<ReconciliationResultDto[]> {
    const query = this.stockBalanceRepository
      .createQueryBuilder('balance')
      .leftJoinAndSelect('balance.inventoryItem', 'item')
      .leftJoinAndSelect('balance.product', 'product')
      .leftJoinAndSelect('balance.bin', 'bin');

    if (inventoryItemId) {
      query.where(
        'balance.inventory_item_id = :id OR balance.product_id = :id OR balance.id = :id',
        { id: inventoryItemId },
      );
    }

    const balances = await query.getMany();

    const txQuery = this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('tx.inventory_item_id', 'inventoryItemId')
      .addSelect('tx.product_id', 'productId')
      .addSelect('tx.source_bin_id', 'sourceBinId')
      .addSelect('tx.destination_bin_id', 'destinationBinId')
      .addSelect('tx.transaction_type', 'type')
      .addSelect('tx.adjustment_direction', 'adjustmentDirection')
      .addSelect('SUM(tx.quantity)', 'total')
      .groupBy('tx.inventory_item_id')
      .addGroupBy('tx.product_id')
      .addGroupBy('tx.source_bin_id')
      .addGroupBy('tx.destination_bin_id')
      .addGroupBy('tx.transaction_type')
      .addGroupBy('tx.adjustment_direction');

    if (inventoryItemId) {
      const balanceIds = balances
        .map((b) => b.inventoryItemId)
        .filter((id) => id);
      const productIds = balances.map((b) => b.productId).filter((id) => id);

      if (balanceIds.length > 0 || productIds.length > 0) {
        txQuery.andWhere(
          '(tx.inventory_item_id IN (:...balanceIds) OR tx.product_id IN (:...productIds))',
          {
            balanceIds: balanceIds.length > 0 ? balanceIds : ['none'],
            productIds: productIds.length > 0 ? productIds : ['none'],
          },
        );
      } else {
        return [];
      }
    }

    const txAgg = await txQuery.getRawMany();

    const results: ReconciliationResultDto[] = balances.map((balance) => {
      let ledgerMovement = 0;

      for (const row of txAgg) {
        const qty = parseFloat(row.total) || 0;
        const type = row.type as TransactionType;

        const matchesLegacy = !!(
          balance.inventoryItemId &&
          row.inventoryItemId === balance.inventoryItemId
        );
        const matchesModernTarget = !!(
          balance.productId &&
          row.productId === balance.productId &&
          row.destinationBinId === balance.binId
        );
        const matchesModernSource = !!(
          balance.productId &&
          row.productId === balance.productId &&
          row.sourceBinId === balance.binId
        );

        let txQty = 0;

        if (
          type === TransactionType.STOCK_IN ||
          type === TransactionType.RETURN ||
          type === TransactionType.GRN_RECEIPT ||
          type === TransactionType.DC_RETURN ||
          (type === TransactionType.ADJUSTMENT &&
            row.adjustmentDirection === AdjustmentDirection.INCREASE)
        ) {
          if (matchesLegacy || matchesModernTarget) txQty += qty;
        } else if (type === TransactionType.TRANSFER) {
          if (matchesModernTarget) txQty += qty;
          if (matchesModernSource) txQty -= qty;
        } else if (
          type === TransactionType.STOCK_OUT ||
          type === TransactionType.STORES_ISSUE ||
          type === TransactionType.DC_DISPATCH ||
          (type === TransactionType.ADJUSTMENT &&
            row.adjustmentDirection === AdjustmentDirection.DECREASE)
        ) {
          if (matchesLegacy || matchesModernSource) txQty -= qty;
        }

        ledgerMovement += txQty;
      }

      let status = ReconciliationStatus.NOT_RECONCILABLE;
      let reason: string | undefined = undefined;
      let expectedBalance: number | null = null;
      let difference: number | null = null;

      if (
        balance.openingBalance === null ||
        balance.openingBalance === undefined
      ) {
        reason = 'OPENING_BASELINE_MISSING';
      } else {
        const currentBalance = Number(balance.currentQuantity);
        const opening = Number(balance.openingBalance);
        expectedBalance = opening + ledgerMovement;
        difference = currentBalance - expectedBalance;

        if (Math.abs(difference) < 0.0005) {
          status = ReconciliationStatus.MATCH;
          difference = 0;
        } else {
          status = ReconciliationStatus.MISMATCH;
        }
      }

      return {
        stockBalanceId: balance.id,
        inventoryItemId: balance.inventoryItemId || undefined,
        productId: balance.productId || undefined,
        productName: balance.product?.name || undefined,
        binId: balance.binId || undefined,
        binCode: balance.bin?.code || undefined,
        material:
          balance.product?.name || balance.inventoryItem?.material || 'Unknown',
        grade: balance.inventoryItem?.grade || 'N/A',
        size: balance.inventoryItem?.size || 'N/A',
        currentBalance: Number(balance.currentQuantity),
        ledgerMovement: ledgerMovement,
        openingBalance:
          balance.openingBalance !== null &&
          balance.openingBalance !== undefined
            ? Number(balance.openingBalance)
            : null,
        expectedBalance,
        difference,
        status,
        reason,
      };
    });

    return results;
  }

  /**
   * READ-ONLY comprehensive business workflow and ledger reconciliation audit.
   * Compares StockBalances with StockTransactions, MaterialIssues, and MaterialReturns.
   */
  async getWorkflowReconciliation() {
    // 1. Audit Product + Bin balances vs Stock Transactions
    const binBalances = await this.stockBalanceRepository.find({
      relations: { product: true, bin: true },
    });

    const txAgg = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('tx.product_id', 'productId')
      .addSelect('tx.source_bin_id', 'sourceBinId')
      .addSelect('tx.destination_bin_id', 'destinationBinId')
      .addSelect('tx.transaction_type', 'type')
      .addSelect('tx.adjustment_direction', 'adjustmentDirection')
      .addSelect('SUM(tx.quantity)', 'total')
      .groupBy('tx.product_id')
      .addGroupBy('tx.source_bin_id')
      .addGroupBy('tx.destination_bin_id')
      .addGroupBy('tx.transaction_type')
      .addGroupBy('tx.adjustment_direction')
      .getRawMany();

    const binReconResults = binBalances.map((b) => {
      const currentQty = Number(b.currentQuantity) || 0;
      const binId = b.binId;
      const productId = b.productId;

      let inQty = 0;
      let outQty = 0;

      for (const row of txAgg) {
        const qty = parseFloat(row.total) || 0;
        
        if (productId && row.productId && row.productId !== productId) {
          continue; // Skip movements of other products in the same bin
        }

        if (
          row.destinationBinId === binId &&
          (row.type === 'STOCK_IN' || row.type === 'RETURN' || row.type === 'GRN_RECEIPT' || row.type === 'DC_RETURN' || row.type === 'TRANSFER' || (row.type === 'ADJUSTMENT' && row.adjustmentDirection === 'INCREASE'))
        ) {
          inQty += qty;
        }
        if (
          row.sourceBinId === binId &&
          (row.type === 'STOCK_OUT' || row.type === 'STORES_ISSUE' || row.type === 'DC_DISPATCH' || row.type === 'TRANSFER' || (row.type === 'ADJUSTMENT' && row.adjustmentDirection === 'DECREASE'))
        ) {
          outQty += qty;
        }
      }

      const opening = Number(b.openingBalance || 0);
      const expectedBalance = opening + inQty - outQty;
      const difference = currentQty - expectedBalance;
      const isMatch = Math.abs(difference) < 0.001;

      return {
        binId: b.binId,
        binCode: b.bin?.code || 'N/A',
        productId: b.productId,
        productName: b.product?.name || 'N/A',
        currentQuantity: currentQty,
        expectedBalance,
        difference,
        status: isMatch ? 'MATCH' : 'MISMATCH',
      };
    });

    return {
      timestamp: new Date().toISOString(),
      reconciliationStatus: binReconResults.every((r) => r.status === 'MATCH')
        ? 'CLEAN'
        : 'DISCREPANCY_DETECTED',
      binBalances: binReconResults,
    };
  }

  async addStockTransaction(
    inventoryItemId: string,
    createTxDto: CreateStockTransactionDto,
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify item exists
      const item = await queryRunner.manager.findOne(InventoryItem, {
        where: { id: inventoryItemId },
      });
      if (!item) {
        throw new NotFoundException(
          `Inventory item ${inventoryItemId} not found`,
        );
      }

      // 1.5 Fetch current balance to get target mappings if they exist
      const currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      // 2. Create the transaction record
      const transaction = this.stockTransactionRepository.create({
        ...createTxDto,
        inventoryItemId,
        productId: currentBalance?.productId,
        sourceBinId:
          createTxDto.transactionType === TransactionType.STOCK_OUT
            ? currentBalance?.binId
            : undefined,
        destinationBinId:
          createTxDto.transactionType === TransactionType.STOCK_IN
            ? currentBalance?.binId
            : undefined,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      // 3. Update stock balance atomically
      const { transactionType, quantity } = createTxDto;

      let mathOperator = '';
      if (transactionType === TransactionType.STOCK_IN) {
        mathOperator = '+';
      } else if (transactionType === TransactionType.STOCK_OUT) {
        mathOperator = '-';
      } else if (transactionType === TransactionType.ADJUSTMENT) {
        throw new BadRequestException(
          'ADJUSTMENT transaction type logic needs explicit delta specification',
        );
      }

      if (mathOperator) {
        await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity ${mathOperator} $1, 
               last_transaction_id = $2, 
               updated_at = NOW() 
           WHERE inventory_item_id = $3`,
          [quantity, savedTx.id, inventoryItemId],
        );
      }

      await queryRunner.commitTransaction();

      this.triggerMslCheck(currentBalance?.productId || savedTx.productId);

      return savedTx;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async stockIn(
    inventoryItemId: string,
    dto: CreateStockInDto,
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = await queryRunner.manager.findOne(InventoryItem, {
        where: { id: inventoryItemId },
      });
      if (!item) {
        throw new NotFoundException(
          `Inventory item ${inventoryItemId} not found`,
        );
      }

      // Fallback for seed data without initial balance.
      const balanceCheck = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });
      if (!balanceCheck) {
        const newBalance = this.stockBalanceRepository.create({
          inventoryItemId,
          currentQuantity: 0,
        });
        await queryRunner.manager.save(newBalance);
      }

      const transaction = this.stockTransactionRepository.create({
        inventoryItemId,
        productId: balanceCheck?.productId,
        destinationBinId: balanceCheck?.binId,
        transactionType: TransactionType.STOCK_IN,
        quantity: dto.quantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        reason: dto.reason,
        remarks: dto.remarks || dto.reason,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      // Atomic stock update
      await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET current_quantity = current_quantity + $1, 
             last_transaction_id = $2, 
             updated_at = NOW() 
         WHERE inventory_item_id = $3`,
        [dto.quantity, savedTx.id, inventoryItemId],
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      if (!finalBalance) {
        throw new BadRequestException(
          'Failed to update stock balance atomically',
        );
      }

      await queryRunner.commitTransaction();

      this.triggerMslCheck(balanceCheck?.productId || finalBalance.productId);

      return {
        transaction: savedTx,
        balance: finalBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async stockOut(
    inventoryItemId: string,
    dto: CreateStockOutDto,
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = await queryRunner.manager.findOne(InventoryItem, {
        where: { id: inventoryItemId },
      });
      if (!item) {
        throw new NotFoundException(
          `Inventory item ${inventoryItemId} not found`,
        );
      }

      // We don't auto-create balance for stockOut; it must exist and have enough stock.
      const currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      if (!currentBalance) {
        throw new BadRequestException(
          'Insufficient stock (no balance record found).',
        );
      }

      // Atomic stock decrement check and update
      const updateResult = await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET current_quantity = current_quantity - $1, 
             updated_at = NOW() 
         WHERE inventory_item_id = $2 AND current_quantity >= $1`,
        [dto.quantity, inventoryItemId],
      );

      if (updateResult[1] === 0) {
        // [1] contains row count in pg query results, or check updateResult itself based on TypeORM driver
        // Actually, with query() in postgres, the result is usually [rows, count]
        // Let's be safer and check affected count if we use query.
        // Wait, for TypeORM query on postgres: `result[1]` is affected rows.
        throw new BadRequestException('Insufficient stock.');
      }

      const transaction = this.stockTransactionRepository.create({
        inventoryItemId,
        productId: currentBalance.productId,
        sourceBinId: currentBalance.binId,
        transactionType: TransactionType.STOCK_OUT,
        quantity: dto.quantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        reason: dto.reason,
        remarks: dto.remarks || dto.reason,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      // Now set the last_transaction_id
      await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET last_transaction_id = $1 
         WHERE inventory_item_id = $2`,
        [savedTx.id, inventoryItemId],
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      await queryRunner.commitTransaction();

      this.triggerMslCheck(currentBalance?.productId || finalBalance?.productId);

      return {
        transaction: savedTx,
        balance: finalBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async stockAdjustment(
    inventoryItemId: string,
    dto: CreateStockAdjustmentDto,
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = await queryRunner.manager.findOne(InventoryItem, {
        where: { id: inventoryItemId },
      });
      if (!item) {
        throw new NotFoundException(
          `Inventory item ${inventoryItemId} not found`,
        );
      }

      const currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      if (!currentBalance) {
        throw new BadRequestException(
          'Insufficient stock (no balance record found).',
        );
      }

      let updateResult;

      if (dto.direction === AdjustmentDirection.INCREASE) {
        updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity + $1, 
               updated_at = NOW() 
           WHERE inventory_item_id = $2`,
          [dto.quantity, inventoryItemId],
        );
      } else if (dto.direction === AdjustmentDirection.DECREASE) {
        updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, 
               updated_at = NOW() 
           WHERE inventory_item_id = $2 AND current_quantity >= $1`,
          [dto.quantity, inventoryItemId],
        );

        if (updateResult[1] === 0) {
          throw new BadRequestException(
            'Insufficient stock for adjustment decrease.',
          );
        }
      } else {
        throw new BadRequestException('Invalid adjustment direction.');
      }

      const transaction = this.stockTransactionRepository.create({
        inventoryItemId,
        productId: currentBalance.productId,
        sourceBinId:
          dto.direction === AdjustmentDirection.DECREASE
            ? currentBalance.binId
            : undefined,
        destinationBinId:
          dto.direction === AdjustmentDirection.INCREASE
            ? currentBalance.binId
            : undefined,
        transactionType: TransactionType.ADJUSTMENT,
        quantity: dto.quantity,
        adjustmentDirection: dto.direction,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        remarks: dto.remarks,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET last_transaction_id = $1 
         WHERE inventory_item_id = $2`,
        [savedTx.id, inventoryItemId],
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      await queryRunner.commitTransaction();

      this.triggerMslCheck(currentBalance?.productId || finalBalance?.productId);

      return {
        transaction: savedTx,
        balance: finalBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async modernStockIn(dto: ModernStockInDto, userId: string, customTxType?: TransactionType) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found`);
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: dto.binId },
      });
      if (!bin) {
        throw new NotFoundException(`Bin ${dto.binId} not found`);
      }

      let balance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: dto.productId, binId: dto.binId },
      });

      if (!balance) {
        balance = this.stockBalanceRepository.create({
          productId: dto.productId,
          binId: dto.binId,
          currentQuantity: 0,
          openingBalance: 0,
        });
        await queryRunner.manager.save(balance);
      }

      const transaction = this.stockTransactionRepository.create({
        productId: dto.productId,
        destinationBinId: dto.binId,
        transactionType: customTxType || TransactionType.STOCK_IN,
        quantity: dto.quantity,
        referenceType: dto.referenceType || 'MANUAL',
        referenceId: dto.referenceId,
        reason: dto.reason,
        remarks: dto.remarks || dto.reason,
        lotBatchNumber: dto.lotBatchNumber,
        cost: dto.cost,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET current_quantity = current_quantity + $1, 
             last_transaction_id = $2, 
             updated_at = NOW() 
         WHERE product_id = $3 AND bin_id = $4`,
        [dto.quantity, savedTx.id, dto.productId, dto.binId],
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: dto.productId, binId: dto.binId },
        relations: { product: true, bin: true },
      });

      await queryRunner.commitTransaction();

      this.triggerMslCheck(dto.productId);

      return {
        transaction: savedTx,
        balance: finalBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async modernStockOut(dto: ModernStockOutDto, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found`);
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: dto.binId },
      });
      if (!bin) {
        throw new NotFoundException(`Bin ${dto.binId} not found`);
      }

      const currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: dto.productId, binId: dto.binId },
      });

      if (!currentBalance || Number(currentBalance.currentQuantity) < dto.quantity) {
        throw new BadRequestException('Insufficient stock.');
      }

      const transaction = this.stockTransactionRepository.create({
        productId: dto.productId,
        sourceBinId: dto.binId,
        transactionType: TransactionType.STOCK_OUT,
        quantity: dto.quantity,
        referenceType: dto.referenceType || 'MANUAL',
        referenceId: dto.referenceId,
        reason: dto.reason,
        remarks: dto.remarks || dto.reason,
        lotBatchNumber: dto.lotBatchNumber,
        cost: dto.cost,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      const updateResult = await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET current_quantity = current_quantity - $1, 
             last_transaction_id = $2, 
             updated_at = NOW() 
         WHERE product_id = $3 AND bin_id = $4 AND current_quantity >= $1`,
        [dto.quantity, savedTx.id, dto.productId, dto.binId],
      );

      if (updateResult[1] === 0) {
        throw new BadRequestException('Insufficient stock.');
      }

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: dto.productId, binId: dto.binId },
        relations: { product: true, bin: true },
      });

      await queryRunner.commitTransaction();

      this.triggerMslCheck(dto.productId);

      return {
        transaction: savedTx,
        balance: finalBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async modernStockAdjustment(dto: ModernStockAdjustmentDto, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found`);
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: dto.binId },
      });
      if (!bin) {
        throw new NotFoundException(`Bin ${dto.binId} not found`);
      }

      let currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: dto.productId, binId: dto.binId },
      });

      if (!currentBalance && dto.direction === AdjustmentDirection.INCREASE) {
        currentBalance = this.stockBalanceRepository.create({
          productId: dto.productId,
          binId: dto.binId,
          currentQuantity: 0,
          openingBalance: 0,
        });
        await queryRunner.manager.save(currentBalance);
      } else if (!currentBalance && dto.direction === AdjustmentDirection.DECREASE) {
        throw new BadRequestException('Insufficient stock for adjustment decrease.');
      }

      if (
        dto.direction === AdjustmentDirection.DECREASE &&
        Number(currentBalance?.currentQuantity || 0) < dto.quantity
      ) {
        throw new BadRequestException('Insufficient stock for adjustment decrease.');
      }

      const transaction = this.stockTransactionRepository.create({
        productId: dto.productId,
        sourceBinId: dto.direction === AdjustmentDirection.DECREASE ? dto.binId : undefined,
        destinationBinId: dto.direction === AdjustmentDirection.INCREASE ? dto.binId : undefined,
        transactionType: TransactionType.ADJUSTMENT,
        adjustmentDirection: dto.direction,
        quantity: dto.quantity,
        referenceType: dto.referenceType || 'MANUAL',
        referenceId: dto.referenceId,
        reason: dto.reason,
        remarks: dto.remarks || dto.reason,
        lotBatchNumber: dto.lotBatchNumber,
        cost: dto.cost,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      if (dto.direction === AdjustmentDirection.INCREASE) {
        await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity + $1, 
               last_transaction_id = $2, 
               updated_at = NOW() 
           WHERE product_id = $3 AND bin_id = $4`,
          [dto.quantity, savedTx.id, dto.productId, dto.binId],
        );
      } else if (dto.direction === AdjustmentDirection.DECREASE) {
        const updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, 
               last_transaction_id = $2, 
               updated_at = NOW() 
           WHERE product_id = $3 AND bin_id = $4 AND current_quantity >= $1`,
          [dto.quantity, savedTx.id, dto.productId, dto.binId],
        );

        if (updateResult[1] === 0) {
          throw new BadRequestException('Insufficient stock for adjustment decrease.');
        }
      } else {
        throw new BadRequestException('Invalid adjustment direction.');
      }

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { productId: dto.productId, binId: dto.binId },
        relations: { product: true, bin: true },
      });

      await queryRunner.commitTransaction();

      this.triggerMslCheck(dto.productId);

      return {
        transaction: savedTx,
        balance: finalBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
