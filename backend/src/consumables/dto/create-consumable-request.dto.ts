import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConsumablePaymentMode } from '../entities/consumable-request.entity.js';

export class CreateConsumableRequestItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsBoolean()
  isNewProduct?: boolean;

  @IsNumber()
  @Min(0)
  requestedQty!: number;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  isNewVendor?: boolean;

  @IsOptional()
  @IsString()
  newVendorName?: string;

  @IsOptional()
  @IsString()
  newVendorAddress?: string;

  @IsOptional()
  @IsString()
  newVendorMobile?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newVendorPrice?: number;

  @IsOptional()
  @IsString()
  endUserInVelan?: string;

  @IsOptional()
  @IsString()
  requestedBy?: string;
}

export class CreateConsumableRequestDto {
  @IsEnum(ConsumablePaymentMode)
  paymentMode!: ConsumablePaymentMode;

  @IsOptional()
  @IsString()
  endUserInVelan?: string;

  @IsString()
  requestedBy!: string;

  @IsOptional()
  @IsString()
  preparedBy?: string;

  @IsOptional()
  @IsString()
  verifiedBy?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateConsumableRequestItemDto)
  items!: CreateConsumableRequestItemDto[];
}

