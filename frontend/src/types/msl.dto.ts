export interface InventoryMslItemDto {
  productId: string;
  productName: string;
  categoryName: string;
  familyName: string;
  currentStock: number;
  minimumInventory: number;
  maximumInventory?: number | null;
  deficitQty: number;
  status: string; // 'NORMAL' | 'BELOW_MSL' | 'CRITICAL' | 'OUT_OF_STOCK'
}

export interface InventoryMslSummaryDto {
  totalMonitoredProducts: number;
  normalStockCount: number;
  belowMslCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  totalDeficitQty: number;
}

export interface InventoryMslStatusResponseDto {
  summary: InventoryMslSummaryDto;
  items: InventoryMslItemDto[];
  generatedAt: string;
}

export interface SweepStatus {
  isRunning: boolean;
  lastSweepTime: string | null;
  lastSweepStats: {
    totalEvaluated: number;
    created: number;
    suppressed: number;
    resolved: number;
    unaffected: number;
    durationMs: number;
  } | null;
}
