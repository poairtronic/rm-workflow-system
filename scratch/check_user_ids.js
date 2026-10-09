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
  const res = await client.query('SELECT id, email FROM users');
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
