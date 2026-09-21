import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoController } from './po.controller.js';
import { PoService } from './po.service.js';
import { PurchaseOrder } from './entities/po.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { FilesModule } from '../files/files.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, Customer]),
    AuthModule,
    forwardRef(() => AttachmentsModule),
    FilesModule,
  ],
  controllers: [PoController],
  providers: [PoService],
  exports: [PoService],
})
export class PoModule {}
