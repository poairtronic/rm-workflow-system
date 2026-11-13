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
  const wl = await c.query('SELECT * FROM warehouse_locations');
  console.log('All warehouse_locations:', wl.rows);

  const r = await c.query('SELECT DISTINCT location_id FROM racks');
  console.log('Racks distinct location_ids:', r.rows);

  const mainLoc = await c.query("SELECT * FROM warehouse_locations WHERE code ILIKE '%main%' OR name ILIKE '%main%'");
  console.log('Main locations:', mainLoc.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

