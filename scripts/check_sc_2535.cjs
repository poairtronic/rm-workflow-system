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
  const res = await c.query("SELECT id, sc_number, po_id, product_name, target_quantity FROM sales_order_components WHERE sc_number LIKE '%2535%' OR sc_number LIKE '%2536%' OR sc_number LIKE '%2534%'");
  console.log('Matching SCs in current DB:', res.rows);

  const sampleScs = await c.query("SELECT sc_number FROM sales_order_components LIMIT 20");
  console.log('Sample SCs in current DB:', sampleScs.rows.map(r => r.sc_number));

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

