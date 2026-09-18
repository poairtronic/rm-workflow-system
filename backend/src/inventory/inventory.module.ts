import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction } from './entities/stock-transaction.entity.js';
import { Product } from './entities/product.entity.js';
import { Bin } from './entities/bin.entity.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      StockBalance,
      StockTransaction,
      Product,
      Bin,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryReconciliationService],
  exports: [InventoryService, InventoryReconciliationService],
})
export class InventoryModule {}
