import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class GeneralIssueItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsNotEmpty()
  binId!: string;

  @IsNumber()
  @Min(0.001)
  quantityIssued!: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class CreateGeneralIssueDto {
  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  requester?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  externalReference?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneralIssueItemDto)
  items!: GeneralIssueItemDto[];
}
