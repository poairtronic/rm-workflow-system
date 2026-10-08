import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ModernStockOutDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsNotEmpty()
  binId!: string;

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
}
