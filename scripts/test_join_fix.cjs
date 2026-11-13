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
  const q1 = `
    SELECT r.id, soc.id as soc_id, r.sc_id
    FROM rm_requests r
    LEFT JOIN sales_order_components soc ON r.sc_id = soc.id
    WHERE r.status IN ('SUBMITTED', 'REVIEWED', 'COMPLETED')
  `;
  const res1 = await c.query(q1);
  const scIds = res1.rows.map(r => r.soc_id || r.sc_id).filter(Boolean);

  console.log('Testing query with casts: p.id::text = mii.issued_product_id and ri.mapped_product_id::text...');
  const q3 = `
    SELECT mi.sc_id as "scId", mii.rm_item_id as "rmItemId", mii.quantity_issued as "quantityIssued",
           COALESCE(mii.issued_product_name, p.name, ri.material) as "issuedProductName",
           COALESCE(mii.issued_product_id, ri.mapped_product_id::text) as "issuedProductId",
           ri.material as "requestedMaterial",
           ri.original_material as "originalMaterial",
           ri.original_grade as "originalGrade",
           ri.original_quantity as "originalQuantity",
           mi.issue_number as "issueNumber", mi.created_at as "issuedAt"
    FROM material_issue_items mii
    JOIN material_issues mi ON mi.id = mii.material_issue_id
    LEFT JOIN rm_items ri ON ri.id = mii.rm_item_id
    LEFT JOIN products p ON p.id::text = mii.issued_product_id
    WHERE mi.sc_id = ANY($1) AND mi.issue_type = 'INITIAL_ISSUE'
    ORDER BY mi.created_at ASC
  `;
  const res3 = await c.query(q3, [scIds]);
  console.log('✓ SUCCESS! Returned rows:', res3.rows.length);

  await c.end();
}).catch(e => {
  console.error('FAILED:', e);
  process.exit(1);
});
