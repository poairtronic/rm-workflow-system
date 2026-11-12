import {
  IsUUID,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnDeliveryChallanItemDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantityToReturn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  receivedQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  expectedReturnQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  expectedOutputQuantity?: number;

  @IsOptional()
  @IsUUID()
  returnedProductId?: string;

  @IsOptional()
  @IsUUID()
  destinationBinId?: string;

  @IsOptional()
  @IsUUID()
  targetBinId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  actualInwardQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  actualReceivedQty?: number;

  @IsOptional()
  @IsBoolean()
  isCumulative?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReturnDeliveryChallanDto {
  @IsISO8601()
  actualReceiptDate: string;

  @IsString()
  @IsOptional()
  verificationRemarks?: string;

  @ValidateNested({ each: true })
  @Type(() => ReturnDeliveryChallanItemDto)
  @ArrayMinSize(1)
  items: ReturnDeliveryChallanItemDto[];
}
