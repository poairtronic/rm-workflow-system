import { IsUUID, IsNotEmpty } from 'class-validator';

export class ValidateProcessTransitionDto {
  @IsUUID()
  @IsNotEmpty()
  fromProcessId: string;

  @IsUUID()
  @IsNotEmpty()
  toProcessId: string;
}
