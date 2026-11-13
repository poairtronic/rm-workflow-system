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
  const p1 = await c.query("SELECT id, code, name, barcode FROM products WHERE name = 'AL 115 X 25'");
  console.log('Product AL 115 X 25:', p1.rows);

  const p2 = await c.query("SELECT id, code, name, barcode FROM products WHERE name = 'CARBIDE BUSH 21 X10 X21'");
  console.log('Product CARBIDE BUSH 21 X10 X21:', p2.rows);

  const stats = await c.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE code LIKE 'PRD-%') as prd_code,
      count(*) FILTER (WHERE barcode LIKE 'PRD-%') as prd_barcode
    FROM products
  `);
  console.log('Stats:', stats.rows[0]);

  // Check how many have hex codes (like PRD-XXXXXX where X is hex)
  const hexSample = await c.query(`
    SELECT code, name, barcode 
    FROM products 
    WHERE code ~ '^PRD-[0-9A-F]{6}$'
    LIMIT 10
  `);
  console.log('Hex code sample:', hexSample.rows);

  const hexCount = await c.query(`
    SELECT count(*) 
    FROM products 
    WHERE code ~ '^PRD-[0-9A-F]{6}$'
  `);
  console.log('Total hex codes:', hexCount.rows[0].count);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
