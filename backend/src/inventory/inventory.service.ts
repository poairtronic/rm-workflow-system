import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction, TransactionType, AdjustmentDirection } from './entities/stock-transaction.entity.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto.js';
import { CreateStockInDto } from './dto/create-stock-in.dto.js';
import { CreateStockOutDto } from './dto/create-stock-out.dto.js';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto.js';
import { GetInventoryFilterDto, StockStatusFilter } from './dto/get-inventory-filter.dto.js';
import { GetTransactionFilterDto } from './dto/get-transaction-filter.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';
import { ReconciliationResultDto, ReconciliationStatus } from './dto/reconciliation-result.dto.js';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepository: Repository<StockBalance>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(filterDto?: GetInventoryFilterDto): Promise<PaginatedResponseDto<InventoryItem>> {
    const { search, stockStatus, isActive, page = 1, pageSize = 10 } = filterDto || {};
    
    const query = this.inventoryItemRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.stockBalance', 'balance')
      .orderBy('item.material', 'ASC')
      .addOrderBy('item.size', 'ASC');

    if (search) {
      const searchPattern = `%${search}%`;
      query.andWhere(
        '(item.material ILIKE :search OR item.materialType ILIKE :search OR item.grade ILIKE :search OR item.size ILIKE :search)',
        { search: searchPattern }
      );
    }

    if (isActive !== undefined) {
      query.andWhere('item.isActive = :isActive', { isActive });
    }

    if (stockStatus) {
      if (stockStatus === StockStatusFilter.LOW_STOCK) {
        query.andWhere('COALESCE(balance.current_quantity, 0) < item.minimum_stock_level');
      } else if (stockStatus === StockStatusFilter.NORMAL) {
        query.andWhere('COALESCE(balance.current_quantity, 0) >= item.minimum_stock_level');
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
        throw new ConflictException('An inventory item with this exact combination of material, type, grade, and size already exists.');
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
        throw new ConflictException('An inventory item with this exact combination of material, type, grade, and size already exists.');
      }
      throw error;
    }
  }

  async getStockBalance(inventoryItemId: string) {
    const balance = await this.stockBalanceRepository.findOne({
      where: { inventoryItemId },
    });
    if (!balance) {
      throw new NotFoundException(`Stock balance for item ${inventoryItemId} not found`);
    }
    return balance;
  }

  async getTransactions(inventoryItemId: string, filterDto?: GetTransactionFilterDto): Promise<PaginatedResponseDto<StockTransaction>> {
    const { transactionType, adjustmentDirection, startDate, endDate, page = 1, pageSize = 10 } = filterDto || {};

    const query = this.stockTransactionRepository.createQueryBuilder('tx')
      .where('tx.inventory_item_id = :inventoryItemId', { inventoryItemId })
      .leftJoin('tx.createdBy', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .orderBy('tx.createdAt', 'DESC')
      .addOrderBy('tx.id', 'DESC');

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

  async getReconciliation(inventoryItemId?: string): Promise<ReconciliationResultDto[]> {
    const query = this.inventoryItemRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.stockBalance', 'balance');

    if (inventoryItemId) {
      query.where('item.id = :id', { id: inventoryItemId });
    }

    const items = await query.getMany();

    const txQuery = this.stockTransactionRepository.createQueryBuilder('tx')
      .select('tx.inventory_item_id', 'inventoryItemId')
      .addSelect(`SUM(CASE WHEN tx.transaction_type = 'STOCK_IN' OR (tx.transaction_type = 'ADJUSTMENT' AND tx.adjustment_direction = 'INCREASE') THEN tx.quantity ELSE 0 END)`, 'totalIn')
      .addSelect(`SUM(CASE WHEN tx.transaction_type = 'STOCK_OUT' OR (tx.transaction_type = 'ADJUSTMENT' AND tx.adjustment_direction = 'DECREASE') THEN tx.quantity ELSE 0 END)`, 'totalOut');

    if (inventoryItemId) {
      txQuery.where('tx.inventory_item_id = :id', { id: inventoryItemId });
    }

    const aggregations = await txQuery
      .groupBy('tx.inventory_item_id')
      .getRawMany();

    const aggMap = new Map<string, { totalIn: number, totalOut: number }>();
    for (const row of aggregations) {
      aggMap.set(row.inventoryItemId, {
        totalIn: parseFloat(row.totalIn) || 0,
        totalOut: parseFloat(row.totalOut) || 0,
      });
    }

    const results: ReconciliationResultDto[] = items.map(item => {
      const balance = item.stockBalance;
      const agg = aggMap.get(item.id) || { totalIn: 0, totalOut: 0 };
      
      const ledgerMovement = agg.totalIn - agg.totalOut;

      let status = ReconciliationStatus.NOT_RECONCILABLE;
      let reason: string | undefined = undefined;
      let expectedBalance: number | null = null;
      let difference: number | null = null;

      if (!balance) {
        reason = 'MISSING_BALANCE';
      } else if (balance.openingBalance === null || balance.openingBalance === undefined) {
        reason = 'OPENING_BASELINE_MISSING';
      } else {
        const currentBalance = Number(balance.currentQuantity);
        const opening = Number(balance.openingBalance);
        expectedBalance = opening + ledgerMovement;
        difference = currentBalance - expectedBalance;

        // Decimal safe comparison up to 3 decimal places
        if (Math.abs(difference) < 0.0005) {
          status = ReconciliationStatus.MATCH;
          difference = 0; // Normalize to exact 0
        } else {
          status = ReconciliationStatus.MISMATCH;
        }
      }

      return {
        inventoryItemId: item.id,
        material: item.material,
        grade: item.grade,
        size: item.size,
        currentBalance: balance ? Number(balance.currentQuantity) : 0,
        ledgerMovement: ledgerMovement,
        openingBalance: balance?.openingBalance !== null && balance?.openingBalance !== undefined ? Number(balance.openingBalance) : null,
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
      .select('tx.source_bin_id', 'sourceBinId')
      .addSelect('tx.destination_bin_id', 'destinationBinId')
      .addSelect('tx.transaction_type', 'type')
      .addSelect('SUM(tx.quantity)', 'total')
      .groupBy('tx.source_bin_id')
      .addGroupBy('tx.destination_bin_id')
      .addGroupBy('tx.transaction_type')
      .getRawMany();

    const binReconResults = binBalances.map((b) => {
      const currentQty = Number(b.currentQuantity) || 0;
      const binId = b.binId;

      let inQty = 0;
      let outQty = 0;

      for (const row of txAgg) {
        const qty = parseFloat(row.total) || 0;
        if (row.destinationBinId === binId && (row.type === 'STOCK_IN' || row.type === 'RETURN')) {
          inQty += qty;
        }
        if (row.sourceBinId === binId && (row.type === 'STOCK_OUT' || row.type === 'STORES_ISSUE')) {
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
      reconciliationStatus: binReconResults.every((r) => r.status === 'MATCH') ? 'CLEAN' : 'DISCREPANCY_DETECTED',
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
        throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
      }

      // 2. Create the transaction record
      const transaction = this.stockTransactionRepository.create({
        ...createTxDto,
        inventoryItemId,
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
        throw new BadRequestException('ADJUSTMENT transaction type logic needs explicit delta specification');
      }

      if (mathOperator) {
        await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity ${mathOperator} $1, 
               last_transaction_id = $2, 
               updated_at = NOW() 
           WHERE inventory_item_id = $3`,
          [quantity, savedTx.id, inventoryItemId]
        );
      }

      await queryRunner.commitTransaction();
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
        throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
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
        transactionType: TransactionType.STOCK_IN,
        quantity: dto.quantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        remarks: dto.remarks,
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
        [dto.quantity, savedTx.id, inventoryItemId]
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      if (!finalBalance) {
        throw new BadRequestException('Failed to update stock balance atomically');
      }

      await queryRunner.commitTransaction();
      
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
        throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
      }

      // We don't auto-create balance for stockOut; it must exist and have enough stock.
      const currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });
      
      if (!currentBalance) {
        throw new BadRequestException('Insufficient stock (no balance record found).');
      }

      // Atomic stock decrement check and update
      const updateResult = await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET current_quantity = current_quantity - $1, 
             updated_at = NOW() 
         WHERE inventory_item_id = $2 AND current_quantity >= $1`,
        [dto.quantity, inventoryItemId]
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
        transactionType: TransactionType.STOCK_OUT,
        quantity: dto.quantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        remarks: dto.remarks,
        createdById: userId,
      });
      const savedTx = await queryRunner.manager.save(transaction);

      // Now set the last_transaction_id
      await queryRunner.manager.query(
        `UPDATE stock_balances 
         SET last_transaction_id = $1 
         WHERE inventory_item_id = $2`,
        [savedTx.id, inventoryItemId]
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      await queryRunner.commitTransaction();
      
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
        throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
      }

      const currentBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });
      
      if (!currentBalance) {
        throw new BadRequestException('Insufficient stock (no balance record found).');
      }

      let updateResult;

      if (dto.direction === AdjustmentDirection.INCREASE) {
        updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity + $1, 
               updated_at = NOW() 
           WHERE inventory_item_id = $2`,
          [dto.quantity, inventoryItemId]
        );
      } else if (dto.direction === AdjustmentDirection.DECREASE) {
        updateResult = await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, 
               updated_at = NOW() 
           WHERE inventory_item_id = $2 AND current_quantity >= $1`,
          [dto.quantity, inventoryItemId]
        );

        if (updateResult[1] === 0) {
          throw new BadRequestException('Insufficient stock for adjustment decrease.');
        }
      } else {
        throw new BadRequestException('Invalid adjustment direction.');
      }

      const transaction = this.stockTransactionRepository.create({
        inventoryItemId,
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
        [savedTx.id, inventoryItemId]
      );

      const finalBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });

      await queryRunner.commitTransaction();
      
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
