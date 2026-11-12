import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryChallanType } from '../entities/delivery-challan.entity.js';

export class LockCheckItemDto {
  @IsOptional()
  @IsUUID()
  scId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  partName?: string;

  @IsOptional()
  @IsString()
  partNumber?: string;

  @IsOptional()
  @IsString()
  mercItemId?: string;

  @IsOptional()
  @IsString()
  poPartLabel?: string;

  @IsOptional()
  @IsBoolean()
  isExtraItem?: boolean;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}

export class LockCheckDto {
  @IsEnum(DeliveryChallanType)
  type: DeliveryChallanType;

  @IsOptional()
  @IsUUID()
  scId?: string;

  @IsOptional()
  @IsString()
  poNumber?: string;

  @ValidateNested({ each: true })
  @Type(() => LockCheckItemDto)
  @ArrayMinSize(1)
  items: LockCheckItemDto[];
}

