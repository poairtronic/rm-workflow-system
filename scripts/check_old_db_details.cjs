const { Client } = require('pg');

const oldDbUrl = 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function check() {
  const c = new Client({ connectionString: oldDbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    console.log('Connected to old DB');
    const locs = await c.query('SELECT * FROM warehouse_locations');
    console.log('old DB warehouse_locations:', locs.rows);
    const scs = await c.query("SELECT sc_number, po_id, product_name FROM sales_order_components WHERE sc_number LIKE '2535%'");
    console.log('old DB 2535 SCs:', scs.rows);
    await c.end();
  } catch (e) {
    console.error('Failed to connect to old DB:', e.message);
  }
}
check();

