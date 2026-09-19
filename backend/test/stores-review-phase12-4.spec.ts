import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let customerId = '';
let poId = '';
let scId1 = '';
let rmId1 = '';
let rmItem1 = '';
let rmItem2 = '';
let productId1 = '';
let productId2 = '';
let binId = '';

let pgClient: Client;
const ADMIN_ID = '44444444-4444-4444-4444-444444444444';

describe('Phase 12.4 - Stores Review / Inventory Verification', () => {
  beforeAll(async () => {
    pgClient = new Client('postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db');
    await pgClient.connect();

    // Find ADMIN role
    const roleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`);
    let roleId = roleRes.rows[0]?.id;

    // Seed mock admin
    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${ADMIN_ID}', 'Admin User 2', 'admin2@example.com', 'hash', '${roleId}', true)
      ON CONFLICT (email) DO NOTHING;
    `);

    adminToken = jwt.sign({
      sub: ADMIN_ID,
      email: 'admin2@example.com',
      role: 'ADMIN',
      roles: ['ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION']
    }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');

    // Setup base SC & RM
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Review Test Customer', code: `REV-CUST-${Date.now()}`, isActive: true })
    });
    customerId = (await custRes.json()).id;

    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poNumber: `REV-PO-${Date.now()}`, customerId })
    });
    poId = (await poRes.json()).id;

    const scRes1 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId: poId, scNumber: `SC-REV-01`, productName: 'Widget A', targetQuantity: 10 })
    });
    scId1 = (await scRes1.json()).id;

    const r1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: scId1 })
    });
    rmId1 = (await r1.json()).id;

    const item1Res = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Steel', grade: '304', quantity: 50, size: '10mm' })
    });
    rmItem1 = (await item1Res.json()).id;

    const item2Res = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ material: 'Copper', grade: 'C101', quantity: 200, size: '5mm' })
    });
    rmItem2 = (await item2Res.json()).id;

    await fetch(`${BASE_URL}/rm/${rmId1}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Submit for review' })
    });

    // Create 2 mock Products and inject Stock
    const fam = await pgClient.query(`SELECT id FROM product_families LIMIT 1`);
    const famId = fam.rows[0].id;
    const p1 = await pgClient.query(`INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Steel 304 10mm ' || gen_random_uuid()::text, '${famId}', 0) RETURNING id`);
    const p2 = await pgClient.query(`INSERT INTO products (name, family_id, minimum_inventory) VALUES ('Product Copper C101 5mm ' || gen_random_uuid()::text, '${famId}', 0) RETURNING id`);
    productId1 = p1.rows[0].id;
    productId2 = p2.rows[0].id;

    const b = await pgClient.query(`SELECT id FROM bins LIMIT 1`);
    binId = b.rows[0].id;

    // Inject stock: Steel = 100 (AVAILABLE, req 50) | Copper = 150 (PARTIAL, req 200)
    await pgClient.query(`INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId1}', '${binId}', 100)`);
    await pgClient.query(`INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ('${productId2}', '${binId}', 150)`);
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('REVIEW_01: Should perform Stores Review and correctly classify item availability without mutating physical stock', async () => {
    // 1. Capture inventory before
    const countBefore = await pgClient.query(`SELECT COUNT(*) as count FROM stock_transactions`);
    
    // 2. Perform Review
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/review`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemMappings: [
          { rmItemId: rmItem1, productId: productId1 },
          { rmItemId: rmItem2, productId: productId2 }
        ],
        remarks: 'Availability check'
      })
    });
    
    expect(res.status).toBe(201);
    const data = await res.json();
    
    expect(data.status).toBe('REVIEWED');
    expect(data.reviewedAt).toBeDefined();
    expect(data.reviewedById).toBe(ADMIN_ID);
    
    const i1 = data.items.find((i: any) => i.id === rmItem1);
    expect(i1.availabilityStatus).toBe('AVAILABLE');
    expect(Number(i1.availableQuantitySnapshot)).toBe(100);
    
    const i2 = data.items.find((i: any) => i.id === rmItem2);
    expect(i2.availabilityStatus).toBe('PARTIAL');
    expect(Number(i2.availableQuantitySnapshot)).toBe(150);

    // 3. Verify absolute inventory immutability
    const countAfter = await pgClient.query(`SELECT COUNT(*) as count FROM stock_transactions`);
    expect(countBefore.rows[0].count).toBe(countAfter.rows[0].count);

    const bal1 = await pgClient.query(`SELECT current_quantity FROM stock_balances WHERE product_id = '${productId1}'`);
    expect(Number(bal1.rows[0].current_quantity)).toBe(100); // Unchanged
  });

  it('REVIEW_02: Should safely prevent review of DRAFT RM', async () => {
    const scDraft = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId: poId, scNumber: `SC-REV-02`, productName: 'Widget C', targetQuantity: 10 })
    });
    const sId = (await scDraft.json()).id;

    const rDraft = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scId: sId })
    });
    const rmDraftId = (await rDraft.json()).id;

    const res = await fetch(`${BASE_URL}/rm/${rmDraftId}/review`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemMappings: [] })
    });
    
    expect(res.status).toBe(400); // Must be SUBMITTED
  });
});


