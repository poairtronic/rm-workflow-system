import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const SEED_ROLES = [
  { name: 'ADMIN', description: 'System Administrator with full access' },
  { name: 'DESIGNER', description: 'Design Engineer creating RM requirement lists' },
  { name: 'STORES', description: 'Stores Manager checking inventory and issuing materials' },
  { name: 'PRODUCTION', description: 'Production Operator logging receipts and returns' },
  { name: 'SENIOR_MANAGER', description: 'Senior Manager for operations monitoring' },
  { name: 'GENERAL_MANAGER', description: 'General Manager for executive governance' },
];

const SEED_USERS = [
  {
    name: 'System Admin',
    email: 'admin@airtronic.com',
    roleName: 'ADMIN',
    department: 'Management',
  },
  {
    name: 'Rajesh Sharma',
    email: 'designer@airtronic.com',
    roleName: 'DESIGNER',
    department: 'Design',
  },
  {
    name: 'Anil Kumar',
    email: 'stores@airtronic.com',
    roleName: 'STORES',
    department: 'Stores & Inventory',
  },
  {
    name: 'Suresh Patel',
    email: 'production@airtronic.com',
    roleName: 'PRODUCTION',
    department: 'Machining Shop Floor',
  },
  {
    name: 'Vikram Mehta',
    email: 'senior.manager@airtronic.com',
    roleName: 'SENIOR_MANAGER',
    department: 'Operations Monitoring',
  },
  {
    name: 'Dr. Arvind Swaminathan',
    email: 'general.manager@airtronic.com',
    roleName: 'GENERAL_MANAGER',
    department: 'Executive Governance',
  },
];

async function seed() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[Seed] Connected to PostgreSQL database.');

  // 1. Seed Roles
  const roleMap = {};
  for (const r of SEED_ROLES) {
    let res = await client.query('SELECT id FROM roles WHERE name = $1', [r.name]);
    if (res.rows.length === 0) {
      res = await client.query(
        'INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id',
        [r.name, r.description]
      );
    }
    roleMap[r.name] = res.rows[0].id;
  }

  // 2. Seed Users
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const userMap = {};

  for (const u of SEED_USERS) {
    const roleId = roleMap[u.roleName];
    let res = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (res.rows.length === 0) {
      res = await client.query(
        'INSERT INTO users (id, name, email, password_hash, role_id, department, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id',
        [u.name, u.email, defaultPasswordHash, roleId, u.department]
      );
    } else {
      await client.query(
        'UPDATE users SET password_hash = $1, role_id = $2, is_active = true, updated_at = NOW() WHERE email = $3',
        [defaultPasswordHash, roleId, u.email]
      );
    }
    userMap[u.email] = res.rows[0].id;
  }

  // 3. Seed Sample Customer
  let custRes = await client.query('SELECT id FROM customers WHERE code = $1', ['BDL-IND']);
  let customerId;
  if (custRes.rows.length === 0) {
    const newCust = await client.query(
      `INSERT INTO customers (id, code, name, contact_person, email, phone, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), 'BDL-IND', 'Bharat Dynamics Limited', 'K. S. Rao', 'ksrao@bdl.gov.in', '+91-40-23456789', true, NOW(), NOW())
       RETURNING id`
    );
    customerId = newCust.rows[0].id;
    console.log('[Seed] Created customer BDL-IND');
  } else {
    customerId = custRes.rows[0].id;
  }

  // 4. Seed Sample PO
  let poRes = await client.query('SELECT id FROM purchase_orders WHERE po_number = $1', ['PO-TEST-001']);
  let poId;
  if (poRes.rows.length === 0) {
    const newPo = await client.query(
      `INSERT INTO purchase_orders (id, po_number, customer_id, reference_date, remarks, created_at, updated_at)
       VALUES (gen_random_uuid(), 'PO-TEST-001', $1, '2026-08-15', 'Sample PO for development validation', NOW(), NOW())
       RETURNING id`,
      [customerId]
    );
    poId = newPo.rows[0].id;
    console.log('[Seed] Created PO-TEST-001');
  } else {
    poId = poRes.rows[0].id;
  }

  // 5. Seed Sample SC
  let scRes = await client.query('SELECT id FROM sales_order_components WHERE sc_number = $1', ['SC-TEST-001']);
  let scId;
  if (scRes.rows.length === 0) {
    const newSc = await client.query(
      `INSERT INTO sales_order_components (id, sc_number, po_id, product_name, drawing_number, target_quantity, status, created_at, updated_at)
       VALUES (gen_random_uuid(), 'SC-TEST-001', $1, 'Main Drive Spindle Shaft', 'DWG-SP-101-REV-C', 10, 'IN_PRODUCTION', NOW(), NOW())
       RETURNING id`,
      [poId]
    );
    scId = newSc.rows[0].id;
    console.log('[Seed] Created SC-TEST-001');
  } else {
    scId = scRes.rows[0].id;
  }

  // 6. Seed RM Request
  let rmRes = await client.query('SELECT id FROM rm_requests WHERE sc_id = $1', [scId]);
  if (rmRes.rows.length === 0) {
    const newRm = await client.query(
      `INSERT INTO rm_requests (id, sc_id, created_by_id, form_type, status, submitted_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'SC', 'SUBMITTED', NOW(), NOW(), NOW())
       RETURNING id`,
      [scId, userMap['designer@airtronic.com']]
    );
    const rmReqId = newRm.rows[0].id;

    await client.query(
      `INSERT INTO rm_items (id, rm_form_id, sc_id, material, material_type, grade, size, quantity, diameter, length, weight, weight_unit, remarks, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'EN31', 'ROUND_BAR', 'IS:5517', 'Ø110 x 35 mm', 10, 110, 35, 26.5, 'KG', 'Case hardening alloy steel', NOW(), NOW())`,
      [rmReqId, scId]
    );
    console.log('[Seed] Created RM Request and Items for SC-TEST-001');
  }

  console.log('[Seed] ✓ All seed data successfully synchronized!');
  await client.end();
}

seed().catch(console.error);
