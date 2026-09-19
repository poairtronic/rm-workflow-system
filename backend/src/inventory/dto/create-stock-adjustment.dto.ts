import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { AdjustmentDirection } from '../entities/stock-transaction.entity.js';

export class CreateStockAdjustmentDto {
  @IsNumber()
  @Min(0.001) // Quantity must be strictly positive
  @IsNotEmpty()
  quantity!: number;

  @IsEnum(AdjustmentDirection)
  @IsNotEmpty()
  direction!: AdjustmentDirection;

  @IsString()
  @IsNotEmpty()
  referenceType!: string;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsNotEmpty() // Remarks are explicitly required for adjustment
  remarks!: string;
}
