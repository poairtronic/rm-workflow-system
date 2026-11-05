import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  shortClose?: boolean;
}

export default IssueMercItemDto;

