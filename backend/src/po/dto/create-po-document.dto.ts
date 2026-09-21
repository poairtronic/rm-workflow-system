import { IsEnum, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { PoDocumentType } from '../../attachments/enums/po-document-type.enum.js';

export class CreatePoDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  fileId!: string;

  @IsOptional()
  @IsEnum(PoDocumentType)
  documentType?: PoDocumentType;
}
