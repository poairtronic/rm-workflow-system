import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RmRequest,
      RmItem,
      SalesOrderComponent,
      MaterialIssue,
      MaterialConsumption
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

