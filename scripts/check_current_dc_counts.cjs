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

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  try {
    const dcCount = await client.query('SELECT count(*) FROM delivery_challans');
    const dcItemCount = await client.query('SELECT count(*) FROM delivery_challan_items');
    const dcMovementCount = await client.query('SELECT count(*) FROM dc_movements');
    const vendorCount = await client.query('SELECT count(*) FROM vendors');
    const scCount = await client.query('SELECT count(*) FROM sales_order_components');
    const poCount = await client.query('SELECT count(*) FROM purchase_orders');
    const prodCount = await client.query('SELECT count(*) FROM products');

    console.log('=== CURRENT DB COUNTS ===');
    console.log('Delivery Challans:', dcCount.rows[0].count);
    console.log('DC Items:', dcItemCount.rows[0].count);
    console.log('DC Movements:', dcMovementCount.rows[0].count);
    console.log('Vendors:', vendorCount.rows[0].count);
    console.log('Sales Order Components (SCs):', scCount.rows[0].count);
    console.log('Purchase Orders (POs):', poCount.rows[0].count);
    console.log('Products:', prodCount.rows[0].count);

    // List any existing DC numbers
    const existingDcs = await client.query('SELECT challan_number, type, status, created_at FROM delivery_challans ORDER BY challan_number');
    console.log('\n=== EXISTING DC NUMBERS IN DB ===');
    console.log('Total:', existingDcs.rows.length);
    console.table(existingDcs.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();

