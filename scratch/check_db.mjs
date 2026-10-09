import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function check() {
  const po = await pool.query("SELECT * FROM purchase_orders WHERE po_number = 'PO-BROWSER-CHECK-01'");
  console.log('PO:', JSON.stringify(po.rows, null, 2));
  const sc = await pool.query("SELECT * FROM sales_order_components WHERE po_id = $1", [po.rows[0].id]);
  console.log('SC:', JSON.stringify(sc.rows, null, 2));
  const rmReq = await pool.query("SELECT * FROM rm_requests WHERE po_id = $1", [po.rows[0].id]);
  console.log('RM Requests:', JSON.stringify(rmReq.rows, null, 2));
  const rmCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'rm_items'");
  console.log('rm_items cols:', rmCols.rows.map(r => r.column_name));
  const rmItems = await pool.query("SELECT * FROM rm_items WHERE sc_id = $1", [sc.rows[0].id]);
  console.log('RM Items:', JSON.stringify(rmItems.rows, null, 2));
  const issues = await pool.query("SELECT * FROM material_issues WHERE sc_id = $1", [sc.rows[0].id]);
  console.log('Issues:', JSON.stringify(issues.rows, null, 2));
  const issueItems = await pool.query("SELECT * FROM material_issue_items WHERE material_issue_id = $1", [issues.rows[0]?.id]);
  console.log('Issue Items:', JSON.stringify(issueItems.rows, null, 2));
  const receipts = await pool.query("SELECT * FROM material_receipts WHERE material_issue_id = $1", [issues.rows[0]?.id]);
  console.log('Receipts:', JSON.stringify(receipts.rows, null, 2));
  const extra = await pool.query("SELECT * FROM additional_material_requests WHERE sc_id = $1", [sc.rows[0].id]);
  console.log('Extra Requests:', JSON.stringify(extra.rows, null, 2));
  const notifs = await pool.query("SELECT id, user_id, title, type, is_read, created_at FROM notifications WHERE title LIKE '%PO-BROWSER-CHECK-01%' OR title LIKE '%SC-BROWSER-CHECK-01%' ORDER BY created_at ASC");
  console.log('Notifications:', JSON.stringify(notifs.rows, null, 2));
  await pool.end();
}
check();
