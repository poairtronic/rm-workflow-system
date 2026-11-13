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
  const sample = await c.query("SELECT code, name, barcode FROM products ORDER BY name LIMIT 25");
  console.log('Sample updated products:');
  sample.rows.forEach(r => {
    console.log(`Name: "${r.name.padEnd(30)}" | Code: "${r.code.padEnd(35)}" | Barcode: "${r.barcode}"`);
  });

  const checkAnyDiff = await c.query(`
    SELECT count(*) 
    FROM products 
    WHERE code != barcode 
       OR code != ('PRD-' || TRIM(name))
  `);
  console.log('\nProducts where code != barcode or code != PRD-<name>:', checkAnyDiff.rows[0].count);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
