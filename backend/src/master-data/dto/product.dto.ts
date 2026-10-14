import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  barcode?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUUID('4')
  familyId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  familyName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @MaxLength(50)
  uom?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumInventory?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumInventory?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  barcode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID('4')
  familyId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  familyName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @MaxLength(50)
  uom?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumInventory?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumInventory?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
