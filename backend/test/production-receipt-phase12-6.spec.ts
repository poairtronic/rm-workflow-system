import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let prodToken = '';
let customerId = '';
let poId = '';
let scId = '';
let rmId = '';
let rmItem1 = '';
let productId = '';
let binId = '';
let materialIssueId = '';

let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const PROD_ID = '77777777-7777-7777-7777-777777777777';

describe('Phase 12.6 - Production Receipt', () => {
  beforeAll(async () => {
    pgClient = new Client(
      'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    const adminRoleRes = await pgClient.query(`SELECT id FROM roles LIMIT 1`);
    const adminRoleId = adminRoleRes.rows[0]?.id;

    const prodRoleRes = await pgClient.query(
      `SELECT id FROM roles WHERE name = 'PRODUCTION' LIMIT 1`,
    );
    const prodRoleId = prodRoleRes.rows[0]?.id || adminRoleId;

    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${ADMIN_ID}', 'Admin User', 'admin-prod@example.com', 'hash', '${adminRoleId}', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${PROD_ID}', 'Prod User', 'prod-user@example.com', 'hash', '${prodRoleId}', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    adminToken = jwt.sign(
      {
        sub: ADMIN_ID,
        email: 'admin-prod@example.com',
        role: 'ADMIN',
        roles: ['ADMIN'],
      },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    prodToken = jwt.sign(
      {
        sub: PROD_ID,
        email: 'prod-user@example.com',
        role: 'PRODUCTION',
        roles: ['PRODUCTION'],
      },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    // Create workflow up to Material Issue
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Prod Customer',
        code: `PRD-${Date.now()}`,
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
      body: JSON.stringify({ poNumber: `PRD-PO-${Date.now()}`, customerId }),
    });
    poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId,
        scNumber: `SC-PRD-${Date.now()}`,
        productName: 'Widget',
        targetQuantity: 10,
      }),
    });
    const scJson = await scRes.json();
    if (!scRes.ok) console.error('SC CREATE FAILED:', scJson);
    scId = scJson.id;

    const rRes = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId }),
    });
    const rmJson = await rRes.json();
    if (!rRes.ok) console.error('RM CREATE FAILED:', rmJson);
    rmId = rmJson.id;

    const itemRes = await fetch(`${BASE_URL}/rm/${rmId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Aluminium',
        grade: '6061-T6',
        size: '10x10',
        quantity: 50,
      }),
    });
    const itemJson = await itemRes.json();
    if (!itemRes.ok) console.error('RM ITEM CREATE FAILED:', itemJson);
    rmItem1 = itemJson.id;

    await fetch(`${BASE_URL}/rm/${rmId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks: 'Submit' }),
    });

    const fam = await pgClient.query(`SELECT id FROM product_families LIMIT 1`);
    const p1 = await pgClient.query(
      `INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Receipt ' || gen_random_uuid()::text, '${fam.rows[0].id}', 0) RETURNING id`,
    );
    productId = p1.rows[0].id;

    const b = await pgClient.query(`SELECT id FROM bins LIMIT 1`);
    binId = b.rows[0].id;

    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId}', '${binId}', 100)`,
    );

    await fetch(`${BASE_URL}/rm/${rmId}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemMappings: [{ rmItemId: rmItem1, productId }],
      }),
    });

    const issueRes = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId,
        items: [{ rmItemId: rmItem1, binId, quantityIssued: 40 }],
      }),
    });
    materialIssueId = (await issueRes.json()).id;
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('RECEIPT_01: Should safely reject receipt for nonexistent material issue', async () => {
    const res = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materialIssueId: '11111111-1111-4111-a111-111111111111',
        items: [{ rmItemId: rmItem1, quantityReceived: 40 }],
      }),
    });

    expect(res.status).toBe(404);
  });

  it('RECEIPT_02: Should safely reject receipt if quantity exceeds issued', async () => {
    const res = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materialIssueId,
        items: [{ rmItemId: rmItem1, quantityReceived: 50 }], // Issued was 40
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(JSON.stringify(data)).toContain('Cannot receive more than issued');
  });

  it('RECEIPT_03: Should correctly create partial receipt WITHOUT second stock deduction', async () => {
    const stockBefore = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}'`,
    );
    const txBefore = await pgClient.query(
      `SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`,
    );

    expect(Number(stockBefore.rows[0].current_quantity)).toBe(60); // 100 - 40 issued

    const res = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materialIssueId,
        items: [{ rmItemId: rmItem1, quantityReceived: 25 }], // Partial
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('PARTIAL');

    const stockAfter = await pgClient.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = '${productId}'`,
    );
    const txAfter = await pgClient.query(
      `SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = '${productId}'`,
    );

    expect(Number(stockAfter.rows[0].current_quantity)).toBe(60); // UNCHANGED!
    expect(Number(txAfter.rows[0].c)).toBe(Number(txBefore.rows[0].c)); // NO NEW TRANSACTIONS
  });

  it('RECEIPT_04: Should correctly receive the remaining balance and block further receipts', async () => {
    const res = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materialIssueId,
        items: [{ rmItemId: rmItem1, quantityReceived: 15 }], // The remaining 15
      }),
    });

    expect(res.status).toBe(201);

    // Now try to receive 1 more
    const overRes = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materialIssueId,
        items: [{ rmItemId: rmItem1, quantityReceived: 1 }],
      }),
    });

    expect(overRes.status).toBe(400);
    const data = await overRes.json();
    expect(JSON.stringify(data)).toContain('fully received');
  });
});
