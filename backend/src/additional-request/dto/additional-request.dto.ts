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
import { Type, Transform } from 'class-transformer';
import { AdditionalReason } from '../entities/additional-request.entity.js';

export class AdditionalRequestItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  rmItemId!: string;

  @IsNumber()
  @Min(0.001)
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0.001)
  @IsOptional()
  quantityRequested?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  material?: string;
}

export class CreateAdditionalRequestDto {
  @IsUUID('4')
  @IsNotEmpty()
  scId!: string;

  @Transform(({ value }) => {
    if (!value) return AdditionalReason.ADDITIONAL_REQUIREMENT;
    const mapping: Record<string, AdditionalReason> = {
      'DESIGN_CHANGE': AdditionalReason.ADDITIONAL_REQUIREMENT,
      'TOOL_BREAKAGE': AdditionalReason.TOOL_WEAR_SCRAP,
      'MATERIAL_DEFECT': AdditionalReason.DAMAGE,
      'SAMPLE_PREPARATION': AdditionalReason.WASTAGE,
      'REWORK_SCRAP': AdditionalReason.MANUFACTURING_ERROR,
    };
    return mapping[value] || value;
  })
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
