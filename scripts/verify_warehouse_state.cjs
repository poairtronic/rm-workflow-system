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

  console.log('=== WAREHOUSES & LOCATIONS AUDIT ===');
  const wh = await c.query("SELECT id, code, name FROM warehouses WHERE code = 'WH-VELAN'");
  console.log('Warehouse:', wh.rows[0]);

  const locs = await c.query(`
    SELECT l.id, l.code, l.name, count(r.id) as rack_count
    FROM warehouse_locations l
    LEFT JOIN racks r ON r.location_id = l.id
    WHERE l.warehouse_id = $1
    GROUP BY l.id, l.code, l.name
    ORDER BY l.code
  `, [wh.rows[0].id]);
  
  console.log('\n7 Storage Locations in VELAN STORES:');
  locs.rows.forEach(l => console.log(`  - [${l.code}] ${l.name}: ${l.rack_count} storage sections`));

  console.log('\nSample Racks in Rack Area:');
  const sampleRacks = await c.query(`
    SELECT r.code, r.name FROM racks r 
    JOIN warehouse_locations l ON r.location_id = l.id 
    WHERE l.code = 'LOC-RACK' 
    ORDER BY r.code 
    LIMIT 5
  `);
  sampleRacks.rows.forEach(r => console.log(`  Rack: [${r.code}] ${r.name}`));

  const lastRacks = await c.query(`
    SELECT r.code, r.name FROM racks r 
    JOIN warehouse_locations l ON r.location_id = l.id 
    WHERE l.code = 'LOC-RACK' 
    ORDER BY r.code DESC 
    LIMIT 5
  `);
  lastRacks.rows.forEach(r => console.log(`  Rack: [${r.code}] ${r.name}`));

  console.log('\nSample Shelves in Bin Area:');
  const sampleBins = await c.query(`
    SELECT r.code, r.name FROM racks r 
    JOIN warehouse_locations l ON r.location_id = l.id 
    WHERE l.code = 'LOC-BIN' 
    ORDER BY r.code 
    LIMIT 5
  `);
  sampleBins.rows.forEach(r => console.log(`  Bin: [${r.code}] ${r.name}`));

  console.log('\nFine Blank Area Racks:');
  const fbRacks = await c.query(`
    SELECT r.code, r.name FROM racks r 
    JOIN warehouse_locations l ON r.location_id = l.id 
    WHERE l.code = 'LOC-FB' 
    ORDER BY r.code
  `);
  fbRacks.rows.forEach(r => console.log(`  FB: [${r.code}] ${r.name}`));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

