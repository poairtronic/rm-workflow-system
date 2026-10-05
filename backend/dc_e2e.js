import pg from 'pg';
import fetch from 'node-fetch';
import 'dotenv/config';

async function run() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("=== GET TOKENS ===");
  let r = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: 'stores@airtronic.com', password: 'Password@123'})});
  const storesToken = (await r.json()).accessToken;

  console.log("\n=== 1a: DC TYPE 2 Setup ===");
  // We need stock >= 5
  const stockRes = await client.query(`
    SELECT sb.bin_id, sb.product_id, sb.quantity_on_hand
    FROM stock_balances sb
    WHERE sb.quantity_on_hand >= 5
    LIMIT 1
  `);
  if (stockRes.rows.length === 0) {
    console.log("No stock available. Mocking a row for testing.");
    // We will just create a product and bin and give it stock
    await client.query(`
      INSERT INTO products (id, code, name, category, created_at, updated_at) 
      VALUES ('p-1234-5678-9012-345678901234', 'TEST-PROD', 'Test', 'RM', NOW(), NOW()) ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO bins (id, code, created_at, updated_at) 
      VALUES ('b-1234-5678-9012-345678901234', 'TEST-BIN', NOW(), NOW()) ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO stock_balances (id, product_id, bin_id, quantity_on_hand, created_at, updated_at)
      VALUES (gen_random_uuid(), 'p-1234-5678-9012-345678901234', 'b-1234-5678-9012-345678901234', 10, NOW(), NOW())
    `);
  }
  
  const sb = stockRes.rows.length > 0 ? stockRes.rows[0] : { product_id: 'p-1234-5678-9012-345678901234', bin_id: 'b-1234-5678-9012-345678901234', quantity_on_hand: 10 };
  console.log(`Product ID: ${sb.product_id}, Bin ID: ${sb.bin_id}, Stock Before: ${sb.quantity_on_hand}`);

  console.log("\n=== 1b: POST /api/delivery-challans/type-2 ===");
  // Need a vendor
  const vendorRes = await client.query(`SELECT id FROM vendors LIMIT 1`);
  const vendorId = vendorRes.rows[0].id;
  
  const type2Payload = {
    type: 'TYPE_2',
    scCode: null,
    processId: null,
    vendorId: vendorId, // We use vendorId internally in the API layer mapping
    destinationEntity: 'R&D Department (Internal)',
    purpose: 'Testing DC Type 2 flow',
    items: [{
      rmItemId: sb.product_id, // frontend maps it to productId
      binId: sb.bin_id,
      quantityToDispatch: 2
    }]
  };
  
  // Actually, we must use the EXACT frontend payload, which goes to `/api/delivery-challans`. No wait, we fixed `api.ts` to hit `/type-2` directly!
  // Wait, I fixed `api.ts` to transform the payload. If I want to test the BACKEND, I should send the transformed payload to `/type-2` directly!
  // Or I can send the frontend payload if I want to mimic the UI? No, the UI uses `deliveryChallanApi.create`, which transforms it. The network request goes to the backend.
  // The backend expects: type: GENERAL_INVENTORY_OUTWARD, vendorId, dispatchDate, notes, items: [productId, binId, quantityDispatched].
  
  const backendType2Payload = {
    type: 'GENERAL_INVENTORY_OUTWARD',
    vendorId: vendorId,
    dispatchDate: new Date().toISOString(),
    notes: 'Testing DC Type 2 flow',
    items: [{
      productId: sb.product_id,
      binId: sb.bin_id,
      quantityDispatched: 2
    }]
  };
  
  console.log("Payload:", JSON.stringify(backendType2Payload, null, 2));
  
  const dc2Res = await fetch('http://localhost:3000/api/delivery-challans/type-2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesToken}` },
    body: JSON.stringify(backendType2Payload)
  });
  
  const dc2Data = await dc2Res.json();
  console.log("Response:", dc2Res.status, dc2Data);
  const dc2Id = dc2Data.id;

  console.log("\n=== 1c: Verify Stock and StockTransaction ===");
  const stockAfter = await client.query(`SELECT quantity_on_hand FROM stock_balances WHERE product_id=$1 AND bin_id=$2`, [sb.product_id, sb.bin_id]);
  console.log("Stock After:", stockAfter.rows[0].quantity_on_hand);
  
  const tx = await client.query(`SELECT * FROM stock_transactions WHERE reference_id=$1 ORDER BY created_at DESC LIMIT 1`, [dc2Id]);
  console.log("Transaction created:", tx.rows[0]);

  console.log("\n=== 1d: GET /api/delivery-challans/:id/printable ===");
  const printRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc2Id}/printable`, {
    headers: { 'Authorization': `Bearer ${storesToken}` }
  });
  console.log("Printable status:", printRes.status, await printRes.text());

  console.log("\n=== 1e: Return & Close ===");
  const returnPayload = {
    actualReceiptDate: new Date().toISOString(),
    items: [{
      itemId: dc2Data.items[0].id,
      quantityToReturn: 1
    }]
  };
  const returnRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc2Id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesToken}` },
    body: JSON.stringify(returnPayload)
  });
  console.log("Return partial:", returnRes.status, await returnRes.json());
  
  const closeRes = await fetch(`http://localhost:3000/api/delivery-challans/${dc2Id}/close`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesToken}` },
    body: JSON.stringify({ closureNotes: 'Closed manually' })
  });
  console.log("Close DC:", closeRes.status, await closeRes.json());
  
  await client.end();
}
run().catch(console.error);
