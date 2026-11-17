import { IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdateSweepDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(720)
  thresholdHours!: number;
}
