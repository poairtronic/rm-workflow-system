const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const res = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_transactions'");
  console.log(res.rows);
  await c.end();
}
run().catch(console.error);

