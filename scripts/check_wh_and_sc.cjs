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

const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  console.log('--- WAREHOUSE TABLES ---');
  const wh = await c.query('SELECT * FROM warehouses');
  console.log('Warehouses:', wh.rows);

  const loc = await c.query('SELECT * FROM storage_locations');
  console.log('Storage Locations count:', loc.rows.length);
  console.log('Storage Locations:', loc.rows);

  const sec = await c.query('SELECT count(*) FROM storage_sections');
  console.log('Storage Sections count:', sec.rows[0].count);

  const secSample = await c.query('SELECT * FROM storage_sections LIMIT 10');
  console.log('Storage Sections sample:', secSample.rows);

  console.log('\n--- SC SAMPLES WITH HYPHENS ---');
  const scHyphen = await c.query("SELECT id, sc_number, po_id, product_name, quantity, uom FROM sales_order_components WHERE sc_number LIKE '%-%' LIMIT 20");
  console.log('Hyphenated SCs:', scHyphen.rows);

  const sc2535 = await c.query("SELECT id, sc_number, po_id, product_name, quantity, uom FROM sales_order_components WHERE sc_number LIKE '2535%'");
  console.log('2535 SCs:', sc2535.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

