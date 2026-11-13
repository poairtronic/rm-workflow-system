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

  console.log('=== WAREHOUSES ===');
  const whs = await c.query('SELECT * FROM warehouses');
  console.log(whs.rows);

  console.log('\n=== WAREHOUSE LOCATIONS ===');
  const locs = await c.query('SELECT * FROM warehouse_locations');
  console.log(locs.rows);

  console.log('\n=== RACKS COUNT BY LOCATION ===');
  const racks = await c.query(`
    SELECT l.name as loc_name, count(r.id) as rack_count 
    FROM racks r 
    JOIN warehouse_locations l ON r.location_id = l.id 
    GROUP BY l.name
  `);
  console.log(racks.rows);

  console.log('\n=== SAMPLE RACKS (NAMES & CODES) ===');
  const sampleRacks = await c.query('SELECT code, name FROM racks ORDER BY name LIMIT 50');
  sampleRacks.rows.forEach(r => console.log(`  [${r.code}] ${r.name}`));

  console.log('\n=== BINS COUNT ===');
  const binsCount = await c.query('SELECT count(*) FROM bins');
  console.log('Total bins:', binsCount.rows[0].count);

  const sampleBins = await c.query('SELECT b.code, b.name, r.name as rack_name FROM bins b JOIN racks r ON b.rack_id = r.id LIMIT 20');
  sampleBins.rows.forEach(b => console.log(`  Bin: [${b.code}] ${b.name} (under rack: ${b.rack_name})`));

  console.log('\n=== STOCK BALANCES BY BIN ===');
  const stockBins = await c.query(`
    SELECT b.name as bin_name, r.name as rack_name, count(sb.id) as stock_count, sum(sb.current_quantity) as total_qty
    FROM stock_balances sb
    JOIN bins b ON sb.bin_id = b.id
    JOIN racks r ON b.rack_id = r.id
    GROUP BY b.name, r.name
    ORDER BY stock_count DESC
    LIMIT 20
  `);
  console.log('Bins with active stock:');
  stockBins.rows.forEach(s => console.log(`  ${s.bin_name} (Rack: ${s.rack_name}): ${s.stock_count} products, total qty ${s.total_qty}`));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

