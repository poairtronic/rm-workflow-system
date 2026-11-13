const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  } else if (!dbUrl && line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  }
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  console.log('=== VENDOR SEARCH ===');
  const vRes = await client.query(`
    SELECT id, name FROM vendors 
    WHERE name ILIKE '%NV%' 
       OR name ILIKE '%FLAME%' 
       OR name ILIKE '%RKV%' 
       OR name ILIKE '%R.K.V%' 
       OR name ILIKE '%FINISH%'
       OR name ILIKE '%HONING%'
  `);
  console.table(vRes.rows);

  console.log('=== PO SEARCH ===');
  const poCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_orders'");
  console.log('PO columns:', poCols.rows.map(x => x.column_name));
  const poRes = await client.query(`
    SELECT id, po_number FROM purchase_orders 
    WHERE po_number ILIKE '%1210%' 
       OR po_number ILIKE '%667%' 
       OR po_number ILIKE '%BHARAT%'
  `);
  console.table(poRes.rows);

  console.log('=== MISSING PARTS SEARCH (2181, 1853, etc.) ===');
  const parts = ['2181', '1853', '1851', '1857', '1856', '1854', '1852', '1847', '1844'];
  const pRes = await client.query(`
    SELECT id, code, name FROM products WHERE code = ANY($1) OR name = ANY($1)
  `, [parts]);
  console.log('In products:');
  console.table(pRes.rows);

  const rmRes = await client.query(`
    SELECT id, sc_id, part_number, part_name, material FROM rm_items WHERE part_number = ANY($1)
  `, [parts]);
  console.log('In rm_items:');
  console.table(rmRes.rows);

  const mercRes = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%merc%'
  `);
  console.log('Merc tables:', mercRes.rows);

  await client.end();
}

main().catch(console.error);
