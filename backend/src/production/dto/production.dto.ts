import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiptItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsNumber()
  @Min(0.001)
  quantityReceived!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateProductionReceiptDto {
  @IsUUID('4')
  @IsNotEmpty()
  materialIssueId!: string;

  @IsOptional()
  @IsUUID('4')
  scId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items!: ReceiptItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

export class CreateMaterialConsumptionDto {
  @IsUUID('4')
  @IsNotEmpty()
  scId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsNumber()
  @Min(0.001)
  quantityConsumed!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReturnItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsNumber()
  @Min(0.001)
  quantityReturned!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateMaterialReturnDto {
  @IsUUID('4')
  @IsNotEmpty()
  scId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class VerifyReturnDto {
  @IsUUID('4')
  @IsNotEmpty()
  destinationBinId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
