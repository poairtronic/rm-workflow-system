import { IsOptional, IsBoolean, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AppearanceConfigDto {
  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  density?: string;
}

export class NotificationsConfigDto {
  @IsOptional()
  @IsBoolean()
  globalEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  workflowAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dcOverdueAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  materialIssueOverdueAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  lowStockMslAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  stockMovementAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  consumableEmailAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  consumableReceiptOverdueAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  consumablePartiallyIssuedAlertsEnabled?: boolean;
}

export class RegionalConfigDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  defaultStockUnit?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class ThresholdsConfigDto {
  @IsOptional()
  @IsNumber()
  dcReturnSlaDays?: number;

  @IsOptional()
  @IsNumber()
  materialIssueOverdueHours?: number;

  @IsOptional()
  @IsNumber()
  mslCheckIntervalHours?: number;
}

export class UpdateSystemConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AppearanceConfigDto)
  appearance?: AppearanceConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationsConfigDto)
  notifications?: NotificationsConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegionalConfigDto)
  regional?: RegionalConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ThresholdsConfigDto)
  thresholds?: ThresholdsConfigDto;
}
