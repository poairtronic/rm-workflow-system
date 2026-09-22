import 'dotenv/config';
import { test, expect, beforeAll, describe, afterAll } from 'vitest';
import { Client } from 'pg';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Phase 13.1.1 - SC Completion Concurrency Hardening', () => {
  let pgClient: Client;
  let adminToken: string;
  let prodToken: string;
  let storesToken: string;
  let customerId: string;
  let poId: string;
  let scId: string;
  let productId: string;
  let binId: string;
  let rmItem1: string;

  beforeAll(async () => {
    pgClient = new Client({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres@localhost:5432/rm_workflow_db',
    });
    await pgClient.connect();

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

    const timestamp = Date.now();
    const catRes = await pgClient.query(
      `INSERT INTO product_categories (name, is_active) VALUES ('CONCUR_CAT_${timestamp}', true) RETURNING id`,
    );
    const famRes = await pgClient.query(
      `INSERT INTO product_families (name, category_id, is_active) VALUES ('CONCUR_FAM_${timestamp}', '${catRes.rows[0].id}', true) RETURNING id`,
    );
    const prodResDb = await pgClient.query(
      `INSERT INTO products (name, family_id, is_active) VALUES ('CONCUR_PROD_${timestamp}', '${famRes.rows[0].id}', true) RETURNING id`,
    );
    productId = prodResDb.rows[0].id;

    const whRes = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active) VALUES ('CONCUR_WH_${timestamp}', 'CWH_${timestamp}', true) RETURNING id`,
    );
    const locRes = await pgClient.query(
      `INSERT INTO warehouse_locations (name, code, warehouse_id, is_active) VALUES ('CONCUR_LOC_${timestamp}', 'CLOC_${timestamp}', '${whRes.rows[0].id}', true) RETURNING id`,
    );
    const rackRes = await pgClient.query(
      `INSERT INTO racks (name, code, location_id, is_active) VALUES ('CONCUR_RACK_${timestamp}', 'CRACK_${timestamp}', '${locRes.rows[0].id}', true) RETURNING id`,
    );
    const binResDb = await pgClient.query(
      `INSERT INTO bins (name, code, rack_id, is_active) VALUES ('CONCUR_BIN_${timestamp}', 'CBIN_${timestamp}', '${rackRes.rows[0].id}', true) RETURNING id`,
    );
    binId = binResDb.rows[0].id;

    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 500)`,
    );
    await pgClient.query(
      `INSERT INTO stock_transactions (product_id, transaction_type, quantity, destination_bin_id, "referenceType", reference_id, created_by_id) VALUES ('${productId}', 'STOCK_IN', 500, '${binId}', 'SYSTEM', 'OPENING', '${EXISTING_USER_ID}')`,
    );

    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: `CUST-CONCUR-${Date.now()}`,
        name: 'Concur Customer',
        isActive: true,
      }),
    });
    customerId = (await custRes.json()).id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `PO-CONCUR-${Date.now()}-A`, customerId, referenceDate: '2026-09-01' }),
    });
    poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-CONCUR-${Date.now()}-1`, productName: 'Widget 1', targetQuantity: 10 }),
    });
    scId = (await scRes.json()).id;

    // Create RM Requirement
    const rmReqRes1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId }),
    });
    const rmReq1 = await rmReqRes1.json();

    const rmItemRes1 = await fetch(`${BASE_URL}/rm/${rmReq1.id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Test Mat', grade: 'Test Grade', size: 'Test Size', quantity: 100 }),
    });
    rmItem1 = (await rmItemRes1.json()).id;

    await fetch(`${BASE_URL}/rm/${rmReq1.id}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });

    await pgClient.query(`UPDATE rm_items SET mapped_product_id = '${productId}' WHERE id = '${rmItem1}'`);
    await pgClient.query(`UPDATE rm_requests SET status = 'REVIEWED' WHERE sc_id = '${scId}'`);

    // Force IN_PRODUCTION
    await pgClient.query(`UPDATE sales_order_components SET status = 'IN_PRODUCTION' WHERE id = '${scId}'`);

    // Issue and receive material so unaccounted is 0.
    const issueRes = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId, items: [{ rmItemId: rmItem1, binId, quantityIssued: 50 }] }),
    });
    if (!issueRes.ok) throw new Error(`Issue failed: ${await issueRes.text()}`);
    const issueId = (await issueRes.json()).id;

    const recRes = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId, materialIssueId: issueId, items: [{ rmItemId: rmItem1, quantityReceived: 50 }] }),
    });
    if (!recRes.ok) throw new Error(`Receipt failed: ${await recRes.text()}`);

    // Consume all to make unaccounted = 0
    const conRes = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId, rmItemId: rmItem1, quantityConsumed: 50 }),
    });
    if (!conRes.ok) throw new Error(`Consumption failed: ${await conRes.text()}`);
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('CONCUR_01: Concurrent SC completion requests should lock and resolve safely', async () => {
    // Both requests sent simultaneously.
    const req1 = fetch(`${BASE_URL}/sc/${scId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Completed 1' })
    });
    
    const req2 = fetch(`${BASE_URL}/sc/${scId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Completed 2' })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const body1 = await res1.json();
    const body2 = await res2.json();
    console.log('CONCUR_01 req1 response:', res1.status, body1);
    console.log('CONCUR_01 req2 response:', res2.status, body2);
    
    const statuses = [res1.status, res2.status].sort();

    // One should succeed (201), the other should fail (400) because it's already completed.
    expect(statuses).toEqual([201, 400]);

    // Verify DB state
    const scDbRes = await pgClient.query(`SELECT status FROM sales_order_components WHERE id = '${scId}'`);
    expect(scDbRes.rows[0].status).toBe('COMPLETED');
  });

  it('CONCUR_02: Concurrent SC close requests should lock and resolve safely', async () => {
    const req1 = fetch(`${BASE_URL}/sc/${scId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Closed 1' })
    });
    
    const req2 = fetch(`${BASE_URL}/sc/${scId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Closed 2' })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const body1 = await res1.json();
    const body2 = await res2.json();
    console.log('CONCUR_02 req1 response:', res1.status, body1);
    console.log('CONCUR_02 req2 response:', res2.status, body2);
    const statuses = [res1.status, res2.status].sort();

    // One should succeed (201), the other should fail (400) because it's already closed.
    expect(statuses).toEqual([201, 400]);

    // Verify DB state
    const scDbRes = await pgClient.query(`SELECT status FROM sales_order_components WHERE id = '${scId}'`);
    expect(scDbRes.rows[0].status).toBe('CLOSED');
  });
});
