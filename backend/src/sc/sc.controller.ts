import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { ScService } from './sc.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreateScDto, CompleteScDto, CloseScDto } from './dto/sc.dto.js';
import { ScStatus } from './entities/sc.entity.js';
import { CreateScSupportingDocumentDto } from './dto/create-sc-supporting-document.dto.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { FilesService } from '../files/files.service.js';
import { AttachmentContext } from '../attachments/entities/attachment.entity.js';

@Controller('api/sc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScController {
  constructor(
    private readonly scService: ScService,
    @Inject(forwardRef(() => AttachmentsService))
    private readonly attachmentsService: AttachmentsService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES)
  createSc(@Body() dto: CreateScDto) {
    return this.scService.createSc(dto);
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
  findAll(
    @Query('poId') poId?: string,
    @Query('scNumber') scNumber?: string,
    @Query('status') status?: ScStatus,
    @Query('search') search?: string,
  ) {
    return this.scService.findAll({ poId, scNumber, status, search });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scService.findOne(id);
  }

  @Post(':id/complete')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN)
  completeSc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteScDto,
    @Req() req: any,
  ) {
    return this.scService.completeSc(id, req.user.userId, dto);
  }

  @Post(':id/close')
  @Roles(UserRole.STORES, UserRole.PRODUCTION, UserRole.ADMIN)
  closeSc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseScDto,
    @Req() req: any,
  ) {
    return this.scService.closeSc(id, req.user.userId, dto);
  }

  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION)
  async attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateScSupportingDocumentDto,
    @Req() req: any,
  ) {
    await this.scService.findOne(id);
    const userRole = req.user.role || req.user.roles?.[0];
    return this.attachmentsService.attach(
      {
        fileId: dto.fileId,
        context: AttachmentContext.SC,
        recordId: id,
        documentType: dto.documentType,
      },
      req.user.userId,
      userRole,
    );
  }

  @Get(':id/documents')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    await this.scService.findOne(id);
    return this.attachmentsService.list(AttachmentContext.SC, id);
  }

  @Get(':id/documents/:attachmentId/download')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.scService.findOne(id);
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (
      attachment.context !== AttachmentContext.SC ||
      attachment.recordId !== id
    ) {
      throw new NotFoundException(
        `Attachment ${attachmentId} does not belong to SC ${id}.`,
      );
    }
    const url = await this.filesService.getFileDownloadUrl(attachment.fileId);
    return { url };
  }

  @Delete(':id/documents/:attachmentId')
  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION)
  async detachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: any,
  ) {
    await this.scService.findOne(id);
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (
      attachment.context !== AttachmentContext.SC ||
      attachment.recordId !== id
    ) {
      throw new NotFoundException(
        `Attachment ${attachmentId} does not belong to SC ${id}.`,
      );
    }
    const userRole = req.user.role || req.user.roles?.[0];
    return this.attachmentsService.detach(attachmentId, req.user.userId, userRole);
  }
}

