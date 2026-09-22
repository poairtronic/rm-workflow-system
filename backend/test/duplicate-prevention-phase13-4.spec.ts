import { test, expect, beforeAll, describe, afterAll } from 'vitest';
import { Client } from 'pg';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Phase 13.4 - Duplicate Prevention & Idempotency Hardening', () => {
  let pgClient: Client;
  let adminToken: string;
  let prodToken: string;
  let storesToken: string;
  let scId: string;
  let rmItem1: string;
  let binId: string;

  beforeAll(async () => {
    pgClient = new Client({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
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
      `INSERT INTO product_categories (name, is_active) VALUES ('DUP_CAT_${timestamp}', true) RETURNING id`,
    );
    const famRes = await pgClient.query(
      `INSERT INTO product_families (name, category_id, is_active) VALUES ('DUP_FAM_${timestamp}', '${catRes.rows[0].id}', true) RETURNING id`,
    );
    const prodResDb = await pgClient.query(
      `INSERT INTO products (name, family_id, is_active) VALUES ('DUP_PROD_${timestamp}', '${famRes.rows[0].id}', true) RETURNING id`,
    );
    const productId = prodResDb.rows[0].id;

    const whRes = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active) VALUES ('DUP_WH_${timestamp}', 'DWH_${timestamp}', true) RETURNING id`,
    );
    const locRes = await pgClient.query(
      `INSERT INTO warehouse_locations (name, code, warehouse_id, is_active) VALUES ('DUP_LOC_${timestamp}', 'DLOC_${timestamp}', '${whRes.rows[0].id}', true) RETURNING id`,
    );
    const rackRes = await pgClient.query(
      `INSERT INTO racks (name, code, location_id, is_active) VALUES ('DUP_RACK_${timestamp}', 'DRACK_${timestamp}', '${locRes.rows[0].id}', true) RETURNING id`,
    );
    const binResDb = await pgClient.query(
      `INSERT INTO bins (name, code, rack_id, is_active) VALUES ('DUP_BIN_${timestamp}', 'DBIN_${timestamp}', '${rackRes.rows[0].id}', true) RETURNING id`,
    );
    binId = binResDb.rows[0].id;

    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 5000)`,
    );

    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: `DUP-${timestamp}`,
        name: 'Dup Customer',
        isActive: true,
      }),
    });
    const customerId = (await custRes.json()).id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `PO-DUP-${timestamp}`, customerId, referenceDate: '2026-09-01' }),
    });
    const poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-DUP-${timestamp}`, productName: 'Dup Product', targetQuantity: 10 }),
    });
    scId = (await scRes.json()).id;

    const rmReqRes1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId }),
    });
    const rmReq1 = await rmReqRes1.json();

    const rmItemRes1 = await fetch(`${BASE_URL}/rm/${rmReq1.id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Dup Mat', grade: 'Dup Grade', size: 'Dup Size', quantity: 1000 }),
    });
    rmItem1 = (await rmItemRes1.json()).id;

    await fetch(`${BASE_URL}/rm/${rmReq1.id}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
    await pgClient.query(`UPDATE rm_items SET mapped_product_id = '${productId}' WHERE id = '${rmItem1}'`);
    await pgClient.query(`UPDATE rm_requests SET status = 'REVIEWED' WHERE sc_id = '${scId}'`);
  });

  afterAll(async () => {
    await pgClient.end();
  });

  test('DUP_001-003: Single, Duplicate, Concurrent Material Issues', async () => {
    // 1. Concurrent Material Issues
    const issuePayload = {
      scId: scId,
      items: [{ rmItemId: rmItem1, binId, quantityIssued: 100 }]
    };

    const promise1 = fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(issuePayload),
    });
    const promise2 = fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(issuePayload),
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);

    expect([res1.status, res2.status]).toContain(201);
    expect([res1.status, res2.status]).toContain(409); // ConflictException

    // Verify DB count
    const issues = await pgClient.query(`SELECT id FROM material_issues WHERE sc_id = '${scId}'`);
    expect(issues.rowCount).toBe(1);

    const issueItems = await pgClient.query(`SELECT id FROM material_issue_items WHERE material_issue_id = '${issues.rows[0].id}'`);
    expect(issueItems.rowCount).toBe(1);

    const stockTx = await pgClient.query(`SELECT id FROM stock_transactions WHERE reference_id = '${issues.rows[0].id}' AND transaction_type = 'STORES_ISSUE'`);
    expect(stockTx.rowCount).toBe(1);
  });

  test('DUP_004-006: Single, Duplicate, Concurrent Production Receipts', async () => {
    const issues = await pgClient.query(`SELECT id FROM material_issues WHERE sc_id = '${scId}'`);
    const materialIssueId = issues.rows[0].id;

    const idempotencyKey = `REC-${Date.now()}`;
    const payload = {
      materialIssueId,
      scId,
      items: [{ rmItemId: rmItem1, quantityReceived: 50 }],
      idempotencyKey
    };

    const promise1 = fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const promise2 = fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect([res1.status, res2.status]).toContain(201);
    expect([res1.status, res2.status]).toContain(409); // Idempotency Conflict

    // Verify DB Count
    const receipts = await pgClient.query(`SELECT id FROM material_receipts WHERE idempotency_key = '${idempotencyKey}'`);
    expect(receipts.rowCount).toBe(1);

    // Also test a regular sequential retry with same key
    const res3 = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res3.status).toBe(409);
  });

  test('DUP_007-009: Return Ack Concurrency', async () => {
    // 1. Consume some material first
    await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId, rmItemId: rmItem1, quantityConsumed: 40 }),
    });

    // 2. Create Return
    const retRes = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId, items: [{ rmItemId: rmItem1, quantityReturned: 10 }] }),
    });
    const ret = await retRes.json();

    // 3. Concurrent ACK
    const payload = { destinationBinId: binId };

    const promise1 = fetch(`${BASE_URL}/production/return/${ret.id}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const promise2 = fetch(`${BASE_URL}/production/return/${ret.id}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect([res1.status, res2.status]).toContain(201);
    expect([res1.status, res2.status]).toContain(400); // Bad Request because status is no longer PENDING

    const dbRet = await pgClient.query(`SELECT status FROM material_returns WHERE id = '${ret.id}'`);
    expect(dbRet.rows[0].status).toBe('ACKNOWLEDGED');

    const txs = await pgClient.query(`SELECT id FROM stock_transactions WHERE reference_id = '${ret.id}' AND transaction_type = 'RETURN'`);
    expect(txs.rowCount).toBe(1);
  });

  test('DUP_013-015: Additional Request Concurrency', async () => {
    const payload = {
      scId,
      reason: 'WASTAGE',
      items: [{ rmItemId: rmItem1, quantity: 20 }]
    };

    const promise1 = fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const promise2 = fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect([res1.status, res2.status]).toContain(201);
    expect([res1.status, res2.status]).toContain(409); // Unique index idx_single_active_request conflict

    const reqs = await pgClient.query(`SELECT id FROM additional_material_requests WHERE sc_id = '${scId}' AND status IN ('REQUESTED', 'APPROVED')`);
    expect(reqs.rowCount).toBe(1);
  });

  test('DUP_010-012: SC Completion Concurrency', async () => {
    // Complete remaining receipt and consumption first to have 0 unaccounted
    const issues = await pgClient.query(`SELECT id FROM material_issues WHERE sc_id = '${scId}'`);
    const materialIssueId = issues.rows[0].id;
    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialIssueId, scId, items: [{ rmItemId: rmItem1, quantityReceived: 50 }], idempotencyKey: `REC-${Date.now()}-2` }),
    });
    await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId, rmItemId: rmItem1, quantityConsumed: 50 }),
    });
    // Need to reject the additional request to allow completion
    await pgClient.query(`UPDATE additional_material_requests SET status = 'REJECTED' WHERE sc_id = '${scId}'`);

    const promise1 = fetch(`${BASE_URL}/sc/${scId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Done' }),
    });
    const promise2 = fetch(`${BASE_URL}/sc/${scId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Done' }),
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect([res1.status, res2.status]).toContain(201);
    expect([res1.status, res2.status]).toContain(400); // Bad Request because already completed

    const dbSc = await pgClient.query(`SELECT status FROM sales_order_components WHERE id = '${scId}'`);
    expect(dbSc.rows[0].status).toBe('COMPLETED');
  });

});
