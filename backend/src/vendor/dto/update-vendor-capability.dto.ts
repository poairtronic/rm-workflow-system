import {
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVendorCapabilityDto {
  @IsBoolean()
  @IsOptional()
  isApproved?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

