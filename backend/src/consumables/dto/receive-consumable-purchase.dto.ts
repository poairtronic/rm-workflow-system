import {
  IsUUID,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  Min,
} from 'class-validator';

export class ReceiveConsumablePurchaseDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  lineItemId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001, { message: 'Real received quantity must be greater than zero.' })
  realReceivedQty?: number;

  @IsOptional()
  @IsUUID()
  binId?: string;

  @IsOptional()
  @IsBoolean()
  autoIssue?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.001, { message: 'Issue quantity must be greater than zero.' })
  issueQty?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  items?: any[];
}

