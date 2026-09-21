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
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { RmService } from './rm.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreateRmDto, CreateRmItemDto, SubmitRmDto } from './dto/rm.dto.js';
import { StoresReviewRmDto } from './dto/stores-review.dto.js';
import { RmRequestStatus } from './entities/rm-request.entity.js';
import { CreateRmDocumentDto } from './dto/create-rm-document.dto.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { FilesService } from '../files/files.service.js';
import { AttachmentContext } from '../attachments/entities/attachment.entity.js';

@Controller('api/rm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RmController {
  constructor(
    private readonly rmService: RmService,
    @Inject(forwardRef(() => AttachmentsService))
    private readonly attachmentsService: AttachmentsService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  createRm(@Body() dto: CreateRmDto, @Req() req: any) {
    return this.rmService.createRm(dto, req.user.userId);
  }

  @Post(':id/items')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  addRmItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRmItemDto,
  ) {
    return this.rmService.addRmItem(id, dto);
  }

  @Post(':id/submit')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  submitRm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitRmDto) {
    return this.rmService.submitRm(id, dto);
  }

  @Post(':id/review')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  reviewRm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StoresReviewRmDto,
    @Req() req: any,
  ) {
    return this.rmService.reviewRm(id, dto, req.user.userId);
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
    @Query('scId') scId?: string,
    @Query('status') status?: RmRequestStatus,
  ) {
    return this.rmService.findAll({ scId, status });
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
    return this.rmService.findOne(id);
  }

  @Post(':id/documents')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  async attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRmDocumentDto,
    @Req() req: any,
  ) {
    await this.rmService.findOne(id);
    return this.attachmentsService.attach(
      {
        fileId: dto.fileId,
        context: AttachmentContext.RM_REQUEST,
        recordId: id,
        documentType: dto.documentType,
      },
      req.user.userId,
      req.user.role,
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
    await this.rmService.findOne(id);
    return this.attachmentsService.list(AttachmentContext.RM_REQUEST, id);
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
    await this.rmService.findOne(id);
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (
      attachment.context !== AttachmentContext.RM_REQUEST ||
      attachment.recordId !== id
    ) {
      throw new NotFoundException(
        `Attachment ${attachmentId} does not belong to RM Request ${id}.`,
      );
    }
    const url = await this.filesService.getFileDownloadUrl(attachment.fileId);
    return { url };
  }

  @Delete(':id/documents/:attachmentId')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  async detachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: any,
  ) {
    await this.rmService.findOne(id);
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (
      attachment.context !== AttachmentContext.RM_REQUEST ||
      attachment.recordId !== id
    ) {
      throw new NotFoundException(
        `Attachment ${attachmentId} does not belong to RM Request ${id}.`,
      );
    }
    return this.attachmentsService.detach(
      attachmentId,
      req.user.userId,
      req.user.role,
    );
  }
}

