import { test, expect, beforeAll, describe, afterAll } from 'vitest';
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Phase 12.9 - Additional Material Request', () => {
  let pgClient: Client;
  let adminToken: string;
  let prodToken: string;
  let storesToken: string;
  let customerId: string;
  let poId: string;
  let scId1: string;
  let scId2: string;
  let rmItem1: string;
  let rmItem2: string;
  let productId: string;
  let binId: string;

  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // 1. Get Tokens
    const uRes = await pgClient.query(`SELECT id FROM users LIMIT 1`);
    const EXISTING_USER_ID = uRes.rows[0]?.id;
    const jwt = await import('jsonwebtoken');
    const secret =
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';

    adminToken = jwt.sign(
      { sub: EXISTING_USER_ID, role: 'ADMIN', roles: ['ADMIN'] },
      secret,
    );
    prodToken = jwt.sign(
      { sub: EXISTING_USER_ID, role: 'PRODUCTION', roles: ['PRODUCTION'] },
      secret,
    );
    storesToken = jwt.sign(
      { sub: EXISTING_USER_ID, role: 'STORES', roles: ['STORES'] },
      secret,
    );

    // 2. Setup master data and flow
    const timestamp = Date.now();
    const catRes = await pgClient.query(
      `INSERT INTO product_categories (name, is_active) VALUES ('ADDL_CAT_${timestamp}', true) RETURNING id`,
    );
    const famRes = await pgClient.query(
      `INSERT INTO product_families (name, category_id, is_active) VALUES ('ADDL_FAM_${timestamp}', '${catRes.rows[0].id}', true) RETURNING id`,
    );
    const prodResDb = await pgClient.query(
      `INSERT INTO products (name, family_id, is_active) VALUES ('ADDL_PROD_${timestamp}', '${famRes.rows[0].id}', true) RETURNING id`,
    );
    productId = prodResDb.rows[0].id;

    const whRes = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active) VALUES ('ADDL_WH_${timestamp}', 'AWH_${timestamp}', true) RETURNING id`,
    );
    const locRes = await pgClient.query(
      `INSERT INTO warehouse_locations (name, code, warehouse_id, is_active) VALUES ('ADDL_LOC_${timestamp}', 'ALOC_${timestamp}', '${whRes.rows[0].id}', true) RETURNING id`,
    );
    const rackRes = await pgClient.query(
      `INSERT INTO racks (name, code, location_id, is_active) VALUES ('ADDL_RACK_${timestamp}', 'ARACK_${timestamp}', '${locRes.rows[0].id}', true) RETURNING id`,
    );
    const binResDb = await pgClient.query(
      `INSERT INTO bins (name, code, rack_id, is_active) VALUES ('ADDL_BIN_${timestamp}', 'ABIN_${timestamp}', '${rackRes.rows[0].id}', true) RETURNING id`,
    );
    binId = binResDb.rows[0].id;

    // Insert Stock (Opening)
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 500)`,
    );
    await pgClient.query(
      `INSERT INTO stock_transactions (product_id, transaction_type, quantity, destination_bin_id, "referenceType", reference_id, created_by_id) VALUES ('${productId}', 'STOCK_IN', 500, '${binId}', 'SYSTEM', 'OPENING', '${EXISTING_USER_ID}')`,
    );

    // Create Customer, PO, SC1, SC2
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: `CUST-ADDL-${Date.now()}`,
        name: 'Addl Customer',
        isActive: true,
      }),
    });
    const cust = await custRes.json();
    if (!custRes.ok) console.error('Cust Failed:', cust);
    customerId = cust.id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poNumber: `PO-ADDL-${Date.now()}`,
        customerId,
        referenceDate: '2026-09-01',
      }),
    });
    const po = await poRes.json();
    if (!poRes.ok) console.error('PO Failed:', po);
    poId = po.id;

    const scRes1 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId,
        scNumber: `SC-ADDL-${Date.now()}-1`,
        productName: 'Widget 1',
        targetQuantity: 10,
      }),
    });
    const sc1 = await scRes1.json();
    if (!scRes1.ok) console.error('SC1 Failed:', sc1);
    scId1 = sc1.id;

    const scRes2 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId,
        scNumber: `SC-ADDL-${Date.now()}-2`,
        productName: 'Widget 2',
        targetQuantity: 20,
      }),
    });
    const sc2 = await scRes2.json();
    if (!scRes2.ok) console.error('SC2 Failed:', sc2);
    scId2 = sc2.id;

    // Create RM Requirement for SC1
    const rmReqRes1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: scId1 }),
    });
    const rmReq1 = await rmReqRes1.json();
    if (!rmReqRes1.ok) console.error('rmReq1 Failed:', rmReq1);

    // Add Item to SC1
    const rmItemRes1 = await fetch(`${BASE_URL}/rm/${rmReq1.id}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Test Mat',
        grade: 'Test Grade',
        size: 'Test Size',
        quantity: 100,
      }),
    });
    const rmItem1Data = await rmItemRes1.json();
    if (!rmItemRes1.ok) console.error('rmItem1 Failed:', rmItem1Data);
    rmItem1 = rmItem1Data.id;

    // Create RM Requirement for SC2
    const rmReqRes2 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: scId2 }),
    });
    const rmReq2 = await rmReqRes2.json();
    if (!rmReqRes2.ok) console.error('rmReq2 Failed:', rmReq2);

    // Add Item to SC2
    const rmItemRes2 = await fetch(`${BASE_URL}/rm/${rmReq2.id}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Test Mat 2',
        grade: 'Test Grade 2',
        size: 'Test Size 2',
        quantity: 200,
      }),
    });
    const rmItem2Data = await rmItemRes2.json();
    if (!rmItemRes2.ok) console.error('rmItem2 Failed:', rmItem2Data);
    rmItem2 = rmItem2Data.id;

    // Submit both RMs
    await fetch(`${BASE_URL}/rm/${rmReq1.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await fetch(`${BASE_URL}/rm/${rmReq2.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Cheat: Map product and approve in DB to bypass Phase 12.4 complex UI flows
    await pgClient.query(
      `UPDATE rm_items SET mapped_product_id = '${productId}' WHERE id IN ('${rmItem1}', '${rmItem2}')`,
    );
    await pgClient.query(
      `UPDATE sales_order_components SET status = 'IN_PRODUCTION' WHERE id IN ('${scId1}', '${scId2}')`,
    );

    // Issue Material for SC1 (Issue 50)
    await fetch(`${BASE_URL}/material-issue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${storesToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, binId, quantityIssued: 50 }],
      }),
    });
    // Receive Material for SC1
    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, quantityReceived: 50 }],
      }),
    });
    // Consume Material for SC1 (Consume 40)
    await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        rmItemId: rmItem1,
        quantityConsumed: 40,
      }),
    });
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('ADDL_01: Should safely reject zero and negative quantities', async () => {
    let res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, quantity: 0 }],
      }),
    });
    expect(res.status).toBe(400);

    res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, quantity: -10 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('ADDL_02: Should safely reject invalid UUIDs for SC and RM Item', async () => {
    let res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: 'not-a-uuid',
        items: [{ rmItemId: rmItem1, quantity: 10 }],
      }),
    });
    expect(res.status).toBe(400);

    res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: 'not-a-uuid', quantity: 10 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('ADDL_03: Should safely reject if rmItemId does not belong to the SC', async () => {
    const res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem2, quantity: 10 }],
      }), // rmItem2 belongs to scId2
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('not found or does not belong to SC');
  });

  it('ADDL_04: Should PREVENT mass assignment of status and quantityApproved', async () => {
    const res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        status: 'APPROVED',
        approvedById: 'uuid-hacker',
        items: [{ rmItemId: rmItem1, quantity: 10, quantityApproved: 50 }],
      }),
    });
    // With forbidNonWhitelisted: true, this throws a 400
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toEqual(
      expect.arrayContaining([expect.stringContaining('should not exist')]),
    );
  });

  it('ADDL_05: Should CREATE a valid Additional Request and strictly preserve Inventory & Accounting immutability', async () => {
    // 1. Capture BEFORE state
    const stockBefore = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`,
    );
    const txBefore = await pgClient.query(
      `SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`,
    );
    const accBeforeRes = await fetch(
      `${BASE_URL}/production/accounting/${scId1}`,
      { headers: { Authorization: `Bearer ${prodToken}` } },
    );
    const accBefore = await accBeforeRes.json();

    // 2. Create Request
    const res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, quantity: 30 }],
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('REQUESTED');
    expect(data.items[0].quantityRequested).toBe('30.000');
    expect(data.items[0].quantityApproved).toBeNull();

    // 3. Capture AFTER state
    const stockAfter = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`,
    );
    const txAfter = await pgClient.query(
      `SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`,
    );
    const accAfterRes = await fetch(
      `${BASE_URL}/production/accounting/${scId1}`,
      { headers: { Authorization: `Bearer ${prodToken}` } },
    );
    const accAfter = await accAfterRes.json();

    // 4. Assert IMMUTABILITY
    expect(Number(stockAfter.rows[0].current_quantity)).toBe(
      Number(stockBefore.rows[0].current_quantity),
    );
    expect(Number(txAfter.rows[0].c)).toBe(Number(txBefore.rows[0].c));

    expect(accAfter.items[0].issued).toBe(accBefore.items[0].issued);
    expect(accAfter.items[0].received).toBe(accBefore.items[0].received);
    expect(accAfter.items[0].consumed).toBe(accBefore.items[0].consumed);
    expect(accAfter.items[0].returned).toBe(accBefore.items[0].returned);
    expect(accAfter.items[0].unaccounted).toBe(accBefore.items[0].unaccounted);
  });

  it('ADDL_06: Should safely isolate multiple requests for the same SC', async () => {
    // Second request for the same SC
    const res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, quantity: 20 }],
      }),
    });
    expect(res.status).toBe(409); // Idempotency blocks multiple active requests

    const getRes = await fetch(
      `${BASE_URL}/additional-requests?scId=${scId1}`,
      {
        headers: { Authorization: `Bearer ${prodToken}` },
      },
    );
    const list = await getRes.json();

    // Should have 1 request for SC1 because the duplicate was rejected
    expect(list.length).toBe(1);
  });

  it('ADDL_07: Should completely isolate requests across different SCs and POs', async () => {
    const res2 = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId2,
        items: [{ rmItemId: rmItem2, quantity: 50 }],
      }),
    });
    expect(res2.status).toBe(201);

    const getRes1 = await fetch(
      `${BASE_URL}/additional-requests?scId=${scId1}`,
      { headers: { Authorization: `Bearer ${prodToken}` } },
    );
    const list1 = await getRes1.json();

    const getRes2 = await fetch(
      `${BASE_URL}/additional-requests?scId=${scId2}`,
      { headers: { Authorization: `Bearer ${prodToken}` } },
    );
    const list2 = await getRes2.json();

    expect(list1.length).toBe(1); // From SC1 (duplicate blocked)
    expect(list2.length).toBe(1); // Only SC2

    // Verify traceability context
    expect(list2[0].salesOrderComponent.id).toBe(scId2);
    expect(list2[0].items[0].rmItem.id).toBe(rmItem2);
  });

  it('ADDL_08: Should strictly enforce RBAC - Stores cannot request', async () => {
    const res = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${storesToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, quantity: 10 }],
      }),
    });
    expect(res.status).toBe(403);
  });
});
