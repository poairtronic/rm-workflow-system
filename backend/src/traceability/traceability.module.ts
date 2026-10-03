import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TraceabilityController } from './traceability.controller.js';
import { TraceabilityService } from './traceability.service.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../production/entities/material-return.entity.js';
import { GeneralIssue } from '../general-issue/entities/general-issue.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrderComponent,
      MaterialIssue,
      MaterialConsumption,
      MaterialReturn,
      GeneralIssue,
    ]),
  ],
  controllers: [TraceabilityController],
  providers: [TraceabilityService],
  exports: [TraceabilityService],
})
export class TraceabilityModule {}
