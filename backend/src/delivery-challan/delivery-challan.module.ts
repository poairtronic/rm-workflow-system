import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryChallan } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem } from './entities/dc-rework-item.entity.js';
import { DeliveryChallanController } from './delivery-challan.controller.js';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryChallan,
      DeliveryChallanItem,
      DcMovement,
      DcQcInspection,
      DcReworkItem,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [DeliveryChallanController],
  providers: [DeliveryChallanService],
  exports: [DeliveryChallanService],
})
export class DeliveryChallanModule {}
