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

export class ReturnDeliveryChallanItemDto {
  @IsUUID()
  itemId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantityToReturn: number;
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
