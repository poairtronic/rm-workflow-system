import { api } from './api';
import type {
  MercIndentSummary,
  MercIndentDetail,
  MercIndentFullDetail,
  MercItemDetail,
  IssueMercItemPayload,
  CreateMercProductPayload,
} from '../types/mercIndent.types';

export const mercIndentService = {
  getMercIndents: async (): Promise<MercIndentSummary[]> => {
    const res = await api.get<any>('/api/merc-indents');
    const list = Array.isArray(res) ? res : res?.data;
    return Array.isArray(list) ? list : [];
  },

  getMercIndentById: async (id: string): Promise<MercIndentDetail> => {
    const res = await api.get<any>(`/api/merc-indents/${id}`);
    const data =
      res?.data && typeof res.data === 'object' && !Array.isArray(res.data) && res.data.id
        ? res.data
        : res || {};
    return {
      ...data,
      lineItems: Array.isArray(data?.lineItems) ? data.lineItems : [],
    };
  },

  getMercIndentFullDetail: async (id: string): Promise<MercIndentFullDetail> => {
    const res = await api.get<any>(`/api/merc-indents/${id}/full-detail`);
    const data =
      res?.data && typeof res.data === 'object' && !Array.isArray(res.data) && res.data.id
        ? res.data
        : res || {};
    return {
      ...data,
      lineItems: (Array.isArray(data?.lineItems) ? data.lineItems : []).map((item: any) => ({
        ...item,
        suggestedProducts: (Array.isArray(item?.suggestedProducts) ? item.suggestedProducts : []).map(
          (p: any) => ({
            ...p,
            bins: Array.isArray(p?.bins) ? p.bins : [],
          }),
        ),
      })),
    };
  },

  getMercItemDetail: async (id: string, itemId: string): Promise<MercItemDetail> => {
    const res = await api.get<any>(`/api/merc-indents/${id}/items/${itemId}`);
    const data =
      res?.data && typeof res.data === 'object' && !Array.isArray(res.data) && res.data.id
        ? res.data
        : res || {};
    return {
      ...data,
      suggestedProducts: (Array.isArray(data?.suggestedProducts) ? data.suggestedProducts : []).map(
        (p: any) => ({
          ...p,
          bins: Array.isArray(p?.bins) ? p.bins : [],
        }),
      ),
    };
  },

  issueMercItem: async (
    id: string,
    itemId: string,
    payload: IssueMercItemPayload,
  ): Promise<{
    success: boolean;
    newItemStatus: string;
    newIndentStatus: string;
    stockTransactionId: string;
  }> => {
    return api.post(`/api/merc-indents/${id}/items/${itemId}/issue`, payload);
  },

  createAndStockProduct: async (
    payload: CreateMercProductPayload,
  ): Promise<{
    id: string;
    name: string;
    code: string;
    uom: string;
    initialStock: number;
    binId: string | null;
  }> => {
    return api.post('/api/merc-indents/products/create-and-stock', payload);
  },

  syncFromMerc: async (): Promise<{
    success: boolean;
    totalFetched: number;
    newlyAdded: number;
    message: string;
  }> => {
    const res = await api.post<any>('/api/merc-indents/sync');
    return res?.data && res.data.success !== undefined ? res.data : res;
  },
};

export default mercIndentService;
