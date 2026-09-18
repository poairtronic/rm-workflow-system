import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CreateLocationDto {
  @IsUUID('4')
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
