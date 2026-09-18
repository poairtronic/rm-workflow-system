import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CreateBinDto {
  @IsUUID('4')
  @IsNotEmpty()
  rackId!: string;

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

export class UpdateBinDto {
  @IsOptional()
  @IsUUID('4')
  rackId?: string;

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
