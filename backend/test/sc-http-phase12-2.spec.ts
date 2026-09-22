import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let token = '';
let customerId = '';
let poId1 = '';
let poId2 = '';
let scId1 = '';
let scId2 = '';
let scId3 = '';
let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';

describe('Phase 12.2 - SC Real HTTP / Real DB Independence Verification', () => {
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
      // Fallback create role if missing
      const newRole = await pgClient.query(
        `INSERT INTO roles (id, name, description) VALUES (gen_random_uuid(), 'ADMIN', 'Admin Role') RETURNING id`,
      );
      roleId = newRole.rows[0].id;
    }

    // Insert dummy user so FK constraint passes
    await pgClient.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES ('${ADMIN_ID}', 'Admin User', 'admin@example.com', 'hash', '${roleId}', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Generate valid JWT Token directly
    const payload = {
      sub: ADMIN_ID,
      email: 'admin@example.com',
      role: 'ADMIN',
      roles: [
        'ADMIN',
        'STORES',
        'PRODUCTION',
        'SENIOR_MANAGER',
        'GENERAL_MANAGER',
      ],
    };
    token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );

    // 2. Create a Customer for our POs
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'SC Test Customer',
        code: `SC-CUST-${Date.now()}`,
        isActive: true,
      }),
    });
    customerId = (await custRes.json()).id;

    // 3. Create PO-1 and PO-2
    const poRes1 = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ poNumber: `SC-PO1-${Date.now()}`, customerId }),
    });
    poId1 = (await poRes1.json()).id;

    const poRes2 = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ poNumber: `SC-PO2-${Date.now()}`, customerId }),
    });
    poId2 = (await poRes2.json()).id;
  });

  afterAll(async () => {
    // Cleanup SCs, POs, Customer to allow user deletion?
    // User FK is restrict on completed_by_id? We can just leave the user.
    await pgClient.end();
  });

  it('SC_CREATE_01: Should block SC creation with missing/invalid PO', async () => {
    const invalidPoPayload = {
      poId: '00000000-0000-0000-0000-000000000000',
      scNumber: `SC-FAIL-${Date.now()}`,
      productName: 'Widget A',
      targetQuantity: 10,
    };
    const res = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidPoPayload),
    });
    expect(res.status).toBe(404); // Not found Exception from Service
  });

  it('SC_CREATE_02: Should create SC001, SC002 under PO-1 and SC003 under PO-2 successfully', async () => {
    const p1 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId1,
        scNumber: `SC001`,
        productName: 'Widget A',
        targetQuantity: 10,
      }),
    });
    expect(p1.status).toBe(201);
    scId1 = (await p1.json()).id;

    const p2 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId1,
        scNumber: `SC002`,
        productName: 'Widget B',
        targetQuantity: 20,
      }),
    });
    expect(p2.status).toBe(201);
    scId2 = (await p2.json()).id;

    const p3 = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId2,
        scNumber: `SC001`,
        productName: 'Widget C',
        targetQuantity: 15,
      }), // Same SC number, different PO
    });
    expect(p3.status).toBe(201);
    scId3 = (await p3.json()).id;

    // Verify IDs are distinct
    expect(scId1).toBeDefined();
    expect(scId2).toBeDefined();
    expect(scId3).toBeDefined();
    expect(scId1).not.toBe(scId2);
  });

  it('SC_ISOLATION_01: Completing SC001 does not affect SC002', async () => {
    // Force SC001 to IN_PRODUCTION so it can be completed
    await pgClient.query(`UPDATE sales_order_components SET status = 'IN_PRODUCTION' WHERE id = '${scId1}'`);

    const c1 = await fetch(`${BASE_URL}/sc/${scId1}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks: 'Done' }),
    });
    expect(c1.status).toBe(201);
    const completedSc1 = await c1.json();
    expect(completedSc1.status).toBe('COMPLETED');
    expect(completedSc1.completedById).toBeDefined();

    // Verify SC002 is still DRAFT
    const sc2Check = await fetch(`${BASE_URL}/sc/${scId2}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sc2Data = await sc2Check.json();
    expect(sc2Data.status).toBe('DRAFT');
  });

  it('SC_ISOLATION_02: Closing SC001 does not affect SC002', async () => {
    const cl1 = await fetch(`${BASE_URL}/sc/${scId1}/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remarks: 'Closed' }),
    });
    expect(cl1.status).toBe(201);
    const closedSc1 = await cl1.json();
    expect(closedSc1.status).toBe('CLOSED');

    // Verify SC002 is still DRAFT
    const sc2Check = await fetch(`${BASE_URL}/sc/${scId2}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sc2Data = await sc2Check.json();
    expect(sc2Data.status).toBe('DRAFT');
  });

  it('SC_VALIDATION_01: Should prevent duplicate SC numbers under the SAME PO', async () => {
    const dupRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poId: poId1,
        scNumber: `SC002`,
        productName: 'Widget D',
        targetQuantity: 1,
      }),
    });
    expect(dupRes.status).toBe(409); // ConflictException
  });

  it('SC_VALIDATION_02: Cannot close DRAFT SC', async () => {
    const clRes = await fetch(`${BASE_URL}/sc/${scId2}/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(clRes.status).toBe(400); // BadRequestException: Cannot close a DRAFT SC
  });

  it('SC_LIST_01: FindAll properly filters by PO ID', async () => {
    const res = await fetch(`${BASE_URL}/sc?poId=${poId1}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(2);
    const ids = data.map((x: any) => x.id);
    expect(ids).toContain(scId1);
    expect(ids).toContain(scId2);
    expect(ids).not.toContain(scId3); // scId3 belongs to PO2
  });
});
