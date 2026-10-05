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
  uom?: string;
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
  items: Array<CreateDeliveryChallanItemDto & { id: string; quantityDispatched?: number; quantityReturned?: number; product?: any; bin?: any }>;
  totalGrossWeight?: number;
  cryptographicHash?: string;
}
