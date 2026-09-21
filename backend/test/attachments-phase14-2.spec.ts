import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let designerToken = '';
let pgClient: Client;

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const DESIGNER_ID = '66666666-6666-6666-6666-666666666666';

let testFileId = '';
let testPoId = '';
let testScId = '';

describe('Phase 14.2 - Attachment Association', () => {
  beforeAll(async () => {
    pgClient = new Client(
      'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    let adminRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`)).rows[0]?.id;
    if (!adminRole) {
      const insRole = await pgClient.query(`INSERT INTO roles (name) VALUES ('ADMIN') RETURNING id`);
      adminRole = insRole.rows[0].id;
    }
    
    let designerRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'DESIGNER' LIMIT 1`)).rows[0]?.id;
    if (!designerRole) {
      const insRole = await pgClient.query(`INSERT INTO roles (name) VALUES ('DESIGNER') RETURNING id`);
      designerRole = insRole.rows[0].id;
    }

    // 2. Users
    await pgClient.query(`INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Admin', 'admin@attach.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`, [ADMIN_ID, adminRole]);
    await pgClient.query(`INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Designer', 'designer@attach.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`, [DESIGNER_ID, designerRole]);

    adminToken = jwt.sign({ sub: ADMIN_ID, email: 'admin@attach.com', role: 'ADMIN', roles: ['ADMIN'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters', { expiresIn: '1h' });
    designerToken = jwt.sign({ sub: DESIGNER_ID, email: 'designer@attach.com', role: 'DESIGNER', roles: ['DESIGNER'] }, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters', { expiresIn: '1h' });

    // 3. Setup File
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-1.4 mock pdf data'], { type: 'application/pdf' }), 'test.pdf');
    const uploadRes = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: formData });
    const uploadResJson = await uploadRes.json();
    console.log('Upload response:', uploadResJson);
    testFileId = uploadResJson.id;

    // 4. Setup Customer, PO and SC
    const runId = Math.floor(Math.random() * 1000000);
    const customerRes = await pgClient.query(`INSERT INTO customers (name, code) VALUES ('Test Customer ${runId}', 'TC${runId}') RETURNING id`);
    const customerId = customerRes.rows[0].id;
    const poRes = await pgClient.query(`INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-ATTACH-${runId}', $1) RETURNING id`, [customerId]);
    testPoId = poRes.rows[0].id;

    const scRes = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-ATTACH-${runId}', $1, 'Prod', 'ACTIVE') RETURNING id`, [testPoId]);
    testScId = scRes.rows[0].id;
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('ATT-01: Should reject unauthenticated attachment', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: testFileId, context: 'PO', recordId: testPoId }),
    });
    expect(res.status).toBe(401);
  });

  it('ATT-02: Should reject non-existent file', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: '00000000-0000-0000-0000-000000000000', context: 'PO', recordId: testPoId }),
    });
    expect(res.status).toBe(404);
  });

  it('ATT-03: Should reject non-existent business record', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: testFileId, context: 'PO', recordId: '00000000-0000-0000-0000-000000000000' }),
    });
    if (res.status !== 404) {
      console.log('ATT-03 body:', await res.json());
    }
    expect(res.status).toBe(404);
  });

  it('ATT-04: Should reject context/record mismatch (e.g. context PO with SC ID)', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: testFileId, context: 'PO', recordId: testScId }),
    });
    expect(res.status).toBe(404); // Because poService.findOne(scId) throws NotFound
  });

  it('ATT-05: Should reject if role not authorized (Designer to PO)', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: testFileId, context: 'PO', recordId: testPoId }),
    });
    expect(res.status).toBe(403);
  });

  it('ATT-06: Should attach file successfully to PO', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: testFileId, context: 'PO', recordId: testPoId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.context).toBe('PO');
    expect(body.recordId).toBe(testPoId);
  });

  it('ATT-07: Should reject exact duplicate attachment', async () => {
    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: testFileId, context: 'PO', recordId: testPoId }),
    });
    expect(res.status).toBe(409); // Conflict
  });

  it('ATT-08: Should support multiple different files for one record', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-1.4 file 2'], { type: 'application/pdf' }), 'test2.pdf');
    const uploadRes = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: formData });
    const file2Id = (await uploadRes.json()).id;

    const res = await fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: file2Id, context: 'PO', recordId: testPoId }),
    });
    expect(res.status).toBe(201);
  });

  it('ATT-09: Should support retrieving attachments by context', async () => {
    const res = await fetch(`${BASE_URL}/attachments?context=PO&recordId=${testPoId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(2);
    expect(body[0].file.mimeType).toBeDefined(); // Verifies relation loading
  });

  it('ATT-10: Concurrency duplicate prevention', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-1.4 file 3'], { type: 'application/pdf' }), 'test3.pdf');
    const uploadRes = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: formData });
    const file3Id = (await uploadRes.json()).id;

    const p1 = fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: file3Id, context: 'PO', recordId: testPoId }),
    });
    const p2 = fetch(`${BASE_URL}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fileId: file3Id, context: 'PO', recordId: testPoId }),
    });

    const results = await Promise.all([p1, p2]);
    const statuses = results.map(r => r.status);
    expect(statuses).toContain(201);
    expect(statuses).toContain(409); // One succeeds, one fails
  });

  it('ATT-11: Should support detaching an attachment', async () => {
    // List attachments to get one
    const resList = await fetch(`${BASE_URL}/attachments?context=PO&recordId=${testPoId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attachments = await resList.json();
    const attachId = attachments[0].id;

    const resDel = await fetch(`${BASE_URL}/attachments/${attachId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(resDel.status).toBe(200);

    // Verify it's no longer listed
    const resList2 = await fetch(`${BASE_URL}/attachments?context=PO&recordId=${testPoId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attachments2 = await resList2.json();
    expect(attachments2.find((a: any) => a.id === attachId)).toBeUndefined();
  });
});
