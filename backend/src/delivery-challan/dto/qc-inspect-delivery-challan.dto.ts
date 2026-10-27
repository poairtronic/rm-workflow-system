import {
  IsUUID,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QcInspectItemDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  passedQty: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  rejectedQty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  actualStoreInwardQty?: number;

  @IsOptional()
  @IsUUID()
  targetBinId?: string;

  @IsOptional()
  @IsString()
  qcRemarks?: string;
}

export class QcInspectDeliveryChallanDto {
  @IsOptional()
  @IsISO8601()
  inspectionDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @ValidateNested({ each: true })
  @Type(() => QcInspectItemDto)
  @ArrayMinSize(1)
  items: QcInspectItemDto[];
}
