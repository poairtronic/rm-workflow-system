import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ProductionDocumentType } from '../enums/production-document-type.enum.js';

export class CreateProductionDocumentDto {
  @IsUUID()
  fileId!: string;

  @IsEnum(ProductionDocumentType)
  documentType!: ProductionDocumentType;
}

export class UpdateProductionDocumentDto {
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @IsOptional()
  @IsEnum(ProductionDocumentType)
  documentType?: ProductionDocumentType;
}
