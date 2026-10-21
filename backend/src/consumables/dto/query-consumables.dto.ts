import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConsumableItemTrack,
  ConsumableItemStatus,
} from '../entities/consumable-request-item.entity.js';

export class QueryConsumableItemsDto {
  @IsOptional()
  @IsEnum(ConsumableItemTrack)
  track?: ConsumableItemTrack;

  @IsOptional()
  @IsEnum(ConsumableItemStatus)
  status?: ConsumableItemStatus;

  @IsOptional()
  @IsString()
  prNumber?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

