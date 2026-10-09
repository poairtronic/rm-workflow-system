export interface AgeingBucketDto {
  count: number;
  totalBalanceQty: number;
}

export interface VendorDcAgeingDistributionDto {
  lessThan7Days: AgeingBucketDto;
  sevenTo14Days: AgeingBucketDto;
  fifteenTo30Days: AgeingBucketDto;
  moreThan30Days: AgeingBucketDto;
}

export interface VendorPerformanceAnalyticsSummaryDto {
  totalVendors: number;
  activeVendors: number;
  totalDcs: number;
  openDcs: number;
  closedDcs: number;
  overdueDcs: number;
  overallSlaComplianceRate: number;
  avgTurnaroundDays: number;
  totalCustodyQty: number;
}

export interface VendorPerformanceRankingItemDto {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  totalDcs: number;
  openDcs: number;
  closedDcs: number;
  overdueDcs: number;
  slaComplianceRate: number;
  avgTurnaroundDays: number;
  activeItemsInCustody: number;
}

export interface VendorPerformanceAnalyticsResponseDto {
  summary: VendorPerformanceAnalyticsSummaryDto;
  ageingDistribution: VendorDcAgeingDistributionDto;
  vendorRankings: VendorPerformanceRankingItemDto[];
  generatedAt: string;
}

export interface VendorTraceabilityMetaDto {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
}

export interface VendorTraceabilitySummaryDto {
  totalDcCount: number;
  openDcCount: number;
  closedDcCount: number;
  overdueDcCount: number;
  totalDispatchedQty: number;
  totalReturnedQty: number;
  netBalanceInCustody: number;
  averageTurnaroundDays: number;
  slaComplianceRate: number;
}

export interface VendorDcItemDto {
  id: string;
  productId: string;
  productName: string;
  quantityDispatched: number;
  quantityReturned: number;
  balanceInCustody: number;
}

export interface VendorChallanBreakdownDto {
  dcId: string;
  challanNumber: string;
  type: string;
  status: string;
  givenDate: string;
  expectedReturnDate?: string | null;
  actualReceiptDate?: string | null;
  actualTimeTakenDays?: number | null;
  isOverdue: boolean;
  slaDays?: number | null;
  isSlaBreached: boolean;
  scNumber?: string | null;
  scId?: string | null;
  poNumber?: string | null;
  poId?: string | null;
  processName?: string | null;
  processCode?: string | null;
  processId?: string | null;
  items: VendorDcItemDto[];
}

export interface VendorItemInCustodyDto {
  productId: string;
  productName: string;
  totalDispatched: number;
  totalReturned: number;
  balanceInCustody: number;
}

export interface VendorAssociatedProcessDto {
  processId: string;
  processCode: string;
  processName: string;
  totalDcCount: number;
  openDcCount: number;
  totalDispatchedQty: number;
  totalReturnedQty: number;
  balanceInCustody: number;
}

export interface VendorTraceabilityResponseDto {
  vendor: VendorTraceabilityMetaDto;
  summary: VendorTraceabilitySummaryDto;
  challanBreakdown: VendorChallanBreakdownDto[];
  itemsInCustody: VendorItemInCustodyDto[];
  associatedProcesses: VendorAssociatedProcessDto[];
  generatedAt: string;
}

// Chart-friendly ageing bucket
export interface ChartAgeingBucket {
  name: string;
  dcCount: number;
  balanceQty: number;
  color: string;
}

// Legacy aliases to preserve any external imports
export type GlobalVendorMetrics = VendorPerformanceAnalyticsResponseDto;
export type VendorProfileDto = VendorTraceabilityResponseDto;

export interface VendorCustodyItem {
  dcNumber: string;
  scReference: string;
  dispatchedDate: string;
  targetSlaDate: string;
  itemDescription: string;
  quantity: number;
  estimatedValue: number;
  isOverdue: boolean;
}

export interface EscalateDcDto {
  type: 'EMAIL' | 'SMS' | 'MANUAL_CALL';
  notes?: string;
}
