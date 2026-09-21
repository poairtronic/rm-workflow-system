import { IsEnum, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { ScDocumentType } from '../../attachments/enums/sc-document-type.enum.js';

export class CreateScSupportingDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  fileId!: string;

  @IsOptional()
  @IsEnum(ScDocumentType)
  documentType?: ScDocumentType;
}
