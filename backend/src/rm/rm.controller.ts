import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { CreateDraftRmDto, UpdateDraftRmDto } from './dto/draft-rm.dto.js';
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

  @Post('draft')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  createDraftRm(@Body() dto: CreateDraftRmDto, @Req() req: any) {
    return this.rmService.createDraftRm(dto, req.user);
  }

  @Get('po/:poId/draft')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  getDraftRmByPo(@Param('poId', ParseUUIDPipe) poId: string, @Req() req: any) {
    return this.rmService.getDraftRmByPo(poId, req.user);
  }

  @Put('po/:poId/draft')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  updateDraftRm(@Param('poId', ParseUUIDPipe) poId: string, @Body() dto: UpdateDraftRmDto, @Req() req: any) {
    return this.rmService.updateDraftRm(poId, dto, req.user);
  }

  @Post('po/:poId/submit')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  submitDraftRmByPo(@Param('poId', ParseUUIDPipe) poId: string, @Req() req: any) {
    return this.rmService.submitDraftRmByPo(poId, req.user);
  }

  @Get('mine')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  getMine(@Req() req: any) {
    return this.rmService.getMine(req.user);
  }

  @Get('stores/queue')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  getStoresQueue() {
    return this.rmService.getStoresQueue();
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
    @Req() req?: any,
  ) {
    return this.rmService.findAll({ scId, status }, req?.user);
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
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req?: any) {
    return this.rmService.findOne(id, req?.user);
  }

  @Delete(':id')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  deleteRm(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.rmService.deleteRm(id, req.user);
  }

  @Delete(':id/items/:itemId')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  deleteRmItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: any,
  ) {
    return this.rmService.deleteRmItem(id, itemId, req.user);
  }

  @Patch(':id/items/:itemId')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  updateRmItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    return this.rmService.updateRmItem(id, itemId, dto, req.user);
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

