import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const DESIGNER_A_ID = '66666666-6666-6666-6666-666666666666';
const DESIGNER_B_ID = '77777777-7777-7777-7777-777777777777';
const STORES_ID = '88888888-8888-8888-8888-888888888888';

describe('Phase 14 Final Security & Business-Rule Conflict Remediation', () => {
  let pgClient: Client;
  let adminToken: string;
  let designerAToken: string;
  let designerBToken: string;
  let storesToken: string;
  let invalidToken: string;
  let expiredToken: string;

  let customerId: string;
  let poAId: string;
  let poBId: string;
  let scAId: string;
  let scBId: string;
  let rmAId: string;
  let rmBId: string;

  let fileAId: string;
  let fileBId: string;
  let attachmentAId: string;

  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    const secret =
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';

    // Roles & Users Setup
    let adminRole = (
      await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`)
    ).rows[0]?.id;
    if (!adminRole) {
      adminRole = (
        await pgClient.query(
          `INSERT INTO roles (name, description) VALUES ('ADMIN', 'Admin') RETURNING id`,
        )
      ).rows[0].id;
    }

    let designerRole = (
      await pgClient.query(`SELECT id FROM roles WHERE name = 'DESIGNER' LIMIT 1`)
    ).rows[0]?.id;
    if (!designerRole) {
      designerRole = (
        await pgClient.query(
          `INSERT INTO roles (name, description) VALUES ('DESIGNER', 'Designer') RETURNING id`,
        )
      ).rows[0].id;
    }

    let storesRole = (
      await pgClient.query(`SELECT id FROM roles WHERE name = 'STORES' LIMIT 1`)
    ).rows[0]?.id;
    if (!storesRole) {
      storesRole = (
        await pgClient.query(
          `INSERT INTO roles (name, description) VALUES ('STORES', 'Stores') RETURNING id`,
        )
      ).rows[0].id;
    }

    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Admin Rem', 'admin_rem@test.com', 'pwd', $2) ON CONFLICT (id) DO NOTHING`,
      [ADMIN_ID, adminRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Designer A', 'des_a_rem@test.com', 'pwd', $2) ON CONFLICT (id) DO NOTHING`,
      [DESIGNER_A_ID, designerRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Designer B', 'des_b_rem@test.com', 'pwd', $2) ON CONFLICT (id) DO NOTHING`,
      [DESIGNER_B_ID, designerRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Stores Rem', 'stores_rem@test.com', 'pwd', $2) ON CONFLICT (id) DO NOTHING`,
      [STORES_ID, storesRole],
    );

    adminToken = jwt.sign(
      { sub: ADMIN_ID, email: 'admin_rem@test.com', role: 'ADMIN', roles: ['ADMIN'] },
      secret,
      { expiresIn: '1h' },
    );
    designerAToken = jwt.sign(
      { sub: DESIGNER_A_ID, email: 'des_a_rem@test.com', role: 'DESIGNER', roles: ['DESIGNER'] },
      secret,
      { expiresIn: '1h' },
    );
    designerBToken = jwt.sign(
      { sub: DESIGNER_B_ID, email: 'des_b_rem@test.com', role: 'DESIGNER', roles: ['DESIGNER'] },
      secret,
      { expiresIn: '1h' },
    );
    storesToken = jwt.sign(
      { sub: STORES_ID, email: 'stores_rem@test.com', role: 'STORES', roles: ['STORES'] },
      secret,
      { expiresIn: '1h' },
    );
    invalidToken = 'invalid.jwt.token';
    expiredToken = jwt.sign(
      { sub: DESIGNER_A_ID, email: 'des_a_rem@test.com', role: 'DESIGNER', roles: ['DESIGNER'] },
      secret,
      { expiresIn: '-10s' },
    );

    const runId = Date.now().toString();

    // Setup Customers, POs, SCs, RMs
    const custRes = await pgClient.query(
      `INSERT INTO customers (name, code) VALUES ('Cust Rem ${runId}', 'C-REM-${runId}') RETURNING id`,
    );
    customerId = custRes.rows[0].id;

    const poARes = await pgClient.query(
      `INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-A-${runId}', $1) RETURNING id`,
      [customerId],
    );
    poAId = poARes.rows[0].id;

    const poBRes = await pgClient.query(
      `INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-B-${runId}', $1) RETURNING id`,
      [customerId],
    );
    poBId = poBRes.rows[0].id;

    const scARes = await pgClient.query(
      `INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-A-${runId}', $1, 'Prod A', 'ACTIVE') RETURNING id`,
      [poAId],
    );
    scAId = scARes.rows[0].id;

    const scBRes = await pgClient.query(
      `INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-B-${runId}', $1, 'Prod B', 'ACTIVE') RETURNING id`,
      [poBId],
    );
    scBId = scBRes.rows[0].id;

    const rmARes = await pgClient.query(
      `INSERT INTO rm_requests (sc_id, status, form_type, created_by_id) VALUES ($1, 'DRAFT', 'SC', $2) RETURNING id`,
      [scAId, DESIGNER_A_ID],
    );
    rmAId = rmARes.rows[0].id;

    const rmBRes = await pgClient.query(
      `INSERT INTO rm_requests (sc_id, status, form_type, created_by_id) VALUES ($1, 'DRAFT', 'SC', $2) RETURNING id`,
      [scBId, DESIGNER_B_ID],
    );
    rmBId = rmBRes.rows[0].id;

    // Upload File A as Designer A
    const formA = new FormData();
    formA.append(
      'file',
      new Blob(['%PDF-1.4 file A content'], { type: 'application/pdf' }),
      'FileA_Drawing.pdf',
    );
    const upARes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerAToken}` },
      body: formA,
    });
    fileAId = (await upARes.json()).id;

    // Upload File B as Designer B
    const formB = new FormData();
    formB.append(
      'file',
      new Blob(['%PDF-1.4 file B content'], { type: 'application/pdf' }),
      'FileB_Drawing.pdf',
    );
    const upBRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerBToken}` },
      body: formB,
    });
    fileBId = (await upBRes.json()).id;

    // Attach File A to SC-A as Designer A
    const attARes = await fetch(`${BASE_URL}/sc/${scAId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${designerAToken}`,
      },
      body: JSON.stringify({ fileId: fileAId, documentType: 'SC_DRAWING' }),
    });
    const attJson = await attARes.json();
    attachmentAId = attJson.id;
  }, 30000);

  afterAll(async () => {
    await pgClient.end();
  });

  // --------------------------------------------------------------------------
  // 1. Conflict #1 Verification: AMR Approve / Reject Endpoints Disabled
  // --------------------------------------------------------------------------
  it('AMR-01: Verify POST /api/production/additional-requests/:id/approve returns 404 (Route Unavailable)', async () => {
    const res = await fetch(
      `${BASE_URL}/production/additional-requests/${scAId}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    expect([404, 405, 501]).toContain(res.status);
  });

  it('AMR-02: Verify POST /api/production/additional-requests/:id/reject returns 404 (Route Unavailable)', async () => {
    const res = await fetch(
      `${BASE_URL}/production/additional-requests/${scAId}/reject`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    expect([404, 405, 501]).toContain(res.status);
  });

  it('AMR-03: Verify valid AMR creation & retrieval remains fully functional', async () => {
    // Add item to RM-A
    const rmItemRes = await pgClient.query(
      `INSERT INTO rm_items (rm_form_id, sc_id, material, grade, size, quantity) VALUES ($1, $2, 'Steel', '304', '10mm', 50) RETURNING id`,
      [rmAId, scAId],
    );
    const rmItemId = rmItemRes.rows[0].id;

    const createRes = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${designerAToken}`,
      },
      body: JSON.stringify({
        scId: scAId,
        items: [{ rmItemId, quantity: 10 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const amr = await createRes.json();
    expect(amr.id).toBeDefined();

    const getRes = await fetch(`${BASE_URL}/additional-requests/${amr.id}`, {
      headers: { Authorization: `Bearer ${designerAToken}` },
    });
    expect(getRes.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // 2. Conflict #2 Verification: RM Item Immutability & Route Non-Existence
  // --------------------------------------------------------------------------
  it('RMITEM-01: Verify PATCH /api/rm/:id/items/:itemId returns 404 (Route Non-Existent)', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmAId}/items/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(404);
  });

  it('RMITEM-02: Verify DELETE /api/rm/:id/items/:itemId returns 404 (Route Non-Existent)', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmAId}/items/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // 3. Generic File IDOR & Record Authorization Checks
  // --------------------------------------------------------------------------
  describe('IDOR & Boundary Checks', () => {
    it('IDOR-01: Generic File IDOR — Non-owner/non-creator user cannot download unattached/unauthorized file', async () => {
      // Upload unattached file as Designer A
      const form = new FormData();
      form.append(
        'file',
        new Blob(['%PDF-1.4 private file'], { type: 'application/pdf' }),
        'PrivateA.pdf',
      );
      const upRes = await fetch(`${BASE_URL}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${designerAToken}` },
        body: form,
      });
      const privateFileId = (await upRes.json()).id;

      // Designer B attempts to download Designer A's unattached file
      const dlRes = await fetch(`${BASE_URL}/files/${privateFileId}/download`, {
        headers: { Authorization: `Bearer ${designerBToken}` },
      });
      expect(dlRes.status).toBe(403);
    });

    it('IDOR-02: Attachment IDOR — Cannot access attachment on wrong parent SC route', async () => {
      // Attachment A belongs to SC-A. Requesting via SC-B route MUST return 404
      const res = await fetch(
        `${BASE_URL}/sc/${scBId}/documents/${attachmentAId}/download`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      expect(res.status).toBe(404);
    });

    it('IDOR-03: Wrong Parent ID on PO Documents route', async () => {
      const res = await fetch(
        `${BASE_URL}/po/${poBId}/documents/${attachmentAId}/download`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      expect(res.status).toBe(404);
    });

    it('IDOR-04: Wrong Parent ID on RM Documents route', async () => {
      const res = await fetch(
        `${BASE_URL}/rm/${rmBId}/documents/${attachmentAId}/download`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // 4. JWT & Security Verification
  // --------------------------------------------------------------------------
  describe('Authentication & Dev Security', () => {
    it('SEC-01: Invalid JWT token rejected with 401', async () => {
      const res = await fetch(`${BASE_URL}/files/${fileAId}`, {
        headers: { Authorization: `Bearer ${invalidToken}` },
      });
      expect(res.status).toBe(401);
    });

    it('SEC-02: Expired JWT token rejected with 401', async () => {
      const res = await fetch(`${BASE_URL}/files/${fileAId}`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(401);
    });

    it('SEC-03: Dev-Token Endpoint is strictly disabled in production (403)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { AuthController } = await import('../src/auth/auth.controller.js');
      const authController = new AuthController({} as any);
      
      try {
        authController.getDevToken({ role: 'ADMIN' as any });
        expect.fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        const statusCode = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        expect(statusCode).toBe(403);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('SEC-04: Direct Inventory Transaction endpoint is disabled by design (501)', async () => {
      const { InventoryController } = await import('../src/inventory/inventory.controller.js');
      const controller = new InventoryController({} as any);
      
      try {
        controller.addTransaction('00000000-0000-0000-0000-000000000000', {} as any, {} as any);
        expect.fail('Should have thrown NotImplementedException');
      } catch (err: any) {
        const statusCode = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        expect(statusCode).toBe(501);
      }

      // Also verify HTTP route returns 501 when real inventory ID is present
      const invRes = await pgClient.query('SELECT id FROM inventory_items LIMIT 1');
      if (invRes.rows.length > 0) {
        const invId = invRes.rows[0].id;
        const res = await fetch(
          `${BASE_URL}/inventory/${invId}/transactions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              transactionType: 'STOCK_IN',
              quantity: 10,
              referenceType: 'MANUAL_TEST',
            }),
          },
        );
        expect(res.status).toBe(501);
      }
    });
  });
});
