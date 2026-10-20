import { IsUUID, IsOptional, IsISO8601, IsString } from 'class-validator';

export class ReworkReDispatchDto {
  @IsUUID()
  vendorId: string;

  @IsOptional()
  @IsISO8601()
  targetReturnDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
