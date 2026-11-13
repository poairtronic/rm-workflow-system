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

  const custs = await client.query('SELECT id, name FROM customers');
  console.log('Customers count:', custs.rows.length);
  const bfCust = custs.rows.find(c => c.name.toLowerCase().includes('bharat'));
  const hwCust = custs.rows.find(c => c.name.toLowerCase().includes('hyundai'));
  console.log('Bharat Forge Customer:', bfCust);
  console.log('Hyundai Customer:', hwCust);

  // Check columns of customers
  if (!bfCust || !hwCust) {
    console.log('Sample customers:', custs.rows.slice(0, 5));
  }

  const p = await client.query("SELECT po_number, customer_id FROM purchase_orders WHERE po_number ILIKE '%BHARAT%'");
  console.log('Existing Bharat Forge POs:', p.rows);

  const cRes = await client.query("SELECT id, name FROM customers WHERE name ILIKE '%HYUNDAI%' OR name ILIKE '%WIA%'");
  console.log('Hyundai customer:', cRes.rows);

  await client.end();
}

run().catch(console.error);
