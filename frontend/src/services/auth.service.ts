import { api } from './api';

export interface AuthRolesResponse {
  operationalRoles: string[];
  governanceRoles: string[];
}

export const AuthService = {
  async getRoles(): Promise<AuthRolesResponse> {
    return api.get<AuthRolesResponse>('/api/auth/roles');
  },

  async getDevToken(role?: string): Promise<{ accessToken: string; user: any }> {
    return api.post<{ accessToken: string; user: any }>('/api/auth/dev-token', { role });
  },

  async getProfile(): Promise<any> {
    return api.get<any>('/api/auth/me');
  },
};
