import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let storesToken = '';
let customerId = '';
let poId = '';
let scId1 = '';
let rmId1 = '';
let rmItem1 = '';
let productId1 = '';
let binId = '';

let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const STORES_ID = '66666666-6666-6666-6666-666666666666';

describe('Phase 12.5 - Stores Material Issue', () => {
  beforeAll(async () => {
    pgClient = new Client(
      'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // Find roles
    const adminRoleRes = await pgClient.query(`SELECT id FROM roles LIMIT 1`);
    const adminRoleId = adminRoleRes.rows[0]?.id;

    const storesRoleRes = await pgClient.query(`SELECT id FROM roles LIMIT 1`);
    const storesRoleId = storesRoleRes.rows[0]?.id;

    // Seed mock users
    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${ADMIN_ID}', 'Admin User 5', 'admin5@example.com', 'hash', '${adminRoleId}', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${STORES_ID}', 'Stores User 5', 'stores5@example.com', 'hash', '${storesRoleId}', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    adminToken = jwt.sign(
      {
        sub: ADMIN_ID,
        email: 'admin5@example.com',
        role: 'ADMIN',
        roles: ['ADMIN'],
      },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    storesToken = jwt.sign(
      {
        sub: STORES_ID,
        email: 'stores5@example.com',
        role: 'STORES',
        roles: ['STORES'],
      },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    // Create workflow
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Issue Customer',
        code: `ISS-CUST-${Date.now()}`,
        isActive: true,
      }),
    });
    customerId = (await custRes.json()).id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ poNumber: `ISS-PO-${Date.now()}`, customerId }),
    });
    poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId,
        scNumber: `SC-ISS-01`,
        productName: 'Widget Issue',
        targetQuantity: 10,
      }),
    });
    scId1 = (await scRes.json()).id;

    const rRes = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: scId1 }),
    });
    rmId1 = (await rRes.json()).id;

    const itemRes = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Aluminium',
        grade: '6061',
        quantity: 50,
        size: '20mm',
      }),
    });
    rmItem1 = (await itemRes.json()).id;

    await fetch(`${BASE_URL}/rm/${rmId1}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks: 'Submit' }),
    });

    // Create Product and inject stock
    const fam = await pgClient.query(`SELECT id FROM product_families LIMIT 1`);
    const famId = fam.rows[0].id;
    const p1 = await pgClient.query(
      `INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Alu 6061 20mm ' || gen_random_uuid()::text, '${famId}', 0) RETURNING id`,
    );
    productId1 = p1.rows[0].id;

    const b = await pgClient.query(`SELECT id FROM bins LIMIT 1`);
    binId = b.rows[0].id;

    // Inject 100 stock
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId1}', '${binId}', 100)`,
    );

    // Perform Review
    await fetch(`${BASE_URL}/rm/${rmId1}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemMappings: [{ rmItemId: rmItem1, productId: productId1 }],
      }),
    });
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('ISSUE_01: Should safely reject issue for unmapped product or DRAFT RM', async () => {
    const scDraft = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId,
        scNumber: `SC-ISS-02`,
        productName: 'Widget DRAFT',
        targetQuantity: 10,
      }),
    });
    const sId = (await scDraft.json()).id;

    const rDraft = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: sId }),
    });
    const rmDraftId = (await rDraft.json()).id;

    const itemRes = await fetch(`${BASE_URL}/rm/${rmDraftId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Aluminium',
        grade: '6061',
        quantity: 50,
        size: '20mm',
      }),
    });
    const draftItemId = (await itemRes.json()).id;

    const res = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: sId,
        items: [{ rmItemId: draftItemId, binId: binId, quantityIssued: 10 }],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(JSON.stringify(data)).toContain('REVIEWED');
  });

  it('ISSUE_02: Should successfully physically issue stock and create atomic transaction', async () => {
    const balBefore = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId1}' AND bin_id = '${binId}'`,
    );
    expect(Number(balBefore.rows[0].current_quantity)).toBe(100);

    const res = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${storesToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: scId1,
        items: [{ rmItemId: rmItem1, binId: binId, quantityIssued: 30 }],
      }),
    });

    expect(res.status).toBe(201);

    // Verify physical deduction
    const balAfter = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId1}' AND bin_id = '${binId}'`,
    );
    expect(Number(balAfter.rows[0].current_quantity)).toBe(70);

    // Verify StockTransaction STORES_ISSUE
    const tx = await pgClient.query(`
      SELECT transaction_type, product_id, source_bin_id, quantity, created_by_id 
      FROM stock_transactions 
      WHERE product_id = '${productId1}' AND transaction_type = 'STORES_ISSUE'
    `);
    expect(tx.rows.length).toBe(1);
    expect(Number(tx.rows[0].quantity)).toBe(30);
    expect(tx.rows[0].source_bin_id).toBe(binId);
    expect(tx.rows[0].created_by_id).toBe(STORES_ID); // Actor attribution verified!
  });

  it('ISSUE_03: Should correctly handle CONCURRENCY and block double deduction', async () => {
    // Current stock is 70.
    // Send two concurrent requests for 50 each.
    // Only one should succeed.

    const reqBody = JSON.stringify({
      scId: scId1,
      items: [{ rmItemId: rmItem1, binId: binId, quantityIssued: 50 }],
    });

    const [res1, res2] = await Promise.all([
      fetch(`${BASE_URL}/material-issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: reqBody,
      }),
      fetch(`${BASE_URL}/material-issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: reqBody,
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // One must succeed (201) and one must fail (400 Insufficient stock or conflict)
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBe(400);

    // Verify stock is precisely 20. (70 - 50 = 20)
    const balAfter = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId1}' AND bin_id = '${binId}'`,
    );
    expect(Number(balAfter.rows[0].current_quantity)).toBe(20);

    // Verify only 2 STORES_ISSUE transactions exist total (the first 30, and the new 50)
    const txs = await pgClient.query(`
      SELECT quantity FROM stock_transactions 
      WHERE product_id = '${productId1}' AND transaction_type = 'STORES_ISSUE'
    `);
    expect(txs.rows.length).toBe(2);
  });
});
