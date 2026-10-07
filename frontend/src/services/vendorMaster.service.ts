import { api } from './api';
import type {
  VendorMasterDto,
  CreateVendorMasterDto,
  UpdateVendorMasterDto,
} from '../types/vendor-master.dto';

export const vendorMasterApi = {
  getAll: (params?: { isActive?: boolean; search?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<VendorMasterDto[]>(`/api/vendors${qs}`);
  },
  getById: (id: string) => api.get<VendorMasterDto>(`/api/vendors/${id}`),
  create: (data: CreateVendorMasterDto) => api.post<VendorMasterDto>('/api/vendors', data),
  update: (id: string, data: UpdateVendorMasterDto) => api.patch<VendorMasterDto>(`/api/vendors/${id}`, data),
  toggleActive: (id: string) => api.patch<VendorMasterDto>(`/api/vendors/${id}/toggle-active`),
  delete: (id: string) => api.delete<{ success: boolean; message: string }>(`/api/vendors/${id}`),
};

