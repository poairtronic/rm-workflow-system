const { Client } = require('pg');

async function check() {
  const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'password', database: 'rm_workflow_db' });
  await c.connect();
  const tables = [
    'users', 'customers', 'products', 'purchase_orders',
    'sales_order_components', 'rm_requests', 'rm_items',
    'material_issues', 'delivery_challans', 'delivery_challan_items'
  ];
  for (const t of tables) {
    try {
      const r = await c.query(`SELECT count(*) FROM ${t}`);
      console.log(`${t}: ${r.rows[0].count}`);
    } catch (e) {
      console.log(`${t}: error - ${e.message}`);
    }
  }
  const pos = await c.query('SELECT po_number FROM purchase_orders');
  console.log('POs in local rm_workflow_db:', pos.rows.map(r => r.po_number));
  await c.end();
}

check().catch(console.error);

