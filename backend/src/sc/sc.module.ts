import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrderComponent } from './entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { ScService } from './sc.service.js';
import { ScController } from './sc.controller.js';
import { AuthModule } from '../auth/auth.module.js';

import { ProductionModule } from '../production/production.module.js';
import { AdditionalRequestModule } from '../additional-request/additional-request.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { FilesModule } from '../files/files.module.js';
import { forwardRef } from '@nestjs/common';
import { ScDocumentsController } from './sc-documents.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesOrderComponent, PurchaseOrder, Customer]),
    AuthModule,
    ProductionModule,
    AdditionalRequestModule,
    forwardRef(() => AttachmentsModule),
    FilesModule,
  ],
  controllers: [ScController, ScDocumentsController],
  providers: [ScService],
  exports: [ScService],
})
export class ScModule {}
