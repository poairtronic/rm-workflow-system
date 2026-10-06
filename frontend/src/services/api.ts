import { APP_CONFIG } from '../app/config';
import { toast } from 'react-hot-toast';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = APP_CONFIG.apiBaseUrl;
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

  private async handleError(response: Response, endpoint: string, method: string): Promise<never> {
    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
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
    if (response.status !== 401) {
      toast.error(errorMsg);
    }
    
    throw new Error(errorMsg);
  }

  async get<T>(endpoint: string, responseType: 'json' | 'blob' = 'json'): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      await this.handleError(response, endpoint, 'GET');
    }
    if (responseType === 'blob') {
      return response.blob() as any;
    }
    return response.json();
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      await this.handleError(response, endpoint, 'POST');
    }
    return response.json();
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      await this.handleError(response, endpoint, 'PATCH');
    }
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      await this.handleError(response, endpoint, 'DELETE');
    }
    return response.json();
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('rm_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      await this.handleError(response, endpoint, 'UPLOAD');
    }
    return response.json();
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
    const res = await api.post<{ accessToken: string; user: any }>('/api/auth/login', {
      email: data.employeeId,
      password: data.password,
    });
    return { token: res.accessToken, user: res.user };
  },
  getMe: () => api.get<{ status: string; user: any }>('/api/auth/me'),
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

import type { VendorSlaDto, CreateVendorSlaDto, SlaOverrideDto, ComplianceDataPoint } from '../types/vendor-sla.dto';

export const vendorSlaApi = {
  getAll: async () => {
    const slas = await api.get<any[]>('/api/vendors/slas');
    return slas.map(sla => ({
      id: sla.id,
      vendorName: sla.vendor?.name || '',
      vendorId: sla.vendorId,
      processName: sla.process?.name || '',
      processId: sla.processId,
      standardTatDays: sla.slaDays, // Map from backend slaDays
      isActive: sla.isActive,
    })) as VendorSlaDto[];
  },
  create: async (data: CreateVendorSlaDto) => {
    // Backend expects CreateVendorSlaDto with processId, slaDays, effectiveDate, etc.
    const backendPayload = {
      processId: data.processId,
      slaDays: data.standardTatDays, // Map to backend
      effectiveDate: new Date().toISOString(),
      isActive: true,
    };
    const sla = await api.post<any>(`/api/vendors/${data.vendorId}/slas`, backendPayload);
    return {
      id: sla.id,
      vendorName: sla.vendor?.name || '',
      vendorId: sla.vendorId,
      processName: sla.process?.name || '',
      processId: sla.processId,
      standardTatDays: sla.slaDays,
      isActive: sla.isActive,
    } as VendorSlaDto;
  },
  overrideSla: (slaId: string, data: SlaOverrideDto) => api.post<{ success: boolean }>(`/api/vendor-slas/${slaId}/override`, data),
  getCompliance: (vendorId: string) => api.get<ComplianceDataPoint[]>(`/api/vendor-slas/compliance/${vendorId}`)
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
  create: (data: any) => {
    const isType1 = data.type === 'PRODUCTION_PROCESS_OUTWARD';
    const endpoint = isType1 ? '/api/delivery-challans/type-1' : '/api/delivery-challans/type-2';
    
    const backendPayload = {
      type: data.type,
      vendorId: data.vendorId,
      ...(isType1 && { scId: data.scId, processId: data.processId, expectedReturnDate: data.expectedReturnDate }),
      dispatchDate: new Date().toISOString(),
      notes: data.notes || '',
      items: data.items.map((i: any) => ({
        productId: i.productId,
        binId: i.binId,
        quantityDispatched: Number(i.quantity)
      }))
    };
    
    return api.post<DeliveryChallanDto>(endpoint, backendPayload);
  },
  processReturn: (id: string, data: ProcessDcReturnDto) => {
    const backendPayload = {
      actualReceiptDate: new Date().toISOString(),
      items: data.items.map(i => ({
        itemId: i.itemId,
        quantityToReturn: i.receivedQuantity
      }))
    };
    return api.post<DeliveryChallanDto>(`/api/delivery-challans/${id}/return`, backendPayload);
  },
  close: (id: string, data: CloseDcDto) => api.patch<DeliveryChallanDto>(`/api/delivery-challans/${id}/close`, data),
  getPrintable: (id: string) => api.get<any>(`/api/delivery-challans/${id}/printable`),
};

import type { ConsolidatedTraceabilityDto } from '../types/traceability.dto';
import type { PoConsolidatedTraceabilityDto } from '../types/po-traceability.dto';

export const traceabilityApi = {
  getConsolidated: (scId: string) => api.get<ConsolidatedTraceabilityDto>(`/api/traceability/sc/${scId}/consolidated`),
  getPoConsolidated: (poId: string) => api.get<PoConsolidatedTraceabilityDto>(`/api/traceability/po/${poId}/consolidated`),
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
};

