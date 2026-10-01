import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction } from './entities/stock-transaction.entity.js';
import { Product } from './entities/product.entity.js';
import { Bin } from './entities/bin.entity.js';
import { MslAlert } from './entities/msl-alert.entity.js';
import { InventoryController } from './inventory.controller.js';
import { MslController } from './msl.controller.js';
import { InventoryService } from './inventory.service.js';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';
import { MslEngineService } from './msl-engine.service.js';
import { MslCalculationService } from './msl-calculation.service.js';
import { MslAlertService } from './msl-alert.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      StockBalance,
      StockTransaction,
      Product,
      Bin,
      MslAlert,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [MslController, InventoryController],
  providers: [
    InventoryService,
    InventoryReconciliationService,
    MslEngineService,
    MslCalculationService,
    MslAlertService,
  ],
  exports: [
    InventoryService,
    InventoryReconciliationService,
    MslEngineService,
    MslCalculationService,
    MslAlertService,
  ],
})
export class InventoryModule {}
