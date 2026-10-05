export interface ProcessDcReturnItemDto {
  itemId: string;
  receivedQuantity: number;
  usableQuantity: number;
  scrapQuantity: number;
  conditionNotes?: string;
  _isSplit?: boolean;
}

export interface ProcessDcReturnDto {
  items: ProcessDcReturnItemDto[];
}

export interface CloseDcDto {
  closureNotes: string;
}
