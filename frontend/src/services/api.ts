import { APP_CONFIG } from '../app/config';
import { toast } from 'react-hot-toast';

class ApiClient {
  private baseUrl: string;

  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor() {
    this.baseUrl = APP_CONFIG.apiBaseUrl;
  }

  private onRefreshed(token: string | null) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string | null) => void) {
    this.refreshSubscribers.push(cb);
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('rm_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private isAuthRoute(endpoint: string): boolean {
    return (
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/refresh') ||
      endpoint.includes('/auth/logout') ||
      endpoint.includes('/auth/forgot-password') ||
      endpoint.includes('/auth/verify-reset-token') ||
      endpoint.includes('/auth/reset-password')
    );
  }

  private async tryRefreshToken(): Promise<string | null> {
    const storedRefreshToken = localStorage.getItem('rm_refresh_token');
    if (!storedRefreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data?.accessToken && data?.refreshToken) {
        localStorage.setItem('rm_access_token', data.accessToken);
        localStorage.setItem('rm_refresh_token', data.refreshToken);
        return data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async handleError(response: Response, endpoint: string, method: string): Promise<never> {
    if (response.status === 401 && !this.isAuthRoute(endpoint)) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    
    let errorMsg = `${method} ${endpoint} failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      const extractedMessage = errorJson?.error?.message || errorJson?.message || errorJson?.error;
      if (extractedMessage) {
        errorMsg = Array.isArray(extractedMessage)
          ? extractedMessage.join(', ')
          : extractedMessage;
      }
    } catch {}
    
    // Global toast for errors, skip 401 as it's handled by AuthContext
    if (response.status === 429) {
      toast.error('Too many requests. Please wait a moment.', { id: 'rate-limit-error' });
    } else if (response.status !== 401) {
      toast.error(errorMsg);
    }
    
    throw new Error(errorMsg);
  }

  private async parseResponseBody<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text || !text.trim()) {
      return null as any;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text as any;
    }
  }

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    responseType: 'json' | 'blob' = 'json',
    isRetry = false,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);

    if (response.status === 401 && !isRetry && !this.isAuthRoute(endpoint)) {
      if (this.isRefreshing) {
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber(async (newToken) => {
            if (newToken) {
              try {
                const retryHeaders: HeadersInit = {
                  ...(options.headers as Record<string, string>),
                  Authorization: `Bearer ${newToken}`,
                };
                const retryRes = await fetch(`${this.baseUrl}${endpoint}`, {
                  ...options,
                  headers: retryHeaders,
                });
                if (!retryRes.ok) {
                  await this.handleError(retryRes, endpoint, options.method || 'GET');
                }
                if (responseType === 'blob') {
                  resolve((await retryRes.blob()) as any);
                } else {
                  resolve(await this.parseResponseBody<T>(retryRes));
                }
              } catch (err) {
                reject(err);
              }
            } else {
              window.dispatchEvent(new Event('auth:unauthorized'));
              reject(new Error('Session expired'));
            }
          });
        });
      }

      this.isRefreshing = true;
      const newToken = await this.tryRefreshToken();
      this.isRefreshing = false;
      this.onRefreshed(newToken);

      if (newToken) {
        const retryHeaders: HeadersInit = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        };
        const retryRes = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: retryHeaders,
        });
        if (!retryRes.ok) {
          await this.handleError(retryRes, endpoint, options.method || 'GET');
        }
        if (responseType === 'blob') {
          return (await retryRes.blob()) as any;
        }
        return this.parseResponseBody<T>(retryRes);
      } else {
        localStorage.removeItem('rm_access_token');
        localStorage.removeItem('rm_refresh_token');
        window.dispatchEvent(new Event('auth:unauthorized'));
        await this.handleError(response, endpoint, options.method || 'GET');
      }
    }

    if (!response.ok) {
      await this.handleError(response, endpoint, options.method || 'GET');
    }

    if (responseType === 'blob') {
      return (await response.blob()) as any;
    }
    return this.parseResponseBody<T>(response);
  }

  async get<T>(endpoint: string, responseType: 'json' | 'blob' = 'json'): Promise<T> {
    return this.requestWithRetry<T>(endpoint, { method: 'GET', headers: this.getHeaders() }, responseType);
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('rm_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.requestWithRetry<T>(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });
  }
}

export const api = new ApiClient();

export function unwrapList(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  if (response && Array.isArray(response.items)) return response.items;
  return [];
}

import type { SweepStatus, InventoryMslStatusResponseDto } from '../types/msl.dto';

export const mslApi = {
  getMslSweepStatus: () => api.get<SweepStatus>('/api/inventory/msl/sweep-status'),
  getInventoryMslStatus: () => api.get<InventoryMslStatusResponseDto>('/api/traceability/analytics/inventory-msl-status'),
  generateEmergencyPO: (payload: any) => api.post<{ success: boolean; message: string }>('/api/purchase-orders/emergency', payload),
};

import type { ProductionProcessDto, CreateProductionProcessDto, UpdateProductionProcessDto, VendorDto } from '../types/process-master.dto';

export const authApi = {
  login: async (data: any) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/login', {
      email: data.employeeId,
      password: data.password,
    });
    return { token: res.accessToken, refreshToken: res.refreshToken, user: res.user };
  },
  refresh: async (refreshToken: string) => {
    return api.post<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/refresh', {
      refreshToken,
    });
  },
  logout: async (refreshToken?: string) => {
    return api.post<{ success: boolean; message: string }>('/api/auth/logout', {
      refreshToken,
    });
  },
  getMe: () => api.get<{ status: string; user: any }>('/api/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ success: boolean; message: string }>('/api/auth/change-password', data),
  forgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/api/auth/forgot-password', { email }),
  verifyResetToken: (token: string) =>
    api.get<{ valid: boolean; email?: string; message?: string }>(
      `/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`,
    ),
  resetPassword: (data: { token: string; newPassword: string }) =>
    api.post<{ success: boolean; message: string }>('/api/auth/reset-password', data),
};

export const productionProcessApi = {
  getAll: async () => {
    const [data, slas] = await Promise.all([
      api.get<any[]>('/api/production-processes'),
      api.get<any[]>('/api/vendors/slas').catch(() => []) // fallback
    ]);
    
    // Group vendors by processId
    const vendorMap = new Map<string, Set<string>>();
    for (const sla of slas) {
      if (!vendorMap.has(sla.processId)) vendorMap.set(sla.processId, new Set());
      vendorMap.get(sla.processId)!.add(sla.vendorId);
    }

    return data.map(p => ({
      id: p.id,
      sequenceId: p.sequenceNumber?.toString() || '',
      nomenclature: p.name || '',
      internalCode: p.code || '',
      description: p.description || '',
      baseUom: 'NOS', // missing in backend
      isActive: p.isActive ?? true,
      expectedCycleTimeMs: 0,
      costCenter: '',
      qcCheckpoints: [],
      linkedVendorIds: Array.from(vendorMap.get(p.id) || []), // REAL data from SLAs!
    })) as ProductionProcessDto[];
  },
  getById: (id: string) => api.get<ProductionProcessDto>(`/api/production-processes/${id}`),
  create: (data: CreateProductionProcessDto) => {
    const backendData = {
      code: data.internalCode,
      name: data.nomenclature,
      sequenceNumber: parseInt(data.sequenceId, 10),
      description: data.description,
      isActive: true,
    };
    return api.post<ProductionProcessDto>('/api/production-processes', backendData);
  },
  update: (id: string, data: UpdateProductionProcessDto) => {
    const backendData = {
      ...(data.internalCode && { code: data.internalCode }),
      ...(data.nomenclature && { name: data.nomenclature }),
      ...(data.sequenceId && { sequenceNumber: parseInt(data.sequenceId, 10) }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
    return api.patch<ProductionProcessDto>(`/api/production-processes/${id}`, backendData);
  },
  getVendors: async () => {
    const vendors = await api.get<any[]>('/api/vendors?isActive=true');
    return vendors.map(v => ({
      id: v.id,
      vendorName: v.name,
      code: v.code,
      isApproved: v.isActive
    })) as VendorDto[];
  },
};

import type {
  VendorSlaDto,
  CreateVendorSlaDto,
  SlaOverrideDto,
  VendorComplianceResult,
  VendorComparisonResult,
  VendorSlaOverrideItem,
} from '../types/vendor-sla.dto';

export const vendorSlaApi = {
  getAll: async () => {
    const raw = await api.get<any>('/api/vendors/slas');
    const slas = unwrapList(raw);
    return slas.map(sla => ({
      id: sla.id,
      vendorName: sla.vendor?.name || '',
      vendorId: sla.vendorId,
      processName: sla.process?.name || '',
      processId: sla.processId,
      standardTatDays: sla.slaDays,
      leadTimeMultiplier: Number(sla.leadTimeMultiplier) || 1.0,
      toleranceBufferDays: sla.toleranceBufferDays || 1,
      isActive: sla.isActive,
      alert24h: sla.alert24h,
      alert48h: sla.alert48h,
      alert72h: sla.alert72h,
      emailAlertsEnabled: sla.emailAlertsEnabled,
      smsAlertsEnabled: sla.smsAlertsEnabled,
    })) as VendorSlaDto[];
  },
  create: async (data: CreateVendorSlaDto) => {
    const backendPayload = {
      processId: data.processId,
      slaDays: data.standardTatDays,
      effectiveDate: new Date().toISOString(),
      isActive: true,
      leadTimeMultiplier: data.leadTimeMultiplier || 1.0,
      toleranceBufferDays: data.toleranceBufferDays || 1,
      alert24h: data.alert24h !== undefined ? data.alert24h : true,
      alert48h: !!data.alert48h,
      alert72h: !!data.alert72h,
      emailAlertsEnabled: data.emailAlertsEnabled !== undefined ? data.emailAlertsEnabled : true,
      smsAlertsEnabled: !!data.smsAlertsEnabled,
    };
    const sla = await api.post<any>(`/api/vendors/${data.vendorId}/slas`, backendPayload);
    return {
      id: sla.id,
      vendorName: sla.vendor?.name || '',
      vendorId: sla.vendorId,
      processName: sla.process?.name || '',
      processId: sla.processId,
      standardTatDays: sla.slaDays,
      leadTimeMultiplier: Number(sla.leadTimeMultiplier) || 1.0,
      toleranceBufferDays: sla.toleranceBufferDays || 1,
      isActive: sla.isActive,
      alert24h: sla.alert24h,
      alert48h: sla.alert48h,
      alert72h: sla.alert72h,
      emailAlertsEnabled: sla.emailAlertsEnabled,
      smsAlertsEnabled: sla.smsAlertsEnabled,
    } as VendorSlaDto;
  },
  updateSla: async (slaId: string, data: Partial<CreateVendorSlaDto & { isActive: boolean }>) => {
    const payload: any = {};
    if (data.standardTatDays !== undefined) payload.slaDays = data.standardTatDays;
    if (data.leadTimeMultiplier !== undefined) payload.leadTimeMultiplier = data.leadTimeMultiplier;
    if (data.toleranceBufferDays !== undefined) payload.toleranceBufferDays = data.toleranceBufferDays;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    return api.patch<any>(`/api/vendors/slas/${slaId}`, payload);
  },
  overrideSla: (slaId: string, data: SlaOverrideDto) =>
    api.post<VendorSlaOverrideItem>(`/api/vendors/slas/${slaId}/override`, data),
  getOverrides: (slaId: string) =>
    api.get<VendorSlaOverrideItem[]>(`/api/vendors/slas/${slaId}/overrides`),
  getCompliance: (vendorId: string) =>
    api.get<VendorComplianceResult>(`/api/vendors/${vendorId}/compliance`),
  compareByProcess: (processId: string) =>
    api.get<VendorComparisonResult[]>(`/api/vendors/compare/by-process/${processId}`),
};

import type { DeliveryChallanDto } from '../types/delivery-challan.dto';
import type { ProcessDcReturnDto, CloseDcDto } from '../types/dc-return.dto';

export const deliveryChallanApi = {
  getAll: async () => {
    const res = unwrapList(await api.get<any[]>('/api/delivery-challans'));
    return res.map((dc: any) => ({
      ...dc,
      dcNumber: dc.challanNumber || dc.dcNumber,
      vendorName: dc.vendor?.name || dc.vendorName,
    })) as DeliveryChallanDto[];
  },
  getAllMovements: async () => {
    return api.get<any[]>('/api/delivery-challans/all-movements');
  },
  create: (data: any) => {
    const isType1 = data.type === 'PRODUCTION_PROCESS_OUTWARD';
    const endpoint = isType1 ? '/api/delivery-challans/type-1' : '/api/delivery-challans/type-2';
    
    const backendPayload = {
      type: data.type,
      vendorId: data.vendorId,
      ...(isType1 && data.scId && { scId: data.scId, processId: data.processId }),
      ...(isType1 && { expectedReturnDate: data.expectedReturnDate }),
      dispatchDate: new Date().toISOString(),
      notes: data.notes || '',
      items: data.items.map((i: any) => ({
        productId: i.productId,
        binId: i.binId || undefined,
        quantityDispatched: Number(i.quantity) || Number(i.quantityDispatched),
        ...(isType1 && { scId: i.scId, processId: i.processId, description: i.description, batchNumber: i.batchNumber }),
        ...(!isType1 && {
          outputProductId: i.outputProductId || undefined,
          expectedOutputQuantity: i.expectedOutputQuantity ? Number(i.expectedOutputQuantity) : undefined,
          outputBinId: i.outputBinId || undefined,
          description: i.description,
          batchNumber: i.batchNumber,
        }),
      }))
    };
    
    return api.post<DeliveryChallanDto>(endpoint, backendPayload);
  },
  processReturn: (id: string, data: ProcessDcReturnDto | any) => {
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    const backendPayload = {
      actualReceiptDate: data?.actualReceiptDate || new Date().toISOString(),
      verificationRemarks: data?.verificationRemarks || '',
      items: rawItems.map((i: any) => {
        const rawQty = i.quantityToReturn !== undefined && i.quantityToReturn !== null
          ? i.quantityToReturn
          : i.receivedQuantity;
        return {
          itemId: i.itemId,
          quantityToReturn: Number(rawQty),
          ...(i.returnedProductId && { returnedProductId: i.returnedProductId }),
          ...(i.destinationBinId && { destinationBinId: i.destinationBinId }),
        };
      })
    };
    return api.post<DeliveryChallanDto>(`/api/delivery-challans/${id}/return`, backendPayload);
  },
  close: (id: string, data: CloseDcDto) => api.patch<DeliveryChallanDto>(`/api/delivery-challans/${id}/close`, data),
  getPrintable: (id: string) => api.get<any>(`/api/delivery-challans/${id}/printable`),
  getNextType2ItemSequence: () =>
    api.get<{ nextSequence: number; formattedCode: string }>('/api/delivery-challans/next-type2-item-sequence'),
};

import type { ConsolidatedTraceabilityDto } from '../types/traceability.dto';
import type { PoConsolidatedTraceabilityDto } from '../types/po-traceability.dto';

export const traceabilityApi = {
  getConsolidated: async (scId: string) => {
    const raw = await api.get<any>(`/api/traceability/sc/${scId}/consolidated`);
    const masterData = {
      scCode: raw?.sc?.scNumber || 'SC',
      poNumber: raw?.po?.poNumber || 'UNKNOWN',
      customerName: raw?.po?.customer?.name || 'Customer',
      nomenclature: raw?.sc?.productName || 'Component',
      drawingNumber: raw?.sc?.drawingNumber || 'N/A',
      fulfillmentStatus: raw?.sc?.status || 'PENDING',
    };
    return {
      ...raw,
      masterData: raw?.masterData || masterData,
      events: raw?.events || [],
      reconciliation: raw?.reconciliation || {
        totalIssuedKg: 0,
        totalConsumedKg: 0,
        totalReturnedUsableKg: 0,
        totalScrapKg: 0,
        varianceKg: 0,
        isBalanced: true,
      },
    } as ConsolidatedTraceabilityDto & any;
  },
  getPoConsolidated: (poId: string) => api.get<PoConsolidatedTraceabilityDto>(`/api/traceability/po/${poId}/consolidated`),
  getPoList: () => api.get<any[]>('/api/po'),
  getScList: (search?: string) => api.get<any[]>(`/api/sc${search ? `?search=${encodeURIComponent(search)}` : ''}`),
};

export const poApi = {
  getAll: () => api.get<any[]>('/api/po'),
  getById: (id: string) => api.get<any>(`/api/po/${id}`),
};

import type { GlobalVendorMetrics, VendorProfileDto, EscalateDcDto } from '../types/vendor-analytics.dto';

export const vendorAnalyticsApi = {
  getPerformanceAnalytics: () => api.get<GlobalVendorMetrics>('/api/traceability/vendors/performance-analytics'),
  getVendorProfile: (vendorId: string) => api.get<VendorProfileDto>(`/api/traceability/vendors/${vendorId}/traceability`),
  escalateDc: (dcNumber: string, data: EscalateDcDto) => api.post(`/api/vendor-slas/escalate/${dcNumber}`, data),
};

export const reportApi = {
  exportReport: (type: string, startDate: string, endDate: string) => 
    api.get<Blob>(`/api/reports/generation?type=${type}&startDate=${startDate}&endDate=${endDate}`, 'blob'),
  exportTraceabilityExcel: (archive = false) =>
    api.get<Blob>(`/api/reports/export/excel/traceability?archive=${archive}`, 'blob'),
  exportStockMovementExcel: (archive = false) =>
    api.get<Blob>(`/api/reports/export/excel/stock-movement?archive=${archive}`, 'blob'),
  exportVendorSlaExcel: (archive = false) =>
    api.get<Blob>(`/api/reports/export/excel/vendor-sla?archive=${archive}`, 'blob'),
  exportDeliveryChallanPdf: (id: string, archive = false) =>
    api.get<Blob>(`/api/reports/export/pdf/delivery-challan/${id}?archive=${archive}`, 'blob'),
  exportMaterialIssueSlipPdf: (id: string, archive = false) =>
    api.get<Blob>(`/api/reports/export/pdf/material-issue/${id}?archive=${archive}`, 'blob'),
};

export { vendorMasterApi } from './vendorMaster.service';
export { userMasterApi } from './userMaster.service';

export const systemSettingsApi = {
  getConfig: () => api.get<any>('/api/notifications/system-config'),
  updateConfig: (data: any) => api.patch<any>('/api/notifications/system-config', data),
};

export const auditLogsApi = {
  getLogs: (params: { search?: string; module?: string; action?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.module && params.module !== 'ALL') q.append('module', params.module);
    if (params.action && params.action !== 'ALL') q.append('action', params.action);
    if (params.limit) q.append('limit', String(params.limit));
    if (params.offset) q.append('offset', String(params.offset));
    return api.get<{ logs: any[]; total: number; limit: number; offset: number }>(`/api/audit/logs?${q.toString()}`);
  },
  exportCsv: (params: { search?: string; module?: string; action?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.module && params.module !== 'ALL') q.append('module', params.module);
    if (params.action && params.action !== 'ALL') q.append('action', params.action);
    return api.get<Blob>(`/api/audit/export-csv?${q.toString()}`, 'blob');
  },
};

export const emailCommunicationApi = {
  getObservability: () => api.get<any>('/api/email/observability'),
  getLogs: (params: { status?: string; search?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'ALL') q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    if (params.limit) q.append('limit', String(params.limit));
    if (params.offset) q.append('offset', String(params.offset));
    return api.get<{ logs: any[]; total: number; limit: number; offset: number }>(`/api/email/logs?${q.toString()}`);
  },
  retryJob: (jobId: string) => api.post<any>(`/api/email/jobs/${jobId}/retry`),
  sendTestEmail: (data: { recipientEmail: string; subject?: string; message?: string }) =>
    api.post<{ success: boolean; message: string; providerMessageId?: string; error?: string }>('/api/email/test-send', data),
};

export const profileApi = {
  getMe: () => api.get<any>('/api/auth/me'),
  updateProfile: (data: { name?: string; department?: string }) => api.patch<any>('/api/auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.post<any>('/api/auth/change-password', data),
};


