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

  @ValidateIf((o) => o.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD)
  @IsUUID()
  scId?: string;

  @ValidateIf((o) => o.type === DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD)
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
