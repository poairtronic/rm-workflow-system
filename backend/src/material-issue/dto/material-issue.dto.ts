import { IsString, IsNotEmpty, MaxLength, IsUUID, IsNumber, Min, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialIssueItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  binId!: string;

  @IsNumber()
  @Min(0.001)
  quantityIssued!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  heatNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNumber?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateMaterialIssueDto {
  @IsUUID('4')
  @IsNotEmpty()
  scId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialIssueItemDto)
  items!: MaterialIssueItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}
