import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdateRmItemDto {
  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  thickness?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  specification?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
