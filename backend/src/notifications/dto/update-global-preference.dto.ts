import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateGlobalPreferenceDto {
  @IsNotEmpty()
  @IsBoolean()
  workflowEmailEnabled!: boolean;
}
