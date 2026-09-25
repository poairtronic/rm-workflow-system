import { IsOptional, IsInt, Min, Max, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetNotificationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  readOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}
