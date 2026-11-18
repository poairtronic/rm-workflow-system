import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkApproveConsumablesDto {
  @ApiProperty({
    description: 'Array of consumable request item UUIDs (1-200)',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 item ID must be provided' })
  @ArrayMaxSize(200, { message: 'Cannot approve more than 200 items in a single batch' })
  @IsUUID('4', { each: true, message: 'Each item ID must be a valid UUID' })
  itemIds!: string[];
}
