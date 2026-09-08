import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from './entities/stock-transaction.entity.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto.js';

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

  async findAll() {
    return this.inventoryItemRepository.find({
      relations: { stockBalance: true },
    });
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
      });
      await queryRunner.manager.save(balance);

      await queryRunner.commitTransaction();
      return this.findOne(savedItem.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, updateDto: UpdateInventoryItemDto) {
    const item = await this.findOne(id);
    Object.assign(item, updateDto);
    return this.inventoryItemRepository.save(item);
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

  async getTransactions(inventoryItemId: string) {
    return this.stockTransactionRepository.find({
      where: { inventoryItemId },
      order: { createdAt: 'DESC' },
      relations: { createdBy: true },
    });
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
}
