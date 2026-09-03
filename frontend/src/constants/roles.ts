export const USER_ROLES = {
  ADMIN: 'ADMIN',
  DESIGNER: 'DESIGNER',
  STORES: 'STORES',
  PRODUCTION: 'PRODUCTION',
  SENIOR_MANAGER: 'SENIOR_MANAGER',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
} as const;

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  ADMIN: 'System Admin',
  DESIGNER: 'Design Engineer',
  STORES: 'Stores Manager',
  PRODUCTION: 'Production Operator',
  SENIOR_MANAGER: 'Senior Manager (Monitoring & Alerts)',
  GENERAL_MANAGER: 'General Manager (Monitoring & Alerts)',
};
