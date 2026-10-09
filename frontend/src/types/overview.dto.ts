export interface OverviewSummaryDto {
  activeShopFloorScs: number;
  totalStockQuantity: number;
  totalCustodyUnits: number;
  openDeliveryChallans: number;
  lowStockAlerts: number;
}

export interface OverviewRecentScDto {
  id: string;
  sc_number: string;
  product_name: string;
  drawing_number?: string | null;
  target_quantity: number | string;
  status: string;
  po_number?: string | null;
  created_at: string;
}

export interface OverviewRmWorkflowDto {
  scStatusMap: Record<string, number>;
  rmStatusMap: Record<string, number>;
  totalScs: number;
  totalConsumptions: number;
  totalConsumedQty: number;
  totalReturns: number;
  recentScs: OverviewRecentScDto[];
}

export interface OverviewTxTypeItemDto {
  type: string;
  count: number;
  quantity: number;
}

export interface OverviewTopStockItemDto {
  product_id: string;
  product_name: string;
  product_code: string;
  uom: string;
  minimum_inventory: number | string;
  bin_code: string;
  bin_name: string;
  rack_name?: string | null;
  warehouse_name?: string | null;
  current_quantity: number | string;
}

export interface OverviewStockInventoryDto {
  totalStockBalances: number;
  totalStockQuantity: number;
  txTypeBreakdown: OverviewTxTypeItemDto[];
  topStockItems: OverviewTopStockItemDto[];
  lowStockCount: number;
}

export interface OverviewDcStatusItemDto {
  status: string;
  type: string;
  count: number;
}

export interface OverviewVendorCustodyItemDto {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  pendingQty: number;
  openDcs: number;
}

export interface OverviewRecentDcDto {
  id: string;
  challan_number: string;
  type: string;
  status: string;
  dispatch_date: string;
  expected_return_date?: string | null;
  vendor_name: string;
  dispatched_qty: number | string;
  returned_qty: number | string;
  pending_qty: number | string;
}

export interface OverviewDeliveryChallanDto {
  totalDcs: number;
  openDcs: number;
  closedDcs: number;
  totalCustodyQty: number;
  dcStatusBreakdown: OverviewDcStatusItemDto[];
  vendorCustody: OverviewVendorCustodyItemDto[];
  recentDcs: OverviewRecentDcDto[];
}

export interface UnifiedOverviewResponseDto {
  summary: OverviewSummaryDto;
  rmWorkflow: OverviewRmWorkflowDto;
  stockInventory: OverviewStockInventoryDto;
  deliveryChallan: OverviewDeliveryChallanDto;
}

