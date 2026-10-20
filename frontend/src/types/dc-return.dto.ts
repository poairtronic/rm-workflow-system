export interface ProcessDcReturnItemDto {
  itemId: string;
  receivedQuantity: number;
  quantityToReturn?: number;
  usableQuantity?: number;
  scrapQuantity?: number;
  returnedProductId?: string;
  destinationBinId?: string;
  targetBinId?: string;
  actualInwardQty?: number;
  actualReceivedQty?: number;
  expectedReturnQty?: number;
  expectedOutputQuantity?: number;
  conditionNotes?: string;
  _isSplit?: boolean;
}

export interface ProcessDcReturnDto {
  actualReceiptDate?: string;
  verificationRemarks?: string;
  items: ProcessDcReturnItemDto[];
}

export interface CloseDcDto {
  closureNotes: string;
}

export interface QcInspectItemDto {
  itemId: string;
  passedQty: number;
  rejectedQty: number;
  actualStoreInwardQty?: number;
  targetBinId?: string;
  qcRemarks?: string;
}

export interface QcInspectDcDto {
  inspectionDate?: string;
  items: QcInspectItemDto[];
}

export interface ReworkReDispatchDto {
  vendorId: string;
  targetReturnDate?: string;
  notes?: string;
}

