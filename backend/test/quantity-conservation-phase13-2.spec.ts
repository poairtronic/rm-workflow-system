import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let prodToken = '';
let scId1 = '';
let scId2 = '';
let rmItem1_sc1 = '';
let rmItem2_sc1 = '';
let rmItem1_sc2 = '';

let productId = '';
let binId = '';
let materialIssueId_sc1 = '';
let materialIssueId_sc2 = '';

let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const PROD_ID = '77777777-7777-7777-7777-777777777777';

describe('Phase 13.2 - Quantity Conservation Hardening', () => {
  beforeAll(async () => {
    pgClient = new Client(
      'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    const adminRoleRes = await pgClient.query(`SELECT id FROM roles LIMIT 1`);
    const adminRoleId = adminRoleRes.rows[0]?.id;

    adminToken = jwt.sign(
      { sub: ADMIN_ID, role: 'ADMIN', roles: ['ADMIN'] },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );
    prodToken = jwt.sign(
      { sub: PROD_ID, role: 'PRODUCTION', roles: ['PRODUCTION'] },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    // Setup Customer & PO
    const customerRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Quantity Customer', code: `QC-${Date.now()}`, isActive: true }),
    });
    const customerId = (await customerRes.json()).id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `QPO-${Date.now()}`, customerId }),
    });
    const poId = (await poRes.json()).id;

    // SC1
    const scRes1 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-Q1-${Date.now()}`, productName: 'Widget A', targetQuantity: 10 }),
    });
    scId1 = (await scRes1.json()).id;

    // SC2
    const scRes2 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-Q2-${Date.now()}`, productName: 'Widget B', targetQuantity: 10 }),
    });
    scId2 = (await scRes2.json()).id;

    // RM for SC1
    const rRes1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1 }),
    });
    const rmId1 = (await rRes1.json()).id;

    const itemRes1_1 = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Aluminium', grade: '6061', size: '10x10', quantity: 100 }),
    });
    rmItem1_sc1 = (await itemRes1_1.json()).id;

    const itemRes1_2 = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Steel', grade: '304', size: '5x5', quantity: 50 }),
    });
    rmItem2_sc1 = (await itemRes1_2.json()).id;

    await fetch(`${BASE_URL}/rm/${rmId1}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Submit' }),
    });

    // RM for SC2
    const rRes2 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId2 }),
    });
    const rmId2 = (await rRes2.json()).id;

    const itemRes2_1 = await fetch(`${BASE_URL}/rm/${rmId2}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Copper', grade: 'C110', size: '2x2', quantity: 80 }),
    });
    rmItem1_sc2 = (await itemRes2_1.json()).id;

    await fetch(`${BASE_URL}/rm/${rmId2}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Submit' }),
    });

    // Setup Inventory
    const fam = await pgClient.query(`SELECT id FROM product_families LIMIT 1`);
    const p1 = await pgClient.query(
      `INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Q ' || gen_random_uuid()::text, '${fam.rows[0].id}', 0) RETURNING id`,
    );
    productId = p1.rows[0].id;
    const b = await pgClient.query(`SELECT id FROM bins LIMIT 1`);
    binId = b.rows[0].id;

    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 500)`,
    );

    // Review SC1
    await fetch(`${BASE_URL}/rm/${rmId1}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemMappings: [{ rmItemId: rmItem1_sc1, productId }, { rmItemId: rmItem2_sc1, productId }] }),
    });

    // Review SC2
    await fetch(`${BASE_URL}/rm/${rmId2}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemMappings: [{ rmItemId: rmItem1_sc2, productId }] }),
    });

    // Issue SC1 (Full)
    const issueRes1 = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1_sc1, binId, quantityIssued: 100 }, { rmItemId: rmItem2_sc1, binId, quantityIssued: 50 }],
      }),
    });
    materialIssueId_sc1 = (await issueRes1.json()).id;

    // Issue SC2 (Full)
    const issueRes2 = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scId: scId2,
        items: [{ rmItemId: rmItem1_sc2, binId, quantityIssued: 80 }],
      }),
    });
    materialIssueId_sc2 = (await issueRes2.json()).id;
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('QUANTITY_01: Receipt concurrency lock should prevent over-receipt', async () => {
    // Attempt two simultaneous receipts of 60 for an item with 100 max capacity
    const req1 = fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialIssueId: materialIssueId_sc1,
        items: [{ rmItemId: rmItem1_sc1, quantityReceived: 60 }],
      }),
    });

    const req2 = fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialIssueId: materialIssueId_sc1,
        items: [{ rmItemId: rmItem1_sc1, quantityReceived: 60 }],
      }),
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();
    
    // One should succeed, one should fail (since 60+60 > 100)
    expect(statuses).toEqual([201, 400]);

    // Let's receive the rest
    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialIssueId: materialIssueId_sc1,
        items: [{ rmItemId: rmItem1_sc1, quantityReceived: 40 }],
      }),
    });
  });

  it('QUANTITY_02: Return and consume should not exceed available WIP', async () => {
    // SC1 Item1 has 100 received.
    // 1. Consume 40
    await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, rmItemId: rmItem1_sc1, quantityConsumed: 40 }),
    });

    // Available WIP is now 60.
    // 2. Return 50
    const returnRes = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, items: [{ rmItemId: rmItem1_sc1, quantityReturned: 50 }] }),
    });
    expect(returnRes.status).toBe(201);

    // Available WIP is now 10 (100 - 40 - 50).
    // 3. Try to consume 20. Should fail.
    const consumeRes = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, rmItemId: rmItem1_sc1, quantityConsumed: 20 }),
    });
    expect(consumeRes.status).toBe(400);

    // 4. Consume 10. Should succeed.
    const consumeRes2 = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, rmItemId: rmItem1_sc1, quantityConsumed: 10 }),
    });
    expect(consumeRes2.status).toBe(201);

    // Verify Accounting
    const accRes = await fetch(`${BASE_URL}/production/accounting/${scId1}`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    const acc = await accRes.json();
    const item1Acc = acc.items.find((i: any) => i.rmItemId === rmItem1_sc1);
    expect(Number(item1Acc.received)).toBe(100);
    expect(Number(item1Acc.consumed)).toBe(50);
    expect(Number(item1Acc.pendingReturned)).toBe(50);
    expect(Number(item1Acc.wip)).toBe(0);
    // Unaccounted is still 50 because return is pending
    expect(Number(item1Acc.unaccounted)).toBe(50);
  });

  it('QUANTITY_03: SC Isolation - Operations on SC1 do not affect SC2', async () => {
    // Receive 80 for SC2
    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialIssueId: materialIssueId_sc2,
        items: [{ rmItemId: rmItem1_sc2, quantityReceived: 80 }],
      }),
    });

    const consumeRes = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId2, rmItemId: rmItem1_sc2, quantityConsumed: 80 }),
    });
    expect(consumeRes.status).toBe(201);

    // Ensure SC1 remains unaffected
    const accRes = await fetch(`${BASE_URL}/production/accounting/${scId1}`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    const acc = await accRes.json();
    const item1Acc = acc.items.find((i: any) => i.rmItemId === rmItem1_sc1);
    expect(Number(item1Acc.wip)).toBe(0); // From previous test
  });
  
  it('QUANTITY_04: Multiple RM items accounting', async () => {
    // SC1 RM Item 2 has 50 issued. Let's receive 50.
    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialIssueId: materialIssueId_sc1,
        items: [{ rmItemId: rmItem2_sc1, quantityReceived: 50 }],
      }),
    });
    
    // Consume 30
    await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, rmItemId: rmItem2_sc1, quantityConsumed: 30 }),
    });
    
    // Try to consume 30 more on RM Item 2, but it should fail (only 20 left)
    const consumeRes = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, rmItemId: rmItem2_sc1, quantityConsumed: 30 }),
    });
    expect(consumeRes.status).toBe(400);
    
    const accRes = await fetch(`${BASE_URL}/production/accounting/${scId1}`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    const acc = await accRes.json();
    const item2Acc = acc.items.find((i: any) => i.rmItemId === rmItem2_sc1);
    expect(Number(item2Acc.received)).toBe(50);
    expect(Number(item2Acc.consumed)).toBe(30);
    expect(Number(item2Acc.wip)).toBe(20);
  });
});
