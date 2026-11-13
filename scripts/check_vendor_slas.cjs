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
  const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='vendor_slas'");
  console.log('vendor_slas columns:', cols.rows);
  const rows = await c.query('SELECT * FROM vendor_slas LIMIT 10');
  console.log('vendor_slas count:', rows.rows.length);
  console.log('vendor_slas sample:', rows.rows);
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

