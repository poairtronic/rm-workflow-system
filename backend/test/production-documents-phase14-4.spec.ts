import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let pgClient: Client;
const ADMIN_ID = '77777777-7777-7777-7777-777777777777';

let testFile1Id = '';
let testFile2Id = '';
let testPoId = '';
let testScId = '';
let testSc2Id = '';

describe('Phase 14.4 - Production Documents', () => {
  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // 1. Setup Admin user
    let adminRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`)).rows[0]?.id;
    if (!adminRole) {
      await pgClient.query(`INSERT INTO roles (name) VALUES ('ADMIN') ON CONFLICT (name) DO NOTHING`);
      adminRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`)).rows[0]?.id;
    }
    await pgClient.query(`INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Admin2', 'admin2@attach.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`, [ADMIN_ID, adminRole]);
    adminToken = jwt.sign({ sub: ADMIN_ID, email: 'admin2@attach.com', role: 'ADMIN', roles: ['ADMIN'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters', { expiresIn: '1h' });

    // 2. Setup Files
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-1.4 pdf data 1'], { type: 'application/pdf' }), 'test1.pdf');
    let res = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: formData });
    let upload = await res.json();
    testFile1Id = upload.id;

    const formData2 = new FormData();
    formData2.append('file', new Blob(['%PDF-1.4 pdf data 2'], { type: 'application/pdf' }), 'test2.pdf');
    res = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: formData2 });
    upload = await res.json();
    testFile2Id = upload.id;

    // 3. Setup SC
    const runId = Math.floor(Math.random() * 1000000);
    const customerRes = await pgClient.query(`INSERT INTO customers (name, code) VALUES ('Test Customer ${runId}', 'TC${runId}') RETURNING id`);
    const customerId = customerRes.rows[0].id;
    const poRes = await pgClient.query(`INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-PRODDOC-${runId}', $1) RETURNING id`, [customerId]);
    testPoId = poRes.rows[0].id;

    const scRes = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-PRODDOC-${runId}', $1, 'Prod', 'IN_PRODUCTION') RETURNING id`, [testPoId]);
    testScId = scRes.rows[0].id;

    const scRes2 = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-PRODDOC-2-${runId}', $1, 'Prod', 'IN_PRODUCTION') RETURNING id`, [testPoId]);
    testSc2Id = scRes2.rows[0].id;

    const catRes = await pgClient.query(`INSERT INTO product_categories (name) VALUES ('Cat ${runId}') RETURNING id`);
    const prodFamRes = await pgClient.query(`INSERT INTO product_families (name, category_id) VALUES ('Fam ${runId}', $1) RETURNING id`, [catRes.rows[0].id]);
    const prodRes = await pgClient.query(`INSERT INTO products (name, family_id) VALUES ('Prod ${runId}', $1) RETURNING id`, [prodFamRes.rows[0].id]);
    const prodId = prodRes.rows[0].id;

    // Add an RM Item to SC so accounting gets initialized
    const formRes = await pgClient.query(`INSERT INTO rm_requests (po_id, status, created_by_id) VALUES ($1, 'SUBMITTED', $2) RETURNING id`, [testPoId, ADMIN_ID]);
    const rmRes = await pgClient.query(`INSERT INTO rm_items (rm_form_id, sc_id, material, grade, size, quantity) VALUES ($1, $2, 'Steel', 'A', '10', 100) RETURNING id`, [formRes.rows[0].id, testScId]);
    const rmItemId = rmRes.rows[0].id;

    // We don't need manual transactions. Accounting should just show 0 received, 0 consumed.
  }, 30000);

  afterAll(async () => {
    await pgClient.end();
  });

  let snapshotAcc: any = null;
  let snapshotTx: number = 0;
  let snapshotBal: number = 0;
  let attachmentId = '';

  const captureBaseline = async () => {
    const accRes = await fetch(`${BASE_URL}/production/accounting/${testScId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    snapshotAcc = await accRes.json();

    const txRes = await pgClient.query(`SELECT COUNT(*) as cnt FROM stock_transactions`);
    snapshotTx = parseInt(txRes.rows[0].cnt);
    const balRes = await pgClient.query(`SELECT SUM(current_quantity) as sum FROM stock_balances`);
    snapshotBal = parseFloat(balRes.rows[0].sum || '0');
  };

  const compareBaseline = async () => {
    const accRes = await fetch(`${BASE_URL}/production/accounting/${testScId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const accData = await accRes.json();
    expect(accData).toEqual(snapshotAcc);

    const txRes = await pgClient.query(`SELECT COUNT(*) as cnt FROM stock_transactions`);
    expect(parseInt(txRes.rows[0].cnt)).toBe(snapshotTx);
    const balRes = await pgClient.query(`SELECT SUM(current_quantity) as sum FROM stock_balances`);
    expect(parseFloat(balRes.rows[0].sum || '0')).toBe(snapshotBal);
  };

  it('PRODDOC-1: Capture Accounting Baseline', async () => {
    await captureBaseline();
    expect(snapshotAcc).toBeDefined();
    expect(snapshotAcc.items.length).toBe(1);
    expect(snapshotAcc.items[0].received).toBe(0);
    expect(snapshotAcc.items[0].consumed).toBe(0);
    expect(snapshotAcc.items[0].wip).toBe(0);
  });

  it('PRODDOC-2: Attach Production Document successfully', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: testFile1Id, documentType: 'PRODUCTION_DRAWING' })
    });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.context).toBe('PRODUCTION');
    expect(data.documentType).toBe('PRODUCTION_DRAWING');
    attachmentId = data.id;

    await compareBaseline();
  });

  it('PRODDOC-3: Attach duplicate should fail (prevent duplicates)', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: testFile1Id, documentType: 'PRODUCTION_DRAWING' })
    });
    expect(res.status).toBe(409);
    await compareBaseline();
  });

  it('PRODDOC-4: List Production Documents', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].fileId).toBe(testFile1Id);
    await compareBaseline();
  });

  it('PRODDOC-5: Get a single Production Document', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testScId}/production-documents/${attachmentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe(attachmentId);
    await compareBaseline();
  });

  it('PRODDOC-6: Cross-SC IDOR blocked', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testSc2Id}/production-documents/${attachmentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(404);
  });

  it('PRODDOC-7: Arbitrary Document Type is rejected', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: testFile2Id, documentType: 'UNKNOWN_TYPE' })
    });
    expect(res.status).toBe(400); // Bad Request (Validation failed)
  });

  it('PRODDOC-8: Detach Production Document', async () => {
    const res = await fetch(`${BASE_URL}/sc/${testScId}/production-documents/${attachmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);

    const checkRes = await fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const checkData = await checkRes.json();
    expect(checkData.length).toBe(0); // Should be removed from active attachments

    await compareBaseline();
  });

  it('PRODDOC-9: Concurrency test - attach same file to same SC', async () => {
    const req1 = fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: testFile2Id, documentType: 'PRODUCTION_DRAWING' })
    });
    const req2 = fetch(`${BASE_URL}/sc/${testScId}/production-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: testFile2Id, documentType: 'PRODUCTION_DRAWING' })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statusCodes = [res1.status, res2.status].sort();
    
    // One should succeed (201), the other should fail with 409 (Conflict)
    expect(statusCodes).toEqual([201, 409]);
    await compareBaseline();
  });

  it('PRODDOC-10: Download Production Document', async () => {
    const res = await fetch(`${BASE_URL}/files/${testFile2Id}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('url');
    await compareBaseline();
  });
});
