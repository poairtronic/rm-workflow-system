import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsController } from './dashboards.controller.js';
import { DashboardsService } from './dashboards.service.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { AdditionalMaterialRequest } from '../additional-request/entities/additional-request.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RmRequest,
      SalesOrderComponent,
      MaterialIssue,
      AdditionalMaterialRequest,
    ]),
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}

