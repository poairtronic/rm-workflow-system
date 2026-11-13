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

  const res = await c.query("SELECT id, code, name FROM products WHERE name LIKE 'ARG%' OR name LIKE 'APG%' OR name LIKE 'SPG%' OR name LIKE 'SRG%' OR name LIKE 'BASE PLATE%'");
  console.log('The 8 items:');
  res.rows.forEach(r => console.log(`  ${r.code} | ${r.name}`));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

