import { IsUUID, IsNumber, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeliveryChallanItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  rmItemId?: string;

  @IsOptional()
  @IsUUID()
  binId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantityDispatched: number;

  // Type 2 Asymmetric Stock Conversion Fields
  @IsOptional()
  @IsUUID()
  outputProductId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  expectedOutputQuantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  initialExpectedQty?: number;

  @IsOptional()
  @IsUUID()
  outputBinId?: string;

  @IsOptional()
  @IsUUID()
  scId?: string;

  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  processName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  partNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  partName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNumber?: string;
}
