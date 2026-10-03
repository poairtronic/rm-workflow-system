import { IsUUID, IsNumber, Min } from 'class-validator';

export class DeliveryChallanItemDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  binId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantityDispatched: number;
}
