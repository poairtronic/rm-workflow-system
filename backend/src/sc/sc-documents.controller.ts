import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { AttachmentContext } from '../attachments/entities/attachment.entity.js';
import { CreateProductionDocumentDto } from './dto/production-document.dto.js';

@Controller('api/sc/:scId/production-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScDocumentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION)
  async attachDocument(
    @Param('scId', ParseUUIDPipe) scId: string,
    @Body() dto: CreateProductionDocumentDto,
    @Req() req: any,
  ) {
    return this.attachmentsService.attach(
      {
        fileId: dto.fileId,
        context: AttachmentContext.PRODUCTION,
        recordId: scId,
        documentType: dto.documentType,
      },
      req.user.userId,
      req.user.roles[0], // Or req.user.role if it's string, we know strategy returns roles array. Let's use roles[0] just like we did in test. Wait, attachmentsService expects userRole.
    );
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async listDocuments(@Param('scId', ParseUUIDPipe) scId: string) {
    return this.attachmentsService.list(AttachmentContext.PRODUCTION, scId);
  }

  @Get(':attachmentId')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getDocument(
    @Param('scId', ParseUUIDPipe) scId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (attachment.recordId !== scId || attachment.context !== AttachmentContext.PRODUCTION) {
      throw new NotFoundException('Attachment not found for this SC');
    }
    return attachment;
  }

  @Delete(':attachmentId')
  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION)
  async detachDocument(
    @Param('scId', ParseUUIDPipe) scId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: any,
  ) {
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (attachment.recordId !== scId || attachment.context !== AttachmentContext.PRODUCTION) {
      throw new NotFoundException('Attachment not found for this SC');
    }
    
    // We pass req.user.roles[0] because attachmentsService.detach requires it to re-validate SC ownership/roles.
    await this.attachmentsService.detach(attachmentId, req.user.userId, req.user.roles[0]);
    return { success: true };
  }
}
