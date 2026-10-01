import {
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVendorSlaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  slaDays?: number;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
