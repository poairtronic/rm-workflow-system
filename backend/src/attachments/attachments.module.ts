import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { Attachment } from './entities/attachment.entity.js';
import { FilesModule } from '../files/files.module.js';
import { PoModule } from '../po/po.module.js';
import { ScModule } from '../sc/sc.module.js';
import { RmModule } from '../rm/rm.module.js';
import { AdditionalRequestModule } from '../additional-request/additional-request.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    FilesModule,
    forwardRef(() => PoModule),
    forwardRef(() => ScModule),
    forwardRef(() => RmModule),
    forwardRef(() => AdditionalRequestModule),
    AuthModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
