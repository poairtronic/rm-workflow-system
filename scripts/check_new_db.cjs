const { Client } = require('pg');

async function check() {
  const c = new Client({ connectionString: process.env.DATABASE_URL_DIRECT });
  await c.connect();
  const res = await c.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('Total tables created in new Neon DB:', res.rows.length);
  console.log(res.rows.map(r => r.table_name));
  await c.end();
}

check().catch(console.error);
