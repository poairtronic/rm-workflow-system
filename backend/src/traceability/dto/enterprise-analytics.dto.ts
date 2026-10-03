import { IsOptional, IsDateString, IsUUID, IsEnum } from 'class-validator';

// -------------------------------------------------------------
// 1. Process-wise Outward Summary DTOs
// -------------------------------------------------------------
export class ProcessOutwardItemDto {
  processId!: string;
  processCode!: string;
  processName!: string;
  sequenceNumber!: number;
  allowsOutsideVendor!: boolean;
  totalDcCount!: number;
  openDcCount!: number;
  closedDcCount!: number;
  overdueDcCount!: number;
  totalDispatchedQty!: number;
  totalReturnedQty!: number;
  balanceInCustody!: number;
  activeVendorCount!: number;
  vendorNames!: string[];
}

export class ProcessOutwardSummaryDto {
  totalProcesses!: number;
  activeProcesses!: number;
  totalDcs!: number;
  totalCustodyQty!: number;
}

export class ProcessOutwardAnalyticsResponseDto {
  summary!: ProcessOutwardSummaryDto;
  processes!: ProcessOutwardItemDto[];
  generatedAt!: string;
}

// -------------------------------------------------------------
// 2. Item-wise Outward Summary DTOs
// -------------------------------------------------------------
export class ItemOutwardItemDto {
  productId!: string;
  productName!: string;
  categoryName!: string;
  familyName!: string;
  uom!: string;
  totalDispatchedQty!: number;
  totalReturnedQty!: number;
  balanceInCustody!: number;
  dcCount!: number;
  vendorCount!: number;
  activeVendors!: string[];
}

export class ItemOutwardSummaryDto {
  totalItemsDispatched!: number;
  totalDispatchedQty!: number;
  totalReturnedQty!: number;
  totalBalanceInCustody!: number;
}

export class ItemOutwardAnalyticsResponseDto {
  summary!: ItemOutwardSummaryDto;
  items!: ItemOutwardItemDto[];
  generatedAt!: string;
}

// -------------------------------------------------------------
// 3. RM Consumption Summary DTOs
// -------------------------------------------------------------
export class RmConsumptionFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  scId?: string;
}

export class RmConsumptionGroupDto {
  materialName!: string;
  materialType!: string;
  grade!: string;
  unit!: string;
  totalConsumedQty!: number;
  consumptionCount!: number;
  scCount!: number;
  lastRecordedAt!: string;
}

export class RmConsumptionSummaryDto {
  totalConsumptionsLogged!: number;
  totalConsumedQty!: number;
  uniqueMaterialsCount!: number;
  uniqueScsCount!: number;
}

export class RmConsumptionAnalyticsResponseDto {
  summary!: RmConsumptionSummaryDto;
  consumptions!: RmConsumptionGroupDto[];
  generatedAt!: string;
}

// -------------------------------------------------------------
// 4. MSL & Stock Status Dashboard DTOs
// -------------------------------------------------------------
export enum MslStockFilterStatus {
  ALL = 'ALL',
  NORMAL = 'NORMAL',
  BELOW_MSL = 'BELOW_MSL',
  CRITICAL = 'CRITICAL',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class InventoryMslFilterDto {
  @IsOptional()
  @IsEnum(MslStockFilterStatus)
  status?: MslStockFilterStatus;
}

export class InventoryMslItemDto {
  productId!: string;
  productName!: string;
  categoryName!: string;
  familyName!: string;
  currentStock!: number;
  minimumInventory!: number;
  maximumInventory?: number | null;
  deficitQty!: number;
  status!: string; // 'NORMAL' | 'BELOW_MSL' | 'CRITICAL' | 'OUT_OF_STOCK'
}

export class InventoryMslSummaryDto {
  totalMonitoredProducts!: number;
  normalStockCount!: number;
  belowMslCount!: number;
  criticalStockCount!: number;
  outOfStockCount!: number;
  totalDeficitQty!: number;
}

export class InventoryMslStatusResponseDto {
  summary!: InventoryMslSummaryDto;
  items!: InventoryMslItemDto[];
  generatedAt!: string;
}
