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
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='material_issue_items'");
  console.log('material_issue_items columns:', cols.rows.map(r => r.column_name));

  const miCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='material_issues'");
  console.log('material_issues columns:', miCols.rows.map(r => r.column_name));

  const rmReqCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='rm_requests'");
  console.log('rm_requests columns:', rmReqCols.rows.map(r => r.column_name));

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
