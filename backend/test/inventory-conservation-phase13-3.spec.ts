import { test, expect, beforeAll, describe, afterAll } from 'vitest';
import { Client } from 'pg';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000/api';
let pgClient: Client;

let adminToken: string;
let storesToken: string;

let testWarehouseId: string;
let testLocationId: string;
let binAId: string;
let binBId: string;

let product1Id: string;
let product2Id: string;

let legacyItem1Id: string;

describe('Phase 13.3 - Inventory Conservation Hardening', () => {
  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    const uRes = await pgClient.query(`SELECT id FROM users LIMIT 1`);
    const EXISTING_USER_ID = uRes.rows[0]?.id;
    const jwt = await import('jsonwebtoken');
    const secret =
      process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';

    adminToken = jwt.sign(
      { sub: EXISTING_USER_ID, userId: EXISTING_USER_ID, roles: ['ADMIN'] },
      secret,
    );

    storesToken = jwt.sign(
      { sub: EXISTING_USER_ID, userId: EXISTING_USER_ID, roles: ['STORES'] },
      secret,
    );

    // 3. Create Warehouse, Location, Rack, and Bins in DB
    testWarehouseId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO warehouses (id, code, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`, [testWarehouseId, `WH-13-3-${Date.now()}`, `Warehouse 13.3-${Date.now()}`]);

    testLocationId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO warehouse_locations (id, warehouse_id, code, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`, [testLocationId, testWarehouseId, `LOC-13-3-${Date.now()}`, `Location 13.3-${Date.now()}`]);

    const testRackId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO racks (id, location_id, code, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`, [testRackId, testLocationId, `RACK-13-3-${Date.now()}`, `Rack 13.3-${Date.now()}`]);

    binAId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO bins (id, rack_id, code, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`, [binAId, testRackId, `BIN-A-${Date.now()}`, `Bin A ${Date.now()}`]);

    binBId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO bins (id, rack_id, code, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`, [binBId, testRackId, `BIN-B-${Date.now()}`, `Bin B ${Date.now()}`]);

    // 4. Create Product Category, Family and Products in DB
    const catId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO product_categories (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`, [catId, `Test Category 13.3-${Date.now()}`]);

    const famId = crypto.randomUUID();
    await pgClient.query(`INSERT INTO product_families (id, category_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`, [famId, catId, `Test Family 13.3-${Date.now()}`]);

    product1Id = crypto.randomUUID();
    await pgClient.query(`INSERT INTO products (id, family_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`, [product1Id, famId, `Product 1 13.3-${Date.now()}`]);

    product2Id = crypto.randomUUID();
    await pgClient.query(`INSERT INTO products (id, family_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`, [product2Id, famId, `Product 2 13.3-${Date.now()}`]);

    // 5. Create Legacy Inventory Item (as bridge)
    const legRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: `LEG-13-3-${Date.now()}`,
        materialType: 'TEST',
        grade: 'A',
        size: '10x10',
        unit: 'KG',
        minimumStockLevel: 10,
      }),
    });
    const legData = await legRes.json();
    if (!legRes.ok) {
      console.error('Failed to create legacy item:', legData);
    }
    legacyItem1Id = legData.id;
    if (!legacyItem1Id) throw new Error('legacyItem1Id is undefined');

    console.log('IDs for Update:', { product1Id, binAId, legacyItem1Id });

    // Map Legacy Item to Product 1 and Bin A
    const resUpdate = await pgClient.query(`UPDATE stock_balances SET product_id = $1, bin_id = $2 WHERE inventory_item_id = $3`, [product1Id, binAId, legacyItem1Id]);
    console.log('Update Result rows affected:', resUpdate.rowCount);
  });

  afterAll(async () => {
    await pgClient.end();
  });

  test('INV_001: Opening Balance sets base correctly without double counting', async () => {
    // Legacy item initially created with 0 opening balance.
    // Let's update it to have 100 opening balance to test.
    await pgClient.query(`UPDATE stock_balances SET opening_balance = 100, current_quantity = 100 WHERE inventory_item_id = $1`, [legacyItem1Id]);

    const res = await fetch(`${BASE_URL}/inventory/reconciliation`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const results = await res.json();
    const recon = results.find((r: any) => r.inventoryItemId === legacyItem1Id);
    console.log('Recon object for INV_001:', recon);
    
    expect(recon).toBeDefined();
    expect(recon.openingBalance).toBe(100);
    expect(recon.currentBalance).toBe(100);
    expect(recon.expectedBalance).toBe(100);
    expect(recon.status).toBe('MATCH');
  });

  test('INV_002: Stock In correctly increments balance and generates transaction', async () => {
    const res = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 50,
        referenceType: 'PO',
        referenceId: 'PO-TEST',
        remarks: 'Test Stock In',
      }),
    });
    expect(res.status).toBe(201);
    
    const balanceRes = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const balance = await balanceRes.json();
    expect(Number(balance.currentQuantity)).toBe(150); // 100 + 50
  });

  test('INV_003: Stock Out correctly decrements balance and generates transaction', async () => {
    const res = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 20,
        referenceType: 'SCRAP',
        referenceId: 'SCRAP-123',
        remarks: 'Test Stock Out',
      }),
    });
    expect(res.status).toBe(201);

    const balanceRes = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const balance = await balanceRes.json();
    expect(Number(balance.currentQuantity)).toBe(130); // 150 - 20
  });

  test('INV_006: Adjustment IN correctly increases balance', async () => {
    const res = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/adjustment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 10,
        direction: 'INCREASE',
        referenceType: 'AUDIT',
        remarks: 'Found extra',
      }),
    });
    expect(res.status).toBe(201);

    const balanceRes = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const balance = await balanceRes.json();
    expect(Number(balance.currentQuantity)).toBe(140); // 130 + 10
  });

  test('INV_007: Adjustment OUT correctly decreases balance', async () => {
    const res = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/adjustment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 5,
        direction: 'DECREASE',
        referenceType: 'AUDIT',
        remarks: 'Missing stock',
      }),
    });
    expect(res.status).toBe(201);

    const balanceRes = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const balance = await balanceRes.json();
    expect(Number(balance.currentQuantity)).toBe(135); // 140 - 5
  });

  test('INV_018: Reconciliation holds true for mixed movements', async () => {
    const res = await fetch(`${BASE_URL}/inventory/reconciliation`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const results = await res.json();
    const recon = results.find((r: any) => r.inventoryItemId === legacyItem1Id);
    
    // Expected movement = IN(50) - OUT(20) + ADJ_IN(10) - ADJ_OUT(5) = +35
    expect(recon.ledgerMovement).toBe(35);
    expect(recon.expectedBalance).toBe(135); // 100 + 35
    expect(recon.currentBalance).toBe(135);
    expect(recon.status).toBe('MATCH');
  });

  test('INV_010: Negative stock protection throws 400 on over-out', async () => {
    const res = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 1000,
        referenceType: 'SCRAP',
      }),
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    console.log('INV_010 error data:', data);
    expect(data.error.message).toContain('Insufficient stock');

    const balanceRes = await fetch(`${BASE_URL}/inventory/${legacyItem1Id}/stock`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const balance = await balanceRes.json();
    expect(Number(balance.currentQuantity)).toBe(135); // Must remain unchanged
  });

  test('INV_012: Multi-product bin isolation (Product X and Product Y in Bin A)', async () => {
    // 1. We have Product 1 in Bin A (legacyItem1Id) at 135 quantity.
    // 2. We'll create another legacy item and map it to Product 2 in Bin A.
    const legRes2 = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: `LEG-13-3-Y-${Date.now()}`,
        materialType: 'TEST',
        grade: 'A',
        size: '10x10',
        unit: 'KG',
        minimumStockLevel: 10,
      }),
    });
    const legData2 = await legRes2.json();
    const legacyItem2Id = legData2.id;
    await pgClient.query(`UPDATE stock_balances SET product_id = $1, bin_id = $2, current_quantity = 50, opening_balance = 50 WHERE inventory_item_id = $3`, [product2Id, binAId, legacyItem2Id]);

    // Perform an operation on Product 2
    await fetch(`${BASE_URL}/inventory/${legacyItem2Id}/stock-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 20, referenceType: 'TEST' }),
    });

    // Check reconciliation (this calls getWorkflowReconciliation API too)
    const workflowRes = await fetch(`${BASE_URL}/inventory/reconciliation/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const workflowData = await workflowRes.json();
    console.log('INV_012 workflow data for Bin A:', workflowData.binBalances?.filter((b: any) => b.binId === binAId));
    console.log('INV_012 workflow data last 5:', workflowData.binBalances?.slice(-5));
    
    // There should be a balance entry for Prod 1 in Bin A and Prod 2 in Bin A
    const prod1BinA = workflowData.binBalances.find((b: any) => b.productId === product1Id && b.binId === binAId);
    const prod2BinA = workflowData.binBalances.find((b: any) => b.productId === product2Id && b.binId === binAId);

    expect(prod1BinA.currentQuantity).toBe(135); // Unchanged
    expect(prod1BinA.status).toBe('MATCH');

    expect(prod2BinA.currentQuantity).toBe(70); // 50 + 20
    expect(prod2BinA.status).toBe('MATCH');
  });

  test('INV_014: Concurrent outbound movements are safely serialized and do not result in negative stock', async () => {
    // Setup another item with 10 stock
    const legRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: `LEG-CONCUR-${Date.now()}`,
        materialType: 'TEST',
        grade: 'B',
        size: '1x1',
        unit: 'KG',
      }),
    });
    const itemId = (await legRes.json()).id;
    await pgClient.query(`UPDATE stock_balances SET current_quantity = 10, opening_balance = 10 WHERE inventory_item_id = $1`, [itemId]);

    // Two concurrent requests asking for 8 each. Only one should succeed.
    const req1 = fetch(`${BASE_URL}/inventory/${itemId}/stock-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 8, referenceType: 'TEST' }),
    });

    const req2 = fetch(`${BASE_URL}/inventory/${itemId}/stock-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storesToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 8, referenceType: 'TEST' }),
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    
    // One must be 201, one must be 400
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);

    // Final balance must be 2 (10 - 8)
    const balanceRes = await fetch(`${BASE_URL}/inventory/${itemId}/stock`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const balance = await balanceRes.json();
    expect(Number(balance.currentQuantity)).toBe(2);
  });
});
