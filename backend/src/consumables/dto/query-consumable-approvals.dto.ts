import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConsumableItemTrack } from '../entities/consumable-request-item.entity.js';

export class QueryConsumableApprovalsDto {
  @ApiPropertyOptional({
    description: 'Filter by approval status: PENDING (or PENDING_SM_APPROVAL), APPROVED, REJECTED, ALL',
    default: 'PENDING',
  })
  @IsOptional()
  @IsString()
  status?: string = 'PENDING';

  @ApiPropertyOptional({
    description: 'Fuzzy search by item description, product code, request code, or requester name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ConsumableItemTrack,
    description: 'Filter by track: STOCK_ITEM (Store Issue) or NON_STOCK_OR_NEW (Purchase)',
  })
  @IsOptional()
  track?: ConsumableItemTrack;

  @ApiPropertyOptional({
    description: 'Start date filter (created_at >= from)',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (created_at <= to)',
    example: '2026-11-30',
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    default: 1,
    description: '1-based page number',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: 25,
    description: 'Items per page (max 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}
