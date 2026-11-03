import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MercLineItemDto {
  @IsString()
  @IsNotEmpty()
  mercItemId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['RAW_MATERIAL', 'BROUGHT_OUT'])
  itemType!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  shape?: string;

  @IsOptional()
  @IsNumber()
  lengthMm?: number;

  @IsOptional()
  @IsNumber()
  widthMm?: number;

  @IsOptional()
  @IsNumber()
  heightMm?: number;

  @IsOptional()
  @IsNumber()
  diameterMm?: number;

  @IsNumber()
  @Min(0.001)
  quantityRequired!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ReceiveMercIndentDto {
  @IsString()
  @IsNotEmpty()
  indentId!: string;

  @IsString()
  @IsNotEmpty()
  indentNumber!: string;

  @IsOptional()
  @IsString()
  poNumber?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  layoutNumber?: string;

  @IsString()
  @IsNotEmpty()
  mercCurrentState!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MercLineItemDto)
  lineItems!: MercLineItemDto[];
}

export default ReceiveMercIndentDto;

