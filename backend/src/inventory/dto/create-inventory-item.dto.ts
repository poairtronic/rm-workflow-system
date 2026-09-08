import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsBoolean } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  material!: string;

  @IsString()
  @IsNotEmpty()
  materialType!: string;

  @IsString()
  @IsNotEmpty()
  grade!: string;

  @IsString()
  @IsNotEmpty()
  size!: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumStockLevel?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
