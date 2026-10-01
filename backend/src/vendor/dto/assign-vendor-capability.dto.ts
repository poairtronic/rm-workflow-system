import {
  IsUUID,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignVendorCapabilityDto {
  @IsUUID()
  @IsNotEmpty()
  processId: string;

  @IsBoolean()
  @IsOptional()
  isApproved?: boolean = true;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

