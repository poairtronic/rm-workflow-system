export type DcType = 'PRODUCTION_OUTWARD' | 'RETURN_INWARD' | 'SCRAP_DISPATCH' | 'VENDOR_TRANSFER';

export interface CreateDeliveryChallanItemDto {
  materialCode: string;
  sourceBinId: string;
  batchNumber: string;
  quantity: number;
  uom: string;
}

export interface CreateDeliveryChallanDto {
  type: DcType;
  scCode: string;
  processId: string;
  vendorId: string;
  expectedReturnDate: string; // ISO format
  items: CreateDeliveryChallanItemDto[];
}

export interface DeliveryChallanDto {
  id: string;
  dcNumber: string;
  status: 'DRAFT' | 'ISSUED' | 'IN_TRANSIT' | 'DELIVERED' | 'CLOSED';
  type: DcType;
  scCode: string;
  processId: string;
  vendorId: string;
  vendorName: string;
  processName: string;
  issueDate: string;
  expectedReturnDate: string;
  items: Array<CreateDeliveryChallanItemDto & { id: string }>;
  totalGrossWeight: number;
  cryptographicHash: string;
}
