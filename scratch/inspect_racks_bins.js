const fs = require('fs');
const envPath = fs.existsSync('.env') ? '.env' : 'backend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.match(/DATABASE_URL_DIRECT="?([^"\r\n]+)"?/)[1];
const dns = require('node:dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') { cb = options; opts = {}; }
  if (hostname && hostname.includes('neon.tech')) {
    const forcedOpts = typeof opts === 'object' && opts !== null ? { ...opts, family: 4 } : { family: 4 };
    return originalLookup(hostname, forcedOpts, cb);
  }
  return originalLookup(hostname, opts, cb);
};

const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- RACKS ---');
  const racks = await client.query('SELECT id, code, name FROM racks LIMIT 10');
  console.table(racks.rows);

  console.log('--- BINS with RACKS ---');
  const bins = await client.query(`
    SELECT b.id, b.code as bin_code, b.name as bin_name, 
           r.code as rack_code, r.name as rack_name,
           w.name as warehouse_name
    FROM bins b 
    LEFT JOIN racks r ON r.id = b.rack_id 
    LEFT JOIN warehouse_locations wl ON wl.id = r.location_id
    LEFT JOIN warehouses w ON w.id = wl.warehouse_id
    LIMIT 15
  `);
  console.table(bins.rows);

  console.log('--- STOCK BALANCES FOR RM-0003 ---');
  const rm3 = await client.query("SELECT id, name, code, uom FROM products WHERE code = 'RM-0003'");
  console.table(rm3.rows);
  if (rm3.rows.length > 0) {
    const sb = await client.query(`
      SELECT sb.id, sb.current_quantity, b.code as bin_code, b.name as bin_name,
             r.code as rack_code, r.name as rack_name
      FROM stock_balances sb
      JOIN bins b ON b.id = sb.bin_id
      LEFT JOIN racks r ON r.id = b.rack_id
      WHERE sb.product_id = $1
    `, [rm3.rows[0].id]);
    console.table(sb.rows);
  }

  await client.end();
}

run().catch(console.error);

