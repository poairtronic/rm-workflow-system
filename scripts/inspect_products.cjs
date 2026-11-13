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

  console.log('=== PRODUCT TABLE INSPECTION ===');
  const countLineItemProds = await c.query(`
    SELECT count(*) FROM products 
    WHERE name LIKE 'ARG%' OR name LIKE 'APG%' OR name LIKE 'SPG%' OR name LIKE 'SRG%' 
       OR name LIKE 'BASE PLATE%' OR name LIKE 'FEET PLATE%' OR name LIKE 'DEPTH COLLAR%' 
       OR name LIKE 'VERTICAL BENCH%' OR name LIKE 'CARBIDE%' OR name LIKE 'JIG FEET%' 
       OR name LIKE 'STOPPER%' OR name LIKE 'SP DIA%' OR name LIKE 'EXTENSION%'
  `);
  console.log('Count of line items mistakenly created as products:', countLineItemProds.rows[0].count);

  const genuineProducts = await c.query(`
    SELECT id, code, name, uom FROM products 
    WHERE NOT (
      name LIKE 'ARG%' OR name LIKE 'APG%' OR name LIKE 'SPG%' OR name LIKE 'SRG%' 
      OR name LIKE 'BASE PLATE%' OR name LIKE 'FEET PLATE%' OR name LIKE 'DEPTH COLLAR%' 
      OR name LIKE 'VERTICAL BENCH%' OR name LIKE 'CARBIDE%' OR name LIKE 'JIG FEET%' 
      OR name LIKE 'STOPPER%' OR name LIKE 'SP DIA%' OR name LIKE 'EXTENSION%'
      OR name LIKE 'ACG%' OR name LIKE 'AL HOUSING%' OR name LIKE 'SETTING DISC%'
    )
    LIMIT 50
  `);
  console.log(`Genuine / Inventory Products count: ${genuineProducts.rows.length}`);
  console.log('Sample genuine products:', genuineProducts.rows.slice(0, 20));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

