export type UserRole =
  'ADMIN' | 'DESIGNER' | 'STORES' | 'PRODUCTION' | 'SENIOR_MANAGER' | 'GENERAL_MANAGER';

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
