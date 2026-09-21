import { IsEnum, IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AttachmentContext } from '../entities/attachment.entity.js';
import { RmDocumentType } from '../enums/rm-document-type.enum.js';

export class CreateAttachmentDto {
  @IsUUID()
  @IsNotEmpty()
  fileId!: string;

  @IsEnum(AttachmentContext)
  @IsNotEmpty()
  context!: AttachmentContext;

  @IsUUID()
  @IsNotEmpty()
  recordId!: string;

  @IsOptional()
  @IsString()
  documentType?: string;
}
