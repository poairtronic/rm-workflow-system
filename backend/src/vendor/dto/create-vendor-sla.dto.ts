import {
  IsUUID,
  IsNotEmpty,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVendorSlaDto {
  @IsUUID()
  @IsNotEmpty()
  processId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  slaDays: number;

  @IsDateString()
  @IsNotEmpty()
  effectiveDate: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsString()
  @IsOptional()
  notes?: string;
}
