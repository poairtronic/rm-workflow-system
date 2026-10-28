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
import { UploadedFile } from '../files/entities/uploaded-file.entity.js';
import { Attachment } from '../attachments/entities/attachment.entity.js';
import { PdfGeneratorService } from '../reports/pdf/pdf-generator.service.js';
import { FilesModule } from '../files/files.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryChallan,
      DeliveryChallanItem,
      DcMovement,
      DcQcInspection,
      DcReworkItem,
      UploadedFile,
      Attachment,
    ]),
    AuthModule,
    NotificationsModule,
    FilesModule,
  ],
  controllers: [DeliveryChallanController],
  providers: [DeliveryChallanService, PdfGeneratorService],
  exports: [DeliveryChallanService],
})
export class DeliveryChallanModule {}
