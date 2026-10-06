require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres' });
  await client.connect();

  console.log("=== 3: TEST WITH EVIDENCE ===");

  const userRes = await client.query("SELECT id, roles FROM users LIMIT 1");
  const userId = userRes.rows[0].id;
  const userRole = userRes.rows[0].roles[0] || 'ADMIN';

  const vendorRes = await client.query(`SELECT id FROM vendors LIMIT 1`);
  const vendorId = vendorRes.rows[0].id;
  
  const processRes = await client.query(`SELECT id FROM processes LIMIT 2`);
  const p1 = processRes.rows[0].id;
  const p2 = processRes.rows[1].id;

  const pRes = await client.query(`SELECT p.id as pid, b.id as bid, sb.current_quantity, p.name FROM stock_balances sb JOIN products p ON p.id=sb.product_id JOIN bins b ON b.id=sb.bin_id WHERE sb.current_quantity > 10 LIMIT 4`);
  const items = pRes.rows;

  console.log("Initial stock balances recorded:");
  console.table(items);

  const po1Id = '11111111-1111-1111-1111-111111111111';
  const po2Id = '22222222-2222-2222-2222-222222222222';
  const sc1Id = '33333333-3333-3333-3333-333333333333';
  const sc2Id = '44444444-4444-4444-4444-444444444444';

  await client.query(`INSERT INTO purchase_orders (id, po_number, created_by_id) VALUES ($1, 'PO-AUTOTEST-1', $2), ($3, 'PO-AUTOTEST-2', $2) ON CONFLICT DO NOTHING`, [po1Id, userId, po2Id]);
  await client.query(`INSERT INTO sales_order_components (id, purchase_order_id, sc_number, created_by_id) VALUES ($1, $2, 'SC-AUTOTEST-1', $3), ($4, $5, 'SC-AUTOTEST-2', $3) ON CONFLICT DO NOTHING`, [sc1Id, po1Id, userId, sc2Id, po2Id]);

  // Create DC Type 1
  const payload = {
    challanType: 'DELIVERY_CHALLAN_TYPE_1',
    vendorId,
    dispatchDate: new Date().toISOString(),
    expectedReturnDate: new Date(Date.now() + 86400000).toISOString(),
    notes: 'AUTOTEST-F7a',
    groups: [
      {
        scId: sc1Id, processId: p1,
        items: [
          { productId: items[0].pid, binId: items[0].bid, quantity: 2, batchNumber: 'B1', description: 'Item 1' },
          { productId: items[1].pid, binId: items[1].bid, quantity: 2, batchNumber: 'B2', description: 'Item 2' }
        ]
      },
      {
        scId: sc2Id, processId: p2,
        items: [
          { productId: items[2].pid, binId: items[2].bid, quantity: 3, batchNumber: 'B3', description: 'Item 3' },
          { productId: items[3].pid, binId: items[3].bid, quantity: 3, batchNumber: 'B4', description: 'Item 4' }
        ]
      }
    ]
  };

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: userId, role: userRole }, process.env.JWT_SECRET || 'supersecret');
  
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  const res = await fetch('http://localhost:3000/api/delivery-challans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const dc = await res.json();
  console.log("Created DC:", dc.id);

  // Print raw DB rows
  const dbDc = await client.query("SELECT id, challan_type, sc_id, process_id, status FROM delivery_challans WHERE id = $1", [dc.id]);
  console.log("Header DB row:");
  console.table(dbDc.rows);

  const dbItems = await client.query("SELECT id, product_id, sc_id, process_id, batch_number, description, quantity_dispatched, quantity_returned FROM delivery_challan_items WHERE challan_id = $1", [dc.id]);
  console.log("Item DB rows:");
  console.table(dbItems.rows);

  const dbTx = await client.query("SELECT transaction_type, product_id, quantity FROM stock_transactions WHERE reference_type = 'DELIVERY_CHALLAN_TYPE_1' AND remarks LIKE '%AUTOTEST%'");
  console.log("Stock Transactions:");
  console.table(dbTx.rows);

  // SC Traceability
  const trSc1 = await fetch(`http://localhost:3000/api/traceability/sc/${sc1Id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  const tr1 = await trSc1.json();
  console.log("SC Traceability DC Lines for SC-1:");
  console.table(tr1.timeline?.filter(t => t.eventType === 'DELIVERY_CHALLAN_CREATED'));

  // Return part
  console.log("Returning part (1 qty of first item)...");
  await fetch(`http://localhost:3000/api/delivery-challans/${dc.id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      items: [
        { id: dbItems.rows[0].id, quantityToReturn: 1, remarks: 'Return 1' }
      ]
    })
  });

  const retCheck = await client.query("SELECT id, status FROM delivery_challans WHERE id = $1", [dc.id]);
  console.log("Status after part return:", retCheck.rows[0].status);
  
  // Close the challan with outstanding
  console.log("Closing challan with outstanding quantity...");
  await fetch(`http://localhost:3000/api/delivery-challans/${dc.id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  
  const closeCheck = await client.query("SELECT id, status FROM delivery_challans WHERE id = $1", [dc.id]);
  console.log("Status after close:", closeCheck.rows[0].status);

  const finalTx = await client.query("SELECT transaction_type, product_id, quantity FROM stock_transactions WHERE reference_type = 'DELIVERY_CHALLAN_RETURN' AND reference_id = $1", [dc.id]);
  console.log("Return transactions generated:");
  console.table(finalTx.rows);

  // Printable
  const printRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc.id}/printable`, { headers: { 'Authorization': `Bearer ${token}` } });
  const printDc = await printRes.json();
  console.log("Printable DC Groups:");
  console.log(JSON.stringify(printDc.groups, null, 2));

  // CLEANUP
  console.log("Cleaning up in one transaction...");
  await client.query('BEGIN');
  await client.query("DELETE FROM stock_transactions WHERE reference_type IN ('DELIVERY_CHALLAN_TYPE_1', 'DELIVERY_CHALLAN_RETURN') AND reference_id = $1", [dc.id]);
  await client.query("DELETE FROM delivery_challan_items WHERE challan_id = $1", [dc.id]);
  await client.query("DELETE FROM delivery_challans WHERE id = $1", [dc.id]);
  await client.query("DELETE FROM sales_order_components WHERE id IN ($1, $2)", [sc1Id, sc2Id]);
  await client.query("DELETE FROM purchase_orders WHERE id IN ($1, $2)", [po1Id, po2Id]);
  
  for (const item of items) {
    await client.query("UPDATE stock_balances SET current_quantity = $1 WHERE product_id = $2 AND bin_id = $3", [item.current_quantity, item.pid, item.bid]);
  }
  
  // And also delete the old AUTOTEST DCs! 
  await client.query("DELETE FROM stock_transactions WHERE reference_type = 'DELIVERY_CHALLAN_TYPE_1' AND remarks LIKE '%AUTOTEST%'");
  await client.query("DELETE FROM delivery_challan_items WHERE challan_id IN (SELECT id FROM delivery_challans WHERE notes LIKE '%AUTOTEST%')");
  await client.query("DELETE FROM delivery_challans WHERE notes LIKE '%AUTOTEST%'");
  
  await client.query('COMMIT');
  console.log("Cleanup done. Stock balances restored and AUTOTEST purged.");

  await client.end();
}
run().catch(console.error);
