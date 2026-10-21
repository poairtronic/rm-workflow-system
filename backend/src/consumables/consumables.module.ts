import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConsumableRequest } from './entities/consumable-request.entity.js';
import { ConsumableRequestItem } from './entities/consumable-request-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';

import { ConsumablesService } from './consumables.service.js';
import { ConsumablesController } from './consumables.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConsumableRequest,
      ConsumableRequestItem,
      Product,
      ProductCategory,
      ProductFamily,
      Vendor,
      Bin,
      StockBalance,
      StockTransaction,
    ]),
  ],
  controllers: [ConsumablesController],
  providers: [ConsumablesService],
  exports: [ConsumablesService],
})
export class ConsumablesModule {}

