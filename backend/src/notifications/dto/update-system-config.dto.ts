import { IsOptional, IsBoolean, IsNumber, IsString, Min } from 'class-validator';

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsString()
  digestFrequency?: string;
}
