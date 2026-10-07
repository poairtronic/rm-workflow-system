/**
 * reset-test-data.js
 *
 * Wipes every transactional table in the development database and
 * re-seeds the 8 sample opening-stock rows (same data as seed-runner.js).
 *
 * SAFETY GATES:
 *   1. Refuses to run when NODE_ENV === 'production'.
 *   2. Requires the --yes flag to proceed.
 *
 * Usage (from repo root):
 *   node backend/scripts/reset-test-data.js --yes
 *   npm run reset:test-data --prefix backend -- --yes
 *
 * NOT RUN automatically by this script being created.
 */

import pg from 'pg';
import 'dotenv/config';

// --- Safety Gates ---

if (process.env.NODE_ENV === 'production') {
  console.error('\n[ABORT] NODE_ENV is "production". This script must NEVER run against a production database.\n');
  process.exit(1);
}

if (!process.argv.includes('--yes')) {
  console.error('\n[ABORT] Missing required flag --yes.\nRun with: node backend/scripts/reset-test-data.js --yes\n');
  process.exit(1);
}

// --- Transactional Tables (no CASCADE - each listed explicitly) ---
const TRANSACTIONAL_TABLES = [
  'delivery_challan_items',
  'delivery_challans',
  'general_issue_items',
  'general_issues',
  'material_issue_items',
  'material_issues',
  'material_receipt_items',
  'material_receipts',
  'material_return_items',
  'material_returns',
  'material_consumptions',
  'additional_material_request_items',
  'additional_material_requests',
  'rm_item_snapshots',
  'rm_items',
  'rm_form_scs',
  'rm_requests',
  'sales_order_components',
  'purchase_orders',
  'stock_transactions',
  'stock_balances',
  'msl_alerts',
  'email_logs',
  'email_jobs',
  'notifications',
  'audit_logs',
  'attachments',
  'uploaded_files',
];

// --- Seed Data (mirrors seed-runner.js SAMPLE_PRODUCTS exactly) ---
const SAMPLE_PRODUCTS = [
  { name: 'Sample EN31 Round Bar \u00d8110mm (KG)',     msl: 50,  max: 200,  bin: 'A-01', openQty: 120  },
  { name: 'Sample MS Plate 10mm IS2062 (KG)',      msl: 100, max: 500,  bin: 'A-01', openQty: 105  },
  { name: 'Sample HSS Block M2 100x100x50 (NOS)',  msl: 15,  max: 60,   bin: 'A-02', openQty: 40   },
  { name: 'Sample Al 6061 Bar \u00d850mm (KG)',         msl: 30,  max: 150,  bin: 'A-02', openQty: 32   },
  { name: 'Sample SS304 Sheet 2mm (SQM)',          msl: 20,  max: 100,  bin: 'A-02', openQty: 60   },
  { name: 'Sample Brass Rod \u00d825mm (KG)',           msl: 25,  max: 120,  bin: 'A-03', openQty: 80   },
  { name: 'Sample M8 High Tensile Bolts (NOS)',    msl: 500, max: 3000, bin: 'A-03', openQty: 1500 },
  { name: 'Sample GI Binding Wire 16 SWG (KG)',   msl: 40,  max: 250,  bin: 'A-03', openQty: 150  },
];


async function countTable(client, table) {
  try {
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    return { table, count: r.rows[0].n };
  } catch {
    return { table, count: '(not found)' };
  }
}

function printCounts(label, counts) {
  console.log(`\n${label}`);
  const maxLen = Math.max(...counts.map(c => c.table.length));
  for (const { table, count } of counts) {
    console.log(`  ${table.padEnd(maxLen + 2)} ${count}`);
  }
}

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[ABORT] No DATABASE_URL or DATABASE_URL_DIRECT found.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[reset] Connected to PostgreSQL.');

  try {
    // 1. Counts BEFORE
    const before = await Promise.all(TRANSACTIONAL_TABLES.map(t => countTable(client, t)));
    printCounts('Counts BEFORE reset:', before);

    // 2. TRUNCATE (no CASCADE - every table listed explicitly)
    console.log('\n[reset] Truncating transactional tables...');
    await client.query('SET session_replication_role = replica');
    for (const table of TRANSACTIONAL_TABLES) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY`);
        process.stdout.write(`  truncated: ${table}\n`);
      } catch (err) {
        console.warn(`  WARNING: Could not truncate "${table}": ${err.message}`);
      }
    }
    await client.query('SET session_replication_role = DEFAULT');
    console.log('[reset] Truncation complete.');

    // 3. Re-seed opening stock
    console.log('\n[reset] Re-seeding opening stock...');

    const adminRes = await client.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'ADMIN' LIMIT 1`
    );
    if (adminRes.rows.length === 0) {
      throw new Error('No ADMIN user found. Run main seed first: npm run seed:db');
    }
    const adminUserId = adminRes.rows[0].id;

    const binRes = await client.query(
      `SELECT b.code, b.id FROM bins b
       JOIN racks rk ON rk.id = b.rack_id
       JOIN warehouse_locations wl ON wl.id = rk.location_id
       JOIN warehouses wh ON wh.id = wl.warehouse_id
       WHERE wh.code = 'WH-MAIN'`
    );
    if (binRes.rows.length === 0) {
      throw new Error('No bins found under WH-MAIN. Run main seed first: npm run seed:db');
    }
    const binMap = Object.fromEntries(binRes.rows.map(r => [r.code, r.id]));

    let seededCount = 0;
    for (const p of SAMPLE_PRODUCTS) {
      const prodRes = await client.query(`SELECT id FROM products WHERE name = $1`, [p.name]);
      if (prodRes.rows.length === 0) {
        console.warn(`  WARNING: Product not found, skipping: ${p.name}`);
        continue;
      }
      const prodId = prodRes.rows[0].id;
      const targetBinId = binMap[p.bin];
      if (!targetBinId) {
        console.warn(`  WARNING: Bin "${p.bin}" not found, skipping: ${p.name}`);
        continue;
      }

      const txRes = await client.query(
        `INSERT INTO stock_transactions (
           id, product_id, destination_bin_id, quantity,
           transaction_type, "referenceType", remarks, created_by_id, created_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3,
           'STOCK_IN', 'INITIAL_SETUP', 'Reset: initial sample stock setup', $4, NOW()
         ) RETURNING id`,
        [prodId, targetBinId, p.openQty, adminUserId]
      );
      const txId = txRes.rows[0].id;

      await client.query(
        `INSERT INTO stock_balances (
           id, product_id, bin_id, current_quantity, opening_balance,
           last_transaction_id, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $3, $4, NOW(), NOW()
         )`,
        [prodId, targetBinId, p.openQty, txId]
      );

      process.stdout.write(`  seeded: ${p.name} -> ${p.bin} (qty: ${p.openQty})\n`);
      seededCount++;
    }
    console.log(`[reset] ${seededCount}/8 opening stock rows inserted.`);

    // 4. Counts AFTER
    const after = await Promise.all(TRANSACTIONAL_TABLES.map(t => countTable(client, t)));
    printCounts('Counts AFTER reset:', after);

    console.log('\n[reset] Done. Test data has been reset.\n');
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('\n[reset FATAL]', err.message);
  process.exit(1);
});
