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

  const dates = await c.query('SELECT min(created_at), max(created_at), count(*) FROM sales_order_components');
  console.log('sales_order_components created_at range:', dates.rows[0]);

  const nonTestUsers = await c.query("SELECT DISTINCT created_by_id FROM rm_requests");
  console.log('RM request creators:', nonTestUsers.rows);

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

