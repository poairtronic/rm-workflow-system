import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkRejectConsumablesDto {
  @ApiProperty({
    description: 'Array of consumable request item UUIDs (1-200)',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 item ID must be provided' })
  @ArrayMaxSize(200, { message: 'Cannot reject more than 200 items in a single batch' })
  @IsUUID('4', { each: true, message: 'Each item ID must be a valid UUID' })
  itemIds!: string[];

  @ApiProperty({
    description: 'Mandatory reason for rejection (min 5 characters)',
    example: 'Excess stock already available in tool room; re-use existing allocation.',
  })
  @IsString()
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters long' })
  rejectionReason!: string;
}
