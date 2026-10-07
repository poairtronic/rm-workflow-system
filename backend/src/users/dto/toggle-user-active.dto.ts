import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleUserActiveDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

