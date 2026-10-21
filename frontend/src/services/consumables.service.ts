import { api } from './api';
import type {
  ProductCatalogItem,
  VendorOption,
  CreateConsumableRequestPayload,
  ConsumableLineItemRecord,
  ConsumableItemStatus,
  ConsumableItemTrack,
} from '../types/consumables.types';

export interface BinOption {
  id: string;
  code: string;
  name?: string;
  rack?: { name?: string };
}

export interface ReceiveItemPayload {
  lineItemId?: string;
  itemId?: string;
  realReceivedQty: number;
  binId: string;
  unitPrice?: number;
  autoIssue?: boolean;
  remarks?: string;
}

export const consumablesApi = {
  /**
   * Fetches the products catalog together with real-time stock balances
   */
  async getCatalogWithStock(): Promise<ProductCatalogItem[]> {
    try {
      const res = await api.get<ProductCatalogItem[]>('/api/consumables/catalog-with-stock');
      return res || [];
    } catch {
      try {
        const fallback = await api.get<{ data?: any[]; items?: any[] }>('/api/master-data/products?pageSize=100');
        const list = fallback.data || fallback.items || (Array.isArray(fallback) ? fallback : []);
        return list.map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          uom: p.uom || 'NOS',
          availableStock: Number(p.currentStock || p.totalStock || 0),
          category: p.category?.name || 'CONSUMABLES',
        }));
      } catch {
        return [];
      }
    }
  },

  /**
   * Fetches active vendors for existing vendor selection
   */
  async getVendors(): Promise<VendorOption[]> {
    try {
      const res = await api.get<any>('/api/vendors?limit=100');
      const list = res?.vendors || res?.data || (Array.isArray(res) ? res : []);
      return list.map((v: any) => ({
        id: v.id,
        name: v.name,
        code: v.code,
        phone: v.phone,
        address: v.address,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Fetches active warehouse bins for stock-in and stock-out operations
   */
  async getWarehouseBins(): Promise<BinOption[]> {
    try {
      const res = await api.get<any>('/api/master-data/bins?pageSize=100');
      const list = res?.data || res?.items || (Array.isArray(res) ? res : []);
      return list.map((b: any) => ({
        id: b.id,
        code: b.code || b.name,
        name: b.name || b.code,
        rack: b.rack,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Submits a new multi-line consumable request (Production)
   */
  async createRequest(payload: CreateConsumableRequestPayload): Promise<any> {
    return api.post<any>('/api/consumables/requests', payload);
  },

  /**
   * Retrieves consumable line items with filters
   */
  async getLineItems(params?: {
    track?: ConsumableItemTrack;
    status?: ConsumableItemStatus;
    search?: string;
  }): Promise<ConsumableLineItemRecord[]> {
    const q = new URLSearchParams();
    if (params?.track) q.append('track', params.track);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await api.get<any>(`/api/consumables/line-items${queryStr}`);
    const rawList: any[] = Array.isArray(res)
      ? res
      : res?.items || res?.data || [];

    return rawList.map((i: any) => ({
      ...i,
      requestCode: i.requestCode || i.request?.requestCode || 'CR-N/A',
      productCode: i.productCode || i.product?.code || null,
      binCode: i.binCode || i.bin?.code || null,
      vendorName: i.vendorName || i.vendor?.name || null,
    }));
  },

  /**
   * Selects OPEN items and prints purchase requisition, assigning sequential PR number (e.g. 151)
   */
  async printPurchaseRequisition(lineItemIds: string[]): Promise<{
    prNumber: string;
    printedCount: number;
    printedAt: string;
    items: ConsumableLineItemRecord[];
  }> {
    return api.post<any>('/api/consumables/purchase/print-pr', {
      itemIds: lineItemIds,
      lineItemIds,
    });
  },

  /**
   * Stores receives purchased item into bin with editable real quantity & atomic STOCK_IN
   */
  async receivePurchase(items: ReceiveItemPayload | ReceiveItemPayload[]): Promise<any> {
    const list = Array.isArray(items) ? items : [items];
    const target = list[0];
    const payload = {
      itemId: target?.itemId || target?.lineItemId,
      realReceivedQty: Number(target?.realReceivedQty || 0),
      binId: target?.binId,
      autoIssue: Boolean(target?.autoIssue),
      items: list,
    };
    return api.post<any>('/api/consumables/purchase/receive', payload);
  },

  /**
   * Stores issues an in-stock or received consumable to production (atomic STOCK_OUT)
   */
  async issueToProduction(itemId: string, payload: { binId: string; issueQty: number }): Promise<any> {
    return api.post<any>(`/api/consumables/line-items/${itemId}/issue-to-production`, payload);
  },

  /**
   * Marks a line item as received on the shop floor by Production
   */
  async confirmProductionReceive(itemId: string): Promise<any> {
    return api.patch<any>(`/api/consumables/line-items/${itemId}/production-receive`, {});
  },
};
