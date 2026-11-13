const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  else if (!dbUrl && line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  console.log('Testing step 1: Query rm_requests with relations...');
  try {
    const q1 = `
      SELECT r.*, 
             soc.id as soc_id, soc.sc_number, soc.po_id as soc_po_id, soc.product_name as soc_product_name,
             po.id as po_id, po.po_number as po_po_number
      FROM rm_requests r
      LEFT JOIN sales_order_components soc ON r.sc_id = soc.id
      LEFT JOIN purchase_orders po ON r.po_id = po.id
      WHERE r.status IN ('SUBMITTED', 'REVIEWED', 'COMPLETED')
      ORDER BY r.updated_at DESC
    `;
    const res1 = await c.query(q1);
    console.log('✓ Step 1 passed! Rows:', res1.rows.length);

    const scIds = res1.rows.map(r => r.soc_id || r.sc_id).filter(Boolean);
    console.log('scIds count:', scIds.length);

    console.log('\nTesting step 2: Query issueSums...');
    const q2 = `
      SELECT mi.sc_id as "scId", COALESCE(SUM(mii.quantity_issued), 0) as "totalIssued"
      FROM material_issue_items mii
      JOIN material_issues mi ON mi.id = mii.material_issue_id
      WHERE mi.sc_id = ANY($1) AND mi.issue_type = 'INITIAL_ISSUE'
      GROUP BY mi.sc_id
    `;
    const res2 = await c.query(q2, [scIds]);
    console.log('✓ Step 2 passed! Rows:', res2.rows.length);

    console.log('\nTesting step 3: Query issueRows...');
    const q3 = `
      SELECT mi.sc_id as "scId", mii.rm_item_id as "rmItemId", mii.quantity_issued as "quantityIssued",
             COALESCE(mii.issued_product_name, p.name, ri.material) as "issuedProductName",
             COALESCE(mii.issued_product_id, ri.mapped_product_id) as "issuedProductId",
             ri.material as "requestedMaterial",
             ri.original_material as "originalMaterial",
             ri.original_grade as "originalGrade",
             ri.original_quantity as "originalQuantity",
             mi.issue_number as "issueNumber", mi.created_at as "issuedAt"
      FROM material_issue_items mii
      JOIN material_issues mi ON mi.id = mii.material_issue_id
      LEFT JOIN rm_items ri ON ri.id = mii.rm_item_id
      LEFT JOIN products p ON p.id = mii.issued_product_id
      WHERE mi.sc_id = ANY($1) AND mi.issue_type = 'INITIAL_ISSUE'
      ORDER BY mi.created_at ASC
    `;
    const res3 = await c.query(q3, [scIds]);
    console.log('✓ Step 3 passed! Rows:', res3.rows.length);

    console.log('\nTesting step 4: Items for each rm_request...');
    const q4 = `
      SELECT * FROM rm_items WHERE rm_form_id = ANY($1)
    `;
    const formIds = res1.rows.map(r => r.id);
    const res4 = await c.query(q4, [formIds]);
    console.log('✓ Step 4 passed! Rows:', res4.rows.length);

    console.log('\nNow let us test what TypeORM rmRepo.find() does exactly!');
  } catch (err) {
    console.error('Error during step execution:', err);
  }

  await c.end();
}).catch(e => {
  console.error('Connection error:', e);
  process.exit(1);
});

