import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercIndentPending } from './entities/merc-indent-pending.entity.js';
import { MercIndentLineItem } from './entities/merc-indent-line-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MercIndentController } from './merc-indent.controller.js';
import { MercIndentService } from './merc-indent.service.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MercIndentPending,
      MercIndentLineItem,
      Product,
      ProductFamily,
      ProductCategory,
      Bin,
      StockBalance,
      StockTransaction,
      User,
      Notification,
    ]),
    NotificationsModule,
  ],
  controllers: [MercIndentController],
  providers: [MercIndentService, InternalSecretGuard],
  exports: [MercIndentService],
})
export class MercIndentModule {}

export default MercIndentModule;
