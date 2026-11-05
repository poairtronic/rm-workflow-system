export interface RmIssuedItem {
  rmItemId: string;
  productId: string;
  productName: string;
  spec: string | null;
  binId: string;
  binCode: string;
  rackCode: string;
  originalIssuedQty: number;
  currentBinStock: number;
}

export interface AvailableBin {
  binId: string;
  binCode: string;
  rackCode: string;
  currentQty: number;
}

export interface AvailableProduct {
  productId: string;
  productName: string;
  spec: string | null;
  totalStock: number;
  bins: AvailableBin[];
}

export interface EcrIssuePending {
  id: string;
  ecrId?: string;
  reportNumber: string;
  type: 'REWORK' | 'REJECTION';
  scNumber: string;
  poNumber: string;
  component: string;
  quantityAffected: number;
  status: 'PENDING' | 'ISSUED' | 'PARTIAL' | string;
  issuedAt?: string | null;
  issuedById?: string | null;
  stockTransactionId?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  currentStock?: number;
}

export interface EcrIssueDetail extends EcrIssuePending {
  rmItems: RmIssuedItem[];
  allAvailableProducts: AvailableProduct[];
}

export interface IssueLineItem {
  productId: string;
  binId: string;
  quantityIssued: number;
  productName: string; // for display only
  binLabel: string; // for display only
  maxQty: number; // currentBinStock — for validation
}

export interface IssueEcrPayload {
  items: {
    productId: string;
    binId: string;
    quantityIssued: number;
  }[];
}
