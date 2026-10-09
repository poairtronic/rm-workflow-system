const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function main() {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const roles = await client.query('SELECT * FROM roles;');
  console.log('Roles:', roles.rows);

  const userColumns = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users';");
  console.log('User Columns:', userColumns.rows);

  await client.end();
}

main().catch(console.error);
