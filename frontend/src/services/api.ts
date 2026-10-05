import { APP_CONFIG } from '../app/config';

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

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      let errorMsg = `GET ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
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
      let errorMsg = `POST ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
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
      let errorMsg = `PATCH ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      let errorMsg = `DELETE ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
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
      let errorMsg = `UPLOAD ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }
}

export const api = new ApiClient();

import type { SweepStatus, InventoryMslStatusResponseDto } from '../types/msl.dto';

export const mslApi = {
  getMslSweepStatus: () => api.get<SweepStatus>('/api/inventory/msl/sweep-status'),
  getInventoryMslStatus: () => api.get<InventoryMslStatusResponseDto>('/api/traceability/analytics/inventory-msl-status'),
  generateEmergencyPO: (payload: any) => api.post<{ success: boolean; message: string }>('/api/purchase-orders/emergency', payload),
};

import type { ProductionProcessDto, CreateProductionProcessDto, UpdateProductionProcessDto, VendorDto } from '../types/process-master.dto';

export const productionProcessApi = {
  getAll: () => api.get<ProductionProcessDto[]>('/api/production-processes'),
  getById: (id: string) => api.get<ProductionProcessDto>(`/api/production-processes/${id}`),
  create: (data: CreateProductionProcessDto) => api.post<ProductionProcessDto>('/api/production-processes', data),
  update: (id: string, data: UpdateProductionProcessDto) => api.patch<ProductionProcessDto>(`/api/production-processes/${id}`, data),
  getVendors: () => api.get<VendorDto[]>('/api/vendors/approved'), // Assume there's a vendor endpoint
};

import type { VendorSlaDto, CreateVendorSlaDto, SlaOverrideDto, ComplianceDataPoint } from '../types/vendor-sla.dto';

export const vendorSlaApi = {
  getAll: () => api.get<VendorSlaDto[]>('/api/vendor-slas'),
  create: (data: CreateVendorSlaDto) => api.post<VendorSlaDto>('/api/vendor-slas', data),
  overrideSla: (slaId: string, data: SlaOverrideDto) => api.post<{ success: boolean }>(`/api/vendor-slas/${slaId}/override`, data),
  getCompliance: (vendorId: string) => api.get<ComplianceDataPoint[]>(`/api/vendor-slas/compliance/${vendorId}`)
};

import type { CreateDeliveryChallanDto, DeliveryChallanDto } from '../types/delivery-challan.dto';

export const deliveryChallanApi = {
  create: (data: CreateDeliveryChallanDto) => api.post<DeliveryChallanDto>('/api/delivery-challans', data),
};

