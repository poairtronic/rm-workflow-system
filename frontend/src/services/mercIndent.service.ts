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
    const res = await api.get<MercIndentSummary[]>('/api/merc-indents');
    return Array.isArray(res) ? res : (res as any)?.data || [];
  },

  getMercIndentById: async (id: string): Promise<MercIndentDetail> => {
    return api.get<MercIndentDetail>(`/api/merc-indents/${id}`);
  },

  getMercIndentFullDetail: async (id: string): Promise<MercIndentFullDetail> => {
    return api.get<MercIndentFullDetail>(`/api/merc-indents/${id}/full-detail`);
  },

  getMercItemDetail: async (id: string, itemId: string): Promise<MercItemDetail> => {
    return api.get<MercItemDetail>(`/api/merc-indents/${id}/items/${itemId}`);
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
};

export default mercIndentService;

