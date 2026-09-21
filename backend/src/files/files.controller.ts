import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile as NestUploadedFile,
  BadRequestException,
  ParseFilePipeBuilder,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { forwardRef, Inject } from '@nestjs/common';

import 'multer';

@Controller('api/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => AttachmentsService))
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: any,
    @NestUploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpeg|jpg|png|pdf)$/, // Regex for allowed types
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    
    // Uploader attribution comes straight from the JWT
    const userId = req.user.userId;
    
    const uploadedFile = await this.filesService.uploadFile(userId, file);
    
    return {
      id: uploadedFile.id,
      originalName: uploadedFile.originalName,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
      createdAt: uploadedFile.createdAt,
    };
  }

  @Get(':id')
  async getFileMetadata(@Req() req: any, @Param('id') id: string) {
    await this.attachmentsService.checkFileAccess(id, req.user, 'READ');
    const file = await this.filesService.getFileMetadata(id);
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      createdBy: file.createdById,
    };
  }

  @Get(':id/download')
  async getFileDownloadUrl(@Req() req: any, @Param('id') id: string) {
    await this.attachmentsService.checkFileAccess(id, req.user, 'READ');
    const url = await this.filesService.getFileDownloadUrl(id);
    return { url };
  }

  @Delete(':id')
  async removeFile(@Req() req: any, @Param('id') id: string) {
    await this.attachmentsService.checkFileAccess(id, req.user, 'DELETE');
    const userId = req.user.userId;
    await this.filesService.removeFile(userId, id);
    return { success: true };
  }
}
