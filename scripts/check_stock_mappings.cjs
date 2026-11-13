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

  const stocks = await c.query(`
    SELECT sb.id as sb_id, p.name as prod_name, sb.current_quantity, b.id as bin_id, b.code as bin_code, b.name as bin_name, r.id as rack_id, r.code as rack_code, r.name as rack_name
    FROM stock_balances sb
    JOIN products p ON sb.product_id = p.id
    JOIN bins b ON sb.bin_id = b.id
    JOIN racks r ON b.rack_id = r.id
    ORDER BY r.name, p.name
  `);

  console.log(`Total active stock balances: ${stocks.rows.length}`);
  const rackStockMap = new Map();
  for (const s of stocks.rows) {
    if (!rackStockMap.has(s.rack_name)) rackStockMap.set(s.rack_name, []);
    rackStockMap.get(s.rack_name).push(s);
  }

  console.log(`Unique Racks holding stock: ${rackStockMap.size}`);
  for (const [rName, list] of rackStockMap.entries()) {
    console.log(`  Rack "${rName}": ${list.length} products`);
  }

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

