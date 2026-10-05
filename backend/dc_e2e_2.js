import pg from 'pg';
import fetch from 'node-fetch';
import 'dotenv/config';

async function run() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let r = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: 'stores@airtronic.com', password: 'Password@123'})});
  const storesToken = (await r.json()).accessToken;

  console.log("\n=== 2a: DC TYPE 1 Setup ===");
  // We need stock >= 5
  const stockRes = await client.query(`
    SELECT sb.bin_id, sb.product_id, sb.current_quantity
    FROM stock_balances sb
    WHERE sb.current_quantity >= 5
    LIMIT 1
  `);
  
  const sb = stockRes.rows[0];
  console.log(`Product ID: ${sb.product_id}, Bin ID: ${sb.bin_id}, Stock Before: ${sb.current_quantity}`);

  console.log("\n=== 2b: GET Dependencies for TYPE 1 ===");
  const scRes = await client.query(`SELECT id FROM sales_order_components LIMIT 1`);
  const scId = scRes.rows[0].id;
  
  const slaRes = await client.query(`SELECT vendor_id, process_id, sla_days FROM vendor_slas WHERE is_active=true LIMIT 1`);
  const processId = slaRes.rows[0].process_id;
  const vendorId = slaRes.rows[0].vendor_id;
  const slaDays = slaRes.rows[0].sla_days;

  // Calculate expected return date
  const expectedReturnDate = new Date();
  expectedReturnDate.setDate(expectedReturnDate.getDate() + slaDays);
  console.log(`Computed expectedReturnDate (+${slaDays} days):`, expectedReturnDate.toISOString());

  const type1Payload = {
    type: 'PRODUCTION_PROCESS_OUTWARD',
    vendorId: vendorId,
    scId: scId,
    processId: processId,
    dispatchDate: new Date().toISOString(),
    expectedReturnDate: expectedReturnDate.toISOString(),
    items: [{
      productId: sb.product_id,
      binId: sb.bin_id,
      quantityDispatched: 3
    }]
  };
  
  const dc1Res = await fetch('http://localhost:3000/api/delivery-challans/type-1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesToken}` },
    body: JSON.stringify(type1Payload)
  });
  
  const dc1Data = await dc1Res.json();
  console.log("Response DC1:", dc1Res.status, dc1Data);
  const dc1Id = dc1Data.id;

  if (dc1Res.status === 201) {
    const stockAfter = await client.query(`SELECT current_quantity FROM stock_balances WHERE product_id=$1 AND bin_id=$2`, [sb.product_id, sb.bin_id]);
    console.log("Stock After:", stockAfter.rows[0].current_quantity);
    
    const tx = await client.query(`SELECT * FROM stock_transactions WHERE reference_id=$1 ORDER BY created_at DESC LIMIT 1`, [dc1Id]);
    console.log("Transaction created:", tx.rows[0]);
  }

  await client.end();
}
run().catch(console.error);
