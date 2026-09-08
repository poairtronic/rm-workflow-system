import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction } from './entities/stock-transaction.entity.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      StockBalance,
      StockTransaction,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
