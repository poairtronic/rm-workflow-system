import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneralIssueController } from './general-issue.controller.js';
import { GeneralIssueService } from './general-issue.service.js';
import { GeneralIssue } from './entities/general-issue.entity.js';
import { GeneralIssueItem } from './entities/general-issue-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeneralIssue,
      GeneralIssueItem,
      Product,
      Bin,
      StockBalance,
      StockTransaction,
    ]),
    InventoryModule,
  ],
  controllers: [GeneralIssueController],
  providers: [GeneralIssueService],
  exports: [GeneralIssueService],
})
export class GeneralIssueModule {}
