import { test, expect, beforeAll, describe, afterAll } from 'vitest';
import { Client } from 'pg';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Phase 12.10 - SC Completion & Closure', () => {
  let pgClient: Client;
  let adminToken: string;
  let prodToken: string;
  let storesToken: string;
  let customerId: string;
  let poId: string;
  let poId2: string;
  let scId1: string;
  let scId2: string;
  let scId3: string;
  let rmItem1: string;
  let productId: string;
  let binId: string;

  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
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
      `INSERT INTO product_categories (name, is_active) VALUES ('COMP_CAT_${timestamp}', true) RETURNING id`,
    );
    const famRes = await pgClient.query(
      `INSERT INTO product_families (name, category_id, is_active) VALUES ('COMP_FAM_${timestamp}', '${catRes.rows[0].id}', true) RETURNING id`,
    );
    const prodResDb = await pgClient.query(
      `INSERT INTO products (name, family_id, is_active) VALUES ('COMP_PROD_${timestamp}', '${famRes.rows[0].id}', true) RETURNING id`,
    );
    productId = prodResDb.rows[0].id;

    const whRes = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active) VALUES ('COMP_WH_${timestamp}', 'CWH_${timestamp}', true) RETURNING id`,
    );
    const locRes = await pgClient.query(
      `INSERT INTO warehouse_locations (name, code, warehouse_id, is_active) VALUES ('COMP_LOC_${timestamp}', 'CLOC_${timestamp}', '${whRes.rows[0].id}', true) RETURNING id`,
    );
    const rackRes = await pgClient.query(
      `INSERT INTO racks (name, code, location_id, is_active) VALUES ('COMP_RACK_${timestamp}', 'CRACK_${timestamp}', '${locRes.rows[0].id}', true) RETURNING id`,
    );
    const binResDb = await pgClient.query(
      `INSERT INTO bins (name, code, rack_id, is_active) VALUES ('COMP_BIN_${timestamp}', 'CBIN_${timestamp}', '${rackRes.rows[0].id}', true) RETURNING id`,
    );
    binId = binResDb.rows[0].id;

    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 500)`,
    );
    await pgClient.query(
      `INSERT INTO stock_transactions (product_id, transaction_type, quantity, destination_bin_id, "referenceType", reference_id, created_by_id) VALUES ('${productId}', 'STOCK_IN', 500, '${binId}', 'SYSTEM', 'OPENING', '${EXISTING_USER_ID}')`,
    );

    // Create Customer, PO, SC1, SC2, SC3
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: `CUST-COMP-${Date.now()}`,
        name: 'Comp Customer',
        isActive: true,
      }),
    });
    customerId = (await custRes.json()).id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `PO-COMP-${Date.now()}-A`, customerId, referenceDate: '2026-09-01' }),
    });
    poId = (await poRes.json()).id;

    const poRes2 = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `PO-COMP-${Date.now()}-B`, customerId, referenceDate: '2026-09-01' }),
    });
    poId2 = (await poRes2.json()).id;

    const scRes1 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-COMP-${Date.now()}-1`, productName: 'Widget 1', targetQuantity: 10 }),
    });
    scId1 = (await scRes1.json()).id;

    const scRes2 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, scNumber: `SC-COMP-${Date.now()}-2`, productName: 'Widget 2', targetQuantity: 20 }),
    });
    scId2 = (await scRes2.json()).id;

    const scRes3 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId: poId2, scNumber: `SC-COMP-${Date.now()}-3`, productName: 'Widget 3', targetQuantity: 30 }),
    });
    scId3 = (await scRes3.json()).id;

    // Create RM Requirement for SC1
    const rmReqRes1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1 }),
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
    await pgClient.query(`UPDATE rm_requests SET status = 'REVIEWED' WHERE sc_id = '${scId1}'`);
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('COMP_01: Should block completion for DRAFT SC', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('Must be IN_PRODUCTION or ADDITIONAL_REQUEST');
  });

  it('COMP_02: Should block completion if unaccounted > 0', async () => {
    // Force IN_PRODUCTION
    await pgClient.query(`UPDATE sales_order_components SET status = 'IN_PRODUCTION' WHERE id = '${scId1}'`);
    
    // Issue Material for SC1 (Issue 50)
    const issueRes = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, items: [{ rmItemId: rmItem1, binId, quantityIssued: 50 }] }),
    });
    const issueData = await issueRes.json();
    const issueId = issueData.id;
    // Receive Material for SC1 (Receive 50) => Unaccounted is 50!
    await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, materialIssueId: issueId, items: [{ rmItemId: rmItem1, quantityReceived: 50 }] }),
    });

    const res = await fetch(`${BASE_URL}/sc/${scId1}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('unaccounted quantity');
  });

  it('COMP_03: Should block completion if pending returns exist', async () => {
    // Return 50 to Stores
    const retRes = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, items: [{ rmItemId: rmItem1, quantityReturned: 50 }] }),
    });
    // Unaccounted is now 0 (50 Received - 50 Returned), BUT Return is PENDING_STORE_ACK!
    const res = await fetch(`${BASE_URL}/sc/${scId1}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('pending material returns awaiting Stores ACK');
  });

  it('COMP_04: Should block completion if pending additional requests exist', async () => {
    // Verify the return
    const retRes = await pgClient.query(`SELECT id FROM material_returns WHERE sc_id = '${scId1}'`);
    const retId = retRes.rows[0].id;
    await fetch(`${BASE_URL}/production/return/${retId}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationBinId: binId, remarks: 'Verified by Stores' })
    });
    // Now Returns are ACKed, Unaccounted is 0.
    
    // Create Additional Request
    await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1, items: [{ rmItemId: rmItem1, quantity: 10 }] }),
    });

    const res = await fetch(`${BASE_URL}/sc/${scId1}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('pending additional material requests');
  });

  it('COMP_05: Should COMPLETE SC when all preconditions are met without altering inventory', async () => {
    // Cancel the Additional Request via DB to clear the blocker
    await pgClient.query(`UPDATE additional_material_requests SET status = 'CANCELLED' WHERE sc_id = '${scId1}'`);

    const stockBefore = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txBefore = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`);

    const res = await fetch(`${BASE_URL}/sc/${scId1}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prodToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'All done' })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('COMPLETED');

    const stockAfter = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txAfter = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`);
    expect(stockAfter.rows[0].current_quantity).toBe(stockBefore.rows[0].current_quantity);
    expect(txAfter.rows[0].c).toBe(txBefore.rows[0].c);
  });

  it('COMP_06: Should CLOSE SC when status is COMPLETED without altering inventory', async () => {
    const stockBefore = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txBefore = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`);

    const res = await fetch(`${BASE_URL}/sc/${scId1}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Closed by stores' })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('CLOSED');
    expect(data.completionRemarks).toContain('Closed by stores');

    const stockAfter = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}' AND bin_id = '${binId}'`);
    const txAfter = await pgClient.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`);
    expect(stockAfter.rows[0].current_quantity).toBe(stockBefore.rows[0].current_quantity);
    expect(txAfter.rows[0].c).toBe(txBefore.rows[0].c);
  });

  it('COMP_07: Should block closure if SC is NOT COMPLETED', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId2}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('Must be COMPLETED first');
  });

  it('COMP_08: Independence - SC2 and SC3 remain unchanged', async () => {
    const res2 = await fetch(`${BASE_URL}/sc/${scId2}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const sc2 = await res2.json();
    expect(sc2.status).toBe('DRAFT'); // Unchanged

    const res3 = await fetch(`${BASE_URL}/sc/${scId3}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const sc3 = await res3.json();
    expect(sc3.status).toBe('DRAFT'); // Unchanged
  });
});
