import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';

import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { DeliveryChallan } from '../delivery-challan/entities/delivery-challan.entity.js';
import { FilesModule } from '../files/files.module.js';
import { ExcelReportService } from './excel/excel-report.service.js';
import { PdfGeneratorService } from './pdf/pdf-generator.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RmRequest,
      RmItem,
      SalesOrderComponent,
      MaterialIssue,
      MaterialConsumption,
      StockBalance,
      StockTransaction,
      DeliveryChallan,
    ]),
    FilesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ExcelReportService, PdfGeneratorService],
  exports: [ReportsService, ExcelReportService, PdfGeneratorService],
})
export class ReportsModule {}

