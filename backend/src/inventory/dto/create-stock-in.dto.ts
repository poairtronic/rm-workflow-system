import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateStockInDto {
  @IsNumber()
  @Min(0.001) // Quantity must be strictly positive
  @IsNotEmpty()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  referenceType!: string;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
