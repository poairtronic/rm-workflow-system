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

const SAMPLE_PRODUCTS = [
  { code: 'SAMPLE-EN31-RD', name: 'Sample EN31 Round Bar Ø110mm (KG)', msl: 50, max: 200, bin: 'A-01', openQty: 120 },
  { code: 'SAMPLE-MS-PLT', name: 'Sample MS Plate 10mm IS2062 (KG)', msl: 100, max: 500, bin: 'A-01', openQty: 105 }, // Near MSL
  { code: 'SAMPLE-HSS-BLK', name: 'Sample HSS Block M2 100x100x50 (NOS)', msl: 15, max: 60, bin: 'A-02', openQty: 40 },
  { code: 'SAMPLE-AL6061-RD', name: 'Sample Al 6061 Bar Ø50mm (KG)', msl: 30, max: 150, bin: 'A-02', openQty: 32 }, // Near MSL
  { code: 'SAMPLE-SS304-SHT', name: 'Sample SS304 Sheet 2mm (SQM)', msl: 20, max: 100, bin: 'A-02', openQty: 60 },
  { code: 'SAMPLE-BRASS-RD', name: 'Sample Brass Rod Ø25mm (KG)', msl: 25, max: 120, bin: 'A-03', openQty: 80 },
  { code: 'SAMPLE-M8-BLT', name: 'Sample M8 High Tensile Bolts (NOS)', msl: 500, max: 3000, bin: 'A-03', openQty: 1500 },
  { code: 'SAMPLE-GI-WIRE', name: 'Sample GI Binding Wire 16 SWG (KG)', msl: 40, max: 250, bin: 'A-03', openQty: 150 },
];

const SAMPLE_VENDORS = [
  { code: 'V1', name: 'Abi', category: 'General' },
  { code: 'V2', name: 'RK Engg', category: 'Machining' },
  { code: 'V3', name: 'Shiva Shakthi', category: 'Machining' },
  { code: 'V4', name: 'Fine Turn', category: 'Machining' },
  { code: 'V6', name: 'NVCNC', category: 'Machining' },
  { code: 'V7', name: 'Micro Mac', category: 'Machining' },
  { code: 'V8', name: 'Skyline', category: 'Engineering' },
  { code: 'V10', name: 'Std Engg', category: 'Engineering' },
  { code: 'V11', name: 'Flame Tech / HTV', category: 'Heat Treatment' },
  { code: 'V12', name: 'Mech Tools', category: 'Tooling' },
  { code: 'V13', name: 'VS Engg', category: 'Engineering' },
  { code: 'V14', name: 'RKV Metal', category: 'Fabrication' },
  { code: 'V15', name: 'Metal Form', category: 'Fabrication' },
  { code: 'V16', name: 'Export', category: 'General' },
  { code: 'V17', name: 'Sivam', category: 'General' },
  { code: 'V18', name: 'JMC / Pre Tooling', category: 'Tooling' },
  { code: 'V19', name: 'PS Coating', category: 'Surface Coating' },
  { code: 'V24', name: 'Nisha Tools', category: 'Tooling' },
  { code: 'V26', name: 'GA Tools', category: 'Tooling' },
  { code: 'V27', name: 'JV Tools', category: 'Tooling' },
  { code: 'V35', name: 'GSM', category: 'General' },
  { code: 'V38', name: 'SMV Engg', category: 'Engineering' },
];

const SAMPLE_PROCESSES = [
  {
    code: 'PRC-SMP-HT',
    name: 'Sample Heat Treatment',
    sequenceNumber: 10,
    category: 'OUTSIDE_PROCESSING',
    description: 'Stress relieving, hardening, and tempering',
  },
  {
    code: 'PRC-SMP-CNC',
    name: 'Sample CNC Turning & Milling',
    sequenceNumber: 20,
    category: 'MACHINING',
    description: 'Precision turning, 4-axis CNC milling, and boring',
  },
  {
    code: 'PRC-SMP-PLT',
    name: 'Sample Electroplating & Passivation',
    sequenceNumber: 30,
    category: 'SURFACE_FINISHING',
    description: 'Electroless nickel plating and chemical passivation',
  },
];

