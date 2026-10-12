export interface ProcessDcReturnItemDto {
  itemId: string;
  receivedQuantity: number;
  usableQuantity?: number;
  scrapQuantity?: number;
  returnedProductId?: string;
  destinationBinId?: string;
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
