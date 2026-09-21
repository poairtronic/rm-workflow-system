import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { RmRequest } from './entities/rm-request.entity.js';
import { RmItem } from './entities/rm-item.entity.js';
import { RmFormSc } from './entities/rm-form-sc.entity.js';
import { RmItemSnapshot } from './entities/rm-item-snapshot.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmService } from './rm.service.js';
import { RmController } from './rm.controller.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { FilesModule } from '../files/files.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RmRequest,
      RmItem,
      RmFormSc,
      RmItemSnapshot,
      SalesOrderComponent,
    ]),
    AuthModule,
    forwardRef(() => AttachmentsModule),
    FilesModule,
  ],
  controllers: [RmController],
  providers: [RmService],
  exports: [RmService],
})
export class RmModule {}
