import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteConsumableItemsDto {
  @ApiProperty({
    type: [String],
    description: 'Array of consumable line item UUIDs to delete',
    example: ['11111111-1111-1111-1111-111111111111'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  itemIds: string[];
}
