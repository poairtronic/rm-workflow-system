import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitReworkDto {
  @IsUUID()
  scId: string;

  @IsIn(['REWORK', 'REJECTION'])
  type: 'REWORK' | 'REJECTION';

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsNumber()
  quantityAffected?: number;

  @IsOptional()
  @IsString()
  errorType?: string;

  @IsOptional()
  @IsString()
  stageOfFailure?: string;

  @IsNotEmpty()
  @IsString()
  defectDescription: string;

  @IsOptional()
  @IsString()
  responsibleParty?: string;

  @IsOptional()
  @IsString()
  operatorName?: string;

  @IsOptional()
  @IsString()
  reworkDescription?: string;

  @IsOptional()
  @IsString()
  rejectionDescription?: string;

  @IsOptional()
  @IsString()
  rejectionProcessTemplate?: string;

  @IsOptional()
  @IsString()
  rejectionFailedStage?: string;

  @IsOptional()
  @IsObject()
  rejectionStageCosts?: Record<string, number>;

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

