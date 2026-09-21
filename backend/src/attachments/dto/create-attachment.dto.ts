import { IsEnum, IsUUID, IsNotEmpty } from 'class-validator';
import { AttachmentContext } from '../entities/attachment.entity.js';

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
}
