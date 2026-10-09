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

const jwt = require('../backend/node_modules/jsonwebtoken');

async function run() {
  const token = jwt.sign(
    { sub: 'a0000000-0000-0000-0000-000000000001', email: 'admin@airtronic.com', role: 'ADMIN' },
    'your_development_jwt_secret_min_32_characters',
    { expiresIn: '1h' }
  );

  const res = await fetch('http://localhost:3000/api/products?pageSize=1000', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Total returned:', data.data?.length, 'of total:', data.total);
  
  const longBars = (data.data || []).filter(p => p.name.toLowerCase().includes('long bar'));
  console.log('Long bars found:', longBars.length);
  if (longBars.length > 0) {
    console.log('First 3 long bars:', longBars.slice(0, 3).map(p => ({ id: p.id, name: p.name, code: p.code, uom: p.uom })));
  }
}

run().catch(console.error);
