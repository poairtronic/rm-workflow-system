import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class RecordSlaOverrideDto {
  @IsUUID()
  @IsOptional()
  dcId?: string;

  @IsDateString()
  @IsNotEmpty()
  newTargetDate: string;

  @IsString()
  @IsNotEmpty()
  justificationCode: string;

  @IsString()
  @IsNotEmpty()
  justificationNotes: string;

  @IsDateString()
  @IsOptional()
  originalTargetDate?: string;
}
