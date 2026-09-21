import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment, AttachmentContext } from './entities/attachment.entity.js';
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { FilesService } from '../files/files.service.js';
import { PoService } from '../po/po.service.js';
import { ScService } from '../sc/sc.service.js';
import { RmService } from '../rm/rm.service.js';
import { AdditionalRequestService } from '../additional-request/additional-request.service.js';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    private readonly filesService: FilesService,
    private readonly poService: PoService,
    private readonly scService: ScService,
    private readonly rmService: RmService,
    private readonly amrService: AdditionalRequestService,
  ) {}

  private async validateTargetRecord(
    context: AttachmentContext,
    recordId: string,
    userRole: UserRole,
  ): Promise<void> {
    let allowedRoles: UserRole[] = [];

    // 1. Verify existence of target record
    // 2. Define which roles are allowed to attach documents to this context
    try {
      switch (context) {
        case AttachmentContext.PO:
          await this.poService.findOne(recordId);
          allowedRoles = [UserRole.ADMIN, UserRole.STORES];
          break;
        case AttachmentContext.SC:
        case AttachmentContext.PRODUCTION: // SC is the Production Context
          await this.scService.findOne(recordId);
          allowedRoles = [
            UserRole.ADMIN,
            UserRole.DESIGNER,
            UserRole.STORES,
            UserRole.PRODUCTION,
          ];
          break;
        case AttachmentContext.RM_REQUEST:
          await this.rmService.findOne(recordId);
          allowedRoles = [UserRole.ADMIN, UserRole.DESIGNER];
          break;
        case AttachmentContext.ADDITIONAL_MATERIAL_REQUEST:
          await this.amrService.findOne(recordId);
          allowedRoles = [
            UserRole.ADMIN,
            UserRole.PRODUCTION,
            UserRole.DESIGNER,
          ];
          break;
      }
    } catch (error) {
      // If service throws NotFoundException, we let it bubble up,
      // or we can wrap it to give a specific context error.
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Target record ${recordId} for context ${context} not found.`);
      }
      throw error;
    }

    // 3. Verify user's role is allowed
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `User with role ${userRole} is not authorized to attach files to context ${context}.`,
      );
    }
  }

  async attach(dto: CreateAttachmentDto, userId: string, userRole: UserRole) {
    // 1. Verify file exists and is active
    const file = await this.filesService.getFileMetadata(dto.fileId);
    if (!file) {
      throw new NotFoundException(`File ${dto.fileId} not found.`);
    }

    // 2. Verify target record exists and user is authorized
    await this.validateTargetRecord(dto.context, dto.recordId, userRole);

    // 3. Prevent duplicate active associations
    const existing = await this.attachmentRepo.findOne({
      where: {
        fileId: dto.fileId,
        context: dto.context,
        recordId: dto.recordId,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('This file is already attached to the specified record.');
    }

    // 4. Create association
    const attachment = this.attachmentRepo.create({
      fileId: dto.fileId,
      context: dto.context,
      recordId: dto.recordId,
      documentType: dto.documentType,
      createdById: userId,
    });

    try {
      return await this.attachmentRepo.save(attachment);
    } catch (error: any) {
      if (error.code === '23505') { // Postgres Unique Violation
        throw new ConflictException('This file is already attached to the specified record.');
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id, isActive: true },
      relations: { file: true },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found.`);
    }

    return attachment;
  }

  async list(context: AttachmentContext, recordId: string) {
    return this.attachmentRepo.find({
      where: { context, recordId, isActive: true },
      relations: { file: true },
      order: { createdAt: 'DESC' },
    });
  }

  async detach(id: string, userId: string, userRole: UserRole) {
    const attachment = await this.findOne(id);

    // Validate that the user actually has access to modify this business context
    await this.validateTargetRecord(attachment.context, attachment.recordId, userRole);

    attachment.isActive = false;
    await this.attachmentRepo.save(attachment);
  }
}
