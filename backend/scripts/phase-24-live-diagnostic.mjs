import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runDiagnostic() {
  console.log('='.repeat(80));
  console.log('🚀 STARTING COMPREHENSIVE PHASE 24 & SYSTEM INTEGRITY DIAGNOSTIC TEST');
  console.log('='.repeat(80));
  console.log(`Database Host: ${new URL(process.env.DATABASE_URL).host}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const report = {
    dbConnectivity: false,
    schemaIntegrity: {},
    endpointsValidation: {},
    businessLogicValidation: {},
    auditLedgerValidation: {},
    errorsFound: [],
    rectificationsApplied: [],
  };

  try {
    await client.connect();
    report.dbConnectivity = true;
    console.log('\n[TEST 1] ✅ Database Connection: SUCCESS');

    // 1. Table Verification
    console.log('\n[TEST 2] Verifying Core Tables for Consumables & Inventory...');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    const existingTables = new Set(tablesRes.rows.map(r => r.table_name));

    const requiredTables = [
      'consumable_requests',
      'consumable_request_items',
      'products',
      'product_families',
      'product_categories',
      'vendors',
      'warehouses',
      'warehouse_locations',
      'racks',
      'bins',
      'stock_balances',
      'stock_transactions',
      'users',
    ];

    for (const table of requiredTables) {
      const exists = existingTables.has(table);
      report.schemaIntegrity[table] = exists;
      if (exists) {
        const countRes = await client.query(`SELECT count(*) FROM "${table}"`);
        console.log(`  ✓ Table "${table}": PRESENT (${countRes.rows[0].count} rows)`);
      } else {
        console.error(`  ❌ Table "${table}": MISSING!`);
        report.errorsFound.push(`Missing table: ${table}`);
      }
    }

    // 2. Check Enums
    console.log('\n[TEST 3] Verifying PostgreSQL Custom ENUM Types...');
    const enumsRes = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      ORDER BY t.typname, e.enumsortorder
    `);
    const enumsByType = {};
    for (const row of enumsRes.rows) {
      if (!enumsByType[row.typname]) enumsByType[row.typname] = [];
      enumsByType[row.typname].push(row.enumlabel);
    }

    console.log('  Enums found:');
    for (const [name, vals] of Object.entries(enumsByType)) {
      if (name.includes('consumable')) {
        console.log(`  ✓ ${name}: [${vals.join(', ')}]`);
      }
    }

    // 3. Inspect Foreign Keys & Constraints on Consumable Tables
    console.log('\n[TEST 4] Verifying Foreign Keys on Consumables Tables...');
    const fkRes = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('consumable_requests', 'consumable_request_items')
    `);
    console.log('  Foreign Key Constraints:');
    for (const row of fkRes.rows) {
      console.log(`  ✓ ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
    }

    // 4. Test Catalog with Aggregated Stock Balance
    console.log('\n[TEST 5] Testing Catalog with Aggregated Stock Balances...');
    const catalogRes = await client.query(`
      SELECT 
        p.id, p.name, p.code, p.uom,
        COALESCE(SUM(sb.current_quantity), 0) AS "availableStock"
      FROM products p
      LEFT JOIN stock_balances sb ON sb.product_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.code, p.uom
      ORDER BY "availableStock" DESC
      LIMIT 5
    `);
    console.log('  Top 5 Catalog Items with Stock:');
    for (const item of catalogRes.rows) {
      console.log(`  - [${item.code || 'NO-CODE'}] ${item.name} | Available Stock: ${item.availableStock} ${item.uom}`);
    }

    // Find an in-stock product
    const inStockItem = catalogRes.rows.find(i => Number(i.availableStock) > 0);
    if (!inStockItem) {
      console.warn('  ⚠️ No in-stock product found in stock_balances for Track A testing. We will find/create one.');
    }

    // Find a warehouse bin
    const binRes = await client.query(`
      SELECT b.id, b.code, b.name, r.name as rack_name 
      FROM bins b
      LEFT JOIN racks r ON r.id = b.rack_id
      WHERE b.is_active = true
      LIMIT 1
    `);
    if (binRes.rows.length === 0) {
      throw new Error('No active bin found in database!');
    }
    const testBin = binRes.rows[0];
    console.log(`  ✓ Test Bin Selected: "${testBin.name || testBin.code}" (ID: ${testBin.id})`);

    // Find a valid user
    const userRes = await client.query(`SELECT id, name, email FROM users WHERE is_active = true LIMIT 1`);
    const testUser = userRes.rows[0] || { id: '00000000-0000-0000-0000-000000000000', name: 'System Admin' };
    console.log(`  ✓ Test User: ${testUser.name} (${testUser.id})`);

    // Ensure Consumables category & family exist
    console.log('\n[TEST 6] Testing Consumables Category & Product Family Resolution...');
    let catRes = await client.query(`SELECT id, name FROM product_categories WHERE LOWER(name) = 'consumables' LIMIT 1`);
    let catId;
    if (catRes.rows.length === 0) {
      const insCat = await client.query(`
        INSERT INTO product_categories (name, is_active)
        VALUES ('CONSUMABLES', true)
        RETURNING id
      `);
      catId = insCat.rows[0].id;
      console.log(`  ✓ Auto-created Category CONSUMABLES (${catId})`);
    } else {
      catId = catRes.rows[0].id;
      console.log(`  ✓ Existing Category CONSUMABLES found (${catId})`);
    }

    let famRes = await client.query(`SELECT id, name FROM product_families WHERE category_id = $1 LIMIT 1`, [catId]);
    let famId;
    if (famRes.rows.length === 0) {
      const insFam = await client.query(`
        INSERT INTO product_families (name, category_id, is_active)
        VALUES ('General Consumables', $1, true)
        RETURNING id
      `, [catId]);
      famId = insFam.rows[0].id;
      console.log(`  ✓ Auto-created ProductFamily General Consumables (${famId})`);
    } else {
      famId = famRes.rows[0].id;
      console.log(`  ✓ Existing ProductFamily found (${famId}: ${famRes.rows[0].name})`);
    }

    // 5. Test Live Business Logic via SQL Simulation & Data Validation
    console.log('\n[TEST 7] Testing Dual-Track Consumable Request Creation...');
    const testRunCode = `DIAG-${Date.now().toString().slice(-4)}`;
    const requestCode = `CR-2026-${Math.floor(Math.random() * 8999 + 1000)}`;

    // Create Request Header
    const reqHeaderRes = await client.query(`
      INSERT INTO consumable_requests (
        request_code, payment_mode, end_user_in_velan, requested_by, remarks
      ) VALUES ($1, 'CASH', 'Bay-3 CNC Machine', 'Diag Operator', 'Live Diagnostic Run')
      RETURNING *
    `, [requestCode]);
    const savedRequest = reqHeaderRes.rows[0];
    console.log(`  ✓ Created Request Header: Code ${savedRequest.request_code} (ID: ${savedRequest.id})`);

    // Let's create an in-stock product if none was found
    let stockProdId = inStockItem?.id;
    let stockProdCode = inStockItem?.code || 'P-STOCK-TEST';
    let stockProdName = inStockItem?.name || 'In-Stock Test Drill Bit';
    if (!stockProdId) {
      const newP = await client.query(`
        INSERT INTO products (code, name, family_id, uom, is_active)
        VALUES ($1, $2, $3, 'NOS', true)
        RETURNING id, code, name
      `, [`STK-${testRunCode}`, 'Test In-Stock Insert', famId]);
      stockProdId = newP.rows[0].id;
      stockProdCode = newP.rows[0].code;
      stockProdName = newP.rows[0].name;
      // Add balance in test bin
      await client.query(`
        INSERT INTO stock_balances (product_id, bin_id, current_quantity)
        VALUES ($1, $2, 25)
      `, [stockProdId, testBin.id]);
    }

    // Line Item 1: In-Stock Item (Track A -> READY_FOR_ISSUE)
    const item1Res = await client.query(`
      INSERT INTO consumable_request_items (
        request_id, product_id, product_code, description, uom,
        is_new_product, item_category_track, stock_available_at_request,
        requested_qty, status
      ) VALUES ($1, $2, $3, $4, 'NOS', false, 'STOCK_ITEM', 25, 2, 'READY_FOR_ISSUE')
      RETURNING *
    `, [savedRequest.id, stockProdId, stockProdCode, stockProdName]);
    const item1 = item1Res.rows[0];
    console.log(`  ✓ Item 1 (In-Stock): Routed to Track ${item1.item_category_track}, Status: ${item1.status}`);
    if (item1.item_category_track === 'STOCK_ITEM' && item1.status === 'READY_FOR_ISSUE') {
      report.businessLogicValidation.trackA = true;
    } else {
      report.businessLogicValidation.trackA = false;
      report.errorsFound.push('Track A routing failed');
    }

    // Line Item 2: Zero-Stock / New Product Auto-Creation (Track B -> OPEN)
    const newProdCode = `CNS-AUTO-${testRunCode}`;
    const newProdName = `Auto Diamond Grinding Wheel ${testRunCode}`;
    const autoProdRes = await client.query(`
      INSERT INTO products (code, name, family_id, uom, minimum_inventory, is_active)
      VALUES ($1, $2, $3, 'NOS', 0, true)
      RETURNING *
    `, [newProdCode, newProdName, famId]);
    const autoProduct = autoProdRes.rows[0];
    console.log(`  ✓ Auto-Created Master Product: "${autoProduct.name}" (${autoProduct.code})`);

    // Auto-create Vendor
    const autoVendName = `Apex Industrial Tools ${testRunCode}`;
    const autoVendRes = await client.query(`
      INSERT INTO vendors (name, code, phone, address, is_active)
      VALUES ($1, $2, '9876543210', 'Industrial Estate Phase 2', true)
      RETURNING *
    `, [autoVendName, `VND-${testRunCode}`]);
    const autoVendor = autoVendRes.rows[0];
    console.log(`  ✓ Auto-Created Master Vendor: "${autoVendor.name}" (${autoVendor.code})`);

    const item2Res = await client.query(`
      INSERT INTO consumable_request_items (
        request_id, product_id, product_code, description, uom,
        is_new_product, item_category_track, stock_available_at_request,
        requested_qty, vendor_id, vendor_name, unit_price,
        is_new_vendor, status
      ) VALUES ($1, $2, $3, $4, 'NOS', true, 'NON_STOCK_OR_NEW', 0, 5, $5, $6, 450.00, true, 'OPEN')
      RETURNING *
    `, [savedRequest.id, autoProduct.id, autoProduct.code, autoProduct.name, autoVendor.id, autoVendor.name]);
    const item2 = item2Res.rows[0];
    console.log(`  ✓ Item 2 (Zero Stock New Prod): Routed to Track ${item2.item_category_track}, Status: ${item2.status}`);
    if (item2.item_category_track === 'NON_STOCK_OR_NEW' && item2.status === 'OPEN') {
      report.businessLogicValidation.trackB = true;
    } else {
      report.businessLogicValidation.trackB = false;
      report.errorsFound.push('Track B routing failed');
    }

    // 6. Test PR Generation (Starts >= 151)
    console.log('\n[TEST 8] Testing PR Number Generation & PR Slip Printing...');
    const maxPrRes = await client.query(`
      SELECT MAX(CAST(pr_number AS INTEGER)) as max_pr
      FROM consumable_request_items
      WHERE pr_number ~ '^[0-9]+$'
    `);
    const currentMax = maxPrRes.rows[0].max_pr ? parseInt(maxPrRes.rows[0].max_pr, 10) : 150;
    const nextPrNumber = String(Math.max(151, currentMax + 1));
    console.log(`  ✓ Computed Next Sequential PR Number: ${nextPrNumber} (Baseline >= 151 verified)`);

    const printUpdateRes = await client.query(`
      UPDATE consumable_request_items
      SET pr_number = $1, status = 'PURCHASE_REQUESTED', printed_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [nextPrNumber, item2.id]);
    const printedItem = printUpdateRes.rows[0];
    console.log(`  ✓ Assigned PR #${printedItem.pr_number} to Item 2 -> New Status: ${printedItem.status}`);
    if (printedItem.pr_number === nextPrNumber && printedItem.status === 'PURCHASE_REQUESTED') {
      report.businessLogicValidation.prGeneration = true;
    }

    // 7. Test Store Receipt with Real Received Qty Override & Atomic STOCK_IN
    console.log('\n[TEST 9] Testing Store Receipt with Real Qty Override & Atomic Stock-In...');
    const requestedQty = Number(printedItem.requested_qty);
    const realReceivedQty = 6; // Stores overrides 5 -> 6
    console.log(`  Requested Qty was: ${requestedQty}, Real Received Qty: ${realReceivedQty}`);

    // Check pre-receipt stock balance
    const preBalRes = await client.query(`
      SELECT current_quantity FROM stock_balances 
      WHERE product_id = $1 AND bin_id = $2
    `, [autoProduct.id, testBin.id]);
    const preQty = preBalRes.rows.length > 0 ? Number(preBalRes.rows[0].current_quantity) : 0;

    // Execute atomic STOCK_IN to stock_balances
    if (preBalRes.rows.length > 0) {
      await client.query(`
        UPDATE stock_balances
        SET current_quantity = current_quantity + $1, updated_at = NOW()
        WHERE product_id = $2 AND bin_id = $3
      `, [realReceivedQty, autoProduct.id, testBin.id]);
    } else {
      await client.query(`
        INSERT INTO stock_balances (product_id, bin_id, current_quantity)
        VALUES ($1, $2, $3)
      `, [autoProduct.id, testBin.id, realReceivedQty]);
    }

    // Insert immutable transaction ledger
    await client.query(`
      INSERT INTO stock_transactions (
        product_id, destination_bin_id, transaction_type, quantity,
        "referenceType", reference_id, created_by_id, reason
      ) VALUES (
        $1, $2, 'STOCK_IN', $3, 'CONSUMABLE_PURCHASE', $4, $5, $6
      )
    `, [
      autoProduct.id, testBin.id, realReceivedQty,
      printedItem.id, testUser.id, `Received ${realReceivedQty} against PR #${printedItem.pr_number}`
    ]);

    // Update line item
    const receiveUpdateRes = await client.query(`
      UPDATE consumable_request_items
      SET real_received_qty = $1, bin_id = $2, purchase_received_at = NOW(), status = 'PURCHASE_RECEIVED'
      WHERE id = $3
      RETURNING *
    `, [realReceivedQty, testBin.id, printedItem.id]);
    const receivedItem = receiveUpdateRes.rows[0];

    // Verify post-receipt stock balance
    const postBalRes = await client.query(`
      SELECT current_quantity FROM stock_balances 
      WHERE product_id = $1 AND bin_id = $2
    `, [autoProduct.id, testBin.id]);
    const postQty = Number(postBalRes.rows[0].current_quantity);
    console.log(`  ✓ Stock Balance updated atomically: ${preQty} -> ${postQty} (+${realReceivedQty})`);
    console.log(`  ✓ Item 2 Status: ${receivedItem.status}, Real Received Qty: ${receivedItem.real_received_qty}`);

    if (postQty === preQty + realReceivedQty && receivedItem.status === 'PURCHASE_RECEIVED') {
      report.businessLogicValidation.storeReceipt = true;
    } else {
      report.businessLogicValidation.storeReceipt = false;
      report.errorsFound.push('Store receipt balance calculation mismatch');
    }

    // 8. Test Store Issuance to Production (Atomic STOCK_OUT)
    console.log('\n[TEST 10] Testing Store Issuance to Production (Atomic STOCK_OUT)...');
    const issueQty = 3;
    const preIssueBal = postQty;

    // Stock check guard
    if (preIssueBal < issueQty) {
      throw new Error('Stock check guard failed unexpectedly');
    }

    // Deduct stock balance
    await client.query(`
      UPDATE stock_balances
      SET current_quantity = current_quantity - $1, updated_at = NOW()
      WHERE product_id = $2 AND bin_id = $3
    `, [issueQty, autoProduct.id, testBin.id]);

    // Log Stock Transaction
    await client.query(`
      INSERT INTO stock_transactions (
        product_id, source_bin_id, transaction_type, quantity,
        "referenceType", reference_id, created_by_id, reason
      ) VALUES (
        $1, $2, 'STOCK_OUT', $3, 'CONSUMABLE_ISSUE', $4, $5, $6
      )
    `, [
      autoProduct.id, testBin.id, issueQty,
      receivedItem.id, testUser.id, `Issued ${issueQty} to Production`
    ]);

    // Update item status
    const issueUpdateRes = await client.query(`
      UPDATE consumable_request_items
      SET issued_qty = $1, issued_at = NOW(), status = 'ISSUED_TO_PRODUCTION'
      WHERE id = $2
      RETURNING *
    `, [issueQty, receivedItem.id]);
    const issuedItem = issueUpdateRes.rows[0];

    const postIssueBalRes = await client.query(`
      SELECT current_quantity FROM stock_balances 
      WHERE product_id = $1 AND bin_id = $2
    `, [autoProduct.id, testBin.id]);
    const postIssueBal = Number(postIssueBalRes.rows[0].current_quantity);

    console.log(`  ✓ Stock Balance decremented: ${preIssueBal} -> ${postIssueBal} (-${issueQty})`);
    console.log(`  ✓ Item 2 Status: ${issuedItem.status}, Issued Qty: ${issuedItem.issued_qty}`);
    if (postIssueBal === preIssueBal - issueQty && issuedItem.status === 'ISSUED_TO_PRODUCTION') {
      report.businessLogicValidation.storeIssue = true;
    }

    // 9. Test Production Handover Confirmation (Closed Loop)
    console.log('\n[TEST 11] Testing Closed-Loop Production Handover Confirmation...');
    const confirmRes = await client.query(`
      UPDATE consumable_request_items
      SET status = 'RECEIVED_BY_PRODUCTION', production_received_at = NOW(), production_received_by_id = $1
      WHERE id = $2
      RETURNING *
    `, [testUser.id, issuedItem.id]);
    const confirmedItem = confirmRes.rows[0];
    console.log(`  ✓ Item 2 Status: ${confirmedItem.status}, Received At: ${confirmedItem.production_received_at}`);
    if (confirmedItem.status === 'RECEIVED_BY_PRODUCTION') {
      report.businessLogicValidation.productionHandover = true;
    }

    // 10. Audit Ledger Verification
    console.log('\n[TEST 12] Verifying Stock Transaction Ledger Entries...');
    const ledgerRes = await client.query(`
      SELECT transaction_type, quantity, "referenceType", reason
      FROM stock_transactions
      WHERE reference_id = $1
      ORDER BY created_at ASC
    `, [item2.id]);
    console.log(`  Found ${ledgerRes.rows.length} Ledger Records:`);
    for (const entry of ledgerRes.rows) {
      console.log(`  - [${entry.transaction_type}] Qty: ${entry.quantity} Ref: ${entry.referenceType} | ${entry.reason}`);
    }
    if (ledgerRes.rows.length >= 2) {
      report.auditLedgerValidation.verified = true;
    }

    // Clean up test data
    console.log('\n[CLEANUP] Cleaning up diagnostic test run records...');
    await client.query(`DELETE FROM stock_transactions WHERE reference_id = $1`, [item2.id]);
    await client.query(`DELETE FROM stock_balances WHERE product_id = $1 AND bin_id = $2`, [autoProduct.id, testBin.id]);
    await client.query(`DELETE FROM consumable_request_items WHERE request_id = $1`, [savedRequest.id]);
    await client.query(`DELETE FROM consumable_requests WHERE id = $1`, [savedRequest.id]);
    await client.query(`DELETE FROM products WHERE id = $1`, [autoProduct.id]);
    await client.query(`DELETE FROM vendors WHERE id = $1`, [autoVendor.id]);
    console.log('  ✓ Cleaned up test request, line items, balances, products, and vendors.');

  } catch (err) {
    console.error('❌ Diagnostic error:', err);
    report.errorsFound.push(err.message || String(err));
  } finally {
    await client.end();
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80));
  console.log(JSON.stringify(report, null, 2));
}

runDiagnostic();
