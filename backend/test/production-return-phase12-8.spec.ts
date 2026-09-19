import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let prodToken = '';
let storesToken = '';
let scId = '';
let rmItem1 = '';

let productId = '';
let binId = '';
let materialIssueId = '';

let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const PROD_ID = '77777777-7777-7777-7777-777777777777';
const STORES_ID = '88888888-8888-8888-8888-888888888888';

let returnId = '';

describe('Phase 12.8 - Production Return & Stores Acknowledgement', () => {
  beforeAll(async () => {
    pgClient = new Client('postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db');
    await pgClient.connect();

    const adminRoleRes = await pgClient.query(`SELECT id FROM roles LIMIT 1`);
    const adminRoleId = adminRoleRes.rows[0]?.id;

    const uRes = await pgClient.query(`SELECT id FROM users LIMIT 1`);
    const EXISTING_USER_ID = uRes.rows[0]?.id;

    adminToken = jwt.sign({ sub: EXISTING_USER_ID, role: 'ADMIN', roles: ['ADMIN'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');
    prodToken = jwt.sign({ sub: EXISTING_USER_ID, role: 'PRODUCTION', roles: ['PRODUCTION'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');
    storesToken = jwt.sign({ sub: EXISTING_USER_ID, role: 'STORES', roles: ['STORES'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `RET-PO-${Date.now()}`, customerId: (await (await fetch(`${BASE_URL}/customers`, { method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ret Customer', code: `RET-${Date.now()}`, isActive: true }) })).json()).id })
    });
    const poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-RET-${Date.now()}`, productName: 'Widget', targetQuantity: 10 })
    });
    scId = (await scRes.json()).id;

    const rRes = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId })
    });
    const rmId = (await rRes.json()).id;

    const itemRes = await fetch(`${BASE_URL}/rm/${rmId}/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Aluminium', grade: '6061', size: '10x10', quantity: 50 })
    });
    rmItem1 = (await itemRes.json()).id;

    await fetch(`${BASE_URL}/rm/${rmId}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Submit' })
    });

    const fam = await pgClient.query(`SELECT id FROM product_families LIMIT 1`);
    const p1 = await pgClient.query(`INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Return ' || gen_random_uuid()::text, '${fam.rows[0].id}', 0) RETURNING id`);
    productId = p1.rows[0].id;
    const b = await pgClient.query(`SELECT id FROM bins LIMIT 1`);
    binId = b.rows[0].id;

    await pgClient.query(`INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 100)`);

    await fetch(`${BASE_URL}/rm/${rmId}/review`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemMappings: [{ rmItemId: rmItem1, productId }] })
    });

    const issueRes = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, binId, quantityIssued: 40 }] })
    });
    materialIssueId = (await issueRes.json()).id;

    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialIssueId, items: [{ rmItemId: rmItem1, quantityReceived: 40 }] })
    });

    await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, rmItemId: rmItem1, quantityConsumed: 10 })
    });
    // 40 issued -> 40 received -> 10 consumed -> 30 unaccounted.
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('RETURN_01: Should safely reject negative return', async () => {
    const res = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, quantityReturned: -5 }] })
    });
    expect(res.status).toBe(400);
  });

  it('RETURN_02: Should successfully create pending return WITHOUT stock mutation', async () => {
    const stockBefore = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txBefore = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}' AND destination_bin_id = '${binId}'`);

    const res = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, quantityReturned: 15 }] })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('PENDING_STORE_ACK');
    returnId = data.id;

    const stockAfter = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txAfter = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}' AND destination_bin_id = '${binId}'`);

    expect(Number(stockAfter.rows[0].current_quantity)).toBe(Number(stockBefore.rows[0].current_quantity));
    expect(Number(txAfter.rows[0].c)).toBe(Number(txBefore.rows[0].c));
  });

  it('RETURN_03: Should reject over-return (preventing cumulative over-return)', async () => {
    // We already received 40, consumed 10, returned 15. Remaining = 15.
    // If we try to return 16, it should fail.
    const res = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, quantityReturned: 16 }] })
    });
    expect(res.status).toBe(400);
  });

  it('RETURN_04: Should reflect accurate accounting with pending return', async () => {
    const res = await fetch(`${BASE_URL}/production/accounting/${scId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    const itemAcc = data.items.find((i: any) => i.rmItemId === rmItem1);
    // 40 received, 10 consumed. Pending returns might NOT be counted as 'returned' 
    // depending on the physical location rules. But let's check!
    expect(Number(itemAcc.received)).toBe(40);
    expect(Number(itemAcc.consumed)).toBe(10);
  });

  it('RETURN_05: Should allow Stores to ACKNOWLEDGE the return and ATOMICALLY increase stock', async () => {
    const stockBefore = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txBefore = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}' AND destination_bin_id = '${binId}'`);

    const res = await fetch(`${BASE_URL}/production/return/${returnId}/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationBinId: binId })
    });
    expect(res.status).toBe(201);

    const stockAfter = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txAfter = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}' AND destination_bin_id = '${binId}'`);
    
    // It should increase stock by exactly 15
    expect(Number(stockAfter.rows[0].current_quantity)).toBe(Number(stockBefore.rows[0].current_quantity) + 15);
    // It should insert exactly 1 transaction
    expect(Number(txAfter.rows[0].c)).toBe(Number(txBefore.rows[0].c) + 1);

    const txTypeRes = await pgClient.query(`SELECT transaction_type, quantity, reference_id FROM stock_transactions WHERE "referenceType" = 'MATERIAL_RETURN' AND reference_id = '${returnId}'`);
    expect(txTypeRes.rows[0].transaction_type).toBe('RETURN');
    expect(Number(txTypeRes.rows[0].quantity)).toBe(15);
  });

  it('RETURN_06: Should PREVENT duplicate acknowledgement safely', async () => {
    const res = await fetch(`${BASE_URL}/production/return/${returnId}/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationBinId: binId })
    });
    // Should be rejected because it's already acknowledged
    expect(res.status).toBe(400);
  });

  it('RETURN_07: Concurrency - Should enforce total returned limit under concurrent load', async () => {
    // 40 received, 10 consumed, 15 returned. Remaining = 15.
    // Try to return 10 concurrently twice.
    const req1 = fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, quantityReturned: 10 }] })
    });
    
    await new Promise(r => setTimeout(r, 50));

    const req2 = fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, quantityReturned: 10 }] })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);
  });
});
