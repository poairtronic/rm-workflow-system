import { IsUUID, IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class DeliveryChallanItemDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  binId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantityDispatched: number;
  @IsOptional()
  @IsUUID()
  scId?: string;

  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
