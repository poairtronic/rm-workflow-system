import {
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsOptional,
  IsString,
} from 'class-validator';

export class PrintPrDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each line item ID must be a valid UUID.' })
  itemIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each line item ID must be a valid UUID.' })
  lineItemIds?: string[];

  @IsOptional()
  @IsString()
  printedBy?: string;

  @IsOptional()
  @IsArray()
  itemUpdates?: Array<{ id: string; purchaseQty?: number; unitPrice?: number; vendorId?: string }>;

  @IsOptional()
  itemQuantities?: Record<string, number>;
}

