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

  console.log('=== LATEST 10 SCs FOR TRACEABILITY VIEW ===');
  const res = await c.query(`
    SELECT sc.sc_number, sc.product_name, sc.target_quantity, po.po_number, count(rm.id) as part_count
    FROM sales_order_components sc
    JOIN purchase_orders po ON sc.po_id = po.id
    LEFT JOIN rm_items rm ON rm.sc_id = sc.id
    GROUP BY sc.sc_number, sc.product_name, sc.target_quantity, po.po_number, sc.created_at
    ORDER BY sc.created_at DESC, sc.sc_number DESC
    LIMIT 10
  `);

  res.rows.forEach(r => {
    console.log(`  SC ${r.sc_number.padEnd(8)} | ${r.product_name.padEnd(35)} | ${r.po_number.padEnd(30)} | ${r.target_quantity} NOS | ${r.part_count} parts`);
  });

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

