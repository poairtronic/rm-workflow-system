const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  else if (!dbUrl && line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

async function main() {
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('--- UPDATING ALL PRODUCT CODES & BARCODES ---');

  await c.query('BEGIN');

  // Update products table
  const updateRes = await c.query(`
    UPDATE products
    SET 
      code = CASE 
        WHEN UPPER(TRIM(name)) LIKE 'PRD-%' THEN UPPER(TRIM(name))
        ELSE 'PRD-' || TRIM(name)
      END,
      barcode = CASE 
        WHEN UPPER(TRIM(name)) LIKE 'PRD-%' THEN UPPER(TRIM(name))
        ELSE 'PRD-' || TRIM(name)
      END,
      updated_at = NOW()
    RETURNING id, code, name, barcode;
  `);

  console.log(`✓ Updated ${updateRes.rowCount} products with PRD-<NAME> format for both code and barcode.`);

  // Sync consumable_request_items if any exist
  const syncConsumables = await c.query(`
    UPDATE consumable_request_items cri
    SET product_code = p.code
    FROM products p
    WHERE cri.product_id = p.id AND cri.product_code != p.code;
  `);
  console.log(`✓ Synced ${syncConsumables.rowCount} consumable request items.`);

  await c.query('COMMIT');

  // Verify specific user examples
  console.log('\n--- VERIFICATION OF SPECIFIC ITEMS ---');
  const ex1 = await c.query("SELECT code, name, barcode FROM products WHERE name ILIKE '%AL 115 X 25%'");
  console.log('Example 1 (AL 115 X 25):', ex1.rows);

  const ex2 = await c.query("SELECT code, name, barcode FROM products WHERE name ILIKE '%CARBIDE BUSH 21 X10 X21%'");
  console.log('Example 2 (CARBIDE BUSH 21 X10 X21):', ex2.rows);

  // Overall Verification
  console.log('\n--- VERIFICATION ACROSS ALL PRODUCTS ---');
  const total = await c.query("SELECT count(*) as total FROM products");
  const matchingCode = await c.query("SELECT count(*) as count FROM products WHERE code = barcode AND code LIKE 'PRD-%'");
  const anyMismatch = await c.query("SELECT id, code, name, barcode FROM products WHERE code != barcode OR code NOT LIKE 'PRD-%'");

  console.log(`Total Products: ${total.rows[0].total}`);
  console.log(`Products with code = barcode = 'PRD-<NAME>': ${matchingCode.rows[0].count}`);
  console.log(`Any Mismatches: ${anyMismatch.rows.length}`);

  if (anyMismatch.rows.length > 0) {
    console.error('Mismatches found:', anyMismatch.rows);
  } else {
    console.log('✓ 100% of products now strictly follow PRD-<NAME> format for both code and barcode!');
  }

  await c.end();
}

main().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
