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

const c = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

c.connect().then(async () => {
  const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
  console.log('User columns:', res.rows.map(r => r.column_name));
  const u = await c.query('SELECT * FROM users LIMIT 1');
  console.log('User sample:', u.rows[0]);
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

