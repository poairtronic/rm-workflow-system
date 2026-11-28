import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConsumableRequest } from './entities/consumable-request.entity.js';
import { ConsumableRequestItem } from './entities/consumable-request-item.entity.js';
import { ConsumableLineAttachment } from './entities/consumable-line-attachment.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { SystemSetting } from '../notifications/entities/system-setting.entity.js';

import { ConsumablesService } from './consumables.service.js';
import { ConsumablesBatchNotificationService } from './consumables-batch-notification.service.js';
import { ConsumableAttachmentsService } from './consumable-attachments.service.js';
import { ConsumablesController } from './consumables.controller.js';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { EmailModule } from '../email/email.module.js';
import { PdfGeneratorService } from '../reports/pdf/pdf-generator.service.js';
import { FilesModule } from '../files/files.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConsumableRequest,
      ConsumableRequestItem,
      ConsumableLineAttachment,
      Product,
      ProductCategory,
      ProductFamily,
      Vendor,
      Bin,
      StockBalance,
      StockTransaction,
      User,
      Role,
      SystemSetting,
    ]),
    NotificationsModule,
    forwardRef(() => EmailModule),
    FilesModule,
    AuditModule,
  ],
  controllers: [ConsumablesController],
  providers: [ConsumablesService, ConsumableAttachmentsService, PdfGeneratorService, ConsumablesBatchNotificationService],
  exports: [ConsumablesService, ConsumableAttachmentsService, ConsumablesBatchNotificationService],
})
export class ConsumablesModule {}

