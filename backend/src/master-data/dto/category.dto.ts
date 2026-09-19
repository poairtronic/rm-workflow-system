import { IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Category name must not be empty' })
  @MaxLength(100, { message: 'Category name must not exceed 100 characters' })
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Category name must not be empty' })
  @MaxLength(100, { message: 'Category name must not exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
