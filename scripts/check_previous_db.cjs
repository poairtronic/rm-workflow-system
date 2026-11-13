const { Client } = require('pg');

const oldDbUrl = 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function checkOldDb() {
  console.log('Attempting to connect to PREVIOUS Neon DB (ep-still-bread-b5iszknm)...');
  const c = new Client({ connectionString: oldDbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await c.connect();
    console.log('✓ Successfully connected to previous DB!');

    const tablesRes = await c.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n--- Table Counts in PREVIOUS Database ---');
    for (const row of tablesRes.rows) {
      try {
        const countRes = await c.query(`SELECT count(*) FROM "${row.table_name}"`);
        console.log(`  ${row.table_name.padEnd(35)} : ${countRes.rows[0].count} rows`);
      } catch (err) {
        console.log(`  ${row.table_name.padEnd(35)} : ERROR reading count: ${err.message}`);
      }
    }
    await c.end();
  } catch (err) {
    console.error('Connection to previous DB failed:', err.message);
    if (err.code) console.error('Error code:', err.code);
  }
}

checkOldDb();

