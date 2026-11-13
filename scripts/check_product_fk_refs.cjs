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

  const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));
  const excelProductNames = Array.from(new Set(rows.map(r => r.data?.F?.trim()).filter(Boolean)));

  const matched = (await c.query(`SELECT id FROM products WHERE name = ANY($1)`, [excelProductNames])).rows.map(r => r.id);
  console.log(`Matched product IDs to delete: ${matched.length}`);

  // Check tables referencing these product IDs
  const refTables = [
    { table: 'delivery_challan_items', col: 'product_id' },
    { table: 'delivery_challan_items', col: 'output_product_id' },
    { table: 'dc_movements', col: 'dispatched_product_id' },
    { table: 'dc_movements', col: 'returned_product_id' },
    { table: 'dc_rework_items', col: 'product_id' },
    { table: 'stock_balances', col: 'product_id' },
    { table: 'stock_transactions', col: 'product_id' },
    { table: 'rm_items', col: 'mapped_product_id' },
    { table: 'msl_alerts', col: 'product_id' },
    { table: 'general_issue_items', col: 'product_id' },
    { table: 'consumable_request_items', col: 'product_id' },
    { table: 'merc_indent_line_items', col: 'rm_product_id' }
  ];

  for (const t of refTables) {
    const res = await c.query(`SELECT count(*) FROM "${t.table}" WHERE "${t.col}" = ANY($1)`, [matched]);
    console.log(`References in ${t.table}.${t.col}: ${res.rows[0].count}`);
  }

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

