const dns = require('node:dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }
  if (hostname && hostname.includes('neon.tech')) {
    const forcedOpts = typeof opts === 'object' && opts !== null ? { ...opts, family: 4 } : { family: 4 };
    return originalLookup(hostname, forcedOpts, cb);
  }
  return originalLookup(hostname, opts, cb);
};

const { Client } = require('pg');
const fs = require('fs');
const envContent = fs.readFileSync('backend/.env', 'utf8');
const match = envContent.match(/DATABASE_URL_DIRECT="?([^"\r\n]+)"?/);
const dbUrl = match ? match[1] : null;

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const families = await client.query('SELECT id, name FROM product_families');
  console.log('Product families:');
  console.table(families.rows);

  const txCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_transactions'");
  console.log('stock_transactions columns:');
  console.table(txCols.rows);

  const balCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_balances'");
  console.log('stock_balances columns:');
  console.table(balCols.rows);

  const longBar = await client.query("SELECT * FROM products WHERE name ILIKE '%LONG BAR%90%' LIMIT 5");
  console.log('Long Bar product:');
  console.table(longBar.rows);

  if (longBar.rows.length > 0) {
    const balances = await client.query("SELECT sb.*, b.name as bin_name, b.code as bin_code FROM stock_balances sb JOIN bins b ON b.id = sb.bin_id WHERE sb.product_id = $1", [longBar.rows[0].id]);
    console.log('Long Bar balances:');
    console.table(balances.rows);
  }

  await client.end();
}

run().catch(console.error);
