const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  else if (!dbUrl && line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  const tables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const scHyphen = await c.query("SELECT id, sc_number, po_id, product_name, quantity, uom FROM sales_order_components WHERE sc_number LIKE '%-%' LIMIT 10");
  console.log('Hyphenated SCs:', scHyphen.rows);

  const sc2535 = await c.query("SELECT id, sc_number, po_id, product_name, quantity, uom FROM sales_order_components WHERE sc_number LIKE '2535%'");
  console.log('2535 SCs:', sc2535.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

