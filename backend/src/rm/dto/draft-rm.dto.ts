import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DraftRmItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  spec!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  partNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  partName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  remarks?: string;
}

export class DraftRmScDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  productName!: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  targetQuantity?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftRmItemDto)
  @ArrayMinSize(1)
  items!: DraftRmItemDto[];
}

export class CreateDraftRmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  poNumber!: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftRmScDto)
  @ArrayMinSize(1)
  scs!: DraftRmScDto[];
}

export class UpdateDraftRmDto extends CreateDraftRmDto {}
