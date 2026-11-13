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

async function main() {
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const pos = await c.query('SELECT count(*) FROM purchase_orders');
  console.log('Total POs in DB:', pos.rows[0].count);

  const scs = await c.query('SELECT count(*) FROM sales_order_components');
  console.log('Total SCs in DB:', scs.rows[0].count);

  const rms = await c.query('SELECT count(*) FROM rm_items');
  console.log('Total RM items in DB:', rms.rows[0].count);

  const dcs = await c.query('SELECT count(*) FROM delivery_challans');
  console.log('Total DCs in DB:', dcs.rows[0].count);

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

