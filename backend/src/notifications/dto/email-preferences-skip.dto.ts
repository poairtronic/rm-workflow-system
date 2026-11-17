import { IsOptional, IsString, IsUUID, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSkipsQueryDto {
  @IsOptional()
  @IsString()
  eventCode?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class GetSkipsSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 7;
}

export interface SkipLogEntryInput {
  eventCode: string;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  reason: string;
  entityId?: string | null;
  mode: string;
}

export interface SkipLogItemDto {
  id: string;
  eventCode: string;
  eventLabel: string;
  recipientUserId: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  reason: string;
  reasonText: string;
  entityId: string | null;
  mode: string;
  createdAt: string;
}

export interface SkipsResponseDto {
  entries: SkipLogItemDto[];
  nextCursor: string | null;
}

export interface SkipsSummaryResponseDto {
  days: number;
  byReason: Record<string, number>;
  byEvent: Record<string, number>;
  total: number;
}
