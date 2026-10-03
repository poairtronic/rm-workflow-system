import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TraceabilityController } from './traceability.controller.js';
import { TraceabilityService } from './traceability.service.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialReceipt } from '../production/entities/production-receipt.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../production/entities/material-return.entity.js';
import { AdditionalMaterialRequest } from '../additional-request/entities/additional-request.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { DeliveryChallan } from '../delivery-challan/entities/delivery-challan.entity.js';
import { ProductionProcess } from '../production-process/entities/production-process.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { VendorSla } from '../vendor/entities/vendor-sla.entity.js';
import { DeliveryChallanItem } from '../delivery-challan/entities/delivery-challan-item.entity.js';
import { GeneralIssue } from '../general-issue/entities/general-issue.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrderComponent,
      PurchaseOrder,
      RmRequest,
      MaterialIssue,
      MaterialReceipt,
      MaterialConsumption,
      MaterialReturn,
      AdditionalMaterialRequest,
      StockTransaction,
      DeliveryChallan,
      DeliveryChallanItem,
      ProductionProcess,
      Vendor,
      VendorSla,
      GeneralIssue,
    ]),
  ],
  controllers: [TraceabilityController],
  providers: [TraceabilityService],
  exports: [TraceabilityService],
})
export class TraceabilityModule {}
