import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdditionalRequestController } from './additional-request.controller.js';
import { AdditionalRequestService } from './additional-request.service.js';
import { AdditionalMaterialRequest } from './entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from './entities/additional-request-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdditionalMaterialRequest,
      AdditionalMaterialRequestItem,
      SalesOrderComponent,
      RmItem,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [AdditionalRequestController],
  providers: [AdditionalRequestService],
  exports: [AdditionalRequestService],
})
export class AdditionalRequestModule {}
