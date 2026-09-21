import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { PoService } from './po.service.js';
import { CreatePoDto } from './dto/create-po.dto.js';
import { UpdatePoDto } from './dto/update-po.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreatePoDocumentDto } from './dto/create-po-document.dto.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { FilesService } from '../files/files.service.js';
import { AttachmentContext } from '../attachments/entities/attachment.entity.js';

@Controller('api/po')
export class PoController {
  constructor(
    private readonly poService: PoService,
    @Inject(forwardRef(() => AttachmentsService))
    private readonly attachmentsService: AttachmentsService,
    private readonly filesService: FilesService,
  ) {}

  @Get('status')
  getStatus() {
    return this.poService.getStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  create(@Body() createPoDto: CreatePoDto) {
    return this.poService.create(createPoDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findAll() {
    return this.poService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.poService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePoDto: UpdatePoDto,
  ) {
    return this.poService.update(id, updatePoDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  async attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePoDocumentDto,
    @Req() req: any,
  ) {
    await this.poService.findOne(id);
    const userRole = req.user.role || req.user.roles?.[0];
    return this.attachmentsService.attach(
      {
        fileId: dto.fileId,
        context: AttachmentContext.PO,
        recordId: id,
        documentType: dto.documentType,
      },
      req.user.userId,
      userRole,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/documents')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    await this.poService.findOne(id);
    return this.attachmentsService.list(AttachmentContext.PO, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/documents/:attachmentId/download')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.poService.findOne(id);
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (
      attachment.context !== AttachmentContext.PO ||
      attachment.recordId !== id
    ) {
      throw new NotFoundException(
        `Attachment ${attachmentId} does not belong to PO ${id}.`,
      );
    }
    const url = await this.filesService.getFileDownloadUrl(attachment.fileId);
    return { url };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/documents/:attachmentId')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  async detachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: any,
  ) {
    await this.poService.findOne(id);
    const attachment = await this.attachmentsService.findOne(attachmentId);
    if (
      attachment.context !== AttachmentContext.PO ||
      attachment.recordId !== id
    ) {
      throw new NotFoundException(
        `Attachment ${attachmentId} does not belong to PO ${id}.`,
      );
    }
    const userRole = req.user.role || req.user.roles?.[0];
    return this.attachmentsService.detach(attachmentId, req.user.userId, userRole);
  }
}

