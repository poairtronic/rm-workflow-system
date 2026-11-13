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
  for (const t of ['warehouses', 'warehouse_locations', 'racks', 'bins', 'sales_order_components']) {
    const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1", [t]);
    console.log(`=== ${t} ===`);
    console.log(cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

