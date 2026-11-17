import { IsOptional, IsEnum, IsUUID, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAuditQueryDto {
  @IsOptional()
  @IsEnum(['ROLE', 'USER'], {
    message: 'scope must be one of: ROLE, USER',
  })
  scope?: 'ROLE' | 'USER';

  @IsOptional()
  @IsUUID('all', { message: 'targetId must be a valid UUID' })
  targetId?: string;

  @IsOptional()
  @IsString()
  eventCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  cursor?: string;
}
