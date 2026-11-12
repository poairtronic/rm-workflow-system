const { Client } = require('pg');

async function check() {
  const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'password', database: 'indent_db' });
  await c.connect();
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'indents'");
  console.log('Columns in indents:', cols.rows.map(r => r.column_name));
  const r = await c.query('SELECT * FROM indents LIMIT 3');
  console.log('Sample rows:', r.rows);
  await c.end();
}

check().catch(console.error);
