import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

export class MaterialIssueItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsOptional()
  @Transform(({ value }) => (!value || value === '' ? undefined : value))
  @ValidateIf((o) => !!o.binId)
  @IsUUID('4')
  binId?: string;

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
  @MaxLength(100)
  lotBatchNumber?: string;

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
  @IsUUID('4')
  additionalRequestId?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
