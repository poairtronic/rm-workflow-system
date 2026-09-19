import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let prodToken = '';
let scId = '';
let rmItem1 = '';

let productId = '';
let binId = '';
let materialIssueId = '';

let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const PROD_ID = '77777777-7777-7777-7777-777777777777';

describe('Phase 12.7 - Production Consumption', () => {
  beforeAll(async () => {
    pgClient = new Client('postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db');
    await pgClient.connect();

    const adminRoleRes = await pgClient.query(`SELECT id FROM roles LIMIT 1`);
    const adminRoleId = adminRoleRes.rows[0]?.id;

    const prodRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'PRODUCTION' LIMIT 1`);
    const prodRoleId = prodRoleRes.rows[0]?.id || adminRoleId;

    adminToken = jwt.sign({ sub: ADMIN_ID, role: 'ADMIN', roles: ['ADMIN'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');
    prodToken = jwt.sign({ sub: PROD_ID, role: 'PRODUCTION', roles: ['PRODUCTION'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `PRD-PO-${Date.now()}`, customerId: (await (await fetch(`${BASE_URL}/customers`, { method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Prod Customer', code: `PRD-${Date.now()}`, isActive: true }) })).json()).id })
    });
    const poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-PRD-${Date.now()}`, productName: 'Widget', targetQuantity: 10 })
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
    const p1 = await pgClient.query(`INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Consume ' || gen_random_uuid()::text, '${fam.rows[0].id}', 0) RETURNING id`);
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
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('CONSUME_01: Should safely reject negative consumption', async () => {
    const res = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, rmItemId: rmItem1, quantityConsumed: -5 })
    });
    expect(res.status).toBe(400);
  });

  it('CONSUME_02: Should successfully consume partial amount WITHOUT stock mutation', async () => {
    const stockBefore = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txBefore = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions`);

    const res = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, rmItemId: rmItem1, quantityConsumed: 15 })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(Number(data.consumedQuantity)).toBe(15);

    const stockAfter = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txAfter = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions`);

    expect(Number(stockAfter.rows[0].current_quantity)).toBe(Number(stockBefore.rows[0].current_quantity));
    expect(Number(txAfter.rows[0].c)).toBe(Number(txBefore.rows[0].c));
  });

  it('CONSUME_03: Should reject over-consumption', async () => {
    // 40 received, 15 consumed => 25 remaining
    const res = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, rmItemId: rmItem1, quantityConsumed: 26 })
    });
    expect(res.status).toBe(400);
  });

  it('CONSUME_04: Should reflect accurate accounting', async () => {
    const res = await fetch(`${BASE_URL}/production/accounting/${scId}`, {
      headers: { 'Authorization': `Bearer ${prodToken}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    const itemAcc = data.items.find((i: any) => i.rmItemId === rmItem1);
    expect(Number(itemAcc.received)).toBe(40);
    expect(Number(itemAcc.consumed)).toBe(15);
    expect(Number(itemAcc.unaccounted)).toBe(25);
  });

  it('CONSUME_05: Concurrency - Should enforce total consumed limit under concurrent load', async () => {
    // 25 remaining. Fire two concurrent requests for 20.
    const req1 = fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, rmItemId: rmItem1, quantityConsumed: 20 })
    });
    
    await new Promise(r => setTimeout(r, 50));

    const req2 = fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, rmItemId: rmItem1, quantityConsumed: 20 })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    
    // One should succeed (201) and one should fail (400)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);

    // Final accounting should be consumed = 35, unaccounted = 5
    const accRes = await fetch(`${BASE_URL}/production/accounting/${scId}`, { headers: { 'Authorization': `Bearer ${prodToken}` } });
    const accData = await accRes.json();
    const itemAcc = accData.items.find((i: any) => i.rmItemId === rmItem1);
    expect(Number(itemAcc.consumed)).toBe(35);
    expect(Number(itemAcc.unaccounted)).toBe(5);
  });
});
