import { describe, it, expect, beforeAll } from 'vitest';
import * as jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:3000/api';
let token = '';

describe('Phase 12.1 - Customer & PO Real HTTP / RBAC / Database Verification', () => {

  beforeAll(async () => {
    const payload = {
        sub: '55555555-5555-5555-5555-555555555555',
        email: 'admin@example.com',
        role: 'ADMIN',
        roles: ['ADMIN', 'STORES', 'PRODUCTION']
    };
    token = jwt.sign(payload, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters');
  });

  it('HTTP_01: Should block unauthorized access (No Token)', async () => {
    const res = await fetch(`${BASE_URL}/customers`);
    expect(res.status).toBe(401);
  });

  it('HTTP_02: Should block invalid UUID', async () => {
    const res = await fetch(`${BASE_URL}/customers/not-a-uuid`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(400); // ParseUUIDPipe triggers 400
  });

  it('HTTP_03: Mass Assignment Protection', async () => {
    const badPayload = {
        name: 'Mass Assign',
        code: `MASS-${Date.now()}`,
        id: '11111111-1111-1111-1111-111111111111',
        isActive: false,
    };
    const res = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(badPayload)
    });
    expect(res.status).toBe(400); // ValidationPipe with forbidNonWhitelisted triggers 400 Bad Request
  });

  let customerId = '';
  const customerCode = `TEST-CUST-${Date.now()}`;

  it('CUSTOMER_001: should create a valid customer', async () => {
    const payload = {
        name: 'Test Customer LLC',
        code: customerCode,
        isActive: true
    };
    const res = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.code).toBe(customerCode);
    customerId = data.id;
  });

  it('CUSTOMER_002: should prevent duplicate customer codes (Database Constraint)', async () => {
    const payload = {
        name: 'Duplicate LLC',
        code: customerCode,
        isActive: true
    };
    const res = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    expect(res.status).toBe(409); // ConflictException
  });

  const poNumber = `PO-TEST-${Date.now()}`;

  it('PO_001: should create a PO for the customer', async () => {
    const payload = {
        poNumber: poNumber,
        customerId: customerId,
    };
    const res = await fetch(`${BASE_URL}/po`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.customerId).toBe(customerId);
  });

  it('PO_002: should enforce foreign key constraints', async () => {
    const badPayload = {
      poNumber: `PO-BAD-${Date.now()}`,
      customerId: '00000000-0000-0000-0000-000000000000', // non-existent UUID
    };
    const res = await fetch(`${BASE_URL}/po`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(badPayload)
    });
    expect(res.status).toBe(404); // NotFoundException for Customer
  });

  it('REL_001: Customer -> PO Relationship works', async () => {
    const res = await fetch(`${BASE_URL}/customers/${customerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.purchaseOrders).toBeDefined();
    expect(data.purchaseOrders.length).toBeGreaterThanOrEqual(1);
    expect(data.purchaseOrders.map((p: any) => p.poNumber)).toContain(poNumber);
  });

  it('REL_002: Multiple POs for one Customer', async () => {
    const poNumber2 = `PO-TEST2-${Date.now()}`;
    const payload = {
        poNumber: poNumber2,
        customerId: customerId,
    };
    await fetch(`${BASE_URL}/po`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const res = await fetch(`${BASE_URL}/customers/${customerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    expect(data.purchaseOrders.length).toBeGreaterThanOrEqual(2);
    expect(data.purchaseOrders.map((p: any) => p.poNumber)).toContain(poNumber);
    expect(data.purchaseOrders.map((p: any) => p.poNumber)).toContain(poNumber2);
  });
});
