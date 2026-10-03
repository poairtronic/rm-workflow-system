export interface RmUsageItemBreakdown {
  rmItemId: string;
  material: string;
  grade: string;
  size: string;
  uom: string;
  originalRequested: number;
  initialIssued: number;
  additionalIssued: number;
  totalIssued: number;
  totalConsumed: number;
  totalReturned: number;
  pendingReturned: number;
  finalRmUsed: number;
  variance: number;
  isZeroLossVerified: boolean;
}

export interface FinalRmUsageSummary {
  originalRm: number;
  initialIssued: number;
  additionalRm: number;
  totalIssued: number;
  totalConsumed: number;
  totalReturned: number;
  pendingReturned: number;
  finalRmUsed: number;
  variance: number;
  isZeroLossVerified: boolean;
}

export interface FinalRmUsageResponseDto {
  scId: string;
  scNumber: string;
  productName: string;
  targetQuantity: number;
  status: string;
  summary: FinalRmUsageSummary;
  items: RmUsageItemBreakdown[];
  generatedAt: string;
}
