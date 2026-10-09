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

  @Type(() => Number)
  @IsOptional()
  leadTimeMultiplier?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  toleranceBufferDays?: number;

  @IsBoolean()
  @IsOptional()
  alert72h?: boolean;

  @IsBoolean()
  @IsOptional()
  alert48h?: boolean;

  @IsBoolean()
  @IsOptional()
  alert24h?: boolean;

  @IsBoolean()
  @IsOptional()
  emailAlertsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  smsAlertsEnabled?: boolean;
}
