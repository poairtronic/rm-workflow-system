import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class ResetSystemDataDto {
  @IsOptional()
  @IsBoolean()
  po_traceability?: boolean;

  @IsOptional()
  @IsBoolean()
  sc_traceability?: boolean;

  @IsOptional()
  @IsBoolean()
  my_requisitions?: boolean;

  @IsOptional()
  @IsBoolean()
  rm_issue?: boolean;

  @IsOptional()
  @IsBoolean()
  rm_receipt?: boolean;

  @IsOptional()
  @IsBoolean()
  material_consumption?: boolean;

  @IsOptional()
  @IsBoolean()
  request_return_verify?: boolean;

  @IsOptional()
  @IsBoolean()
  dc?: boolean;

  @IsOptional()
  @IsBoolean()
  dc_movements?: boolean;

  @IsOptional()
  @IsBoolean()
  stock?: boolean;

  @IsOptional()
  @IsBoolean()
  stock_movement?: boolean;

  @IsOptional()
  @IsBoolean()
  consumables?: boolean;

  @IsOptional()
  @IsBoolean()
  purchase_store_consumables?: boolean;

  @IsOptional()
  @IsBoolean()
  product?: boolean;

  @IsOptional()
  @IsBoolean()
  vendor?: boolean;

  @IsOptional()
  @IsBoolean()
  warehouse_locations?: boolean;

  @IsOptional()
  @IsBoolean()
  warehouse?: boolean;

  @IsOptional()
  @IsBoolean()
  production_processes?: boolean;

  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  audit_logs?: boolean;

  @IsOptional()
  @IsString()
  confirmationToken?: string;
}
