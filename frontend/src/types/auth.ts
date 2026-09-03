export type UserRole =
  | 'ADMIN'
  | 'DESIGN_USER'
  | 'SENIOR_MANAGER'
  | 'STORES_MANAGER'
  | 'PRODUCTION_USER'
  | 'ACCOUNTS'
  | 'PRODUCTION_MANAGER'
  | 'MANAGEMENT';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  department?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
}
