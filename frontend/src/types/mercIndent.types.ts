export interface MercIndentSummary {
  id: string;
  indentNumber: string;
  poNumber: string | null;
  customerName: string | null;
  status: 'PENDING' | 'PARTIAL' | 'ISSUED';
  totalItems: number;
  issuedItems: number;
  createdAt: string;
}

export interface MercLineItem {
  id: string;
  mercItemId: string;
  itemType: 'RAW_MATERIAL' | 'BROUGHT_OUT';
  name: string;
  material: string | null;
  shape: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  diameterMm: number | null;
  quantityRequired: number;
  quantityIssued: number;
  unit: string | null;
  status: 'PENDING' | 'PARTIAL' | 'ISSUED';
  rmProductId?: string | null;
  rmBinId?: string | null;
  currentStock?: number;
}

export interface MercIndentDetail extends MercIndentSummary {
  lineItems: MercLineItem[];
}

export interface MercIndentFullDetail extends MercIndentSummary {
  layoutNumber: string | null;
  mercCurrentState?: string;
  updatedAt?: string;
  lineItems: (MercLineItem & {
    suggestedProducts: SuggestedProduct[];
  })[];
}

export interface SuggestedProductBin {
  binId: string;
  binCode: string;
  rackCode: string;
  currentQty: number;
}

export interface SuggestedProduct {
  productId: string;
  productName: string;
  totalStock: number;
  bins: SuggestedProductBin[];
  isSuggested?: boolean;
}

export interface MercItemDetail extends MercLineItem {
  suggestedProducts: SuggestedProduct[];
}

export interface IssueMercItemPayload {
  productId: string;
  binId: string;
  quantityIssued: number;
}

export interface CreateMercProductPayload {
  name: string;
  description?: string;
  unitId?: string;
  initialStock?: number;
  binId?: string;
}

