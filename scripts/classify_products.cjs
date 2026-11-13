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

  // Load real inventory items
  const realInvPath = 'backend/scripts/seed-real-inventory.js';
  const realInvContent = fs.readFileSync(realInvPath, 'utf8');
  const match = realInvContent.match(/export const REAL_INVENTORY_ITEMS = (\[[\s\S]*?\]);/);
  const realInv = eval(match[1]);
  const realProductNames = new Set(realInv.map(i => i.product.trim()));
  console.log(`Real Inventory Products in file: ${realProductNames.size}`);

  // Query all products in DB
  const dbProds = await c.query('SELECT id, code, name, uom FROM products');
  console.log(`Total Products in DB: ${dbProds.rows.length}`);

  let matchReal = 0;
  let notMatchReal = [];
  for (const p of dbProds.rows) {
    if (realProductNames.has(p.name)) {
      matchReal++;
    } else {
      notMatchReal.push(p);
    }
  }

  console.log(`Products in DB matching real inventory: ${matchReal}`);
  console.log(`Products in DB NOT matching real inventory: ${notMatchReal.length}`);

  console.log('\nSample non-matching products:');
  notMatchReal.slice(0, 30).forEach(p => console.log(`  - "${p.name}" (code: ${p.code})`));

  // Also check if any other genuine products exist (like MERC Indent items or consumable items)
  const mercProds = await c.query(`
    SELECT DISTINCT p.name FROM merc_indent_line_items m 
    JOIN products p ON m.rm_product_id = p.id
  `);
  console.log(`\nProducts used in MERC indents: ${mercProds.rows.length}`);
  mercProds.rows.forEach(r => console.log(`  MERC: "${r.name}"`));

  const stockTxProds = await c.query(`
    SELECT DISTINCT p.name FROM stock_transactions st 
    JOIN products p ON st.product_id = p.id
    LIMIT 20
  `);
  console.log(`\nSample Products in stock_transactions: ${stockTxProds.rows.length}`);

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

