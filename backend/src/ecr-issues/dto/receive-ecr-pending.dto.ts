import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  IsISO8601,
} from 'class-validator';

export class ReceiveEcrPendingDto {
  @IsString()
  @IsNotEmpty()
  ecrId!: string;

  @IsString()
  @IsNotEmpty()
  reportNumber!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['REWORK', 'REJECTION'])
  type!: string;

  @IsString()
  @IsNotEmpty()
  scNumber!: string;

  @IsString()
  @IsNotEmpty()
  poNumber!: string;

  @IsString()
  @IsNotEmpty()
  component!: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantityAffected!: number;

  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  approvedAt!: string;
}

export default ReceiveEcrPendingDto;

