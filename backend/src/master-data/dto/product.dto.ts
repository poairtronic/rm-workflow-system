import { IsString, IsNotEmpty, MaxLength, IsUUID, IsNumber, Min, IsOptional, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsUUID('4')
  @IsNotEmpty()
  familyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

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
  @IsUUID('4')
  familyId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

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
