export type UserRoleType =
  | 'ADMIN'
  | 'DESIGNER'
  | 'STORES'
  | 'PRODUCTION'
  | 'SENIOR_MANAGER'
  | 'GENERAL_MANAGER';

export interface UserRoleDto {
  id: string;
  name: UserRoleType;
  description?: string;
}

export interface UserMasterDto {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role?: UserRoleDto;
  department?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserMasterDto {
  name: string;
  email: string;
  role: UserRoleType;
  department?: string;
  isActive?: boolean;
  password?: string;
}

export interface UpdateUserMasterDto {
  name?: string;
  email?: string;
  role?: UserRoleType;
  department?: string;
}

