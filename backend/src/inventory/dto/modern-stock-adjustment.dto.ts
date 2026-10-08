import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  MinLength,
  IsEnum,
} from 'class-validator';
import { AdjustmentDirection } from '../entities/stock-transaction.entity.js';

export class ModernStockAdjustmentDto {
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

  @IsEnum(AdjustmentDirection)
  @IsNotEmpty()
  direction!: AdjustmentDirection;

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
}
