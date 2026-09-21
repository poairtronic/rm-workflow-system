import { IsEnum, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { RmDocumentType } from '../../attachments/enums/rm-document-type.enum.js';

export class CreateRmDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  fileId!: string;

  @IsOptional()
  @IsEnum(RmDocumentType)
  documentType?: RmDocumentType;
}
