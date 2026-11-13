const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  else if (!dbUrl && line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  const miiCols = await c.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='material_issue_items'");
  console.log('material_issue_items:', miiCols.rows);

  const riCols = await c.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='rm_items'");
  console.log('rm_items id:', riCols.rows.find(r => r.column_name === 'id'));

  const pCols = await c.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='products'");
  console.log('products id:', pCols.rows.find(r => r.column_name === 'id'));

  const miCols = await c.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='material_issues'");
  console.log('material_issues sc_id:', miCols.rows.find(r => r.column_name === 'sc_id'));

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

