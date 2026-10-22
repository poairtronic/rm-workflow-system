export type DcType =
  | 'PRODUCTION_PROCESS_OUTWARD'
  | 'GENERAL_INVENTORY_OUTWARD'
  | 'PRODUCTION_OUTWARD'
  | 'RETURN_INWARD'
  | 'SCRAP_DISPATCH'
  | 'VENDOR_TRANSFER'
  | 'GENERAL_OUTWARD'
  | string;

export interface CreateDeliveryChallanItemDto {
  productId?: string;
  binId?: string;
  materialCode?: string;
  sourceBinId?: string;
  batchNumber?: string;
  quantity?: number;
  quantityDispatched?: number;
  outputProductId?: string;
  expectedOutputQuantity?: number;
  outputBinId?: string;
  uom?: string;
  description?: string;
}

export interface CreateDeliveryChallanDto {
  type: DcType;
  scId?: string;
  scCode?: string;
  processId?: string;
  vendorId?: string;
  dispatchDate?: string;
  expectedReturnDate?: string; // ISO format
  destinationEntity?: string;
  purpose?: string;
  notes?: string;
  items: CreateDeliveryChallanItemDto[];
}

export interface DcReworkItemDto {
  id: string;
  sourceDcId: string;
  sourceDcNumber: string;
  dcType: string;
  scId?: string | null;
  scNumber?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  productId: string;
  productName: string;
  partNumber?: string | null;
  uom: string;
  originalVendorId: string;
  originalVendorName: string;
  rejectedQty: number;
  qcRemarks?: string | null;
  reworkStatus: 'PENDING_ACK' | 'MARKED_OKAY' | 'RE_DISPATCHED';
  reworkDcId?: string | null;
  reworkDcNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceDc?: any;
  sc?: any;
  po?: any;
  product?: any;
  originalVendor?: any;
  reworkDc?: any;
}

export interface DeliveryChallanLineItemDto extends CreateDeliveryChallanItemDto {
  id: string;
  quantityDispatched?: number;
  quantityReturned?: number;
  qcPendingQty?: number;
  qcPassedQty?: number;
  qcRejectedQty?: number;
  initialExpectedQty?: number;
  expectedReturnQty?: number;
  actualReceivedQty?: number;
  returnTargetBinId?: string;
  returnTargetBin?: any;
  product?: any;
  bin?: any;
  sc?: any;
  process?: any;
  partNumber?: string | null;
  partName?: string | null;
}

export interface DeliveryChallanDto {
  id: string;
  dcNumber: string;
  challanNumber?: string;
  status: 'OPEN' | 'DISPATCHED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CLOSED' | 'DRAFT' | string;
  type: DcType;
  scId?: string;
  scCode?: string;
  processId?: string;
  vendorId?: string;
  vendorName?: string;
  vendor?: { id: string; name: string; code?: string };
  destinationEntity?: string;
  purpose?: string;
  notes?: string;
  processName?: string;
  issueDate?: string;
  dispatchDate?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  items: DeliveryChallanLineItemDto[];
  reworkItems?: DcReworkItemDto[];
  qcInspections?: any[];
  totalGrossWeight?: number;
  cryptographicHash?: string;
}

export interface DcLifecycleReworkEntry {
  id: string;
  status: 'PENDING_ACK' | 'MARKED_OKAY' | 'RE_DISPATCHED';
  rejectedQty: number;
  uom: string;
  isSameVendor: boolean;
  vendorName: string;
  reworkDcNumber?: string | null;
  dispatchDate?: string | null;
  actualReturnDate?: string | null;
  qcRemarks?: string | null;
  summary: string;
}

export interface DcComprehensiveLifecycleItemDto {
  id: string;
  rowId: string;
  challanId: string;
  challanNumber: string;
  type: DcType;
  typeLabel: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  partNumber: string;
  partName: string;
  productName: string;
  productCode: string;
  uom: string;
  scNumber: string;
  processName: string;

  // Dates & Delivery SLA
  dispatchDate: string | null;
  dispatchDateFormatted: string;
  expectedReturnDate: string | null;
  expectedReturnDateFormatted: string;
  actualReturnDate: string | null;
  actualReturnDateFormatted: string;
  estimatedDays: number | null;
  actualDays: number | null;
  deliveryTurnaround: string;
  isOnTime: boolean;

  // Quantities & Variation
  quantityDispatched: number;
  initialExpectedQty: number;
  revisedExpectedQty: number;
  expectedVariation: number;
  hasVariation: boolean;
  actualReceivedQty: number;
  unreceivedBalance: number;
  isFullyReceived: boolean;

  // QC & Rework
  qcPendingQty: number;
  qcPassedQty: number;
  qcRejectedQty: number;
  reworkEntries: DcLifecycleReworkEntry[];
  reworkSummary: string;

  status: string;
  notes: string;
}

export interface DcLifecycleReportResponse {
  items: DcComprehensiveLifecycleItemDto[];
  kpis: {
    totalChallans: number;
    totalDispatchedUnits: number;
    totalReceivedUnits: number;
    totalVariationUnits: number;
    totalQcPendingUnits: number;
    totalReworkUnits: number;
    onTimeRate: number;
    totalReceiptsCount: number;
    onTimeReceiptCount: number;
  };
}

