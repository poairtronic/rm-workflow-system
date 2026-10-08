import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

async function runTest() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = 'admin@airtronic.com';
  const jwt = await import('jsonwebtoken');
  const userRes = await pool.query("SELECT id FROM users WHERE email='admin@airtronic.com'");
  const userId = userRes.rows[0].id;
  const token = jwt.default.sign({ sub: userId, email: 'admin@airtronic.com', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Get a product and a bin
  const productRes = await pool.query('SELECT id FROM products LIMIT 1');
  const binRes = await pool.query('SELECT id FROM bins LIMIT 1');
  
  if (productRes.rows.length === 0 || binRes.rows.length === 0) {
    throw new Error('Missing products or bins to test with');
  }

  const productId = productRes.rows[0].id;
  const binId = binRes.rows[0].id;

  console.log('--- RAW REQUEST ---');
  const payload = {
    productId,
    binId,
    quantity: 15.5,
    reason: 'TEST LOT COST GAP',
    remarks: 'Auto-testing gap fulfillment',
    lotBatchNumber: 'BATCH-2026-X1',
    cost: 450.75
  };
  console.log(JSON.stringify(payload, null, 2));

  const stockInRes = await fetch('http://127.0.0.1:3000/api/inventory/stock-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  const stockInData = await stockInRes.json();
  console.log('\n--- RAW RESPONSE ---');
  console.log(JSON.stringify(stockInData, null, 2));

  console.log('\n--- RAW DB ROW ---');
  const txRes = await pool.query(`SELECT id, product_id, quantity, lot_batch_number, cost, transaction_type FROM stock_transactions WHERE id = $1`, [stockInData.transaction.id]);
  console.log(JSON.stringify(txRes.rows[0], null, 2));
  
  await pool.end();
}

runTest().catch(console.error);
