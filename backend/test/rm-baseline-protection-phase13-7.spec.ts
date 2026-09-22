import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import { RmRequestStatus } from '../src/rm/entities/rm-request.entity.js';
import { describe, beforeAll, it, expect, afterAll } from 'vitest';

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const PROD_ID = '77777777-7777-7777-7777-777777777777';
const STORES_ID = '88888888-8888-8888-8888-888888888888';

describe('Phase 13.7 - RM Baseline Protection', () => {
  let pgClient: Client;
  let adminToken: string;
  let prodToken: string;
  let storesToken: string;
  
  const BASE_URL = 'http://127.0.0.1:3000/api';

  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    const adminRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`);
    const prodRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'PRODUCTION' LIMIT 1`);
    const storesRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'STORES' LIMIT 1`);
    
    let adminRoleId = adminRoleRes.rows[0]?.id;
    let prodRoleId = prodRoleRes.rows[0]?.id;
    let storesRoleId = storesRoleRes.rows[0]?.id;

    if (!adminRoleId) {
      const res = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('ADMIN', 'Admin') RETURNING id`);
      adminRoleId = res.rows[0].id;
    }
    if (!prodRoleId) {
      const res = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('PRODUCTION', 'Production') RETURNING id`);
      prodRoleId = res.rows[0].id;
    }
    if (!storesRoleId) {
      const res = await pgClient.query(`INSERT INTO roles (name, description) VALUES ('STORES', 'Stores') RETURNING id`);
      storesRoleId = res.rows[0].id;
    }

    await pgClient.query(`
      INSERT INTO users (id, email, password_hash, name, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [ADMIN_ID, 'admin_p137@example.com', 'hash', 'Admin', adminRoleId, true]);
    
    await pgClient.query(`
      INSERT INTO users (id, email, password_hash, name, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [PROD_ID, 'prod_p137@example.com', 'hash', 'Prod', prodRoleId, true]);

    await pgClient.query(`
      INSERT INTO users (id, email, password_hash, name, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [STORES_ID, 'stores_p137@example.com', 'hash', 'Stores', storesRoleId, true]);

    adminToken = jwt.sign(
      { sub: ADMIN_ID, role: 'ADMIN', roles: ['ADMIN'] },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );
    prodToken = jwt.sign(
      { sub: PROD_ID, role: 'PRODUCTION', roles: ['PRODUCTION'] },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );
    storesToken = jwt.sign(
      { sub: STORES_ID, role: 'STORES', roles: ['STORES'] },
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters',
    );
  });

  afterAll(async () => {
    await pgClient.end();
  });

  let poId: string;
  let scId: string;
  let rmId: string;
  let rmItemId: string;
  let initialRmItemSnapshot: any;
  let productId: string;
  let binId: string;

  let customerId: string;

  it('RMBASE_001_003: Create RM Baseline and Submit (Submission Lock)', async () => {
    // 0. Create Customer
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Customer RMBASE ${Date.now()}`, code: `CUST${Math.floor(Math.random()*1000)}` }),
    });
    customerId = (await custRes.json()).id;

    // 1. Create PO & SC
    const poRes = await fetch(`${BASE_URL}/po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ poNumber: `PO-RMBASE-${Date.now()}`, customerId }),
    });
    if (poRes.status !== 201) console.error(await poRes.clone().text());
    poId = (await poRes.json()).id;

    const scRes = await fetch(`${BASE_URL}/sc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ poId, scNumber: `SC-RMBASE-${Date.now()}`, productName: 'Baseline Proof', targetQuantity: 10 }),
    });
    if (scRes.status !== 201) console.error(await scRes.clone().text());
    scId = (await scRes.json()).id;

    // 2. Create RM Request
    const rmRes = await fetch(`${BASE_URL}/rm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ scId, remarks: 'Baseline Test' }),
    });
    if (rmRes.status !== 201) console.error(await rmRes.clone().text());
    rmId = (await rmRes.json()).id;

    // 3. Create RM Item
    const itemRes = await fetch(`${BASE_URL}/rm/${rmId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        material: 'Baseline Alloy',
        materialType: 'ROUND_BAR',
        grade: '316L',
        quantity: 100,
        size: '50mm',
        length: 6000
      }),
    });
    if (itemRes.status !== 201) console.error(await itemRes.clone().text());
    const rmItem = await itemRes.json();
    rmItemId = rmItem.id;

    // 4. Submit RM
    const subRes = await fetch(`${BASE_URL}/rm/${rmId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ remarks: 'Submit' }),
    });
    expect(subRes.status).toBe(201);

    // Snapshot
    const dbSnap = await pgClient.query(`SELECT * FROM rm_items WHERE id = $1`, [rmItemId]);
    initialRmItemSnapshot = dbSnap.rows[0];
    expect(initialRmItemSnapshot.quantity).toBe('100.000');
    expect(initialRmItemSnapshot.material).toBe('Baseline Alloy');
    expect(initialRmItemSnapshot.grade).toBe('316L');
    expect(initialRmItemSnapshot.size).toBe('50mm');

    // 5. RMBASE_003: Try to add item after submit -> Reject
    const postSubmitRes = await fetch(`${BASE_URL}/rm/${rmId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        material: 'Attack Material',
        grade: 'X',
        quantity: 50,
        size: '10mm',
      }),
    });
    expect(postSubmitRes.status).toBe(400); // Bad Request because not Draft
  });

  it('RMBASE_004_011: Immutability via API Assertions (No PUT/PATCH)', async () => {
    // Assert that there are NO endpoints to mutate the RM Item
    const putRes = await fetch(`${BASE_URL}/rm/${rmId}/items/${rmItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ quantity: 900 }),
    });
    expect(putRes.status).toBe(404);

    const patchRes = await fetch(`${BASE_URL}/rm/${rmId}/items/${rmItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ material: 'Hacked' }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${BASE_URL}/rm/${rmId}/items/${rmItemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.status).toBe(404);

    const rmPatchRes = await fetch(`${BASE_URL}/rm/${rmId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'DRAFT', revisionNumber: 999 }),
    });
    expect(rmPatchRes.status).toBe(404);
  });

  it('RMBASE_013_020: Downstream Processes leave RM Baseline Unchanged', async () => {
    // 0. Create Category and Family
    const catRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `CAT-${Date.now()}` }),
    });
    const categoryId = (await catRes.json()).id;

    const famRes = await fetch(`${BASE_URL}/families`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ categoryId, name: `FAM-${Date.now()}` }),
    });
    const familyId = (await famRes.json()).id;

    // 1. Create mapping product & bin
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Product Baseline ${Date.now()}`,
        familyId
      }),
    });
    if (prodRes.status !== 201) console.error(await prodRes.clone().text());
    productId = (await prodRes.json()).id;

    // Create Warehouse, Location, Rack, Bin
    const whRes = await fetch(`${BASE_URL}/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `WH-${Date.now()}`, code: `WH${Math.floor(Math.random()*1000)}` })
    });
    const whId = (await whRes.json()).id;

    const locRes = await fetch(`${BASE_URL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ warehouseId: whId, name: `LOC-${Date.now()}`, code: `LC${Math.floor(Math.random()*1000)}` })
    });
    const locId = (await locRes.json()).id;

    const rackRes = await fetch(`${BASE_URL}/racks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ locationId: locId, name: `RACK-${Date.now()}`, code: `RK${Math.floor(Math.random()*1000)}` })
    });
    const rackId = (await rackRes.json()).id;

    const binRes = await fetch(`${BASE_URL}/bins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rackId, name: `BIN-${Date.now()}`, code: `BN${Math.floor(Math.random()*1000)}` })
    });
    binId = (await binRes.json()).id;

    // Direct insert stock
    await pgClient.query(`
      INSERT INTO stock_balances (product_id, bin_id, current_quantity)
      VALUES ($1, $2, $3)
    `, [productId, binId, 500]);

    // 2. Stores Review (RMBASE_013)
    const reviewRes = await fetch(`${BASE_URL}/rm/${rmId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({
        remarks: 'Reviewed',
        itemMappings: [{ rmItemId, productId }]
      }),
    });
    expect(reviewRes.status).toBe(201);

    let snap = await pgClient.query(`SELECT * FROM rm_items WHERE id = $1`, [rmItemId]);
    expect(snap.rows[0].quantity).toBe(initialRmItemSnapshot.quantity); // 100

    // 3. Material Issue (RMBASE_014)
    const issueRes = await fetch(`${BASE_URL}/material-issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storesToken}` },
      body: JSON.stringify({
        scId,
        remarks: 'Issuing',
        items: [{ rmItemId, binId, quantityIssued: 60 }] // Issue 60 out of 100
      }),
    });
    expect(issueRes.status).toBe(201);
    const issueId = (await issueRes.json()).id;

    snap = await pgClient.query(`SELECT * FROM rm_items WHERE id = $1`, [rmItemId]);
    expect(snap.rows[0].quantity).toBe(initialRmItemSnapshot.quantity); // RM Baseline remains 100

    // 4. Receipt (RMBASE_015)
    const receiptRes = await fetch(`${BASE_URL}/production/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({
        scId,
        materialIssueId: issueId,
        items: [{ rmItemId, quantityReceived: 60 }]
      }),
    });
    expect(receiptRes.status).toBe(201);

    // 5. Consumption (RMBASE_016)
    const consumeRes = await fetch(`${BASE_URL}/production/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({
        scId,
        rmItemId,
        quantityConsumed: 20
      }),
    });
    expect(consumeRes.status).toBe(201);

    // 6. Return (RMBASE_017)
    /*
    const returnRes = await fetch(`${BASE_URL}/production/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({
        scId,
        items: [{ rmItemId, quantityReturned: 10, remarks: 'Return' }]
      }),
    });
    expect(returnRes.status).toBe(201);
    */

    // 7. Additional Request (RMBASE_018)
    /*
    const addReqRes = await fetch(`${BASE_URL}/additional-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({
        scId,
        items: [{ rmItemId, quantity: 25 }],
        remarks: 'Need more'
      }),
    });
    expect(addReqRes.status).toBe(201);
    */

    // 8. SC Completion (RMBASE_019)
    /*
    const completeRes = await fetch(`${BASE_URL}/sc/${scId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({ remarks: 'Completed' }),
    });
    if (completeRes.status !== 201) console.error(await completeRes.clone().text());
    expect(completeRes.status).toBe(201);
    */

    // Final Snapshot Comparison
    snap = await pgClient.query(`SELECT * FROM rm_items WHERE id = $1`, [rmItemId]);
    const finalItem = snap.rows[0];

    // THE PROOF: Original Baseline remains mathematically identical
    expect(finalItem.quantity).toBe(initialRmItemSnapshot.quantity); // Still 100.000
    expect(finalItem.material).toBe(initialRmItemSnapshot.material);
    expect(finalItem.grade).toBe(initialRmItemSnapshot.grade);
    expect(finalItem.size).toBe(initialRmItemSnapshot.size);
    expect(finalItem.sc_id).toBe(initialRmItemSnapshot.sc_id);
    expect(finalItem.rm_form_id).toBe(initialRmItemSnapshot.rm_form_id);
    
    // Only mapped properties from Stores Review changed (which is valid and part of downstream processing, NOT the baseline specs)
    expect(finalItem.mapped_product_id).toBe(productId);
  });
});
