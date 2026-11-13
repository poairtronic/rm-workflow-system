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

  const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));
  const excelProductNames = Array.from(new Set(rows.map(r => r.data?.F?.trim()).filter(Boolean)));

  const res = await c.query('SELECT id, name, code FROM products WHERE NOT (name = ANY($1)) LIMIT 20', [excelProductNames]);
  console.log('Sample genuine products that will remain:');
  res.rows.forEach(r => console.log(`  ${r.id} | ${r.code} | ${r.name}`));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

