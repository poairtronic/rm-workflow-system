import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUserPreferenceDto {
  @IsNotEmpty()
  @IsBoolean()
  workflowEmailEnabled!: boolean;
}
