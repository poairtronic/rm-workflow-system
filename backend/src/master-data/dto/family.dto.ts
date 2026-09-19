import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateFamilyDto {
  @IsUUID('4')
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFamilyDto {
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

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
