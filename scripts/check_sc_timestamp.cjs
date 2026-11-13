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
  const sc = await c.query("SELECT sc_number, created_at, updated_at FROM sales_order_components WHERE sc_number = '2535'");
  console.log('SC 2535:', sc.rows[0]);
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

