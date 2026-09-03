import bcrypt from 'bcryptjs';

export const SEED_ROLES = [
  {
    name: 'ADMIN',
    description:
      'System Administrator with full access to user management and audit logs',
  },
  {
    name: 'DESIGNER',
    description: 'Design Engineer creating and editing Raw Material requirement lists',
  },
  {
    name: 'STORES',
    description: 'Stores Manager checking inventory availability and issuing materials',
  },
  {
    name: 'PRODUCTION',
    description:
      'Production Operator confirming receipts, logging consumption, returns, and completing SC',
  },
  {
    name: 'SENIOR_MANAGER',
    description:
      'Senior Manager responsible for real-time monitoring, alerts, and shop floor analytics (no approval gate)',
  },
  {
    name: 'GENERAL_MANAGER',
    description:
      'General Manager responsible for executive monitoring, alerts, and operational analytics (no approval gate)',
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
      roleName: 'DESIGNER',
      department: 'Design',
    },
    {
      name: 'Anil Kumar',
      email: 'stores@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'STORES',
      department: 'Stores & Inventory',
    },
    {
      name: 'Suresh Patel',
      email: 'production@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'PRODUCTION',
      department: 'Machining Shop Floor',
    },
    {
      name: 'Vikram Mehta',
      email: 'senior.manager@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'SENIOR_MANAGER',
      department: 'Operations Monitoring',
    },
    {
      name: 'Dr. Arvind Swaminathan',
      email: 'general.manager@airtronic.com',
      passwordHash: defaultPasswordHash,
      roleName: 'GENERAL_MANAGER',
      department: 'Executive Governance',
    },
  ];
}
