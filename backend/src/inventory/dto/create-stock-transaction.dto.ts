import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { TransactionType } from '../entities/stock-transaction.entity.js';

export class CreateStockTransactionDto {
  @IsEnum(TransactionType)
  @IsNotEmpty()
  transactionType!: TransactionType;

  @IsNumber()
  @Min(0.001) // quantity must be positive
  @IsNotEmpty()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  referenceType!: string;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
