import { api } from './api';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StockBalance {
  id: string;
  productId: string;
  productCode?: string;
  productName?: string;
  uom?: string;
  msl?: number;
  binId: string;
  binCode?: string;
  warehouseName?: string;
  currentQuantity: number;
  latestLotBatchNumber?: string;
}

export interface StockTransaction {
  id: string;
  productId: string;
  product?: { name: string; code: string; uom?: string };
  inventoryItemId?: string;
  sourceBinId?: string;
  sourceBin?: { code: string };
  destinationBinId?: string;
  destinationBin?: { code: string };
  transactionType: string;
  adjustmentDirection?: string;
  quantity: number;
  referenceType: string;
  referenceId?: string;
  reason?: string;
  remarks?: string;
  lotBatchNumber?: string;
  cost?: number;
  createdAt: string;
  createdBy?: { name: string; email: string };
}

export interface ProductBinBalance {
  id: string;
  binId: string;
  binCode?: string;
  warehouseName?: string;
  productId: string;
  currentQuantity: number;
}

export interface ModernStockInPayload {
  productId: string;
  binId: string;
  quantity: number;
  reason: string;
  remarks?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface ModernStockOutPayload {
  productId: string;
  binId: string;
  quantity: number;
  reason: string;
  remarks?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface ModernStockAdjustmentPayload {
  productId: string;
  binId: string;
  quantity: number;
  direction: 'INCREASE' | 'DECREASE';
  reason: string;
  remarks?: string;
  referenceType?: string;
  referenceId?: string;
}

export const inventoryService = {
  getAllBalances: async (params?: any): Promise<PaginatedResponse<StockBalance>> => {
    const query = new URLSearchParams(params as any).toString();
    const response = await api.get<PaginatedResponse<StockBalance>>(`/api/inventory/balances?${query}`);
    return response;
  },
  
  getBalancesByProduct: async (productId: string): Promise<ProductBinBalance[]> => {
    const response = await api.get<ProductBinBalance[]>(`/api/inventory/balances?productId=${productId}`);
    return response;
  },

  getAllTransactions: async (params?: any): Promise<PaginatedResponse<StockTransaction>> => {
    const queryObj: any = {};
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== '') queryObj[k] = params[k];
      });
    }
    const query = new URLSearchParams(queryObj).toString();
    const response = await api.get<PaginatedResponse<StockTransaction>>(`/api/inventory/transactions?${query}`);
    return response;
  },

  stockIn: async (payload: ModernStockInPayload) => {
    return api.post<{ transaction: StockTransaction; balance: StockBalance }>(
      '/api/inventory/stock-in',
      payload,
    );
  },

  stockOut: async (payload: ModernStockOutPayload) => {
    return api.post<{ transaction: StockTransaction; balance: StockBalance }>(
      '/api/inventory/stock-out',
      payload,
    );
  },

  adjustStock: async (payload: ModernStockAdjustmentPayload) => {
    return api.post<{ transaction: StockTransaction; balance: StockBalance }>(
      '/api/inventory/adjustment',
      payload,
    );
  },
};
