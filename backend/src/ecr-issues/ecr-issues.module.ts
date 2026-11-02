import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcrMaterialPending } from './entities/ecr-material-pending.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialIssueItem } from '../material-issue/entities/material-issue-item.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EcrIssuesController } from './ecr-issues.controller.js';
import { EcrIssuesService } from './ecr-issues.service.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EcrMaterialPending,
      User,
      Notification,
      Product,
      StockBalance,
      Bin,
      Rack,
      StockTransaction,
      SalesOrderComponent,
      MaterialIssue,
      MaterialIssueItem,
      RmItem,
      RmRequest,
    ]),
    NotificationsModule,
  ],
  controllers: [EcrIssuesController],
  providers: [EcrIssuesService, InternalSecretGuard],
  exports: [EcrIssuesService],
})
export class EcrIssuesModule {}

export default EcrIssuesModule;
