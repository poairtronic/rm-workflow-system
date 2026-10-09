import { api } from './api';

export interface SystemModuleDto {
  moduleKey: string;
  name: string;
  groupName: string;
  routePath: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RoleMatrixResponse {
  roles: Array<{ id: string; name: string; description?: string }>;
  modules: SystemModuleDto[];
  matrix: Record<string, string[]>;
}

export interface UserPermissionsResponse {
  userId: string;
  userName: string;
  roleName: string;
  effectiveModules: string[];
  roleModules: string[];
  overrides: Array<{
    moduleKey: string;
    accessType: 'GRANT' | 'REVOKE';
  }>;
}

export interface UserOverrideItem {
  moduleKey: string;
  action: 'GRANT' | 'REVOKE' | 'INHERIT';
}

export const permissionsApi = {
  getAllModules: (): Promise<SystemModuleDto[]> =>
    api.get<SystemModuleDto[]>('/permissions/modules'),

  getRoleMatrix: (): Promise<RoleMatrixResponse> =>
    api.get<RoleMatrixResponse>('/permissions/matrix'),

  updateRolePermissions: (roleId: string, allowedModuleKeys: string[]) =>
    api.put(`/permissions/role/${roleId}`, { allowedModuleKeys }),

  getUserPermissions: (userId: string): Promise<UserPermissionsResponse> =>
    api.get<UserPermissionsResponse>(`/permissions/user/${userId}`),

  updateUserPermissions: (userId: string, overrides: UserOverrideItem[]) =>
    api.put(`/permissions/user/${userId}`, { overrides }),

  getMyModules: (): Promise<UserPermissionsResponse> =>
    api.get<UserPermissionsResponse>('/permissions/my-modules'),
};
