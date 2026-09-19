export enum ReconciliationStatus {
  MATCH = 'MATCH',
  MISMATCH = 'MISMATCH',
  NOT_RECONCILABLE = 'NOT_RECONCILABLE',
}

export class ReconciliationResultDto {
  inventoryItemId?: string;
  stockBalanceId!: string;
  productId?: string;
  productName?: string;
  binId?: string;
  binCode?: string;

  material!: string;
  grade!: string;
  size!: string;

  currentBalance!: number;
  ledgerMovement!: number;
  openingBalance!: number | null;
  expectedBalance!: number | null;
  difference!: number | null;
  status!: ReconciliationStatus;
  reason?: string;
}
