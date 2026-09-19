import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateRmDto {
  @IsUUID('4')
  @IsNotEmpty()
  scId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateRmItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  material!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  materialType?: string = 'ROUND_BAR';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  grade!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  size!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thickness?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diameter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  weightUnit?: string = 'KG';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SubmitRmDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
