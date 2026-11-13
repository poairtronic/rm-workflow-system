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

  console.log('=== DEEP VERIFICATION OF SC 2535 ===');
  const sc2535 = await c.query("SELECT id, sc_number, product_name, target_quantity FROM sales_order_components WHERE sc_number = '2535'");
  console.log('SC:', sc2535.rows[0]);

  const sc2535Items = await c.query("SELECT part_name, quantity, weight_unit, remarks FROM rm_items WHERE sc_id = $1 ORDER BY part_name", [sc2535.rows[0].id]);
  console.log('BOM Parts under 2535:');
  sc2535Items.rows.forEach(r => console.log(`  - ${r.part_name}: ${r.quantity} ${r.weight_unit} (${r.remarks || 'Standard'})`));

  console.log('\n=== DEEP VERIFICATION OF SC 1758 ===');
  const sc1758 = await c.query("SELECT id, sc_number, product_name, target_quantity FROM sales_order_components WHERE sc_number = '1758'");
  console.log('SC:', sc1758.rows[0]);

  const sc1758Items = await c.query("SELECT part_name, quantity, weight_unit, remarks FROM rm_items WHERE sc_id = $1 ORDER BY part_name", [sc1758.rows[0].id]);
  console.log('BOM Parts under 1758:');
  sc1758Items.rows.forEach(r => console.log(`  - ${r.part_name}: ${r.quantity} ${r.weight_unit} (${r.remarks || 'Standard'})`));

  console.log('\n=== CHECK PRODUCTS TABLE PURITY ===');
  const checkBad = await c.query("SELECT count(*) FROM products WHERE name LIKE 'ARG%' OR name LIKE 'APG%' OR name LIKE 'SPG%' OR name LIKE 'SRG%' OR name LIKE 'BASE PLATE%' OR name LIKE 'FEET PLATE%'");
  console.log('Line items remaining in products table:', checkBad.rows[0].count);

  const sampleActual = await c.query("SELECT code, name, uom FROM products ORDER BY name LIMIT 10");
  console.log('Sample actual products remaining:');
  sampleActual.rows.forEach(r => console.log(`  - [${r.code}] ${r.name} (${r.uom})`));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

