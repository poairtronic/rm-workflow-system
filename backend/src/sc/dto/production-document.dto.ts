import { IsUUID, IsEnum } from 'class-validator';
import { ProductionDocumentType } from '../enums/production-document-type.enum.js';

export class CreateProductionDocumentDto {
  @IsUUID()
  fileId!: string;

  @IsEnum(ProductionDocumentType)
  documentType!: ProductionDocumentType;
}
