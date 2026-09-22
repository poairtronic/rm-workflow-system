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
      where: { id, isActive: true, file: { isActive: true } },
      relations: { file: true },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found.`);
    }

    return attachment;
  }

  async list(context: AttachmentContext, recordId: string) {
    return this.attachmentRepo.find({
      where: { context, recordId, isActive: true, file: { isActive: true } },
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

  async checkFileAccess(fileId: string, user: { userId: string, roles: UserRole[] }, action: 'READ' | 'WRITE' | 'DELETE'): Promise<void> {
    const file = await this.filesService.getFileMetadata(fileId);
    
    // Fetch all active attachments
    const attachments = await this.attachmentRepo.find({ where: { fileId, isActive: true } });
    
    if (attachments.length === 0) {
      // Unattached file policy: Only creator or ADMIN can access.
      if (file.createdById !== user.userId && !user.roles.includes(UserRole.ADMIN)) {
        throw new ForbiddenException('Unauthorized access to unattached file');
      }
      return;
    }

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (isAdmin) return; // Admins have global access

    if (action === 'DELETE') {
      if (file.createdById !== user.userId) {
        throw new ForbiddenException('Only the creator or an ADMIN can delete this file.');
      }
      // If they are the creator, they can delete it even if it's attached. 
      // (Or maybe we shouldn't allow deleting attached files? The prompt doesn't specify, but typically creator can delete their own files).
      return;
    }

    // If attached, check if user role allows READ/WRITE for any of the attached contexts
    let hasAccess = false;
    
    for (const att of attachments) {
      const allowedRoles = this.getAllowedRolesForContext(att.context, action);
      const userHasRole = allowedRoles.some(role => user.roles.includes(role));
      
      if (userHasRole) {
        try {
          // Verify existence of target record
          switch (att.context) {
            case AttachmentContext.PO: await this.poService.findOne(att.recordId); break;
            case AttachmentContext.SC:
            case AttachmentContext.PRODUCTION: await this.scService.findOne(att.recordId); break;
            case AttachmentContext.RM_REQUEST: await this.rmService.findOne(att.recordId); break;
            case AttachmentContext.ADDITIONAL_MATERIAL_REQUEST: await this.amrService.findOne(att.recordId); break;
          }
          hasAccess = true;
          break;
        } catch (e) {
          // Record doesn't exist, ignore and check other attachments
        }
      }
    }

    if (!hasAccess) {
      throw new ForbiddenException('Unauthorized access to file based on business record');
    }
  }

  private getAllowedRolesForContext(context: AttachmentContext, action: 'READ' | 'WRITE' | 'DELETE'): UserRole[] {
    if (action === 'READ') {
      return [UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER];
    }
    
    // WRITE / DELETE
    switch (context) {
      case AttachmentContext.PO: return [UserRole.ADMIN, UserRole.STORES];
      case AttachmentContext.SC: return [UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION];
      case AttachmentContext.PRODUCTION: return [UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION];
      case AttachmentContext.RM_REQUEST: return [UserRole.ADMIN, UserRole.DESIGNER];
      case AttachmentContext.ADDITIONAL_MATERIAL_REQUEST: return [UserRole.ADMIN, UserRole.DESIGNER, UserRole.PRODUCTION];
    }
    return [];
  }
}
