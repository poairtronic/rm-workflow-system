const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require(path.resolve('backend/node_modules/bcryptjs'));
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  console.log('Connecting to NEW Neon database...');
  const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('✓ Connected successfully!\n');

  // =========================================================================
  // STEP 1: System Modules & Roles & Role Permissions
  // =========================================================================
  console.log('--- Step 1: Populating System Modules & Roles ---');

  const systemModules = [
    ['rm_creation', 'RM Creation', 'RM WORKFLOW', '/design/rm-creation', 'Create RM requisitions and styles', 10],
    ['rm_requisitions', 'My Requisitions', 'RM WORKFLOW', '/design/my-requisitions', 'Track created RM requisitions', 20],
    ['rm_issue', 'RM Issue', 'RM WORKFLOW', '/stores/rm-issue', 'Issue materials from stores to production', 30],
    ['extra_requests', 'Extra Requests', 'RM WORKFLOW', '/stores/extra-requests', 'Review and issue additional material requests', 40],
    ['return_verify', 'Return Verify', 'RM WORKFLOW', '/stores/return-verify', 'Verify material returns into bins', 50],
    ['production_rm', 'My RM', 'RM WORKFLOW', '/production/rm', 'Production operator RM workspace', 60],
    ['consumption', 'Consumption', 'RM WORKFLOW', '/production/consumption', 'Record production material consumption', 70],

    ['stock_overview', 'Stock Overview', 'INVENTORY', '/inventory/stock', 'Live multi-bin stock levels and balances', 80],
    ['stock_movements', 'Stock Movement', 'INVENTORY', '/inventory/movements', 'Manual stock in, out, and adjustments', 90],
    ['supplier_inward', 'Supplier Inward (GRN)', 'INVENTORY', '/inventory/grn', 'Supplier goods receipt inward', 100],
    ['msl_alerts', 'MSL Alerts', 'INVENTORY', '/inventory/msl-alerts', 'Minimum stock level warning dashboard', 110],

    ['dc_type1', 'DC Type 1 (Process)', 'DELIVERY CHALLAN', '/dispatch/delivery-challan/type-1', 'Outward process delivery challans', 120],
    ['dc_type2', 'DC Type 2 (General)', 'DELIVERY CHALLAN', '/dispatch/delivery-challan/type-2', 'General inventory outward challans', 130],
    ['dc_returns', 'DC Returns', 'DELIVERY CHALLAN', '/dispatch/returns', 'Inward delivery challan receipt and returns', 140],
    ['dc_movements', 'DC Movements', 'DELIVERY CHALLAN', '/dispatch/movements', 'Delivery challan movement tracking', 145],

    ['sc_traceability', 'SC Traceability', 'GOVERNANCE', '/governance/traceability', 'Size card end-to-end custody tracking', 150],
    ['po_traceability', 'PO Traceability', 'GOVERNANCE', '/governance/po-traceability', 'Purchase order status and fulfillment audit', 160],
    ['vendor_slas', 'Vendor SLAs', 'GOVERNANCE', '/governance/vendor-slas', 'Vendor performance and lead-time tracking', 170],
    ['vendor_analytics', 'Vendor Analytics', 'GOVERNANCE', '/governance/vendor-analytics', 'Vendor scorecards and delivery metrics', 180],
    ['merc_indents', 'MERC Indents', 'GOVERNANCE', '/governance/merc-indents', 'MERC indent material issue module', 185],

    ['users_master', 'Users & Access Control', 'MASTERS', '/masters/users', 'Manage user accounts, roles, and permissions', 190],
    ['products_master', 'Products Master', 'MASTERS', '/masters/products', 'Raw materials and product definitions', 200],
    ['warehouses_master', 'Warehouses and Bins', 'MASTERS', '/masters/bins', 'Warehouse, location, rack, and bin hierarchy', 210],
    ['vendors_master', 'Vendors Master', 'MASTERS', '/masters/vendors', 'Vendor directory and capabilities', 220],
    ['process_master', 'Process Master', 'MASTERS', '/governance/process-master', 'Manufacturing sequences and cycle times', 230],

    ['overview', 'Overview Dashboard', 'MANAGEMENT', '/overview', 'Executive operational summary', 240],
    ['my_requisitions', 'My Requisitions', 'RM WORKFLOW', '/design/my-requisitions', 'My requisitions tracking', 250],
    ['users', 'Users', 'MASTERS', '/masters/users', 'Users management shortcut', 260],
    ['products', 'Products', 'MASTERS', '/masters/products', 'Products management shortcut', 270],
    ['warehouses', 'Warehouses', 'MASTERS', '/masters/bins', 'Warehouses shortcut', 280],
    ['vendors', 'Vendors', 'MASTERS', '/masters/vendors', 'Vendors shortcut', 290],
    ['processes', 'Processes', 'MASTERS', '/governance/process-master', 'Processes shortcut', 300],
    ['stock_movement', 'Stock Movement', 'INVENTORY', '/inventory/movements', 'Stock movement shortcut', 310]
  ];

  for (const m of systemModules) {
    await c.query(`
      INSERT INTO system_modules (module_key, name, group_name, route_path, description, sort_order, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      ON CONFLICT (module_key) DO UPDATE SET name = $2, route_path = $4, is_active = true
    `, m);
  }
  console.log(`✓ Inserted/updated ${systemModules.length} system modules.`);

  const rolesToEnsure = [
    { name: 'ADMIN', description: 'System Administrator' },
    { name: 'SENIOR_MANAGER', description: 'Senior Operations Manager' },
    { name: 'STORES', description: 'Stores Manager' },
    { name: 'DESIGNER', description: 'Design Engineer' },
    { name: 'PRODUCTION', description: 'Production Operator' },
    { name: 'GENERAL_MANAGER', description: 'General Manager' },
  ];

  const roleMap = new Map();
  for (const r of rolesToEnsure) {
    let rRes = await c.query('SELECT id FROM roles WHERE name = $1', [r.name]);
    if (rRes.rows.length === 0) {
      rRes = await c.query(
        'INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id',
        [r.name, r.description]
      );
    }
    roleMap.set(r.name, rRes.rows[0].id);
  }
  console.log(`✓ Ensured ${rolesToEnsure.length} roles.`);

  const ROLE_PERMISSIONS = {
    ADMIN: systemModules.map(m => m[0]),
    SENIOR_MANAGER: [
      'overview', 'stock_overview', 'stock_movements', 'stock_movement', 'msl_alerts',
      'sc_traceability', 'po_traceability', 'vendor_slas', 'vendor_analytics', 'merc_indents',
      'products', 'warehouses', 'vendors', 'products_master', 'warehouses_master', 'vendors_master'
    ],
    STORES: [
      'overview', 'stock_overview', 'stock_movements', 'stock_movement', 'supplier_inward',
      'msl_alerts', 'rm_issue', 'extra_requests', 'return_verify', 'merc_indents',
      'dc_type1', 'dc_type2', 'dc_returns', 'dc_movements',
      'products', 'warehouses', 'vendors', 'products_master', 'warehouses_master', 'vendors_master'
    ],
    DESIGNER: [
      'overview', 'rm_creation', 'rm_requisitions', 'my_requisitions',
      'stock_overview', 'products', 'products_master'
    ],
    PRODUCTION: [
      'overview', 'production_rm', 'consumption', 'rm_requisitions', 'my_requisitions',
      'stock_overview', 'products', 'products_master'
    ],
  };

  for (const [roleName, moduleKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (roleId) {
      for (const mKey of moduleKeys) {
        await c.query(`
          INSERT INTO role_module_permissions (id, role_id, module_key, is_allowed, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
          ON CONFLICT (role_id, module_key) DO UPDATE SET is_allowed = true
        `, [roleId, mKey]);
      }
    }
  }
  console.log('✓ Synchronized role_module_permissions.');

  // =========================================================================
  // STEP 2: Target Production Users
  // =========================================================================
  console.log('\n--- Step 2: Provisioning Target Users ---');
  const TARGET_USERS = [
    {
      name: 'RAMU (Admin)',
      email: 'admin@airtronic.com',
      roleName: 'ADMIN',
      rawPassword: 'airtronic123A@',
      department: 'Management',
    },
    {
      name: 'Amritha',
      email: 'amrithaairtronic@gmail.com',
      roleName: 'ADMIN',
      rawPassword: 'Amritha123',
      department: 'Management',
    },
    {
      name: 'Amritha R',
      email: 'amritha.r.2445@gmail.com',
      roleName: 'SENIOR_MANAGER',
      rawPassword: 'airtronic123A@',
      department: 'Operations Monitoring',
    },
    {
      name: 'Stores Team',
      email: 'posuppportairtronic@gmail.com',
      roleName: 'STORES',
      rawPassword: 'airtronic123A@',
      department: 'Stores & Inventory',
    },
    {
      name: 'RAMU',
      email: 'ramu76486@gmail.com',
      roleName: 'ADMIN',
      rawPassword: '@Ramu123',
      department: 'Management',
    },
    {
      name: 'Ramu Chidambaram',
      email: 'ramuchidu03@gmail.com',
      roleName: 'DESIGNER',
      rawPassword: '@Ramu123',
      department: 'Design',
    },
    {
      name: 'Velan Production',
      email: 'velandimplementation@gmail.com',
      roleName: 'PRODUCTION',
      rawPassword: 'airtronic123A@',
      department: 'Machining Shop Floor',
    },
  ];

  let primaryAdminId = null;
  for (const u of TARGET_USERS) {
    const roleId = roleMap.get(u.roleName);
    const passwordHash = await bcrypt.hash(u.rawPassword, 10);
    const emailLower = u.email.toLowerCase().trim();

    let uRes = await c.query('SELECT id FROM users WHERE email = $1', [emailLower]);
    let userId;
    if (uRes.rows.length === 0) {
      userId = crypto.randomUUID();
      await c.query(
        `INSERT INTO users (id, name, email, password_hash, role_id, department, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
        [userId, u.name, emailLower, passwordHash, roleId, u.department]
      );
      console.log(`  + Created user: ${u.name} <${emailLower}> (${u.roleName})`);
    } else {
      userId = uRes.rows[0].id;
      await c.query(
        `UPDATE users SET name = $1, password_hash = $2, role_id = $3, department = $4, is_active = true, updated_at = NOW() WHERE id = $5`,
        [u.name, passwordHash, roleId, u.department, userId]
      );
      console.log(`  * Updated user: ${u.name} <${emailLower}> (${u.roleName})`);
    }
    if (emailLower === 'ramu76486@gmail.com' || (!primaryAdminId && u.roleName === 'ADMIN')) {
      primaryAdminId = userId;
    }
  }

  // =========================================================================
  // STEP 3: Production Processes
  // =========================================================================
  console.log('\n--- Step 3: Populating Production Processes ---');
  const processes = [
    { code: 'PROC-TURN', name: 'TURNING', sequence: 10, defaultLeadTimeDays: 3 },
    { code: 'PROC-MILL', name: 'MILLING', sequence: 20, defaultLeadTimeDays: 4 },
    { code: 'PROC-GRND-SURF', name: 'SURFACE GRINDING', sequence: 30, defaultLeadTimeDays: 2 },
    { code: 'PROC-GRND-CYL', name: 'CYLINDRICAL GRINDING', sequence: 40, defaultLeadTimeDays: 3 },
    { code: 'PROC-WEDM', name: 'WIRE EDM', sequence: 50, defaultLeadTimeDays: 5 },
    { code: 'PROC-EDM', name: 'EDM SPARKING', sequence: 60, defaultLeadTimeDays: 4 },
    { code: 'PROC-HT', name: 'HEAT TREATMENT', sequence: 70, defaultLeadTimeDays: 7 },
    { code: 'PROC-HARD', name: 'HARDENING & TEMPERING', sequence: 80, defaultLeadTimeDays: 5 },
    { code: 'PROC-COAT', name: 'SURFACE COATING / PLATING', sequence: 90, defaultLeadTimeDays: 4 },
    { code: 'PROC-BUFF', name: 'BUFFING & POLISHING', sequence: 100, defaultLeadTimeDays: 2 },
    { code: 'PROC-INSP', name: 'FINAL QC INSPECTION', sequence: 110, defaultLeadTimeDays: 1 },
  ];

  for (const p of processes) {
    await c.query(`
      INSERT INTO production_processes (id, code, name, sequence_number, allows_outside_vendor, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, true, true, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET name = $2, sequence_number = $3
    `, [p.code, p.name, p.sequence]);
  }
  console.log(`✓ Inserted/updated ${processes.length} manufacturing processes.`);

  // =========================================================================
  // STEP 4: Vendors
  // =========================================================================
  console.log('\n--- Step 4: Populating Vendors ---');
  const vendorsJsonPath = path.resolve('backend/scripts/extracted-vendors.json');
  let vendorCount = 0;
  if (fs.existsSync(vendorsJsonPath)) {
    const vendors = JSON.parse(fs.readFileSync(vendorsJsonPath, 'utf8'));
    for (const v of vendors) {
      const code = `VND-${String(v.num).padStart(3, '0')}`;
      const name = v.name.trim().slice(0, 150);
      const phone = v.phone ? v.phone.trim().slice(0, 50) : null;
      const address = v.address ? v.address.trim() : null;

      await c.query(`
        INSERT INTO vendors (id, code, name, phone, address, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
        ON CONFLICT (code) DO UPDATE SET name = $2, phone = $3, address = $4
      `, [code, name, phone, address]);
      vendorCount++;
    }
  }
  console.log(`✓ Inserted/updated ${vendorCount} vendors.`);

  // =========================================================================
  // STEP 5: Real Inventory Hierarchy (Warehouses, Racks, Bins, Products, Stock)
  // =========================================================================
  console.log('\n--- Step 5: Populating Warehouses, Bins, Products & Stock ---');
  // 1. Warehouse
  let whRes = await c.query("SELECT id FROM warehouses WHERE code = 'WH-VELAN'");
  let whId;
  if (whRes.rows.length === 0) {
    const nw = await c.query(
      `INSERT INTO warehouses (id, code, name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), 'WH-VELAN', 'VELAN STORES', true, NOW(), NOW())
       RETURNING id`
    );
    whId = nw.rows[0].id;
  } else {
    whId = whRes.rows[0].id;
  }

  // 2. Default Location
  let locRes = await c.query("SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND code = 'MAIN'", [whId]);
  let locId;
  if (locRes.rows.length === 0) {
    const nl = await c.query(
      `INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'MAIN', 'Main Storage Area', true, NOW(), NOW())
       RETURNING id`,
      [whId]
    );
    locId = nl.rows[0].id;
  } else {
    locId = locRes.rows[0].id;
  }

  // 3. Product Category & Family
  let catRes = await c.query("SELECT id FROM product_categories WHERE name = 'RAW MATERIALS'");
  let catId;
  if (catRes.rows.length === 0) {
    const nc = await c.query(
      `INSERT INTO product_categories (id, name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), 'RAW MATERIALS', true, NOW(), NOW())
       RETURNING id`
    );
    catId = nc.rows[0].id;
  } else {
    catId = catRes.rows[0].id;
  }

  let famRes = await c.query("SELECT id FROM product_families WHERE name = 'METALS'");
  let famId;
  if (famRes.rows.length === 0) {
    const nf = await c.query(
      `INSERT INTO product_families (id, category_id, name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'METALS', true, NOW(), NOW())
       RETURNING id`,
      [catId]
    );
    famId = nf.rows[0].id;
  } else {
    famId = famRes.rows[0].id;
  }

  // Helper maps for racks and bins
  const rackMap = new Map();
  const binMap = new Map();

  async function getOrCreateBin(locationName) {
    const cleanLoc = (locationName || 'MAIN RACK').trim().toUpperCase();
    if (binMap.has(cleanLoc)) return binMap.get(cleanLoc);

    let rackId = rackMap.get(cleanLoc);
    if (!rackId) {
      const rackCode = `RCK-${cleanLoc.replace(/[^A-Za-z0-9]/g, '').slice(0, 15)}`;
      let rRes = await c.query("SELECT id FROM racks WHERE location_id = $1 AND code = $2", [locId, rackCode]);
      if (rRes.rows.length === 0) {
        const nr = await c.query(
          `INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id`,
          [locId, rackCode, cleanLoc]
        );
        rackId = nr.rows[0].id;
      } else {
        rackId = rRes.rows[0].id;
      }
      rackMap.set(cleanLoc, rackId);
    }

    const binCode = `BIN-${cleanLoc.replace(/[^A-Za-z0-9]/g, '').slice(0, 15)}-01`;
    let bRes = await c.query("SELECT id FROM bins WHERE rack_id = $1 AND code = $2", [rackId, binCode]);
    let binId;
    if (bRes.rows.length === 0) {
      const nb = await c.query(
        `INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id`,
        [rackId, binCode, `Bin for ${cleanLoc}`]
      );
      binId = nb.rows[0].id;
    } else {
      binId = bRes.rows[0].id;
    }
    binMap.set(cleanLoc, binId);
    return binId;
  }

  // Load Real Inventory Items from seed-real-inventory.js
  const seedInventoryPath = path.resolve('backend/scripts/seed-real-inventory.js');
  let inventoryItems = [];
  if (fs.existsSync(seedInventoryPath)) {
    const content = fs.readFileSync(seedInventoryPath, 'utf8');
    const match = content.match(/export const REAL_INVENTORY_ITEMS = (\[[\s\S]*?\]);/);
    if (match) {
      inventoryItems = eval(match[1]);
    }
  }

  console.log(`Loaded ${inventoryItems.length} inventory items to seed...`);
  let prodCount = 0;
  for (const item of inventoryItems) {
    const prodName = item.product.trim();
    const uom = (item.uom || 'NOS').trim().toUpperCase();
    const qty = Number(item.qty) || 0;
    const binId = await getOrCreateBin(item.location);

    // Insert or get product
    let pRes = await c.query("SELECT id FROM products WHERE name = $1", [prodName]);
    let prodId;
    if (pRes.rows.length === 0) {
      const code = `PRD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const np = await c.query(
        `INSERT INTO products (id, family_id, code, name, uom, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id`,
        [famId, code, prodName, uom]
      );
      prodId = np.rows[0].id;
      prodCount++;
    } else {
      prodId = pRes.rows[0].id;
    }

    // Insert or update stock_balance
    let sbRes = await c.query("SELECT id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2", [prodId, binId]);
    if (sbRes.rows.length === 0) {
      await c.query(
        `INSERT INTO stock_balances (id, product_id, bin_id, current_quantity, opening_balance, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $3, NOW(), NOW())`,
        [prodId, binId, qty]
      );
    } else {
      await c.query(
        `UPDATE stock_balances SET current_quantity = $1, updated_at = NOW() WHERE id = $2`,
        [qty, sbRes.rows[0].id]
      );
    }
  }
  console.log(`✓ Seeded ${prodCount} products and their initial stock balances.`);

  // =========================================================================
  // STEP 6: Customers & Recent POs / SCs (With 1 SET = 2 NOS Rule)
  // =========================================================================
  console.log('\n--- Step 6: Populating Customers, POs & SCs ---');
  const customers = [
    { code: 'CUST-STELLANTIS', name: 'STELLANTIS' },
    { code: 'CUST-LGB', name: 'LGB' },
    { code: 'CUST-SYSMAC', name: 'SYSMAC' },
    { code: 'CUST-TAFE', name: 'TAFE' },
    { code: 'CUST-BHARGAVI', name: 'BHARGAVI' },
    { code: 'CUST-AIRTRONIC', name: 'AIRTRONIC' },
    { code: 'CUST-VELAN', name: 'VELAN' },
    { code: 'CUST-GENERAL', name: 'GENERAL CUSTOMER' }
  ];

  const custMap = new Map();
  for (const cust of customers) {
    let cRes = await c.query("SELECT id FROM customers WHERE name ILIKE $1", [`%${cust.name}%`]);
    let cid;
    if (cRes.rows.length === 0) {
      const nc = await c.query(
        `INSERT INTO customers (id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW()) RETURNING id`,
        [cust.code, cust.name]
      );
      cid = nc.rows[0].id;
    } else {
      cid = cRes.rows[0].id;
    }
    custMap.set(cust.name, cid);
  }
  console.log(`✓ Ensured ${customers.length} customers.`);

  // Load POs & SCs from scripts/inbuilt_po_sc_data.cjs
  const inbuiltScriptPath = path.resolve('scripts/inbuilt_po_sc_data.cjs');
  if (fs.existsSync(inbuiltScriptPath)) {
    console.log('Running inbuilt PO & SC dataset with 1 SET = 2 NOS rule...');
    // We can run the inbuilt data script logic directly
    const stellantisId = custMap.get('STELLANTIS');
    const sysmacId = custMap.get('SYSMAC');
    const lgbId = custMap.get('LGB');

    // Create POs
    const poList = [
      { poNumber: 'AGIPLPO1340 - STELLANTIS', custId: stellantisId, date: '2026-10-31', url: 'https://drive.google.com/file/d/1S_-YqCwtlRYj0ycWVBT61W42tDrx_QJO/view?usp=sharing' },
      { poNumber: 'AGIPLPO1356 - SYSMAC', custId: sysmacId, date: '2026-11-03', url: 'https://drive.google.com/file/d/1CH0t4aOKPjG7lo8pch2uhPmvSyYtljSs/view?usp=sharing' },
      { poNumber: 'AGIPLPO1382-LGB', custId: lgbId, date: '2026-11-05', url: 'https://drive.google.com/file/d/1D3OoSrtxETFn9ctaLqbOkZMAhqC5h33Z/view?usp=sharing' }
    ];

    const poIdMap = new Map();
    for (const p of poList) {
      let pRes = await c.query("SELECT id FROM purchase_orders WHERE po_number = $1", [p.poNumber]);
      let pid;
      if (pRes.rows.length === 0) {
        const np = await c.query(
          `INSERT INTO purchase_orders (id, po_number, customer_id, reference_date, remarks, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
          [p.poNumber, p.custId, p.date, p.url]
        );
        pid = np.rows[0].id;
      } else {
        pid = pRes.rows[0].id;
      }
      poIdMap.set(p.poNumber, pid);
    }

    // Insert all SCs for these POs
    const scEntries = [
      // PO1340 SCs (Setting Gauges: SP items get 2 NOS per 1 SET)
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2550', prod: 'ARG DIA 25.0 +0.02 / +0.002', qty: 1, items: [
        { part: 'ARG DIA 25.0 +0.02 / +0.002', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25' },
        { part: 'SP DIA 25.0 +0.02 / +0.002', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2551', prod: 'ARG DIA 25.0 +0.025 / +0.002', qty: 1, items: [
        { part: 'ARG DIA 25.0 +0.025 / +0.002', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25' },
        { part: 'SP DIA 25.0 +0.025 / +0.002', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2552', prod: 'ARG DIA 22.00 +0.022', qty: 1, items: [
        { part: 'ARG DIA 22.00 +0.022', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 34 OR DIA 70 X 25' },
        { part: 'SP DIA 22.00 +0.022', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 34 OR DIA 70 X 25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2553', prod: 'ARG DIA 21.785 -0.02', qty: 1, items: [
        { part: 'ARG DIA 21.785 -0.02', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 34 OR DIA 70 X 25' },
        { part: 'SP DIA 21.785 -0.02', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 34 OR DIA 70 X 25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2554', prod: 'ARG DIA 32.00 +0.024', qty: 1, items: [
        { part: 'ARG DIA 32.00 +0.024', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25' },
        { part: 'SP DIA 32.00 +0.024', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2555', prod: 'ACG DIA 36.0 +0.025 / +0.009', qty: 1, items: [
        { part: 'ACG DIA 36.0 +0.025 / +0.009', qty: 1, unit: 'NOS', mat: 'EN31', size: '40X55X20' },
        { part: 'SETTING DISC 36.0 +0.025 / +0.009', qty: 2, unit: 'NOS', mat: 'OHNS', size: 'Ø40X35', remarks: '1 SET = 2 NOS' },
        { part: 'SIDE BLOCKS', qty: 2, unit: 'NOS', mat: 'EN31', size: '70X20X18' },
        { part: 'NYLON HANDLE', qty: 4, unit: 'NOS', mat: 'NYLON', size: 'Ø25X18' },
        { part: 'CARBIDE 10X3X17', qty: 2, unit: 'NOS', mat: 'CARBIDE', size: '10X3X17' },
        { part: 'CARBIDE 8X3X17', qty: 2, unit: 'NOS', mat: 'CARBIDE', size: '8X3X17' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2556', prod: 'ARG DIA 25.0 +0.015 / +0.002', qty: 1, items: [
        { part: 'ARG DIA 25.0 +0.015 / +0.002', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25' },
        { part: 'SP DIA 25.0 +0.015 / +0.002', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2557', prod: 'ARG DIA 25.00 +0.013', qty: 1, items: [
        { part: 'ARG DIA 25.00 +0.013', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25' },
        { part: 'SP DIA 25.00 +0.013', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      { po: 'AGIPLPO1340 - STELLANTIS', sc: '2558', prod: 'ARG DIA 25.00 +0.031 / +0.018', qty: 1, items: [
        { part: 'ARG DIA 25.00 +0.031 / +0.018', qty: 1, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25' },
        { part: 'SP DIA 25.0 +0.031 / +0.018', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 35 OR Ø85X25', remarks: '1 SET = 2 NOS | PUNE SENT' }
      ]},
      // PO1356 SYSMAC
      { po: 'AGIPLPO1356 - SYSMAC', sc: '2564', prod: 'ARG DIA 14.980 +/-0.02', qty: 1, items: [
        { part: 'ARG DIA 14.980 +/-0.02', qty: 1, unit: 'NOS', mat: 'EN31', size: 'Ø75X25' },
        { part: 'SP DIA 14.980 +/-0.02', qty: 2, unit: 'NOS', mat: 'EN31', size: 'Ø75X25', remarks: '1 SET = 2 NOS | PUNE SENT' },
        { part: 'VERTICAL BENCH MOUNT', qty: 1, unit: 'NOS', mat: 'MS', size: 'Ø150X15' },
        { part: 'JIG FEET', qty: 3, unit: 'NOS', mat: 'MS', size: 'Ø20X75' }
      ]},
      // PO1382 LGB (Merged 2569 and 2570 with 2 Qty each per user instruction)
      { po: 'AGIPLPO1382-LGB', sc: '2569', prod: 'APG DIA 19.011 +/-0.005', qty: 2, items: [
        { part: 'APG DIA 19.011 +/-0.005', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 10 OR Ø25X50' },
        { part: 'SRG DIA 19.011 +/-0.005', qty: 4, unit: 'NOS', mat: 'OHNS', size: 'RACK NO 6 OR Ø50X18', remarks: '2 SET = 4 NOS (1 SET = 2 NOS)' },
        { part: 'EXTENSION 25 mm', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 85' }
      ]},
      { po: 'AGIPLPO1382-LGB', sc: '2570', prod: 'APG DIA 19.409 +/-0.005', qty: 2, items: [
        { part: 'APG DIA 19.409 +/-0.005', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 10 OR Ø25X50' },
        { part: 'SRG DIA 19.409 +/-0.005', qty: 4, unit: 'NOS', mat: 'OHNS', size: 'RACK NO 6 OR Ø50X18', remarks: '2 SET = 4 NOS (1 SET = 2 NOS)' },
        { part: 'EXTENSION 25 mm', qty: 2, unit: 'NOS', mat: 'EN31', size: 'RACK NO 85' }
      ]}
    ];

    for (const scEntry of scEntries) {
      const pId = poIdMap.get(scEntry.po);
      let scRes = await c.query("SELECT id FROM sales_order_components WHERE po_id = $1 AND sc_number = $2", [pId, scEntry.sc]);
      let scId;
      if (scRes.rows.length === 0) {
        const nsc = await c.query(
          `INSERT INTO sales_order_components (id, po_id, sc_number, product_name, target_quantity, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IN_PRODUCTION', NOW(), NOW()) RETURNING id`,
          [pId, scEntry.sc, scEntry.prod, scEntry.qty]
        );
        scId = nsc.rows[0].id;
      } else {
        scId = scRes.rows[0].id;
      }

      // Create RM Request for this SC
      let rmRes = await c.query("SELECT id FROM rm_requests WHERE sc_id = $1", [scId]);
      let rmReqId;
      if (rmRes.rows.length === 0) {
        const nreq = await c.query(
          `INSERT INTO rm_requests (id, po_id, sc_id, form_type, status, created_by_id, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'SC', 'COMPLETED', $3, NOW(), NOW()) RETURNING id`,
          [pId, scId, primaryAdminId]
        );
        rmReqId = nreq.rows[0].id;
      } else {
        rmReqId = rmRes.rows[0].id;
      }

      // Insert RM Items
      for (const it of scEntry.items) {
        let itRes = await c.query("SELECT id FROM rm_items WHERE rm_form_id = $1 AND part_name = $2", [rmReqId, it.part]);
        if (itRes.rows.length === 0) {
          await c.query(
            `INSERT INTO rm_items (id, rm_form_id, sc_id, part_name, material, size, quantity, remarks, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [rmReqId, scId, it.part, it.mat, it.size, it.qty, it.remarks || null]
          );
        }
      }
    }
    console.log(`✓ Seeded ${scEntries.length} sales order components with RM requests & items (1 SET = 2 NOS applied).`);
  }

  // =========================================================================
  // STEP 7: Legacy MERC Indents (PO1169 & PO1349) - All 46 + 41 Lines ISSUED
  // =========================================================================
  console.log('\n--- Step 7: Populating Legacy MERC Indents (PO1169 & PO1349) ---');
  const legacyDataPath = path.resolve('data/legacy_indents.json');
  if (fs.existsSync(legacyDataPath)) {
    const legacyIndents = JSON.parse(fs.readFileSync(legacyDataPath, 'utf8'));
    for (const ind of legacyIndents) {
      let pRes = await c.query("SELECT id FROM merc_indent_pending WHERE indent_id = $1", [ind.indentId]);
      let pendingId;
      if (pRes.rows.length === 0) {
        const np = await c.query(
          `INSERT INTO merc_indent_pending (id, indent_id, indent_number, po_number, customer_name, layout_number, status, merc_current_state, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ISSUED', 'ISSUED', NOW(), NOW()) RETURNING id`,
          [ind.indentId, ind.indentNumber, ind.poNumber, ind.customerName || null, ind.layoutNumber || null]
        );
        pendingId = np.rows[0].id;
      } else {
        pendingId = pRes.rows[0].id;
      }

      for (const item of ind.lineItems) {
        let itemRes = await c.query("SELECT id FROM merc_indent_line_items WHERE merc_indent_pending_id = $1 AND merc_item_id = $2", [pendingId, item.mercItemId]);
        if (itemRes.rows.length === 0) {
          await c.query(
            `INSERT INTO merc_indent_line_items (
              id, merc_indent_pending_id, merc_item_id, item_type, name, material, shape,
              length_mm, width_mm, height_mm, diameter_mm, quantity_required, quantity_issued,
              unit, vendor_name, source, status, issued_at, created_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'LEGACY_IMPORT', 'ISSUED', NOW(), NOW()
            )`,
            [
              pendingId, item.mercItemId, item.itemType, item.name, item.material || null, item.shape || null,
              item.lengthMm || null, item.widthMm || null, item.heightMm || null, item.diameterMm || null,
              item.quantityRequired, item.quantityIssued, item.unit || 'NOS', item.vendorName || null
            ]
          );
        }
      }
      console.log(`  ✓ Inserted legacy indent ${ind.indentNumber} with ${ind.lineItems.length} lines (100% ISSUED).`);
    }
  }

  // =========================================================================
  // STEP 8: Delivery Challans (DC) Master & Sample Workflows
  // =========================================================================
  console.log('\n--- Step 8: Populating Delivery Challans ---');
  let firstVendor = (await c.query("SELECT id, name FROM vendors WHERE name ILIKE '%COAT%' OR name ILIKE '%HEAT%' OR name ILIKE '%STEEL%' LIMIT 1")).rows[0];
  if (!firstVendor) firstVendor = (await c.query("SELECT id, name FROM vendors LIMIT 1")).rows[0];
  const sc2550 = (await c.query("SELECT id FROM sales_order_components WHERE sc_number = '2550' LIMIT 1")).rows[0];
  let firstProduct = (await c.query("SELECT id FROM products LIMIT 1")).rows[0];
  let firstProcess = (await c.query("SELECT id FROM production_processes LIMIT 1")).rows[0];

  if (firstVendor && sc2550 && firstProduct) {
    const dcNumber = 'DC-2026-001';
    let dcRes = await c.query("SELECT id FROM delivery_challans WHERE challan_number = $1", [dcNumber]);
    if (dcRes.rows.length === 0) {
      const ndc = await c.query(
        `INSERT INTO delivery_challans (
          id, challan_number, type, vendor_id, sc_id, status, dispatch_date, expected_return_date,
          process_name, notes, created_by_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, 'PRODUCTION_PROCESS_OUTWARD', $2, $3, 'DISPATCHED', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days',
          'HEAT TREATMENT', 'Standard production dispatch batch', $4, NOW(), NOW()
        ) RETURNING id`,
        [dcNumber, firstVendor.id, sc2550.id, primaryAdminId]
      );
      const dcId = ndc.rows[0].id;

      // DC Item
      const nitem = await c.query(
        `INSERT INTO delivery_challan_items (
          id, challan_id, sc_id, product_id, part_number, part_name, description, quantity_dispatched,
          expected_output_quantity, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, '2550-ARG', 'ARG DIA 25.0', 'En31 Shaft Heat Treatment', 1, 1, NOW(), NOW()
        ) RETURNING id`,
        [dcId, sc2550.id, firstProduct.id]
      );

      // DC Movement
      await c.query(
        `INSERT INTO dc_movements (
          id, challan_id, challan_item_id, sc_id, process_id, dispatched_product_id, dispatched_qty, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 1, 'DISPATCHED', NOW(), NOW()
        )`,
        [dcId, nitem.rows[0].id, sc2550.id, firstProcess ? firstProcess.id : null, firstProduct.id]
      );
      console.log(`✓ Seeded sample Delivery Challan ${dcNumber} with items and movement.`);
    }
  }

  // =========================================================================
  // Final Verification
  // =========================================================================
  console.log('\n===============================================================');
  console.log('         NEW NEON DATABASE RESTORATION AUDIT SUMMARY          ');
  console.log('===============================================================');
  const auditTables = [
    'users', 'roles', 'system_modules', 'role_module_permissions',
    'customers', 'purchase_orders', 'sales_order_components',
    'rm_requests', 'rm_items',
    'products', 'warehouses', 'racks', 'bins', 'stock_balances',
    'vendors', 'production_processes',
    'delivery_challans', 'delivery_challan_items', 'dc_movements',
    'merc_indent_pending', 'merc_indent_line_items'
  ];

  for (const t of auditTables) {
    const countRes = await c.query(`SELECT count(*) FROM "${t}"`);
    console.log(`  • ${t.padEnd(28)}: ${countRes.rows[0].count} records`);
  }

  await c.end();
  console.log('\n✓ RESTORATION COMPLETED SUCCESSFULLY WITH ZERO ERRORS!\n');
}

main().catch(err => {
  console.error('Fatal error during restoration:', err);
  process.exit(1);
});
