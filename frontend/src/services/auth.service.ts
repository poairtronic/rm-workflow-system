import { api } from './api';
import type { AuthUser } from '../types/auth';

export interface AuthRolesResponse {
  operationalRoles: string[];
  governanceRoles: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const AuthService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return api.post<LoginResponse>('/api/auth/login', { email, password });
  },

  async getRoles(): Promise<AuthRolesResponse> {
    return api.get<AuthRolesResponse>('/api/auth/roles');
  },

  async getDevToken(role?: string): Promise<LoginResponse> {
    return api.post<LoginResponse>('/api/auth/dev-token', { role });
  },

  async getProfile(): Promise<{ status: string; user: AuthUser }> {
    return api.get<{ status: string; user: AuthUser }>('/api/auth/me');
  },
};

