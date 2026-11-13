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
  const res = await c.query(`
    SELECT challan_number, dispatch_date, expected_return_date, notes
    FROM delivery_challans
    ORDER BY challan_number
  `);
  console.log(`Total DCs: ${res.rows.length}`);
  res.rows.forEach(r => {
    console.log(`${r.challan_number.padEnd(16)} | Dispatch: ${r.dispatch_date.toISOString().split('T')[0]} | Expected: ${r.expected_return_date ? r.expected_return_date.toISOString().split('T')[0] : 'NULL'} | Notes: "${r.notes}"`);
  });
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

