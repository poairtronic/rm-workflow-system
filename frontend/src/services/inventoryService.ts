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
}

export interface StockTransaction {
  id: string;
  productId: string;
  product?: { name: string; code: string };
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
  createdAt: string;
  createdBy?: { name: string; email: string };
}

export const inventoryService = {
  getAllBalances: async (params?: any): Promise<PaginatedResponse<StockBalance>> => {
    const response = await api.get('/inventory/balances', { params });
    return response.data;
  },
  
  getAllTransactions: async (params?: any): Promise<PaginatedResponse<StockTransaction>> => {
    const response = await api.get('/inventory/transactions', { params });
    return response.data;
  }
};
