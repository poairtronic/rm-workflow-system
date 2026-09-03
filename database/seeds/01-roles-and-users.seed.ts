import bcrypt from 'bcryptjs';

export const SEED_ROLES = [
  {
    name: 'ADMIN',
    description:
      'System Administrator with full access to user management and audit logs',
  },
  {
    name: 'DESIGN_USER',
    description: 'Design Engineer creating and editing Raw Material requirement lists',
  },
  {
    name: 'SENIOR_MANAGER',
    description:
      'Senior Design Manager verifying, editing, approving, and rejecting RM lists',
  },
  {
    name: 'STORES_MANAGER',
    description:
      'Stores Manager checking material availability and issuing raw materials',
  },
  {
    name: 'PRODUCTION_USER',
    description:
      'Production Operator confirming receipts, logging consumption, returns and exceptions',
  },
  {
    name: 'ACCOUNTS',
    description: 'Accounts & Commercial governance observer',
  },
  {
    name: 'MANAGEMENT',
    description: 'Executive management observer for shop floor metrics and throughput',
  },
];

export async function getSeedUsers() {
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  return [
    {
      name: 'System Admin',
      email: 'admin@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'ADMIN',
      department: 'Management',
    },
    {
      name: 'Rajesh Sharma',
      email: 'designer@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'DESIGN_USER',
      department: 'Design',
    },
    {
      name: 'Vikram Mehta',
      email: 'senior.design@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'SENIOR_MANAGER',
      department: 'Design Review',
    },
    {
      name: 'Anil Kumar',
      email: 'stores.manager@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'STORES_MANAGER',
      department: 'Stores & Inventory',
    },
    {
      name: 'Suresh Patel',
      email: 'production.user@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'PRODUCTION_USER',
      department: 'Machining Shop Floor',
    },
  ];
}
