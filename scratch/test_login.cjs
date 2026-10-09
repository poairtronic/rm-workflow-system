const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
  });
  await client.connect();
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
  console.log('User columns:', cols.rows.map(r => r.column_name));
  const res = await client.query("SELECT u.id, u.email, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'ADMIN' LIMIT 5");
  console.log('Admin Users:', res.rows);
  await client.end();
}

main().catch(console.error);
