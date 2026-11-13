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

  const res = await c.query('SELECT DISTINCT weight_unit, count(*) FROM rm_items GROUP BY weight_unit');
  console.log('rm_items weight_unit distribution:', res.rows);

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

