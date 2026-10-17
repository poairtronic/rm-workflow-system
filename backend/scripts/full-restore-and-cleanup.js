import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PRODUCT_MSL_MAP } from './update-product-msl.js';
import { INVENTORY_RAW, PRODUCT_FAMILIES } from './import-velan-inventory.js';

const SEED_ROLES = [
  { name: 'ADMIN', description: 'System Administrator with full access to user management and audit logs' },
  { name: 'DESIGNER', description: 'Design Engineer creating and editing Raw Material requirement lists' },
  { name: 'STORES', description: 'Stores Manager checking inventory availability and issuing materials' },
  { name: 'PRODUCTION', description: 'Production Operator confirming receipts, logging consumption, returns, and completing SC' },
  { name: 'SENIOR_MANAGER', description: 'Senior Manager for operations monitoring and analytics' },
  { name: 'GENERAL_MANAGER', description: 'General Manager for executive governance and operational analytics' },
];

const SEED_USERS = [
  // Primary Administrator RAMU
  {
    name: 'RAMU',
    email: 'admin@airtronic.com',
    roleName: 'ADMIN',
    department: 'Management',
  },
  {
    name: 'RAMU',
    email: 'ramu@airtronic.com',
    roleName: 'ADMIN',
    department: 'Management',
  },
  {
    name: 'RAMU',
    email: 'ramu@velan.com',
    roleName: 'ADMIN',
    department: 'Management',
  },
  {
    name: 'RAMU',
    email: 'ramu@gmail.com',
    roleName: 'ADMIN',
    department: 'Management',
  },

  // Operational Department Leads
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

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✓ Connected to PostgreSQL Database.');

  try {
    // ----------------------------------------------------
    // STEP 1: Purge Concurrency / E2E Test Artifacts
    // ----------------------------------------------------
    console.log('\n--- Step 1: Cleaning test artifacts ---');

    const testProdFilter = `(
      name LIKE 'ConcProduct%' 
      OR name LIKE 'Test Product%' 
      OR name LIKE 'CONCUR_PROD%' 
      OR name LIKE '%p20_6%' 
      OR name LIKE 'Custody Product%'
    )`;

    const testUserFilter = `(
      email LIKE '%@test.com' 
      OR email LIKE '%@rmrit.com' 
      OR email LIKE '%@example.com' 
      OR email LIKE 'stores_lock%' 
      OR email LIKE 'prod_lock%' 
      OR email LIKE 'designer_lock%' 
      OR email LIKE 'srmanager_lock%' 
      OR email LIKE 'genmanager_lock%' 
      OR email LIKE 'inactive_lock%' 
      OR email LIKE 'stores_txsafe%' 
      OR email LIKE 'designer_txsafe%' 
      OR email LIKE 'prod_txsafe%'
    )`;

    // Deactivate and safely remove test artifacts
    try {
      await client.query(`UPDATE products SET is_active = false WHERE ${testProdFilter};`);
      await client.query(`UPDATE users SET is_active = false WHERE ${testUserFilter};`);
      console.log('✓ Deactivated all test products and test users');

      // Attempt clean deletion of unreferenced test records
      await client.query(`
        DELETE FROM msl_alerts WHERE product_id IN (SELECT id FROM products WHERE ${testProdFilter});
        DELETE FROM stock_balances WHERE product_id IN (SELECT id FROM products WHERE ${testProdFilter} AND id NOT IN (SELECT product_id FROM stock_transactions));
        DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE ${testUserFilter});
        DELETE FROM user_module_permissions WHERE user_id IN (SELECT id FROM users WHERE ${testUserFilter});
        DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE ${testUserFilter});
      `);
      console.log('✓ Cleared non-critical test dependent records');
    } catch (e) {
      console.warn('  Note on test artifact cleanup:', e.message);
    }

    // ----------------------------------------------------
    // STEP 2: Synchronize System Roles
    // ----------------------------------------------------
    console.log('\n--- Step 2: Restoring System Roles ---');
    const roleMap = new Map();
    for (const r of SEED_ROLES) {
      let res = await client.query('SELECT id FROM roles WHERE name = $1', [r.name]);
      if (res.rows.length === 0) {
        res = await client.query(
          'INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id',
          [r.name, r.description]
        );
      } else {
        await client.query(
          'UPDATE roles SET description = $1, updated_at = NOW() WHERE name = $2',
          [r.description, r.name]
        );
      }
      roleMap.set(r.name, res.rows[0].id);
    }
    console.log(`✓ 6 System Roles verified (${Array.from(roleMap.keys()).join(', ')})`);

    // ----------------------------------------------------
    // STEP 3: Restoring Official Users (including RAMU Admin)
    // ----------------------------------------------------
    console.log('\n--- Step 3: Restoring Official Users ---');
    const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'airtronic123A@';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    for (const u of SEED_USERS) {
      const roleId = roleMap.get(u.roleName);
      let res = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (res.rows.length === 0) {
        await client.query(
          `INSERT INTO users (id, name, email, password_hash, role_id, department, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())`,
          [u.name, u.email, passwordHash, roleId, u.department]
        );
        console.log(`  + Created user: ${u.name} <${u.email}> (${u.roleName})`);
      } else {
        await client.query(
          `UPDATE users 
           SET name = $1, password_hash = $2, role_id = $3, department = $4, is_active = true, updated_at = NOW() 
           WHERE email = $5`,
          [u.name, passwordHash, roleId, u.department, u.email]
        );
        console.log(`  * Updated user: ${u.name} <${u.email}> (${u.roleName})`);
      }
    }

    // ----------------------------------------------------
    // STEP 4: Synchronize System Modules & Permissions
    // ----------------------------------------------------
    console.log('\n--- Step 4: Synchronizing Role Module Permissions ---');
    const modules = [
      { key: 'rm_creation', name: 'RM Creation', group: 'RM WORKFLOW', route: '/design/rm-creation', order: 10 },
      { key: 'rm_requisitions', name: 'My Requisitions', group: 'RM WORKFLOW', route: '/design/my-requisitions', order: 20 },
      { key: 'my_requisitions', name: 'My Requisitions', group: 'RM WORKFLOW', route: '/design/my-requisitions', order: 20 },
      { key: 'rm_issue', name: 'RM Issue', group: 'RM WORKFLOW', route: '/stores/rm-issue', order: 30 },
      { key: 'extra_requests', name: 'Extra Requests', group: 'RM WORKFLOW', route: '/stores/extra-requests', order: 40 },
      { key: 'return_verify', name: 'Return Verify', group: 'RM WORKFLOW', route: '/stores/return-verify', order: 50 },
      { key: 'production_rm', name: 'My RM', group: 'RM WORKFLOW', route: '/production/rm', order: 60 },
      { key: 'consumption', name: 'Consumption', group: 'RM WORKFLOW', route: '/production/consumption', order: 70 },
      { key: 'stock_overview', name: 'Stock Overview', group: 'INVENTORY', route: '/inventory/stock', order: 80 },
      { key: 'stock_movement', name: 'Stock Movement', group: 'INVENTORY', route: '/inventory/movements', order: 90 },
      { key: 'supplier_inward', name: 'Dock Receipt', group: 'INVENTORY', route: '/inventory/dock-receipt', order: 100 },
      { key: 'msl_alerts', name: 'MSL Alerts', group: 'INVENTORY', route: '/inventory/msl-alerts', order: 110 },
      { key: 'dc_type1', name: 'DC Type 1 (Process)', group: 'DELIVERY CHALLAN', route: '/delivery-challan/type1', order: 120 },
      { key: 'dc_type2', name: 'DC Type 2 (General)', group: 'DELIVERY CHALLAN', route: '/delivery-challan/type2', order: 130 },
      { key: 'dc_returns', name: 'DC Returns', group: 'DELIVERY CHALLAN', route: '/delivery-challan/returns', order: 140 },
      { key: 'dc_movements', name: 'DC Movements', group: 'DELIVERY CHALLAN', route: '/delivery-challan/movements', order: 150 },
      { key: 'sc_traceability', name: 'SC Traceability', group: 'GOVERNANCE', route: '/traceability/sc', order: 160 },
      { key: 'po_traceability', name: 'PO Traceability', group: 'GOVERNANCE', route: '/traceability/po', order: 170 },
      { key: 'vendor_slas', name: 'Vendor SLAs', group: 'GOVERNANCE', route: '/governance/vendor-slas', order: 180 },
      { key: 'vendor_analytics', name: 'Vendor Analytics', group: 'GOVERNANCE', route: '/governance/vendor-analytics', order: 190 },
      { key: 'users', name: 'Users Master', group: 'MASTERS', route: '/masters/users', order: 200 },
      { key: 'products', name: 'Products Master', group: 'MASTERS', route: '/masters/products', order: 210 },
      { key: 'warehouses', name: 'Warehouses & Bins', group: 'MASTERS', route: '/masters/warehouses', order: 220 },
      { key: 'vendors', name: 'Vendors Master', group: 'MASTERS', route: '/masters/vendors', order: 230 },
      { key: 'processes', name: 'Process Master', group: 'MASTERS', route: '/masters/processes', order: 240 },
      { key: 'overview', name: 'Overview', group: 'DASHBOARDS', route: '/overview', order: 5 },
    ];

    for (const m of modules) {
      await client.query(`
        INSERT INTO system_modules (module_key, name, group_name, route_path, description, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (module_key) DO UPDATE SET
          name = EXCLUDED.name,
          group_name = EXCLUDED.group_name,
          route_path = EXCLUDED.route_path,
          sort_order = EXCLUDED.sort_order;
      `, [m.key, m.name, m.group, m.route, `${m.name} module`, m.order]);
    }

    // Grant all modules to ADMIN
    const adminRoleId = roleMap.get('ADMIN');
    for (const m of modules) {
      await client.query(`
        INSERT INTO role_module_permissions (role_id, module_key, is_allowed)
        VALUES ($1, $2, true)
        ON CONFLICT (role_id, module_key) DO UPDATE SET is_allowed = true;
      `, [adminRoleId, m.key]);
    }

    // Grant common permissions to STORES, PRODUCTION, DESIGNER, etc.
    const allRoleIds = Array.from(roleMap.values());
    for (const rid of allRoleIds) {
      // Products, stock_overview, overview, warehouses are readable across roles
      for (const k of ['products', 'stock_overview', 'overview', 'warehouses']) {
        await client.query(`
          INSERT INTO role_module_permissions (role_id, module_key, is_allowed)
          VALUES ($1, $2, true)
          ON CONFLICT (role_id, module_key) DO UPDATE SET is_allowed = true;
        `, [rid, k]);
      }
    }
    console.log('✓ System modules and role permissions synchronized');

    // ----------------------------------------------------
    // STEP 5: Storage Hierarchy (Warehouse, Locations, Racks, Bins)
    // ----------------------------------------------------
    console.log('\n--- Step 5: Restoring Storage Hierarchy ---');
    // Ensure VELAN STORES warehouse exists
    let whRes = await client.query("SELECT id FROM warehouses WHERE code = 'VELAN STORES'");
    let whId;
    if (whRes.rows.length === 0) {
      const r = await client.query(
        "INSERT INTO warehouses (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'VELAN STORES', 'Velan Stores', true, NOW(), NOW()) RETURNING id"
      );
      whId = r.rows[0].id;
    } else {
      whId = whRes.rows[0].id;
    }

    // Ensure 5 Shop-Floor Warehouse Locations
    const LOCATIONS = [
      { code: 'ROD-AREA', name: 'Rod Area' },
      { code: 'BAR-AREA', name: 'Bar Area' },
      { code: 'RACK-AREA', name: 'Rack Area' },
      { code: 'BIN-AREA', name: 'Bin Area' },
      { code: 'BEURO', name: 'Beuro Area' },
    ];

    const locMap = new Map();
    for (const l of LOCATIONS) {
      let lRes = await client.query('SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND code = $2', [whId, l.code]);
      if (lRes.rows.length === 0) {
        const ins = await client.query(
          'INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id',
          [whId, l.code, l.name]
        );
        locMap.set(l.code, ins.rows[0].id);
      } else {
        locMap.set(l.code, lRes.rows[0].id);
      }
    }

    // Helper to determine location for a storage unit name
    function getLocationForName(name) {
      const upper = name.trim().toUpperCase();
      if (upper === 'ROD AREA' || upper.startsWith('ROD')) return locMap.get('ROD-AREA');
      if (upper === 'BAR AREA' || upper.startsWith('BAR')) return locMap.get('BAR-AREA');
      if (upper.startsWith('BEURO') || upper === 'BEURO') return locMap.get('BEURO');
      if (upper.startsWith('BIN')) return locMap.get('BIN-AREA');
      if (upper.startsWith('RACK') || upper.startsWith('BOX')) return locMap.get('RACK-AREA');
      return locMap.get('RACK-AREA');
    }

    // Extract all unique locations from INVENTORY_RAW
    const rawLocNames = [...new Set(INVENTORY_RAW.map(i => i.loc.trim().toUpperCase()))];
    const binMap = new Map();

    for (const locName of rawLocNames) {
      const locId = getLocationForName(locName);

      // Check / Create Rack
      let rackRes = await client.query('SELECT id FROM racks WHERE location_id = $1 AND code = $2', [locId, locName]);
      let rackId;
      if (rackRes.rows.length === 0) {
        const ins = await client.query(
          'INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id',
          [locId, locName, locName]
        );
        rackId = ins.rows[0].id;
      } else {
        rackId = rackRes.rows[0].id;
      }

      // Check / Create Bin
      let bRes = await client.query('SELECT id FROM bins WHERE rack_id = $1 AND code = $2', [rackId, locName]);
      let binId;
      if (bRes.rows.length === 0) {
        const ins = await client.query(
          'INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id',
          [rackId, locName, `${locName} Default Bin`]
        );
        binId = ins.rows[0].id;
      } else {
        binId = bRes.rows[0].id;
      }
      binMap.set(locName, binId);
    }
    console.log(`✓ Storage units initialized: 5 locations, ${rawLocNames.length} racks/bins`);

    // ----------------------------------------------------
    // STEP 6: Product Categories & Families
    // ----------------------------------------------------
    console.log('\n--- Step 6: Restoring Categories & Families ---');
    let catRes = await client.query("SELECT id FROM product_categories WHERE name = 'Velan Master Category'");
    let catId;
    if (catRes.rows.length === 0) {
      const ins = await client.query(
        "INSERT INTO product_categories (id, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'Velan Master Category', true, NOW(), NOW()) RETURNING id"
      );
      catId = ins.rows[0].id;
    } else {
      catId = catRes.rows[0].id;
    }

    const familyMap = new Map();
    for (const famName of PRODUCT_FAMILIES) {
      let fRes = await client.query('SELECT id FROM product_families WHERE category_id = $1 AND name = $2', [catId, famName]);
      if (fRes.rows.length === 0) {
        const ins = await client.query(
          'INSERT INTO product_families (id, category_id, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW()) RETURNING id',
          [catId, famName]
        );
        familyMap.set(famName, ins.rows[0].id);
      } else {
        familyMap.set(famName, fRes.rows[0].id);
      }
    }
    console.log(`✓ ${PRODUCT_FAMILIES.length} Product Families synchronized`);

    // Helper to deduce family from item name
    function deduceFamily(name) {
      const upper = name.toUpperCase().trim();
      if (upper.startsWith('CARBIDE BUSH')) return 'CARBIDE BUSH';
      if (upper.startsWith('CARBIDE BALL')) return 'CARBIDE BALLS';
      if (upper.startsWith('CUT PIECE EN31') || upper.startsWith('CUT_PIECE EN31')) return 'EN31 CUT PIECE';
      if (upper.startsWith('CUT PIECE OHNS') || upper.startsWith('CUT_PIECE OHNS')) return 'OHNS CUT PIECE';
      if (upper.startsWith('EN31 DIA') && upper.includes('FINE BLANK')) return 'EN31 FINE BLANK';
      if (upper.startsWith('EN31 DIA') && upper.includes('SEMI FINISHED')) return 'EN31 CUT PIECE';
      if (upper.startsWith('EN31 DIA') && upper.includes('CUT PIECE')) return 'EN31 CUT PIECE';
      if (upper.startsWith('LONG BAR EN31')) return 'EN31 LONG BAR';
      if (upper.startsWith('LONG BAR OHNS KNURLING')) return 'OHNS KNURLING LONG BAR';
      if (upper.startsWith('LONG BAR OHNS')) return 'OHNS LONG BAR';
      if (upper.startsWith('OHNS SQUARE')) return 'OHNS SQUARE';
      if (upper.startsWith('OHNS KD 100') || upper.startsWith('KD 100')) return 'OHNS KD 100';
      if (upper.startsWith('OHNS KD 112') || upper.startsWith('KD 112')) return 'OHNS KD 112';
      if (upper.startsWith('OHNS KD 125') || upper.startsWith('KD 125')) return 'OHNS KD 125';
      if (upper.startsWith('OHNS KD 22') || upper.startsWith('KD 22')) return 'OHNS KD 22';
      if (upper.startsWith('OHNS KD 32') || upper.startsWith('KD 32')) return 'OHNS KD 32';
      if (upper.startsWith('OHNS KD 38') || upper.startsWith('KD 38')) return 'OHNS KD 38';
      if (upper.startsWith('OHNS KD 45') || upper.startsWith('KD 45')) return 'OHNS KD 45';
      if (upper.startsWith('OHNS KD 53') || upper.startsWith('KD 53')) return 'OHNS KD 53';
      if (upper.startsWith('OHNS KD 63') || upper.startsWith('KD 63')) return 'OHNS KD 63';
      if (upper.startsWith('OHNS KD 71') || upper.startsWith('KD 71')) return 'OHNS KD 71';
      if (upper.startsWith('OHNS KD 85') || upper.startsWith('KD 85')) return 'OHNS KD 85';
      if (upper.startsWith('ALUMINIUM ROD') || upper.startsWith('AL ')) return 'ALUMINIUM BAR';
      if (upper.startsWith('BRASS ROD')) return 'BRASS BITS';
      if (upper.startsWith('COPPER ROD') || upper.startsWith('COPPER DIA')) return 'BRASS BITS';
      if (upper.startsWith('D2 DIA')) return 'D2 MATERIAL';
      if (upper.startsWith('HSS BIT') || (upper.startsWith('DIA ') && upper.includes('HSS BIT'))) return 'H.S.S BIT';
      if (upper.startsWith('ARG ID') || upper.startsWith('ARG OD') || upper.startsWith('ARG JET')) return 'ARG FINE BLANK';
      if (upper.startsWith('BALL ') && !upper.includes('CARBIDE')) return 'CARBIDE BALLS';
      if (upper.startsWith('CONNECTORS') || upper.startsWith('CONNECTOR') || upper.startsWith('END CONNECTOR') || upper.startsWith('L CONNECTOR')) {
        if (upper.includes('1A')) return 'CONNECTORS - 1A';
        if (upper.includes('2A')) return 'CONNECTORS - 2A';
        if (upper.includes('CJET') || upper.includes('-CJET')) return 'CONNECTORS - CJET';
        if (upper.includes('PIN')) return 'CONNECTORS - PIN TYPE';
        return 'CONNECTORS - CJET';
      }
      if (upper.startsWith('M12') || upper.startsWith('M14') || upper.startsWith('M20') || upper.startsWith('M6') || upper.startsWith('M8')) {
        if (upper.includes('1A')) return 'CONNECTORS - 1A';
        if (upper.includes('2A')) return 'CONNECTORS - 2A';
        if (upper.includes('CJET') || upper.includes('-CJET')) return 'CONNECTORS - CJET';
        if (upper.includes('PIN')) return 'CONNECTORS - PIN TYPE';
        if (upper.includes('TAP')) return 'TAP';
      }
      if (upper.startsWith('EXTENSTION') || upper.startsWith('EXTENTION')) return 'EXTENTION';
      if (upper.startsWith('I.S NO') || upper.startsWith('I.S NYLON') || upper.startsWith('IS ')) return 'IS HANDLES';
      if (upper.startsWith('JIG')) return 'FEET PLATE SQUARE MS';
      if (upper.startsWith('MS 70') || upper.startsWith('MS 40') || upper.startsWith('MS 75')) return 'BASE PLATE SQUARE MS';
      if (upper.startsWith('NYLON DIA') || upper.startsWith('NYLON ROD')) return 'SETTING PLUG PLASTIC TUBE';
      if (upper.startsWith('SS DIA') || upper.startsWith('SS ROD')) return 'SS MATERIAL';
      if (upper.startsWith('TEFFLON DIA')) return 'SETTING PLUG PLASTIC TUBE';
      if (upper.startsWith('M4 TAP')) return 'TAP';
      if (upper.startsWith('BUFFING') || upper.startsWith('CUTTING WHEELS') || upper.startsWith('M1TR') || upper.startsWith('DIAMOND') || upper.startsWith('OD GRINDING')) return 'OD GRINDING WHEEL';
      if (upper.startsWith('COTTON GLOVES') || upper.startsWith('LATHE GLOVES') || upper.startsWith('EAR PLUGS') || upper.startsWith('SAFETY EYE') || upper.startsWith('CLEANING BRUSH') || upper.startsWith('ALLEN KEY')) return 'ACCESSORIES';
      return 'OTHERS';
    }

    // ----------------------------------------------------
    // STEP 7: Restoring All 325 Products, MSLs & Barcodes
    // ----------------------------------------------------
    console.log('\n--- Step 7: Restoring Products, MSLs & Barcodes ---');
    const adminUserRes = await client.query("SELECT id FROM users WHERE email = 'admin@airtronic.com'");
    const adminUserId = adminUserRes.rows[0].id;

    const productMap = new Map();
    let distinctCount = 0;

    for (const item of INVENTORY_RAW) {
      const codeUpper = item.code.trim().toUpperCase();
      let prodId = productMap.get(codeUpper);

      const targetMsl = PRODUCT_MSL_MAP[item.name.trim().toUpperCase()] || 0;
      const barcodeCandidate = codeUpper.startsWith('PRD-') ? codeUpper : `PRD-${codeUpper}`;

      if (!prodId) {
        let pRes = await client.query('SELECT id FROM products WHERE code = $1 OR name = $2', [item.code, item.name]);
        if (pRes.rows.length === 0) {
          prodId = crypto.randomUUID();
          const famName = deduceFamily(item.name);
          const famId = familyMap.get(famName) || familyMap.get('OTHERS');

          await client.query(`
            INSERT INTO products (
              id, family_id, code, barcode, name, uom, minimum_inventory, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
          `, [prodId, famId, item.code, barcodeCandidate, item.name, item.uom || 'NOS', targetMsl]);
          distinctCount++;
        } else {
          prodId = pRes.rows[0].id;
          await client.query(`
            UPDATE products 
            SET minimum_inventory = $1, barcode = COALESCE(barcode, $2), is_active = true, updated_at = NOW()
            WHERE id = $3
          `, [targetMsl, barcodeCandidate, prodId]);
        }
        productMap.set(codeUpper, prodId);
      }

      // Check / Insert Stock Balance for (prodId, binId)
      const targetBinId = binMap.get(item.loc.trim().toUpperCase());
      if (targetBinId) {
        let bRes = await client.query('SELECT id FROM stock_balances WHERE product_id = $1 AND bin_id = $2', [prodId, targetBinId]);
        if (bRes.rows.length === 0) {
          const balId = crypto.randomUUID();
          await client.query(`
            INSERT INTO stock_balances (id, product_id, bin_id, current_quantity, opening_balance, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $4, NOW(), NOW())
          `, [balId, prodId, targetBinId, item.qty]);

          // Record Opening Transaction
          const txId = crypto.randomUUID();
          await client.query(`
            INSERT INTO stock_transactions (
              id, product_id, destination_bin_id, quantity, transaction_type, "referenceType", reference_id, remarks, created_by_id, created_at
            ) VALUES ($1, $2, $3, $4, 'GRN_RECEIPT', 'OPENING_STOCK', $5, $6, $7, NOW())
          `, [txId, prodId, targetBinId, item.qty, txId, `Initial inventory import into ${item.loc}`, adminUserId]);
        }
      }
    }
    console.log(`✓ Restored ${productMap.size} distinct products with balances and transactions`);

    // ----------------------------------------------------
    // STEP 8: Ensure Customer BDL-IND
    // ----------------------------------------------------
    let cRes = await client.query("SELECT id FROM customers WHERE code = 'BDL-IND'");
    if (cRes.rows.length === 0) {
      await client.query(`
        INSERT INTO customers (id, code, name, contact_person, email, phone, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'BDL-IND', 'Bharat Dynamics Limited', 'K. S. Rao', 'ksrao@bdl.gov.in', '+91-40-23456789', true, NOW(), NOW())
      `);
      console.log('✓ Customer BDL-IND restored');
    }

    // ----------------------------------------------------
    // FINAL VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- Final Verification ---');
    const uCount = await client.query('SELECT count(*) FROM users');
    const pCount = await client.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE minimum_inventory > 0) as monitored,
        count(*) FILTER (WHERE minimum_inventory = 0) as unmonitored
      FROM products
    `);
    const sbCount = await client.query('SELECT count(*) FROM stock_balances');

    console.log(`Active Users: ${uCount.rows[0].count}`);
    console.log(`Total Products: ${pCount.rows[0].total} (Monitored MSL: ${pCount.rows[0].monitored}, Unmonitored: ${pCount.rows[0].unmonitored})`);
    console.log(`Stock Balances: ${sbCount.rows[0].count}`);

    const userList = await client.query(`
      SELECT u.name, u.email, r.name as role, u.is_active 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.created_at ASC
    `);
    console.log('\nRestored Users:');
    console.table(userList.rows);

  } catch (err) {
    console.error('❌ Error during restore:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
