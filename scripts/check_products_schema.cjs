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
  const cols = await c.query("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='products'");
  console.log('Products columns:', cols.rows);

  const total = await c.query("SELECT count(*) FROM products");
  console.log('Total products:', total.rows[0].count);

  const sample = await c.query("SELECT id, code, name, barcode FROM products LIMIT 10");
  console.log('Sample products:', sample.rows);

  // Check unique constraints on products
  const constraints = await c.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'products'::regclass;
  `);
  console.log('Constraints on products:', constraints.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
