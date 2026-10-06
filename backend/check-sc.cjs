const pg = require('pg');
require('dotenv').config();

async function check() {
  const c = new pg.Client(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL);
  await c.connect();

  const res = await c.query("SELECT id, sc_number FROM sales_order_components WHERE sc_number = 'SC-26-003'");
  const sc = res.rows[0];
  if(!sc) {
    console.log('SC NOT FOUND');
    return c.end();
  }
  
  console.log('Found SC:', sc);

  const rmRes = await c.query("SELECT * FROM rm_requests WHERE sc_id = $1", [sc.id]);
  console.log('RM Requests:', rmRes.rows);

  if (rmRes.rows.length > 0) {
    const itemsRes = await c.query("SELECT * FROM rm_items WHERE rm_form_id = $1", [rmRes.rows[0].id]);
    console.log('RM Items:', itemsRes.rows);
  }
  
  await c.end();
}
check();
