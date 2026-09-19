import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ProductionController } from './production.controller.js';
import { ProductionService } from './production.service.js';
import { MaterialReceipt } from './entities/production-receipt.entity.js';
import { MaterialReceiptItem } from './entities/material-receipt-item.entity.js';
import { MaterialConsumption } from './entities/material-consumption.entity.js';
import { MaterialReturn } from './entities/material-return.entity.js';
import { MaterialReturnItem } from './entities/material-return-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialReceipt,
      MaterialReceiptItem,
      MaterialConsumption,
      MaterialReturn,
      MaterialReturnItem,
      SalesOrderComponent,
      MaterialIssue,
      RmItem,
      Bin,
    ]),
    AuthModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
