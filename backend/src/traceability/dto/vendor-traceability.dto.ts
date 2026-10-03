export class VendorTraceabilityMetaDto {
  id!: string;
  code!: string;
  name!: string;
  category?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive!: boolean;
}

export class VendorTraceabilitySummaryDto {
  totalDcCount!: number;
  openDcCount!: number;
  closedDcCount!: number;
  overdueDcCount!: number;
  totalDispatchedQty!: number;
  totalReturnedQty!: number;
  netBalanceInCustody!: number;
  averageTurnaroundDays!: number;
  slaComplianceRate!: number;
}

export class VendorDcItemDto {
  id!: string;
  productId!: string;
  productName!: string;
  quantityDispatched!: number;
  quantityReturned!: number;
  balanceInCustody!: number;
}

export class VendorChallanBreakdownDto {
  dcId!: string;
  challanNumber!: string;
  type!: string;
  status!: string;
  givenDate!: string;
  expectedReturnDate?: string | null;
  actualReceiptDate?: string | null;
  actualTimeTakenDays?: number | null;
  isOverdue!: boolean;
  slaDays?: number | null;
  isSlaBreached!: boolean;
  scNumber?: string | null;
  scId?: string | null;
  poNumber?: string | null;
  poId?: string | null;
  processName?: string | null;
  processCode?: string | null;
  processId?: string | null;
  items!: VendorDcItemDto[];
}

export class VendorItemInCustodyDto {
  productId!: string;
  productName!: string;
  totalDispatched!: number;
  totalReturned!: number;
  balanceInCustody!: number;
}

export class VendorAssociatedProcessDto {
  processId!: string;
  processCode!: string;
  processName!: string;
  totalDcCount!: number;
  openDcCount!: number;
  totalDispatchedQty!: number;
  totalReturnedQty!: number;
  balanceInCustody!: number;
}

export class VendorTraceabilityResponseDto {
  vendor!: VendorTraceabilityMetaDto;
  summary!: VendorTraceabilitySummaryDto;
  challanBreakdown!: VendorChallanBreakdownDto[];
  itemsInCustody!: VendorItemInCustodyDto[];
  associatedProcesses!: VendorAssociatedProcessDto[];
  generatedAt!: string;
}

export class AgeingBucketDto {
  count!: number;
  totalBalanceQty!: number;
}

export class VendorDcAgeingDistributionDto {
  lessThan7Days!: AgeingBucketDto;
  sevenTo14Days!: AgeingBucketDto;
  fifteenTo30Days!: AgeingBucketDto;
  moreThan30Days!: AgeingBucketDto;
}

export class VendorPerformanceAnalyticsSummaryDto {
  totalVendors!: number;
  activeVendors!: number;
  totalDcs!: number;
  openDcs!: number;
  closedDcs!: number;
  overdueDcs!: number;
  overallSlaComplianceRate!: number;
  avgTurnaroundDays!: number;
  totalCustodyQty!: number;
}

export class VendorPerformanceRankingItemDto {
  vendorId!: string;
  vendorCode!: string;
  vendorName!: string;
  totalDcs!: number;
  openDcs!: number;
  closedDcs!: number;
  overdueDcs!: number;
  slaComplianceRate!: number;
  avgTurnaroundDays!: number;
  activeItemsInCustody!: number;
}

export class VendorPerformanceAnalyticsResponseDto {
  summary!: VendorPerformanceAnalyticsSummaryDto;
  ageingDistribution!: VendorDcAgeingDistributionDto;
  vendorRankings!: VendorPerformanceRankingItemDto[];
  generatedAt!: string;
}
