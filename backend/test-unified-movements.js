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

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // Get a product and a bin
  const productRes = await pool.query('SELECT id FROM products LIMIT 1');
  const binRes = await pool.query('SELECT id FROM bins LIMIT 1');
  
  if (productRes.rows.length === 0 || binRes.rows.length === 0) {
    throw new Error('Missing products or bins to test with');
  }

  const productId = productRes.rows[0].id;
  const binId = binRes.rows[0].id;

  // 1. Manual Stock-In
  const stockInPayload = {
    productId,
    binId,
    quantity: 10,
    reason: 'TEST MANUAL IN',
    remarks: 'Testing unified movements',
    lotBatchNumber: 'LOT-MANUAL-01',
    cost: 100.50
  };
  await fetch('http://127.0.0.1:3000/api/inventory/stock-in', {
    method: 'POST',
    headers,
    body: JSON.stringify(stockInPayload)
  });

  // 2. GRN (Supplier Inward)
  const grnPayload = {
    productId,
    binId,
    quantity: 50,
    reason: 'TEST GRN IN',
    remarks: 'Testing unified movements via GRN',
    lotBatchNumber: 'LOT-GRN-01',
    cost: 105.00
  };
  await fetch('http://127.0.0.1:3000/api/inventory/grn', {
    method: 'POST',
    headers,
    body: JSON.stringify(grnPayload)
  });

  // 4. Fetch the Unified Ledger
  const ledgerRes = await fetch('http://127.0.0.1:3000/api/inventory/transactions?pageSize=3', {
    headers
  });
  const ledgerData = await ledgerRes.json();
  
  console.log('\n--- UNIFIED MOVEMENTS LEDGER (Latest 3) ---');
  console.log(JSON.stringify(ledgerData.data, null, 2));
  
  await pool.end();
}

runTest().catch(console.error);
