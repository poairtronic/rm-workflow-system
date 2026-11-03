import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class IssueMercItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsNotEmpty()
  binId!: string;

  @IsNumber()
  @Min(0.001)
  quantityIssued!: number;
}

export default IssueMercItemDto;

