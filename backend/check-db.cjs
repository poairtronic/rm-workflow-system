const pg = require('pg');
require('dotenv').config();

async function run() {
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'delivery_challan_items'");
  console.log('LIVE COLS:', cols.rows.map(x => x.column_name).join(', '));
  
  const poCount = await c.query("SELECT COUNT(*) FROM purchase_orders");
  console.log('PO Count:', poCount.rows[0].count);
  
  const scCount = await c.query("SELECT COUNT(*) FROM sales_order_components");
  console.log('SC Count:', scCount.rows[0].count);
  
  const parsed = new URL(url);
  console.log('Host/DB:', parsed.hostname, parsed.pathname);
  
  await c.end();
}
run();
