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

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  console.log('=== PO LIKE BHARAT OR HYUNDAI OR 1210 OR 667 ===');
  const pos = await client.query(`
    SELECT id, po_number FROM purchase_orders 
    WHERE po_number ILIKE '%1210%' 
       OR po_number ILIKE '%667%' 
       OR po_number ILIKE '%PROJECT%'
       OR po_number ILIKE '%BHARAT%'
       OR po_number ILIKE '%HYUNDAI%'
       OR po_number ILIKE '%MANDO%'
       OR po_number ILIKE '%1248%'
  `);
  console.table(pos.rows);

  console.log('=== MERC INDENTS SEARCH ===');
  const merc = await client.query(`
    SELECT * FROM merc_indent_pending
    WHERE po_number ILIKE '%667%' OR po_number ILIKE '%1210%' OR po_number ILIKE '%HYUNDAI%' OR po_number ILIKE '%BHARAT%'
    LIMIT 10
  `);
  console.table(merc.rows);

  console.log('=== SCs for BHARAT FORGE ===');
  const scs = await client.query(`
    SELECT sc.id, sc.sc_number, sc.product_name, po.po_number 
    FROM sales_order_components sc
    JOIN purchase_orders po ON po.id = sc.po_id
    WHERE po.po_number ILIKE '%BHARAT%'
  `);
  console.table(scs.rows);

  await client.end();
}

main().catch(console.error);

