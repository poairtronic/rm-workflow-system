import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRackDto {
  @IsUUID('4')
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRackDto {
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
