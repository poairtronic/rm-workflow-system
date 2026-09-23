import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MaterialIssueController } from './material-issue.controller.js';
import { MaterialIssueService } from './material-issue.service.js';
import { MaterialIssue } from './entities/material-issue.entity.js';
import { MaterialIssueItem } from './entities/material-issue-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialIssue,
      MaterialIssueItem,
      SalesOrderComponent,
      RmItem,
      Bin,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [MaterialIssueController],
  providers: [MaterialIssueService],
  exports: [MaterialIssueService],
})
export class MaterialIssueModule {}
