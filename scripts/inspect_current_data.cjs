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

  console.log('=== PRODUCT COUNT & UOM ===');
  const pCount = await c.query('SELECT count(*) FROM products');
  console.log('Total products:', pCount.rows[0].count);
  const uomCount = await c.query('SELECT uom, count(*) FROM products GROUP BY uom');
  console.log('Products by UOM:', uomCount.rows);

  const sampleProducts = await c.query('SELECT id, code, name, uom FROM products LIMIT 25');
  console.log('Sample products:', sampleProducts.rows);

  console.log('\n=== SALES ORDER COMPONENTS ===');
  const scCount = await c.query('SELECT count(*) FROM sales_order_components');
  console.log('Total SCs:', scCount.rows[0].count);

  const sampleScs = await c.query('SELECT sc_number, product_name, target_quantity, status FROM sales_order_components ORDER BY created_at DESC LIMIT 20');
  console.log('Sample SCs:', sampleScs.rows);

  console.log('\n=== RM ITEMS ===');
  const rmCount = await c.query('SELECT count(*) FROM rm_items');
  console.log('Total RM items:', rmCount.rows[0].count);

  const sampleRms = await c.query('SELECT sc_id, part_name, quantity, material, size FROM rm_items LIMIT 15');
  console.log('Sample RM items:', sampleRms.rows);

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

