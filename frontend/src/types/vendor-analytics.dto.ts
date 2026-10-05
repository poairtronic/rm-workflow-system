export interface AgeingBucket {
  name: string; // '<7 days', '7-14 days', '15-30 days', '>30 days'
  dcCount: number;
  value: number;
  color: string;
}

export interface GlobalVendorMetrics {
  totalVendorsActive: number;
  globalSlaAdherencePercentage: number;
  totalValueInCustody: number;
  criticalOverdueItems: number;
  ageingBuckets: AgeingBucket[];
}

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

export interface VendorProfileDto {
  vendorId: string;
  vendorName: string;
  contactName: string;
  contactEmail: string;
  historicalSlaScore: number;
  custodyItems: VendorCustodyItem[];
}

export interface EscalateDcDto {
  type: 'EMAIL' | 'SMS' | 'MANUAL_CALL';
  notes?: string;
}
