const { Client } = require('pg');

async function check() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const res = await c.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('All Tables in Database:');
  for (const row of res.rows) {
    const countRes = await c.query(`SELECT count(*) FROM "${row.table_name}"`);
    console.log(`  ${row.table_name.padEnd(35)} : ${countRes.rows[0].count} rows`);
  }

  await c.end();
}

check().catch(console.error);
