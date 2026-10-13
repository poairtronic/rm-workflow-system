import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class ScanStockTransactionDto {
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsEnum(['STOCK_IN', 'STOCK_OUT'])
  action: 'STOCK_IN' | 'STOCK_OUT';

  @IsUUID()
  @IsNotEmpty()
  binId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

