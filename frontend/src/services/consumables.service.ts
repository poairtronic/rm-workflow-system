import { api } from './api';
import type {
  ProductCatalogItem,
  VendorOption,
  CreateConsumableRequestPayload,
  ConsumableLineItemRecord,
  ConsumableItemStatus,
  ConsumableItemTrack,
  ConsumableApprovalStatus,
  ConsumableApprovalQueryParams,
  ConsumableApprovalQueryResponse,
  BulkApproveResponse,
  BulkRejectResponse,
  ConsumableApprovalConfig,
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
  issueQty?: number;
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
        const fallback = await api.get<{ data?: any[]; items?: any[] }>('/api/products?pageSize=100');
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
      const res = await api.get<any>('/api/vendors?limit=500');
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
      const res = await api.get<any>('/api/consumables/warehouse-bins', 'json', true);
      const list = Array.isArray(res) ? res : res?.data || res?.items || [];
      if (list.length > 0) {
        return list.map((b: any) => ({
          id: b.id,
          code: b.code || b.name,
          name: b.name || b.code,
          rack: b.rack,
        }));
      }
    } catch {
      // Continue to fallback
    }

    try {
      const res = await api.get<any>('/api/bins?pageSize=500', 'json', true);
      const list = res?.data || res?.items || (Array.isArray(res) ? res : []);
      if (list.length > 0) {
        return list.map((b: any) => ({
          id: b.id,
          code: b.code || b.name,
          name: b.name || b.code,
          rack: b.rack,
        }));
      }
    } catch {
      // Continue to fallback
    }

    try {
      const fallback = await api.get<any>('/api/master-data/bins?pageSize=500', 'json', true);
      const list = fallback?.data || fallback?.items || (Array.isArray(fallback) ? fallback : []);
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
   * Retrieves active bins that contain positive stock for a given product
   */
  async getProductStockBins(productId: string): Promise<
    Array<{
      binId: string;
      binCode: string;
      binName?: string;
      rackName?: string;
      currentQuantity: number;
    }>
  > {
    try {
      const res = await api.get<any>(`/api/consumables/products/${productId}/stock-bins`, 'json', true);
      return Array.isArray(res) ? res : [];
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
    approvedOnly?: boolean;
    approvalStatus?: ConsumableApprovalStatus;
    limit?: number;
  }): Promise<ConsumableLineItemRecord[]> {
    const q = new URLSearchParams();
    if (params?.track) q.append('track', params.track);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.approvedOnly) q.append('approvedOnly', 'true');
    if (params?.approvalStatus) q.append('approvalStatus', params.approvalStatus);
    q.append('limit', String(params?.limit || 1000));

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await api.get<any>(`/api/consumables/line-items${queryStr}`);
    const rawList: any[] = Array.isArray(res)
      ? res
      : res?.items || res?.data || [];

    return rawList.map((i: any) => ({
      ...i,
      requestedQty: Number(i.requestedQty || 0),
      realReceivedQty: Number(i.realReceivedQty || 0),
      issuedQty: Number(i.issuedQty || 0),
      stockAvailableAtRequest: Number(i.stockAvailableAtRequest || 0),
      requestCode: i.requestCode || i.request?.requestCode || 'CR-N/A',
      productCode: i.productCode || i.product?.code || null,
      binId: i.binId || i.bin?.id || null,
      binCode: i.binCode || i.bin?.code || null,
      vendorName: i.vendorName || i.vendor?.name || null,
    }));
  },

  /**
   * Selects OPEN items and prints purchase requisition, assigning sequential PR number (e.g. 1, 2, ...)
   */
  async printPurchaseRequisition(
    lineItemIdsOrPayload:
      | string[]
      | {
          itemIds?: string[];
          lineItemIds?: string[];
          itemUpdates?: Array<{ id: string; purchaseQty?: number; unitPrice?: number; vendorId?: string }>;
          itemQuantities?: Record<string, number>;
        },
  ): Promise<{
    prNumber: string;
    printedCount: number;
    printedAt: string;
    items: ConsumableLineItemRecord[];
  }> {
    const payload = Array.isArray(lineItemIdsOrPayload)
      ? { itemIds: lineItemIdsOrPayload, lineItemIds: lineItemIdsOrPayload }
      : lineItemIdsOrPayload;
    return api.post<any>('/api/consumables/purchase/print-pr', payload);
  },

  archivePrPdf: (data: { prNumber: string; itemIds: string[] }) =>
    api.post<{ success: boolean; prNumber: string; downloadUrl: string; storageKey: string }>(
      '/api/consumables/requests/archive-pr-pdf',
      data,
    ),

  /**
   * Stores receives purchased item into bin with editable real quantity & atomic STOCK_IN
   */
  async receivePurchase(items: ReceiveItemPayload | ReceiveItemPayload[]): Promise<any> {
    const list = Array.isArray(items) ? items : [items];
    const target = list[0];
    const payload: any = {
      itemId: target?.itemId || target?.lineItemId,
      realReceivedQty: Number(target?.realReceivedQty || 0),
      binId: target?.binId,
      autoIssue: Boolean(target?.autoIssue),
      items: list,
    };
    if (target?.autoIssue && target?.issueQty != null && Number(target.issueQty) > 0) {
      payload.issueQty = Number(target.issueQty);
    }
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

  /**
   * Retrieves consumable SLA & email notification alert settings
   */
  async getAlertSettings(): Promise<{
    consumableEmailAlertsEnabled: boolean;
    consumableReceiptOverdueAlertsEnabled: boolean;
    consumablePartiallyIssuedAlertsEnabled: boolean;
  }> {
    return api.get<any>('/api/consumables/alert-settings');
  },

  /**
   * Updates consumable email alert settings (Admin only)
   */
  async updateAlertSettings(payload: {
    consumableEmailAlertsEnabled?: boolean;
    consumableReceiptOverdueAlertsEnabled?: boolean;
    consumablePartiallyIssuedAlertsEnabled?: boolean;
  }): Promise<any> {
    return api.patch<any>('/api/consumables/alert-settings', payload);
  },

  /**
   * Triggers immediate SLA alert evaluation sweep (>24h receipt overdue & partial issue)
   */
  async checkSlaAlerts(): Promise<{
    overdueReceiptCount: number;
    partiallyIssuedCount: number;
    checkedCount: number;
    timestamp: string;
  }> {
    return api.post<any>('/api/consumables/check-sla-alerts', {});
  },

  /**
   * Deletes a single consumable line item
   */
  async deleteLineItem(itemId: string): Promise<any> {
    return api.delete<any>(`/api/consumables/line-items/${itemId}`);
  },

  /**
   * Bulk deletes multiple consumable line items
   */
  async bulkDeleteLineItems(itemIds: string[]): Promise<any> {
    return api.post<any>('/api/consumables/line-items/bulk-delete', { itemIds });
  },

  /**
   * Deletes an entire consumable request document if none of its items are issued
   */
  async deleteRequest(requestId: string): Promise<any> {
    return api.delete<any>(`/api/consumables/requests/${requestId}`);
  },

  /**
   * Phase P2/P3: Fetches pending approval count for sidebar badge and tabs
   */
  async getPendingApprovalCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>('/api/consumables/approvals/pending-count');
  },

  /**
   * Phase P2/P3: Fetches current approval configuration mode and scope
   */
  async getApprovalConfig(): Promise<ConsumableApprovalConfig> {
    return api.get<ConsumableApprovalConfig>('/api/consumables/approvals/config');
  },

  /**
   * Updates consumable SM approval mode ('ON' | 'OFF') and scope ('ALL' | 'PURCHASE_ONLY')
   */
  async updateApprovalConfig(data: { mode: 'OFF' | 'ON'; scope?: 'ALL' | 'PURCHASE_ONLY' }): Promise<ConsumableApprovalConfig> {
    return api.patch<ConsumableApprovalConfig>('/api/consumables/approvals/config', data);
  },

  /**
   * Phase P2/P3: Queries consumable items by approval status, track, search, dates
   */
  async queryApprovals(params: ConsumableApprovalQueryParams = {}): Promise<ConsumableApprovalQueryResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.track) query.set('track', params.track);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());

    const qs = query.toString();
    const endpoint = `/api/consumables/approvals${qs ? `?${qs}` : ''}`;
    return api.get<ConsumableApprovalQueryResponse>(endpoint);
  },

  /**
   * Phase P2/P3: Bulk approves selected consumable items (up to 200)
   */
  async bulkApprove(itemIds: string[]): Promise<BulkApproveResponse> {
    return api.post<BulkApproveResponse>('/api/consumables/approvals/bulk-approve', { itemIds });
  },

  /**
   * Phase P2/P3: Bulk rejects selected consumable items with mandatory reason
   */
  async bulkReject(itemIds: string[], rejectionReason: string): Promise<BulkRejectResponse> {
    return api.post<BulkRejectResponse>('/api/consumables/approvals/bulk-reject', { itemIds, rejectionReason });
  },
};

export const consumablesService = consumablesApi;
