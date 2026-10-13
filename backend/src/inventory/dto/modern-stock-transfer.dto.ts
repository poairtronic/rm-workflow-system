import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  MinLength,
  IsBoolean,
} from 'class-validator';

export class ModernStockTransferDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsNotEmpty()
  sourceBinId!: string;

  @IsUUID()
  @IsNotEmpty()
  targetBinId!: string;

  @IsNumber()
  @Min(0.001)
  @IsNotEmpty()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason!: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsOptional()
  referenceType?: string;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  lotBatchNumber?: string;

  @IsNumber()
  @IsOptional()
  cost?: number;

  @IsBoolean()
  @IsOptional()
  allowNegative?: boolean;
}
