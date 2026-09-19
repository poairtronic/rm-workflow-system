import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdditionalReason } from '../entities/additional-request.entity.js';

export class AdditionalRequestItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateAdditionalRequestDto {
  @IsUUID('4')
  @IsNotEmpty()
  scId!: string;

  @IsEnum(AdditionalReason)
  @IsOptional()
  reason?: AdditionalReason;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalRequestItemDto)
  items!: AdditionalRequestItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}
