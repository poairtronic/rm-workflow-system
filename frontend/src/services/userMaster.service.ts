import { api } from './api';
import type {
  UserMasterDto,
  CreateUserMasterDto,
  UpdateUserMasterDto,
  UserRoleType,
} from '../types/user-master.dto';

export const userMasterApi = {
  getAll: () => api.get<UserMasterDto[]>('/api/users'),
  getById: (id: string) => api.get<UserMasterDto>(`/api/users/${id}`),
  create: (data: CreateUserMasterDto) => api.post<UserMasterDto>('/api/users', data),
  update: (id: string, data: UpdateUserMasterDto) => api.put<UserMasterDto>(`/api/users/${id}`, data),
  toggleActive: (id: string, isActive?: boolean) =>
    api.patch<UserMasterDto>(`/api/users/${id}/active`, { isActive }),
  updateRole: (id: string, role: UserRoleType) =>
    api.patch<UserMasterDto>(`/api/users/${id}/role`, { role }),
  activate: (id: string) => api.patch<{ success: boolean; message: string }>(`/api/users/${id}/activate`),
  deactivate: (id: string) => api.patch<{ success: boolean; message: string }>(`/api/users/${id}/deactivate`),
};

