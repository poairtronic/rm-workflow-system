/**
 * One-off idempotent legacy indent importer for V-SMART
 * Imports PO1169 and PO1349 into merc_indent_pending and merc_indent_line_items.
 *
 * Usage:
 *   node --env-file=backend/.env scripts/import_legacy_indents.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

const { Client } = pg;

// Constant: strictly no RM stock deduction
const STOCK_DEDUCT = false;

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const legacyDataPath = path.resolve('data/legacy_indents.json');

  if (!fs.existsSync(legacyDataPath)) {
    console.error(`Legacy indents data file not found at: ${legacyDataPath}`);
    process.exit(1);
  }

  const legacyIndents = JSON.parse(fs.readFileSync(legacyDataPath, 'utf8'));
  console.log(`Loaded ${legacyIndents.length} legacy indents. DRY_RUN: ${isDryRun}`);

  if (isDryRun) {
    for (const ind of legacyIndents) {
      console.log(`\n[DRY-RUN] Indent: ${ind.indentNumber} (PO: ${ind.poNumber}) - ${ind.lineItems.length} lines`);
      for (const item of ind.lineItems) {
        console.log(`  - [${item.itemType}] ${item.mercItemId}: ${item.name} | Mat: ${item.material || 'N/A'} | Qty: ${item.quantityRequired} ${item.unit} | Status: ISSUED`);
      }
    }
    console.log('\nDRY RUN complete. 0 records written.');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database.');

  let insertedHeaders = 0;
  let insertedLines = 0;

  for (const ind of legacyIndents) {
    // Idempotent header check
    let pRes = await client.query('SELECT id FROM merc_indent_pending WHERE indent_id = $1', [ind.indentId]);
    let pendingId: string;
    if (pRes.rows.length === 0) {
      const np = await client.query(
        `INSERT INTO merc_indent_pending (id, indent_id, indent_number, po_number, customer_name, layout_number, status, merc_current_state, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ISSUED', 'ISSUED', NOW(), NOW()) RETURNING id`,
        [ind.indentId, ind.indentNumber, ind.poNumber, ind.customerName || null, ind.layoutNumber || null]
      );
      pendingId = np.rows[0].id;
      insertedHeaders++;
      console.log(`Created header: ${ind.indentNumber}`);
    } else {
      pendingId = pRes.rows[0].id;
      console.log(`Header already exists: ${ind.indentNumber}`);
    }

    // Insert line items
    for (const item of ind.lineItems) {
      let itemRes = await client.query(
        'SELECT id FROM merc_indent_line_items WHERE merc_indent_pending_id = $1 AND merc_item_id = $2',
        [pendingId, item.mercItemId]
      );

      if (itemRes.rows.length === 0) {
        await client.query(
          `INSERT INTO merc_indent_line_items (
            id, merc_indent_pending_id, merc_item_id, item_type, name, material, shape,
            length_mm, width_mm, height_mm, diameter_mm, quantity_required, quantity_issued,
            unit, vendor_name, source, status, issued_at, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'LEGACY_IMPORT', 'ISSUED', NOW(), NOW()
          )`,
          [
            pendingId,
            item.mercItemId,
            item.itemType,
            item.name,
            item.material || null,
            item.shape || null,
            item.lengthMm || null,
            item.widthMm || null,
            item.heightMm || null,
            item.diameterMm || null,
            item.quantityRequired,
            item.quantityIssued,
            item.unit || 'NOS',
            item.vendorName || null,
          ]
        );
        insertedLines++;
      }
    }
  }

  console.log(`\nImport complete. Inserted headers: ${insertedHeaders}, Inserted line items: ${insertedLines}. (STOCK_DEDUCT: ${STOCK_DEDUCT})`);
  await client.end();
}

run().catch((err) => {
  console.error('Import error:', err);
  process.exit(1);
});

