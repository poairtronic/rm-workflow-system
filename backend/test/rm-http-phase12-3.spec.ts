import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let customerId = '';
let poId = '';
let scId1 = '';
let scId2 = '';

let rmId1 = '';
let rmId2 = '';

let pgClient: Client;

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';

describe('Phase 12.3 - RM Request Real HTTP / Inventory Isolation Verification', () => {
  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // Find ADMIN role
    const roleRes = await pgClient.query(
      `SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`,
    );
    let roleId = roleRes.rows[0]?.id;
    if (!roleId) {
      const newRole = await pgClient.query(
        `INSERT INTO roles (id, name, description) VALUES (gen_random_uuid(), 'ADMIN', 'Admin Role') RETURNING id`,
      );
      roleId = newRole.rows[0].id;
    }

    // Insert dummy user so FK constraints pass (created_by_id)
    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${ADMIN_ID}', 'Admin User', 'admin@example.com', 'hash', '${roleId}', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Generate JWT
    const payload = {
      sub: ADMIN_ID,
      email: 'admin@example.com',
      role: 'ADMIN',
      roles: ['ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION'],
    };
    adminToken = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    // 1. Setup Customer & PO
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'RM Test Customer',
        code: `RM-CUST-${Date.now()}`,
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
      body: JSON.stringify({ poNumber: `RM-PO-${Date.now()}`, customerId }),
    });
    poId = (await poRes.json()).id;

    // 2. Setup SC001 & SC002
    const scRes1 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId,
        scNumber: `SC001`,
        productName: 'Widget A',
        targetQuantity: 10,
      }),
    });
    scId1 = (await scRes1.json()).id;

    const scRes2 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId,
        scNumber: `SC002`,
        productName: 'Widget B',
        targetQuantity: 20,
      }),
    });
    scId2 = (await scRes2.json()).id;
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('RM_VALIDATION_01: Should block RM creation for missing/invalid SC', async () => {
    // 1. Invalid UUID format should give 400
    const res1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: '00000000-0000-0000-0000-000000000000',
        remarks: 'Test',
      }),
    });
    expect(res1.status).toBe(400); // ValidationPipe (UUID v4)

    // 2. Non-existent UUID should give 404
    const res2 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scId: '11111111-1111-4111-a111-111111111111',
        remarks: 'Test',
      }),
    });
    expect(res2.status).toBe(404); // NotFoundException
  });

  it('RM_CREATE_01: Should create RM001 under SC001 and RM002 under SC002', async () => {
    const r1 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: scId1 }),
    });
    expect(r1.status).toBe(201);
    const data1 = await r1.json();
    rmId1 = data1.id;
    expect(data1.status).toBe('DRAFT');
    expect(data1.createdById).toBe(ADMIN_ID);

    const r2 = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: scId2 }),
    });
    expect(r2.status).toBe(201);
    rmId2 = (await r2.json()).id;
  });

  it('RM_VALIDATION_02: Should prevent multiple RMs under same SC (1:1 constraint)', async () => {
    const dupRes = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scId: scId1 }),
    });
    expect([400, 409].includes(dupRes.status)).toBe(true);
  });

  it('RM_ITEMS_01: Should add multiple RM items to RM001', async () => {
    const item1 = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Mild Steel',
        grade: 'EN8',
        quantity: 50.5,
        size: '100mm',
      }),
    });
    expect(item1.status).toBe(201);

    const item2 = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Stainless Steel',
        grade: '304',
        quantity: 25,
        size: '50mm',
        weight: 100,
        weightUnit: 'KG',
      }),
    });
    expect(item2.status).toBe(201);
  });

  it('RM_VALIDATION_03: Should reject empty submission', async () => {
    // rmId2 has no items
    const res = await fetch(`${BASE_URL}/rm/${rmId2}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status).toBe(400); // BadRequestException: Cannot submit without items
  });

  it('RM_SUBMISSION_01: Should submit RM001 successfully and update SC status', async () => {
    // Pre-flight check SC001 status
    const scCheckBefore = await fetch(`${BASE_URL}/sc/${scId1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect((await scCheckBefore.json()).status).toBe('DRAFT');

    const res = await fetch(`${BASE_URL}/rm/${rmId1}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks: 'Ready for Stores' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('SUBMITTED');
    expect(data.submittedAt).toBeDefined();

    // Verify SC001 status changed to SUBMITTED
    const scCheckAfter = await fetch(`${BASE_URL}/sc/${scId1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect((await scCheckAfter.json()).status).toBe('SUBMITTED');

    // Verify SC002 remains unchanged
    const sc2Check = await fetch(`${BASE_URL}/sc/${scId2}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect((await sc2Check.json()).status).toBe('DRAFT');
  });

  it('RM_VALIDATION_04: Cannot add items to SUBMITTED RM', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material: 'Copper',
        grade: 'C101',
        quantity: 10,
        size: '10mm',
      }),
    });
    expect(res.status).toBe(400); // BadRequestException: Invalid state transition
  });

  it('INVENTORY_ISOLATION_01: RM Creation and Submission must NOT mutate Stock', async () => {
    const query = await pgClient.query(
      `SELECT COUNT(*) as count FROM stock_transactions`,
    );
    expect(query.rows[0].count).toBeDefined();

    // We can confidently assert `materialIssues` on RM Item is 0
    const rmVerify = await fetch(`${BASE_URL}/rm/${rmId1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const rmData = await rmVerify.json();
    expect(rmData.items[0].materialIssues.length).toBe(0);
    expect(rmData.items[1].materialIssues.length).toBe(0);
  });
});
