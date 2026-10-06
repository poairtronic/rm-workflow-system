import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  ValidateNested,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryChallanType } from '../entities/delivery-challan.entity.js';
import { DeliveryChallanItemDto } from './delivery-challan-item.dto.js';

export class CreateDeliveryChallanDto {
  @IsEnum(DeliveryChallanType)
  type: DeliveryChallanType;

  @IsUUID()
  vendorId: string;

  @IsOptional()
  @IsUUID()
  scId?: string;

  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsISO8601()
  dispatchDate: string;

  @IsISO8601()
  @IsOptional()
  expectedReturnDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => DeliveryChallanItemDto)
  @ArrayMinSize(1)
  items: DeliveryChallanItemDto[];
}
