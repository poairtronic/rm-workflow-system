import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SplDcItemDto {
  @IsString()
  @IsNotEmpty()
  poPartLabel: string; // "PO123 - BASE PLATE"

  @IsString()
  @IsOptional()
  mercItemId?: string; // from MERC line item (null for extra items)

  @IsString()
  @IsNotEmpty()
  partNo: string; // auto-generated or entered

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  dispatchedQty: number;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isExtraItem?: boolean; // true if manually added from stock

  @IsString()
  @IsOptional()
  productId?: string; // RM product ID (for extra items)
}

export class SplDispatchGroupDto {
  @IsString()
  @IsNotEmpty()
  processName: string; // "HEAT TREATMENT" / "SPARKING" etc.

  @IsString()
  @IsOptional()
  targetProcess?: string; // optional process from master

  @ValidateNested({ each: true })
  @Type(() => SplDcItemDto)
  @ArrayMinSize(1)
  items: SplDcItemDto[];
}

export class CreateSplDcDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsString()
  @IsNotEmpty()
  poNumber: string;

  @IsString()
  @IsOptional()
  mercIndentId?: string;

  @IsString()
  @IsOptional()
  mercIndentNumber?: string;

  @IsString()
  @IsOptional()
  layoutNumber?: string;

  @IsDateString()
  @IsOptional()
  expectedReturnDate?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @ValidateNested({ each: true })
  @Type(() => SplDispatchGroupDto)
  @ArrayMinSize(1)
  dispatchGroups: SplDispatchGroupDto[];
}

