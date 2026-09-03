export interface MaterialIssueItem {
  materialId: string;
  grade: string;
  size: string;
  requiredQty: number;
  issueQty: number;
  unit: string;
  batchNumber?: string;
  heatNumber?: string;
  remarks?: string;
}

export interface IssueMaterialPayload {
  scNumber: string;
  poNumber: string;
  items: MaterialIssueItem[];
  issuedBy?: string;
  remarks?: string;
}

export interface MaterialIssueResult {
  issueId: string;
  scNumber: string;
  status: 'ISSUED' | 'PARTIALLY_ISSUED';
  issuedAt: string;
  itemsIssuedCount: number;
}

export interface StoresAvailabilityStatus {
  scNumber: string;
  totalRequired: number;
  totalAvailable: number;
  totalPending: number;
  items: Array<{
    materialId: string;
    grade: string;
    size: string;
    requiredQty: number;
    availableQty: number;
    isAvailable: boolean;
  }>;
}