async function seed() {
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) {
    console.error('[Seed Error] SEED_DEFAULT_PASSWORD environment variable is required to run the seed script.');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[Seed] Connected to PostgreSQL database.');

  try {
    // 1. Roles
    const roleMap = {};
    for (const r of SEED_ROLES) {
      let res = await client.query('SELECT id FROM roles WHERE name = $1', [r.name]);
      if (res.rows.length === 0) {
        res = await client.query(
          'INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id',
          [r.name, r.description],
        );
      }
      roleMap[r.name] = res.rows[0].id;
    }
    console.log('[Seed] ✓ Roles synchronized.');

    // 2. Users (Idempotent: NEVER reset password of existing user)
    const defaultPasswordHash = await bcrypt.hash(seedPassword, 10);
    const userMap = {};

    for (const u of SEED_USERS) {
      const roleId = roleMap[u.roleName];
      let res = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (res.rows.length === 0) {
        res = await client.query(
          'INSERT INTO users (id, name, email, password_hash, role_id, department, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id',
          [u.name, u.email, defaultPasswordHash, roleId, u.department],
        );
      } else {
        // Update metadata only; preserve existing password
        await client.query(
          'UPDATE users SET role_id = $1, department = $2, is_active = true, updated_at = NOW() WHERE email = $3',
          [roleId, u.department, u.email],
        );
      }
      userMap[u.email] = res.rows[0].id;
    }
    console.log('[Seed] ✓ 6 Official Users synchronized (existing passwords preserved).');

    const adminUserId = userMap['admin@airtronic.com'];

    // 3. Customer BDL-IND
    let custRes = await client.query('SELECT id FROM customers WHERE code = $1', ['BDL-IND']);
    if (custRes.rows.length === 0) {
      await client.query(
        `INSERT INTO customers (id, code, name, contact_person, email, phone, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'BDL-IND', 'Bharat Dynamics Limited', 'K. S. Rao', 'ksrao@bdl.gov.in', '+91-40-23456789', true, NOW(), NOW())`,
      );
    }
    console.log('[Seed] ✓ Customer BDL-IND synchronized.');

    // 4. Warehouse, Location, Rack, Bins
    let whRes = await client.query('SELECT id FROM warehouses WHERE code = $1', ['WH-MAIN']);
    let whId;
    if (whRes.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO warehouses (id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'WH-MAIN', 'Main Stores Warehouse', true, NOW(), NOW()) RETURNING id`,
      );
      whId = r.rows[0].id;
    } else {
      whId = whRes.rows[0].id;
    }

    let locRes = await client.query('SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND code = $2', [whId, 'LOC-MAIN']);
    let locId;
    if (locRes.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'LOC-MAIN', 'Main Raw Material Floor', true, NOW(), NOW()) RETURNING id`,
        [whId],
      );
      locId = r.rows[0].id;
    } else {
      locId = locRes.rows[0].id;
    }

    let rackRes = await client.query('SELECT id FROM racks WHERE location_id = $1 AND code = $2', [locId, 'RACK-A']);
    let rackId;
    if (rackRes.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'RACK-A', 'Rack A', true, NOW(), NOW()) RETURNING id`,
        [locId],
      );
      rackId = r.rows[0].id;
    } else {
      rackId = rackRes.rows[0].id;
    }

    const binMap = {};
    for (const bCode of ['A-01', 'A-02', 'A-03']) {
      let bRes = await client.query('SELECT id FROM bins WHERE rack_id = $1 AND code = $2', [rackId, bCode]);
      if (bRes.rows.length === 0) {
        bRes = await client.query(
          `INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id`,
          [rackId, bCode, `Bin ${bCode}`],
        );
      }
      binMap[bCode] = bRes.rows[0].id;
    }
    console.log('[Seed] ✓ Storage hierarchy WH-MAIN -> Rack A -> Bins A-01..A-03 synchronized.');

    // 5. Product Category & Family
    let catRes = await client.query('SELECT id FROM product_categories WHERE name = $1', ['Raw Material']);
    let catId;
    if (catRes.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO product_categories (id, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Raw Material', true, NOW(), NOW()) RETURNING id`,
      );
      catId = r.rows[0].id;
    } else {
      catId = catRes.rows[0].id;
    }

    let famRes = await client.query('SELECT id FROM product_families WHERE category_id = $1 AND name = $2', [catId, 'Metal']);
    let famId;
    if (famRes.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO product_families (id, category_id, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'Metal', true, NOW(), NOW()) RETURNING id`,
        [catId],
      );
      famId = r.rows[0].id;
    } else {
      famId = famRes.rows[0].id;
    }

    // 6. 8 Sample Raw Material Products & Opening Stock
    for (const p of SAMPLE_PRODUCTS) {
      let prodRes = await client.query('SELECT id FROM products WHERE name = $1', [p.name]);
      let prodId;
      if (prodRes.rows.length === 0) {
        const r = await client.query(
          `INSERT INTO products (id, family_id, name, minimum_inventory, maximum_inventory, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id`,
          [famId, p.name, p.msl, p.max],
        );
        prodId = r.rows[0].id;
      } else {
        prodId = prodRes.rows[0].id;
        await client.query(
          `UPDATE products SET minimum_inventory = $1, maximum_inventory = $2, is_active = true, updated_at = NOW() WHERE id = $3`,
          [p.msl, p.max, prodId],
        );
      }

      const targetBinId = binMap[p.bin];
      let balRes = await client.query(
        'SELECT id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2',
        [prodId, targetBinId],
      );

      if (balRes.rows.length === 0) {
        // Create opening transaction
        const txRes = await client.query(
          `INSERT INTO stock_transactions (
             id, product_id, destination_bin_id, quantity, transaction_type, "referenceType", remarks, created_by_id, created_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, 'STOCK_IN', 'INITIAL_SETUP', 'Initial sample stock setup', $4, NOW()
           ) RETURNING id`,
          [prodId, targetBinId, p.openQty, adminUserId],
        );
        const txId = txRes.rows[0].id;

        // Create balance
        await client.query(
          `INSERT INTO stock_balances (
             id, product_id, bin_id, current_quantity, opening_balance, last_transaction_id, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $3, $4, NOW(), NOW()
           )`,
          [prodId, targetBinId, p.openQty, txId],
        );
      }
    }
    console.log('[Seed] ✓ 8 Sample Products & Opening Balances/Transactions synchronized.');

    // 7. 3 Sample Vendors
    const vendorMap = {};
    for (const v of SAMPLE_VENDORS) {
      let vRes = await client.query('SELECT id FROM vendors WHERE code = $1', [v.code]);
      if (vRes.rows.length === 0) {
        vRes = await client.query(
          `INSERT INTO vendors (id, code, name, category, contact_person, email, phone, address, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW()) RETURNING id`,
          [v.code, v.name, v.category, v.contactPerson, v.email, v.phone, v.address],
        );
      }
      vendorMap[v.code] = vRes.rows[0].id;
    }

    // 8. 3 Sample Processes
    const processMap = {};
    for (const pr of SAMPLE_PROCESSES) {
      let prRes = await client.query('SELECT id FROM production_processes WHERE code = $1', [pr.code]);
      if (prRes.rows.length === 0) {
        prRes = await client.query(
          `INSERT INTO production_processes (id, code, name, sequence_number, category, description, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
          [pr.code, pr.name, pr.sequenceNumber, pr.category, pr.description],
        );
      }
      processMap[pr.code] = prRes.rows[0].id;
    }

    // 9. Vendor Process Capabilities and SLAs
    const pairings = [
      { vendorCode: 'V11', processCode: 'PRC-SMP-HT', slaDays: 5, leadDays: 4 },
      { vendorCode: 'V2', processCode: 'PRC-SMP-CNC', slaDays: 5, leadDays: 5 },
      { vendorCode: 'V19', processCode: 'PRC-SMP-PLT', slaDays: 7, leadDays: 6 },
    ];

    for (const p of pairings) {
      const vId = vendorMap[p.vendorCode];
      const prId = processMap[p.processCode];

      let capRes = await client.query(
        'SELECT id FROM vendor_process_capabilities WHERE vendor_id = $1 AND process_id = $2',
        [vId, prId],
      );
      if (capRes.rows.length === 0) {
        await client.query(
          `INSERT INTO vendor_process_capabilities (id, vendor_id, process_id, is_approved, lead_time_days, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, true, $3, NOW(), NOW())`,
          [vId, prId, p.leadDays],
        );
      }

      let slaRes = await client.query(
        'SELECT id FROM vendor_slas WHERE vendor_id = $1 AND process_id = $2',
        [vId, prId],
      );
      if (slaRes.rows.length === 0) {
        await client.query(
          `INSERT INTO vendor_slas (id, vendor_id, process_id, sla_days, effective_date, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NOW(), true, NOW(), NOW())`,
          [vId, prId, p.slaDays],
        );
      }
    }
    console.log('[Seed] ✓ Sample Vendors, Processes, Capabilities, and SLAs synchronized.');

    console.log('[Seed] ✓ All seed data successfully synchronized!');
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('[Seed Exception]:', err.message);
  process.exit(1);
});
