const { Client } = require('pg');

const oldDbUrl = 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const newDbUrl = 'postgresql://neondb_owner:npg_p03ZRTFexBzX@ep-weathered-bird-bdraean9.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function checkDb(name, url) {
  console.log(`\n================ Checking ${name} ================`);
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    console.log(`✓ Connected to ${name}`);

    const tables = [
      'sales_order_components',
      'purchase_orders',
      'products',
      'raw_materials',
      'merc_indents',
      'delivery_challans',
      'users',
      'stock_transactions',
      'material_issues',
      'material_receipts',
      'vendor_slas'
    ];

    for (const t of tables) {
      try {
        const res = await c.query(`SELECT count(*) FROM "${t}"`);
        console.log(`  ${t.padEnd(25)} : ${res.rows[0].count} rows`);
      } catch (err) {
        console.log(`  ${t.padEnd(25)} : [TABLE NOT FOUND / ERROR]`);
      }
    }

    try {
      const resRecent = await c.query(`
        SELECT sc_number, created_at, updated_at 
        FROM sales_order_components 
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      console.log('  Latest SCs:');
      resRecent.rows.forEach(r => console.log(`    - ${r.sc_number} (created: ${r.created_at})`));
    } catch (e) { }

    await c.end();
    return true;
  } catch (err) {
    console.error(`✗ Failed to connect to ${name}:`, err.message);
    if (err.code) console.error(`  Error Code:`, err.code);
    return false;
  }
}

async function main() {
  await checkDb('OLD DATABASE (ep-still-bread-b5iszknm)', oldDbUrl);
  await checkDb('NEW DATABASE (ep-weathered-bird-bdraean9)', newDbUrl);
}

main();

