import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { AttachmentContext } from './entities/attachment.entity.js';

@Controller('api/attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  createAttachment(@Body() dto: CreateAttachmentDto, @Req() req: any) {
    return this.attachmentsService.attach(dto, req.user.userId, req.user.role);
  }

  @Get()
  listAttachments(
    @Query('context') context: string,
    @Query('recordId', ParseUUIDPipe) recordId: string,
  ) {
    if (!context || !Object.values(AttachmentContext).includes(context as AttachmentContext)) {
      throw new BadRequestException('Valid context is required');
    }
    return this.attachmentsService.list(context as AttachmentContext, recordId);
  }

  @Get(':id')
  getAttachment(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.findOne(id);
  }

  @Delete(':id')
  detachAttachment(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.attachmentsService.detach(id, req.user.userId, req.user.role);
  }
}
