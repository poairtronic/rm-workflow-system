import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://127.0.0.1:3000/api';

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const DESIGNER_ID = '66666666-6666-6666-6666-666666666666';
const STORES_ID = '88888888-8888-8888-8888-888888888888';
const PROD_ID = '77777777-7777-7777-7777-777777777777';

describe('Phase 14.5 — PO / SC Supporting Documents Certification', () => {
  let pgClient: Client;
  let adminToken: string;
  let designerToken: string;
  let storesToken: string;
  let prodToken: string;

  let customerId: string;
  let poId1: string;
  let poId2: string;
  let scId1: string;
  let scId2: string;

  let file1Id: string;
  let file2Id: string;
  let file3Id: string;
  let file4Id: string;

  beforeAll(async () => {
    pgClient = new Client(
      'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // Setup roles
    let adminRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`)).rows[0]?.id;
    if (!adminRole) {
      const ins = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('ADMIN', 'Admin') RETURNING id`);
      adminRole = ins.rows[0].id;
    }

    let designerRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'DESIGNER' LIMIT 1`)).rows[0]?.id;
    if (!designerRole) {
      const ins = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('DESIGNER', 'Designer') RETURNING id`);
      designerRole = ins.rows[0].id;
    }

    let storesRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'STORES' LIMIT 1`)).rows[0]?.id;
    if (!storesRole) {
      const ins = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('STORES', 'Stores') RETURNING id`);
      storesRole = ins.rows[0].id;
    }

    let prodRole = (await pgClient.query(`SELECT id FROM roles WHERE name = 'PRODUCTION' LIMIT 1`)).rows[0]?.id;
    if (!prodRole) {
      const ins = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('PRODUCTION', 'Production') RETURNING id`);
      prodRole = ins.rows[0].id;
    }

    // Setup users
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Admin', 'admin_p145@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [ADMIN_ID, adminRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Designer', 'designer_p145@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [DESIGNER_ID, designerRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Stores', 'stores_p145@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [STORES_ID, storesRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Prod', 'prod_p145@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [PROD_ID, prodRole],
    );

    const secret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    adminToken = jwt.sign({ sub: ADMIN_ID, email: 'admin_p145@test.com', role: 'ADMIN', roles: ['ADMIN'] }, secret, { expiresIn: '1h' });
    designerToken = jwt.sign({ sub: DESIGNER_ID, email: 'designer_p145@test.com', role: 'DESIGNER', roles: ['DESIGNER'] }, secret, { expiresIn: '1h' });
    storesToken = jwt.sign({ sub: STORES_ID, email: 'stores_p145@test.com', role: 'STORES', roles: ['STORES'] }, secret, { expiresIn: '1h' });
    prodToken = jwt.sign({ sub: PROD_ID, email: 'prod_p145@test.com', role: 'PRODUCTION', roles: ['PRODUCTION'] }, secret, { expiresIn: '1h' });

    // Upload Test Files via Phase 14.1 API
    const formData1 = new FormData();
    formData1.append('file', new Blob(['%PDF-1.4 customer po copy'], { type: 'application/pdf' }), 'customer_po_copy.pdf');
    const u1 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${storesToken}` }, body: formData1 });
    file1Id = (await u1.json()).id;

    const formData2 = new FormData();
    formData2.append('file', new Blob(['%PDF-1.4 tech spec content'], { type: 'application/pdf' }), 'commercial_ref.pdf');
    const u2 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${storesToken}` }, body: formData2 });
    file2Id = (await u2.json()).id;

    const formData3 = new FormData();
    formData3.append('file', new Blob(['%PDF-1.4 sc drawing content'], { type: 'application/pdf' }), 'sc_drawing_a.pdf');
    const u3 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${designerToken}` }, body: formData3 });
    file3Id = (await u3.json()).id;

    const formData4 = new FormData();
    formData4.append('file', new Blob(['%PDF-1.4 sc reference b'], { type: 'application/pdf' }), 'sc_reference_b.pdf');
    const u4 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${designerToken}` }, body: formData4 });
    file4Id = (await u4.json()).id;

    // Create Customer, PO1, PO2, SC1, SC2
    const runId = Math.floor(Math.random() * 1000000);
    const cRes = await pgClient.query(`INSERT INTO customers (name, code) VALUES ('Cust P145 ${runId}', 'C145_${runId}') RETURNING id`);
    customerId = cRes.rows[0].id;

    const po1Res = await pgClient.query(`INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-145-A-${runId}', $1) RETURNING id`, [customerId]);
    poId1 = po1Res.rows[0].id;

    const po2Res = await pgClient.query(`INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-145-B-${runId}', $1) RETURNING id`, [customerId]);
    poId2 = po2Res.rows[0].id;

    const sc1Res = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, target_quantity, status) VALUES ('SC-145-A-${runId}', $1, 'Prod A', 10, 'ACTIVE') RETURNING id`, [poId1]);
    scId1 = sc1Res.rows[0].id;

    const sc2Res = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, target_quantity, status) VALUES ('SC-145-B-${runId}', $1, 'Prod B', 20, 'ACTIVE') RETURNING id`, [poId2]);
    scId2 = sc2Res.rows[0].id;
  });

  afterAll(async () => {
    await pgClient.end();
  });

  /* ===================================================
     PO SUPPORTING DOCUMENTS TESTS
  =================================================== */

  it('PODOC_01: Should reject unauthenticated PO document attach', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_PO_COPY' }),
    });
    expect(res.status).toBe(401);
  });

  it('PODOC_02: Should reject PO document attach for non-existent PO', async () => {
    const fakePoId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/po/${fakePoId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_PO_COPY' }),
    });
    expect(res.status).toBe(404);
  });

  it('PODOC_03: Should reject unauthorized role for PO document attach (Designer)', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_PO_COPY' }),
    });
    expect(res.status).toBe(403);
  });

  it('PODOC_04: Should reject invalid PO document type', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'INVALID_PO_TYPE' }),
    });
    expect(res.status).toBe(400);
  });

  let poAttachment1Id = '';

  it('PODOC_05: Should attach PO document successfully as Stores', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_PO_COPY' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.fileId).toBe(file1Id);
    expect(body.context).toBe('PO');
    expect(body.recordId).toBe(poId1);
    expect(body.documentType).toBe('CUSTOMER_PO_COPY');
    poAttachment1Id = body.id;
  });

  it('PODOC_06: Should reject duplicate PO attachment', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_PO_COPY' }),
    });
    expect(res.status).toBe(409);
  });

  it('PODOC_07: Should support attaching multiple different files to one PO', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file2Id, documentType: 'COMMERCIAL_REFERENCE' }),
    });
    expect(res.status).toBe(201);
  });

  it('PODOC_08: Should list all active documents attached to PO', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      headers: { Authorization: `Bearer ${designerToken}` }, // Designer can read
    });
    expect(res.status).toBe(200);
    const docs = await res.json();
    expect(docs).toBeInstanceOf(Array);
    expect(docs.length).toBeGreaterThanOrEqual(2);
    expect(docs[0].file).toBeDefined();
  });

  it('PODOC_09: Should retrieve authorized download URL for PO document', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents/${poAttachment1Id}/download`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
  });

  it('PODOC_10: Should detach PO document successfully as Stores', async () => {
    const res = await fetch(`${BASE_URL}/po/${poId1}/documents/${poAttachment1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    expect(res.status).toBe(200);

    const listRes = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const docs = await listRes.json();
    expect(docs.find((d: any) => d.id === poAttachment1Id)).toBeUndefined();
  });

  /* ===================================================
     SC SUPPORTING DOCUMENTS TESTS
  =================================================== */

  it('SCDOC_01: Should reject unauthenticated SC document attach', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file3Id, documentType: 'SC_DRAWING' }),
    });
    expect(res.status).toBe(401);
  });

  it('SCDOC_02: Should reject SC document attach for non-existent SC', async () => {
    const fakeScId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/sc/${fakeScId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'SC_DRAWING' }),
    });
    expect(res.status).toBe(404);
  });

  it('SCDOC_03: Should reject invalid SC document type', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'INVALID_SC_TYPE' }),
    });
    expect(res.status).toBe(400);
  });

  let scAttachment1Id = '';

  it('SCDOC_04: Should attach SC supporting document successfully as Designer', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'SC_DRAWING' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.fileId).toBe(file3Id);
    expect(body.context).toBe('SC');
    expect(body.recordId).toBe(scId1);
    expect(body.documentType).toBe('SC_DRAWING');
    scAttachment1Id = body.id;
  });

  it('SCDOC_05: Should reject duplicate SC attachment', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'SC_DRAWING' }),
    });
    expect(res.status).toBe(409);
  });

  it('SCDOC_06: Should support attaching multiple different files to one SC', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file4Id, documentType: 'CUSTOMER_REFERENCE' }),
    });
    expect(res.status).toBe(201);
  });

  it('SCDOC_07: CROSS-SC ISOLATION (SC-A documents MUST NOT appear in SC-B)', async () => {
    // Attach file4Id to SC2 as well
    const attach2 = await fetch(`${BASE_URL}/sc/${scId2}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file4Id, documentType: 'TECHNICAL_REFERENCE' }),
    });
    expect(attach2.status).toBe(201);
    const sc2AttachId = (await attach2.json()).id;

    // List SC1 documents
    const list1Res = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    const docs1 = await list1Res.json();
    expect(docs1.find((d: any) => d.id === sc2AttachId)).toBeUndefined();

    // Try to detach SC2 document using SC1 route param -> Reject 404
    const idorDetach = await fetch(`${BASE_URL}/sc/${scId1}/documents/${sc2AttachId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    expect(idorDetach.status).toBe(404);
  });

  it('SCDOC_08: ISOLATION BETWEEN SC SUPPORTING DOCUMENTS AND PRODUCTION DOCUMENTS', async () => {
    // Attach file1Id as PRODUCTION document to SC1
    const prodAttach = await fetch(`${BASE_URL}/sc/${scId1}/production-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'MACHINING_INSTRUCTION' }),
    });
    expect(prodAttach.status).toBe(201);
    const prodAttachId = (await prodAttach.json()).id;

    // List SC supporting documents for SC1 -> MUST NOT contain prodAttachId
    const scDocsRes = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    const scDocs = await scDocsRes.json();
    expect(scDocs.find((d: any) => d.id === prodAttachId)).toBeUndefined();

    // List Production documents for SC1 -> MUST NOT contain scAttachment1Id
    const prodDocsRes = await fetch(`${BASE_URL}/sc/${scId1}/production-documents`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    const prodDocs = await prodDocsRes.json();
    expect(prodDocs.find((d: any) => d.id === scAttachment1Id)).toBeUndefined();
  });

  it('SCDOC_09: Should retrieve authorized download URL for SC document', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents/${scAttachment1Id}/download`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
  });

  it('SCDOC_10: Should detach SC supporting document successfully', async () => {
    const res = await fetch(`${BASE_URL}/sc/${scId1}/documents/${scAttachment1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    expect(res.status).toBe(200);
  });

  /* ===================================================
     CONCURRENCY & IMMUTABILITY SNAPSHOT TESTS
  =================================================== */

  it('CONC_01: Concurrent PO attachment deduplication', async () => {
    const p1 = fetch(`${BASE_URL}/po/${poId2}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'PO_DRAWING' }),
    });
    const p2 = fetch(`${BASE_URL}/po/${poId2}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'PO_DRAWING' }),
    });

    const results = await Promise.all([p1, p2]);
    const statuses = results.map(r => r.status);
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });

  it('CONC_02: Concurrent SC attachment deduplication', async () => {
    const p1 = fetch(`${BASE_URL}/sc/${scId2}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file2Id, documentType: 'SC_SUPPORTING_REFERENCE' }),
    });
    const p2 = fetch(`${BASE_URL}/sc/${scId2}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file2Id, documentType: 'SC_SUPPORTING_REFERENCE' }),
    });

    const results = await Promise.all([p1, p2]);
    const statuses = results.map(r => r.status);
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });

  it('MANDATORY PO & SC BASELINE SNAPSHOT IMMUTABILITY TEST', async () => {
    // Capture PO1 & SC1 baseline before
    const poBefore = await pgClient.query(`SELECT id, po_number, customer_id FROM purchase_orders WHERE id = $1`, [poId1]);
    const scBefore = await pgClient.query(`SELECT id, sc_number, po_id, product_name, target_quantity, status FROM sales_order_components WHERE id = $1`, [scId1]);

    const poSnapBefore = poBefore.rows[0];
    const scSnapBefore = scBefore.rows[0];

    // Perform operations
    const poAttach = await fetch(`${BASE_URL}/po/${poId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'PO_SUPPORTING_REFERENCE' }),
    });
    const poAttId = (await poAttach.json()).id;

    const scAttach = await fetch(`${BASE_URL}/sc/${scId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'SC_SUPPORTING_REFERENCE' }),
    });
    const scAttId = (await scAttach.json()).id;

    // Detach
    await fetch(`${BASE_URL}/po/${poId1}/documents/${poAttId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${storesToken}` } });
    await fetch(`${BASE_URL}/sc/${scId1}/documents/${scAttId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${designerToken}` } });

    // Capture PO1 & SC1 baseline after
    const poAfter = await pgClient.query(`SELECT id, po_number, customer_id FROM purchase_orders WHERE id = $1`, [poId1]);
    const scAfter = await pgClient.query(`SELECT id, sc_number, po_id, product_name, target_quantity, status FROM sales_order_components WHERE id = $1`, [scId1]);

    const poSnapAfter = poAfter.rows[0];
    const scSnapAfter = scAfter.rows[0];

    expect(poSnapAfter.po_number).toBe(poSnapBefore.po_number);
    expect(poSnapAfter.customer_id).toBe(poSnapBefore.customer_id);

    expect(scSnapAfter.sc_number).toBe(scSnapBefore.sc_number);
    expect(scSnapAfter.po_id).toBe(scSnapBefore.po_id);
    expect(scSnapAfter.product_name).toBe(scSnapBefore.product_name);
    expect(scSnapAfter.target_quantity).toBe(scSnapBefore.target_quantity);
    expect(scSnapAfter.status).toBe(scSnapBefore.status);
  });
});
