import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CreateRackDto {
  @IsUUID('4')
  @IsNotEmpty()
  locationId!: string;

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

export class UpdateRackDto {
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

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
