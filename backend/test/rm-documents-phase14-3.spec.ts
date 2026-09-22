import 'dotenv/config';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

const BASE_URL = 'http://127.0.0.1:3000/api';

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const DESIGNER_ID = '66666666-6666-6666-6666-666666666666';
const STORES_ID = '88888888-8888-8888-8888-888888888888';
const PROD_ID = '77777777-7777-7777-7777-777777777777';

describe('Phase 14.3 — RM Documents Certification', () => {
  let pgClient: Client;
  let adminToken: string;
  let designerToken: string;
  let storesToken: string;
  let prodToken: string;

  let customerId: string;
  let poId: string;
  let scId1: string;
  let scId2: string;
  let rmId1: string;
  let rmId2: string;
  let rmItemId1: string;

  let file1Id: string;
  let file2Id: string;
  let file3Id: string;

  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL ||
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
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Admin', 'admin_p143@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [ADMIN_ID, adminRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Designer', 'designer_p143@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [DESIGNER_ID, designerRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Stores', 'stores_p143@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [STORES_ID, storesRole],
    );
    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, 'Prod', 'prod_p143@test.com', 'hash', $2) ON CONFLICT (id) DO NOTHING`,
      [PROD_ID, prodRole],
    );

    const secret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    adminToken = jwt.sign({ sub: ADMIN_ID, email: 'admin_p143@test.com', role: 'ADMIN', roles: ['ADMIN'] }, secret, { expiresIn: '1h' });
    designerToken = jwt.sign({ sub: DESIGNER_ID, email: 'designer_p143@test.com', role: 'DESIGNER', roles: ['DESIGNER'] }, secret, { expiresIn: '1h' });
    storesToken = jwt.sign({ sub: STORES_ID, email: 'stores_p143@test.com', role: 'STORES', roles: ['STORES'] }, secret, { expiresIn: '1h' });
    prodToken = jwt.sign({ sub: PROD_ID, email: 'prod_p143@test.com', role: 'PRODUCTION', roles: ['PRODUCTION'] }, secret, { expiresIn: '1h' });

    // Upload Test Files via Phase 14.1 API
    const formData1 = new FormData();
    formData1.append('file', new Blob(['%PDF-1.4 customer drawing content'], { type: 'application/pdf' }), 'customer_drawing_v1.pdf');
    const u1 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${designerToken}` }, body: formData1 });
    file1Id = (await u1.json()).id;

    const formData2 = new FormData();
    formData2.append('file', new Blob(['%PDF-1.4 tech spec content'], { type: 'application/pdf' }), 'tech_spec.pdf');
    const u2 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${designerToken}` }, body: formData2 });
    file2Id = (await u2.json()).id;

    const formData3 = new FormData();
    formData3.append('file', new Blob(['%PDF-1.4 design reference content'], { type: 'application/pdf' }), 'design_ref.pdf');
    const u3 = await fetch(`${BASE_URL}/files`, { method: 'POST', headers: { Authorization: `Bearer ${designerToken}` }, body: formData3 });
    const u3Json = await u3.json();
    file3Id = u3Json.id;

    // Create Business Records (Customer, PO, SC1, SC2, RM1, RM2)
    const runId = Math.floor(Math.random() * 1000000);
    const cRes = await pgClient.query(`INSERT INTO customers (name, code) VALUES ('Cust P143 ${runId}', 'C143_${runId}') RETURNING id`);
    customerId = cRes.rows[0].id;

    const poRes = await pgClient.query(`INSERT INTO purchase_orders (po_number, customer_id) VALUES ('PO-143-${runId}', $1) RETURNING id`, [customerId]);
    poId = poRes.rows[0].id;

    const sc1Res = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-143-A-${runId}', $1, 'Comp A', 'ACTIVE') RETURNING id`, [poId]);
    scId1 = sc1Res.rows[0].id;

    const sc2Res = await pgClient.query(`INSERT INTO sales_order_components (sc_number, po_id, product_name, status) VALUES ('SC-143-B-${runId}', $1, 'Comp B', 'ACTIVE') RETURNING id`, [poId]);
    scId2 = sc2Res.rows[0].id;

    // Create RM Request 1 & 2 via API
    const rm1Res = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ scId: scId1, remarks: 'RM 1 for SC 1' }),
    });
    rmId1 = (await rm1Res.json()).id;

    const rm2Res = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ scId: scId2, remarks: 'RM 2 for SC 2' }),
    });
    rmId2 = (await rm2Res.json()).id;

    // Add RM Item to RM 1
    const itemRes = await fetch(`${BASE_URL}/rm/${rmId1}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        material: 'Stainless Steel 316',
        materialType: 'ROUND_BAR',
        grade: '316L',
        quantity: 100,
        size: '50mm',
        length: 6000,
      }),
    });
    rmItemId1 = (await itemRes.json()).id;
  }, 30000);

  afterAll(async () => {
    await pgClient.end();
  });

  it('RMDOC_01: Should reject unauthenticated document attach attempt', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_DRAWING' }),
    });
    expect(res.status).toBe(401);
  });

  it('RMDOC_02: Should reject document attach with non-existent RM ID', async () => {
    const fakeRmId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/rm/${fakeRmId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_DRAWING' }),
    });
    expect(res.status).toBe(404);
  });

  it('RMDOC_03: Should reject document attach with non-existent file ID', async () => {
    const fakeFileId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: fakeFileId, documentType: 'CUSTOMER_DRAWING' }),
    });
    expect(res.status).toBe(404);
  });

  it('RMDOC_04: Should reject invalid document type enum value', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'INVALID_TYPE_ATTACK' }),
    });
    expect(res.status).toBe(400); // ValidationPipe rejects invalid enum
  });

  it('RMDOC_05: Should reject unauthorized role (e.g. Stores creating document)', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_DRAWING' }),
    });
    expect(res.status).toBe(403);
  });

  let attachment1Id = '';

  it('RMDOC_06: Should attach document successfully to RM Request as Designer', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_DRAWING' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.fileId).toBe(file1Id);
    expect(body.context).toBe('RM_REQUEST');
    expect(body.recordId).toBe(rmId1);
    expect(body.documentType).toBe('CUSTOMER_DRAWING');
    attachment1Id = body.id;
  });

  it('RMDOC_07: Should reject exact duplicate document attachment', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'CUSTOMER_DRAWING' }),
    });
    expect(res.status).toBe(409); // Conflict
  });

  it('RMDOC_08: Mass Assignment protection (Client cannot inject context, recordId, or createdById)', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({
        fileId: file2Id,
        documentType: 'TECHNICAL_DRAWING',
        context: 'PO', // Attempt to hijack context
        recordId: rmId2, // Attempt to target different record
        createdById: ADMIN_ID, // Attempt to spoof uploader
      }),
    });
    // With ValidationPipe forbidNonWhitelisted, this returns 400 or strips untrusted properties
    if (res.status === 201) {
      const body = await res.json();
      expect(body.context).toBe('RM_REQUEST'); // Server controlled
      expect(body.recordId).toBe(rmId1); // Route controlled
      expect(body.createdById).toBe(DESIGNER_ID); // JWT controlled
    } else {
      expect(res.status).toBe(400);
    }
  });

  it('RMDOC_09: Should support attaching multiple different files to one RM Request', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file2Id, documentType: 'RM_SPECIFICATION' }),
    });
    expect(res.status).toBe(201);
  });

  it('RMDOC_10: Should list all active documents attached to RM Request', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      headers: { Authorization: `Bearer ${storesToken}` }, // Stores can read
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body[0].file).toBeDefined();
    expect(body[0].file.originalName).toBeDefined();
  });

  it('RMDOC_11: Should retrieve authorized download URL for attached document', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents/${attachment1Id}/download`, {
      headers: { Authorization: `Bearer ${prodToken}` }, // Prod can read
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
    expect(typeof body.url).toBe('string');
  });

  it('RMDOC_12: Cross-SC IDOR protection (Detach document of RM1 using RM2 route param)', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId2}/documents/${attachment1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    expect(res.status).toBe(404); // Not found because attachment1Id does not belong to RM2
  });

  it('RMDOC_13: Concurrency race condition duplicate prevention', async () => {
    const p1 = fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'DESIGNER_REFERENCE' }),
    });
    const p2 = fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file3Id, documentType: 'DESIGNER_REFERENCE' }),
    });

    const results = await Promise.all([p1, p2]);
    const statuses = results.map(r => r.status);
    if (!statuses.includes(201)) {
      console.log('RMDOC_13 error bodies:', await results[0].text(), await results[1].text());
    }
    expect(statuses).toContain(201);
    expect(statuses).toContain(409); // Exactly one succeeds, one gets conflict
  });

  it('RMDOC_14: Should detach document successfully as Designer', async () => {
    const res = await fetch(`${BASE_URL}/rm/${rmId1}/documents/${attachment1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    expect(res.status).toBe(200);

    // Verify it is no longer returned in list
    const resList = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      headers: { Authorization: `Bearer ${designerToken}` },
    });
    const docs = await resList.json();
    expect(docs.find((d: any) => d.id === attachment1Id)).toBeUndefined();
  });

  it('MANDATORY BASELINE SNAPSHOT IMMUTABILITY TEST (Phase 13.7 Guarantee)', async () => {
    // Step 1: Capture baseline before document operations
    const rmBefore = await pgClient.query(`SELECT id, sc_id, status, revision_number, created_by_id FROM rm_requests WHERE id = $1`, [rmId1]);
    const itemsBefore = await pgClient.query(`SELECT id, rm_form_id, sc_id, material, material_type, grade, size, quantity, length, weight_unit FROM rm_items WHERE rm_form_id = $1 ORDER BY id ASC`, [rmId1]);

    const snapshotRmBefore = rmBefore.rows[0];
    const snapshotItemsBefore = itemsBefore.rows;

    // Step 2: Attach a new document
    const attachRes = await fetch(`${BASE_URL}/rm/${rmId1}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${designerToken}` },
      body: JSON.stringify({ fileId: file1Id, documentType: 'DESIGN_DRAWING' }),
    });
    expect(attachRes.status).toBe(201);
    const newAttachId = (await attachRes.json()).id;

    // Step 3: Fetch download URL
    await fetch(`${BASE_URL}/rm/${rmId1}/documents/${newAttachId}/download`, {
      headers: { Authorization: `Bearer ${designerToken}` },
    });

    // Step 4: Detach document
    await fetch(`${BASE_URL}/rm/${rmId1}/documents/${newAttachId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${designerToken}` },
    });

    // Step 5: Read RM Request & Items after all document operations
    const rmAfter = await pgClient.query(`SELECT id, sc_id, status, revision_number, created_by_id FROM rm_requests WHERE id = $1`, [rmId1]);
    const itemsAfter = await pgClient.query(`SELECT id, rm_form_id, sc_id, material, material_type, grade, size, quantity, length, weight_unit FROM rm_items WHERE rm_form_id = $1 ORDER BY id ASC`, [rmId1]);

    const snapshotRmAfter = rmAfter.rows[0];
    const snapshotItemsAfter = itemsAfter.rows;

    // IMMUTABILITY VERIFICATIONS:
    expect(snapshotRmAfter.status).toBe(snapshotRmBefore.status);
    expect(snapshotRmAfter.revision_number).toBe(snapshotRmBefore.revision_number);
    expect(snapshotRmAfter.sc_id).toBe(snapshotRmBefore.sc_id);
    expect(snapshotRmAfter.created_by_id).toBe(snapshotRmBefore.created_by_id);

    expect(snapshotItemsAfter.length).toBe(snapshotItemsBefore.length);
    for (let i = 0; i < snapshotItemsBefore.length; i++) {
      expect(snapshotItemsAfter[i].id).toBe(snapshotItemsBefore[i].id);
      expect(snapshotItemsAfter[i].material).toBe(snapshotItemsBefore[i].material);
      expect(snapshotItemsAfter[i].grade).toBe(snapshotItemsBefore[i].grade);
      expect(snapshotItemsAfter[i].size).toBe(snapshotItemsBefore[i].size);
      expect(snapshotItemsAfter[i].quantity).toBe(snapshotItemsBefore[i].quantity);
      expect(snapshotItemsAfter[i].length).toBe(snapshotItemsBefore[i].length);
    }
  }, 30000);
});
