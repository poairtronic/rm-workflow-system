import { api } from './api';

export interface SC {
  id: string;
  scNumber: string;
  poId?: string;
  purchaseOrder?: { poNumber: string };
  productName: string;
  description?: string;
  drawingNumber?: string;
  targetQuantity: number;
  status: string;
  rmRequest?: any;
  rmItems?: any[];
  completedAt?: string;
  createdAt?: string;
}

export interface RMRequest {
  id: string;
  scId: string;
  status: string;
  remarks?: string;
  items?: any[];
  salesOrderComponent?: SC;
}

export interface MaterialIssue {
  id: string;
  scId: string;
  issueNumber: string;
  issueType: string;
  remarks?: string;
  items: any[];
  createdAt: string;
}

export interface AccountingItem {
  rmItemId: string;
  material: string;
  grade: string;
  size: string;
  required: number;
  issued: number;
  received: number;
  consumed: number;
  returned: number;
  unaccounted: number;
}

export interface MaterialAccounting {
  scId: string;
  scNumber: string;
  status: string;
  items: AccountingItem[];
}

export const workflowService = {
  // SC
  createSc: (data: { poNumber: string; scNumber: string; productName: string; targetQuantity?: number; description?: string }) =>
    api.post<SC>('/api/sc', data),
  getScList: (search?: string) =>
    api.get<SC[]>(`/api/sc${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getScById: (id: string) => api.get<SC>(`/api/sc/${id}`),
  completeSc: (id: string, remarks?: string) => api.post<SC>(`/api/sc/${id}/complete`, { remarks }),
  closeSc: (id: string, remarks?: string) => api.post<SC>(`/api/sc/${id}/close`, { remarks }),

  // RM
  createRm: (scId: string, remarks?: string) => api.post<RMRequest>('/api/rm', { scId, remarks }),
  addRmItem: (rmId: string, item: { material: string; grade: string; size: string; quantity: number; remarks?: string }) =>
    api.post<any>(`/api/rm/${rmId}/items`, item),
  submitRm: (rmId: string, remarks?: string) => api.post<RMRequest>(`/api/rm/${rmId}/submit`, { remarks }),
  getRmList: (scId?: string) => api.get<RMRequest[]>(`/api/rm${scId ? `?scId=${scId}` : ''}`),
  getRmById: (id: string) => api.get<RMRequest>(`/api/rm/${id}`),

  // Material Issue (Stores)
  createIssue: (scId: string, items: { rmItemId: string; binId: string; quantityIssued: number; heatNumber?: string; batchNumber?: string }[], remarks?: string) =>
    api.post<MaterialIssue>('/api/material-issues', { scId, items, remarks }),
  getIssueList: (scId?: string) => api.get<MaterialIssue[]>(`/api/material-issues${scId ? `?scId=${scId}` : ''}`),

  // Production
  receiveMaterial: (scId: string, items: { rmItemId: string; quantityReceived: number }[], remarks?: string) =>
    api.post<any>('/api/production/receipt', { scId, items, remarks }),
  recordConsumption: (scId: string, rmItemId: string, quantityConsumed: number, remarks?: string) =>
    api.post<any>('/api/production/consume', { scId, rmItemId, quantityConsumed, remarks }),
  recordReturn: (scId: string, items: { rmItemId: string; quantityReturned: number }[], remarks?: string) =>
    api.post<any>('/api/production/return', { scId, items, remarks }),
  verifyReturn: (returnId: string, destinationBinId: string, remarks?: string) =>
    api.post<any>(`/api/production/return/${returnId}/verify`, { destinationBinId, remarks }),
  getAccounting: (scId: string) => api.get<MaterialAccounting>(`/api/production/accounting/${scId}`),

  // Additional Request
  createAdditionalRequest: (scId: string, items: { rmItemId?: string; material: string; quantity: number }[], remarks?: string) =>
    api.post<any>('/api/additional-requests', { scId, items, remarks }),
  getAdditionalRequests: (scId?: string) =>
    api.get<any[]>(`/api/additional-requests${scId ? `?scId=${scId}` : ''}`),

  // Files & Documents (Phase 14.3, 14.5)
  uploadFile: (formData: FormData) => api.upload<any>('/api/files', formData),
  getRmDocuments: (rmId: string) => api.get<any[]>(`/api/rm/${rmId}/documents`),
  attachRmDocument: (rmId: string, fileId: string, documentType?: string) =>
    api.post<any>(`/api/rm/${rmId}/documents`, { fileId, documentType }),
  detachRmDocument: (rmId: string, attachmentId: string) =>
    api.delete<any>(`/api/rm/${rmId}/documents/${attachmentId}`),
  getRmDocumentDownloadUrl: (rmId: string, attachmentId: string) =>
    api.get<{ url: string }>(`/api/rm/${rmId}/documents/${attachmentId}/download`),

  // PO Supporting Documents (Phase 14.5)
  getPoDocuments: (poId: string) => api.get<any[]>(`/api/po/${poId}/documents`),
  attachPoDocument: (poId: string, fileId: string, documentType?: string) =>
    api.post<any>(`/api/po/${poId}/documents`, { fileId, documentType }),
  detachPoDocument: (poId: string, attachmentId: string) =>
    api.delete<any>(`/api/po/${poId}/documents/${attachmentId}`),
  getPoDocumentDownloadUrl: (poId: string, attachmentId: string) =>
    api.get<{ url: string }>(`/api/po/${poId}/documents/${attachmentId}/download`),

  // SC Supporting Documents (Phase 14.5)
  getScDocuments: (scId: string) => api.get<any[]>(`/api/sc/${scId}/documents`),
  attachScDocument: (scId: string, fileId: string, documentType?: string) =>
    api.post<any>(`/api/sc/${scId}/documents`, { fileId, documentType }),
  detachScDocument: (scId: string, attachmentId: string) =>
    api.delete<any>(`/api/sc/${scId}/documents/${attachmentId}`),
  getScDocumentDownloadUrl: (scId: string, attachmentId: string) =>
    api.get<{ url: string }>(`/api/sc/${scId}/documents/${attachmentId}/download`),
};
