import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class IssueConsumableToProductionDto {
  @IsUUID()
  binId!: string;

  @IsNumber()
  @Min(0.001, { message: 'Issued quantity must be greater than zero.' })
  issueQty!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

