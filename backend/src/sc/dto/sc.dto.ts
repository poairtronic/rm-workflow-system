import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateScDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  poNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  drawingNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetQuantity?: number = 1;
}

export class CompleteScDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CloseScDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
