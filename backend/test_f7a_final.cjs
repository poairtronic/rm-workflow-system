require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("=== F7a FULL TEST WITH EVIDENCE ===");

  const userRes = await client.query("SELECT id FROM users LIMIT 1");
  const userId = userRes.rows[0].id;

  const vendorRes = await client.query(`SELECT id FROM vendors LIMIT 1`);
  const vendorId = vendorRes.rows[0].id;
  
  const processRes = await client.query(`SELECT id FROM production_processes LIMIT 2`);
  const p1 = processRes.rows[0].id;
  const p2 = processRes.rows[1].id;

  const scRes = await client.query(`SELECT id FROM sales_order_components LIMIT 2`);
  const sc1Id = scRes.rows[0].id;
  const sc2Id = scRes.rows[1].id;

  const pRes = await client.query(`
    SELECT p.id as pid, b.id as bid, sb.current_quantity, p.name 
    FROM stock_balances sb 
    JOIN products p ON p.id=sb.product_id 
    JOIN bins b ON b.id=sb.bin_id 
    WHERE sb.current_quantity > 10 
    LIMIT 4
  `);
  const items = pRes.rows;

  console.log("1) Initial stock balances:");
  console.table(items.map(i=>({name:i.name, qty:i.current_quantity})));

  // Create DC Type 1
  const payload = {
    type: 'PRODUCTION_PROCESS_OUTWARD',
    vendorId,
    dispatchDate: new Date().toISOString(),
    expectedReturnDate: new Date(Date.now() + 86400000).toISOString(),
    notes: 'AUTOTEST-F7a',
    items: [
      { productId: items[0].pid, binId: items[0].bid, quantityDispatched: 2, batchNumber: 'B1', description: 'Item 1', scId: sc1Id, processId: p1 },
      { productId: items[1].pid, binId: items[1].bid, quantityDispatched: 2, batchNumber: 'B2', description: 'Item 2', scId: sc1Id, processId: p1 },
      { productId: items[2].pid, binId: items[2].bid, quantityDispatched: 3, batchNumber: 'B3', description: 'Item 3', scId: sc2Id, processId: p2 },
      { productId: items[3].pid, binId: items[3].bid, quantityDispatched: 3, batchNumber: 'B4', description: 'Item 4', scId: sc2Id, processId: p2 }
    ]
  };

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: userId, roles: ['ADMIN'] }, process.env.JWT_SECRET || 'supersecret');
  
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  const res = await fetch('http://localhost:3000/api/delivery-challans/type-1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const dc = await res.json();
  if (!dc.id) {
    console.error("Create DC FAILED:", dc);
    await client.end();
    return;
  }
  console.log("2) Created DC ID:", dc.id);

  // Header row
  const dbDc = await client.query("SELECT id, type, sc_id, process_id, status FROM delivery_challans WHERE id = $1", [dc.id]);
  console.log("3) Header DB row (sc_id/process_id should be NULL - they live on items):");
  console.table(dbDc.rows);

  // Item rows
  const dbItems = await client.query(
    "SELECT id, product_id, sc_id, process_id, batch_number, description, quantity_dispatched, quantity_returned FROM delivery_challan_items WHERE challan_id = $1",
    [dc.id]
  );
  console.log("4) Item DB rows (sc_id + process_id per item):");
  console.table(dbItems.rows.map(r=>({
    product_id: r.product_id,
    sc_id: r.sc_id,
    process_id: r.process_id,
    batch: r.batch_number,
    desc: r.description,
    qty_out: r.quantity_dispatched,
    qty_ret: r.quantity_returned
  })));

  // Stock transactions
  const dbTx = await client.query(
    `SELECT transaction_type, product_id, quantity FROM stock_transactions WHERE "referenceType" = 'DELIVERY_CHALLAN_TYPE_1' AND reference_id = $1`,
    [dc.id]
  );
  console.log("5) Stock STOCK_OUT transactions (should be 4):");
  console.table(dbTx.rows);

  // Partial return (1 unit of first item)
  console.log("6) Partial return: 1 unit of item[0]...");
  const returnRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc.id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      actualReceiptDate: new Date().toISOString(),
      items: [{ itemId: dbItems.rows[0].id, quantityToReturn: 1 }]
    })
  });
  const returnBody = await returnRes.json();
  console.log("   Return HTTP status:", returnRes.status);
  if (returnRes.status >= 400) console.log("   Return error body:", returnBody);

  const afterRet = await client.query("SELECT status FROM delivery_challans WHERE id=$1", [dc.id]);
  console.log("   Status after partial return:", afterRet.rows[0].status);

  // Close with outstanding (force-close)
  console.log("7) Closing challan (outstanding qty remains)...");
  const closeRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc.id}/close`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const closeBody = await closeRes.json();
  console.log("   Close HTTP status:", closeRes.status);
  if (closeRes.status >= 400) console.log("   Close error:", closeBody);

  const afterClose = await client.query("SELECT status FROM delivery_challans WHERE id=$1", [dc.id]);
  console.log("   Status after close:", afterClose.rows[0].status);

  // Return transactions
  const retTx = await client.query(
    `SELECT transaction_type, product_id, quantity FROM stock_transactions WHERE "referenceType" = 'DELIVERY_CHALLAN_RETURN' AND reference_id = $1`,
    [dc.id]
  );
  console.log("8) STOCK_IN return transactions (expect 1 for 1 unit):");
  console.table(retTx.rows);

  // Printable
  const printRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc.id}/printable`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const printDc = await printRes.json();
  console.log("9) Printable DC - groups field:");
  console.log(JSON.stringify(printDc.groups, null, 2));

  // CLEANUP in one transaction
  console.log("10) Cleanup (restore balances, delete AUTOTEST records)...");
  await client.query('BEGIN');
  // Delete transactions
  await client.query(
    `DELETE FROM stock_transactions WHERE "referenceType" IN ('DELIVERY_CHALLAN_TYPE_1','DELIVERY_CHALLAN_RETURN') AND reference_id = $1`,
    [dc.id]
  );
  // Delete items then header
  await client.query("DELETE FROM delivery_challan_items WHERE challan_id = $1", [dc.id]);
  await client.query("DELETE FROM delivery_challans WHERE id = $1", [dc.id]);
  // Restore balances
  for (const item of items) {
    await client.query(
      "UPDATE stock_balances SET current_quantity = $1 WHERE product_id = $2 AND bin_id = $3",
      [item.current_quantity, item.pid, item.bid]
    );
  }
  // Purge any leftover AUTOTESTs from earlier runs
  await client.query(
    `DELETE FROM stock_transactions WHERE "referenceType" IN ('DELIVERY_CHALLAN_TYPE_1','DELIVERY_CHALLAN_RETURN') AND reference_id IN (SELECT id FROM delivery_challans WHERE notes LIKE '%AUTOTEST%')`
  );
  await client.query("DELETE FROM delivery_challan_items WHERE challan_id IN (SELECT id FROM delivery_challans WHERE notes LIKE '%AUTOTEST%')");
  await client.query("DELETE FROM delivery_challans WHERE notes LIKE '%AUTOTEST%'");
  await client.query('COMMIT');
  console.log("    Cleanup done. All AUTOTEST rows purged, balances restored.");

  await client.end();
}
run().catch(console.error);
