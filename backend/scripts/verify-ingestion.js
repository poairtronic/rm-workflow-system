import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/.env' });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();
  console.log('Connected to DB');

  const scCount = await client.query('SELECT status, COUNT(*)::int as count FROM sales_order_components GROUP BY status');
  console.log('SCs by status:', scCount.rows);

  const reqCount = await client.query('SELECT status, COUNT(*)::int as count FROM rm_requests GROUP BY status');
  console.log('RM Requests by status:', reqCount.rows);

  const rmCount = await client.query('SELECT COUNT(*)::int as count FROM rm_items');
  console.log('RM items total count:', rmCount.rows[0].count);

  const miCount = await client.query('SELECT issue_type, COUNT(*)::int as count FROM material_issues GROUP BY issue_type');
  console.log('Material Issues by issue_type:', miCount.rows);

  const mrCount = await client.query('SELECT status, COUNT(*)::int as count FROM material_receipts GROUP BY status');
  console.log('Material Receipts by status:', mrCount.rows);

  const poCount = await client.query('SELECT COUNT(*)::int as count FROM purchase_orders');
  console.log('Purchase Orders count:', poCount.rows[0].count);

  const custCount = await client.query('SELECT COUNT(*)::int as count FROM customers');
  console.log('Customers count:', custCount.rows[0].count);

  const stockCount = await client.query('SELECT COUNT(*)::int as count FROM stock_balances');
  console.log('Stock balances count (must be 0 or unchanged):', stockCount.rows[0].count);

  const sample = await client.query(`
    SELECT sc.sc_number, sc.product_name, sc.status, po.po_number, c.name as customer_name,
           (SELECT count(*) FROM rm_items ri WHERE ri.sc_id = sc.id) as rm_item_count
    FROM sales_order_components sc
    JOIN purchase_orders po ON sc.po_id = po.id
    JOIN customers c ON po.customer_id = c.id
    ORDER BY sc.sc_number ASC
    LIMIT 10
  `);
  console.log('\nSample SCs (first 10):\n', sample.rows);

  const sampleRm = await client.query(`
    SELECT ri.part_name, ri.material, ri.size, ri.quantity
    FROM rm_items ri
    JOIN sales_order_components sc ON ri.sc_id = sc.id
    WHERE sc.sc_number = (SELECT sc_number FROM sales_order_components ORDER BY sc_number ASC LIMIT 1)
  `);
  console.log('\nSample RM items for first SC:\n', sampleRm.rows);

  // Check reconciliation (issued vs received) for a sample of SCs
  const recon = await client.query(`
    SELECT sc.sc_number, 
           SUM(mii.quantity_issued)::numeric as total_issued, 
           SUM(mri.quantity_received)::numeric as total_received
    FROM sales_order_components sc
    LEFT JOIN material_issues mi ON mi.sc_id = sc.id
    LEFT JOIN material_issue_items mii ON mii.material_issue_id = mi.id
    LEFT JOIN material_receipts mr ON mr.material_issue_id = mi.id
    LEFT JOIN material_receipt_items mri ON mri.material_receipt_id = mr.id
    GROUP BY sc.sc_number
    ORDER BY sc.sc_number ASC
    LIMIT 10
  `);
  console.log('\nReconciliation check (issued vs received, first 10):\n', recon.rows);

  const rangeCheck = await client.query(`
    SELECT MIN(sc_number) as min_sc, MAX(sc_number) as max_sc, COUNT(*)::int as total_scs
    FROM sales_order_components
  `);
  console.log('\nSC Number Range in Database:\n', rangeCheck.rows[0]);

  await client.end();
}
verify().catch(console.error);
