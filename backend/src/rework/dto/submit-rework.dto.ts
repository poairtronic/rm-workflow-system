import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitReworkDto {
  @IsUUID()
  scId: string;

  @IsIn(['REWORK', 'REJECTION'])
  type: 'REWORK' | 'REJECTION';

  @IsOptional()
  @IsString()
  errorType?: string;

  @IsNotEmpty()
  @IsString()
  stageOfFailure: string;

  @IsNotEmpty()
  @IsString()
  defectDescription: string;

  @IsOptional()
  @IsString()
  responsibleParty?: string;

  @IsOptional()
  @IsString()
  reworkDescription?: string;

  @IsOptional()
  @IsString()
  rejectionDescription?: string;

  @IsOptional()
  @IsNumber()
  costEstimation?: number;

  @IsOptional()
  @IsNumber()
  lossEstimation?: number;

  @IsOptional()
  @IsString()
  alternativeNotes?: string;
}
