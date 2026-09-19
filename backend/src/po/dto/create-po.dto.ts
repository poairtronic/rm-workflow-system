import { IsString, IsNotEmpty, IsOptional, MaxLength, IsDateString, IsUUID } from 'class-validator';

export class CreatePoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  poNumber!: string;

  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  externalReference?: string;

  @IsDateString()
  @IsOptional()
  referenceDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  remarks?: string;
}
