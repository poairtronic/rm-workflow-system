import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConsumableApprovalConfigDto {
  @ApiProperty({ enum: ['OFF', 'ON'], description: 'Consumable SM approval mode' })
  @IsEnum(['OFF', 'ON'], { message: 'mode must be either OFF or ON' })
  mode!: 'OFF' | 'ON';

  @ApiPropertyOptional({ enum: ['ALL', 'PURCHASE_ONLY'], description: 'Consumable SM approval scope' })
  @IsOptional()
  @IsEnum(['ALL', 'PURCHASE_ONLY'], { message: 'scope must be either ALL or PURCHASE_ONLY' })
  scope?: 'ALL' | 'PURCHASE_ONLY';
}
