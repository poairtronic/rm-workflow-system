import { IsEnum } from 'class-validator';

export class UpdateEmailPrefsModeDto {
  @IsEnum(['OFF', 'SHADOW', 'ON'], {
    message: 'mode must be one of: OFF, SHADOW, ON',
  })
  mode!: 'OFF' | 'SHADOW' | 'ON';
}
