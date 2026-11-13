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
  console.log('--- LOCATIONS ---');
  const locs = await c.query('SELECT * FROM warehouse_locations');
  console.log(locs.rows);

  console.log('--- RACKS COUNT BY LOCATION ---');
  const racksByLoc = await c.query('SELECT location_id, count(*) FROM racks GROUP BY location_id');
  console.log(racksByLoc.rows);

  console.log('--- RACKS SAMPLE ---');
  const racks = await c.query('SELECT code, name FROM racks ORDER BY code LIMIT 30');
  console.log(racks.rows);

  console.log('--- BINS COUNT ---');
  const binsCount = await c.query('SELECT count(*) FROM bins');
  console.log(binsCount.rows[0]);

  console.log('--- SC STATS ---');
  const totalSc = await c.query('SELECT count(*) FROM sales_order_components');
  console.log('Total SCs:', totalSc.rows[0].count);

  const suffixedSc = await c.query("SELECT sc_number, po_id, product_name, target_quantity FROM sales_order_components WHERE sc_number ~ '^\\d+-\\d+$' ORDER BY sc_number LIMIT 20");
  console.log('Suffixed SCs sample:', suffixedSc.rows);

  const suffixedCount = await c.query("SELECT count(*) FROM sales_order_components WHERE sc_number ~ '^\\d+-\\d+$'");
  console.log('Total suffixed SCs:', suffixedCount.rows[0].count);

  // Check FK references to sales_order_components
  const fkQuery = `
    SELECT
      tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'sales_order_components';
  `;
  const fks = await c.query(fkQuery);
  console.log('Foreign keys referencing sales_order_components:', fks.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

