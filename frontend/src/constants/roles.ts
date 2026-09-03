export const USER_ROLES = {
  ADMIN: 'ADMIN',
  DESIGN_USER: 'DESIGN_USER',
  SENIOR_MANAGER: 'SENIOR_MANAGER',
  STORES_MANAGER: 'STORES_MANAGER',
  PRODUCTION_USER: 'PRODUCTION_USER',
  ACCOUNTS: 'ACCOUNTS',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  MANAGEMENT: 'MANAGEMENT',
} as const;

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  ADMIN: 'System Admin',
  DESIGN_USER: 'Design Engineer',
  SENIOR_MANAGER: 'Senior Design Manager',
  STORES_MANAGER: 'Stores Manager',
  PRODUCTION_USER: 'Production Operator',
  ACCOUNTS: 'Accounts / Costing',
  PRODUCTION_MANAGER: 'Production Manager',
  MANAGEMENT: 'Executive Management',
};
