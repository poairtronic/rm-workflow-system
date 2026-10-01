import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.4 — Vendor Process Capability HTTP API (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `vpc_e2e_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let storesUserId: string;
  let storesToken: string;
  let designerUserId: string;
  let designerToken: string;

  let testVendorId: string;
  let vendorCapableProcId: string; // allows_outside_vendor: true
  let internalOnlyProcId: string;  // allows_outside_vendor: false

  const createdVendorIds: string[] = [];
  const createdProcessIds: string[] = [];

  beforeAll(async () => {
    // 1. Direct PG Client
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();

    // 2. Fetch or create Roles
    const getRoleId = async (roleName: string) => {
      let res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      if (!res.rows.length) {
        await pgClient.query(`INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [roleName]);
        res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      }
      return res.rows[0].id;
    };

    const adminRoleId = await getRoleId('ADMIN');
    const storesRoleId = await getRoleId('STORES');
    const designerRoleId = await getRoleId('DESIGNER');

    // 3. Create Users
    const createUser = async (name: string, email: string, roleId: string) => {
      const res = await pgClient.query(
        `INSERT INTO users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, 'hash', $3, true) RETURNING id`,
        [name, email, roleId],
      );
      return res.rows[0].id;
    };

    adminUserId = await createUser(`Admin ${TEST_PREFIX}`, `${TEST_PREFIX}_admin@example.com`, adminRoleId);
    storesUserId = await createUser(`Stores ${TEST_PREFIX}`, `${TEST_PREFIX}_stores@example.com`, storesRoleId);
    designerUserId = await createUser(`Designer ${TEST_PREFIX}`, `${TEST_PREFIX}_des@example.com`, designerRoleId);

    const jwtSecret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    adminToken = jwt.sign(
      { sub: adminUserId, email: `${TEST_PREFIX}_admin@example.com`, role: UserRole.ADMIN, roles: [UserRole.ADMIN] },
      jwtSecret,
      { expiresIn: '1h' },
    );
    storesToken = jwt.sign(
      { sub: storesUserId, email: `${TEST_PREFIX}_stores@example.com`, role: UserRole.STORES, roles: [UserRole.STORES] },
      jwtSecret,
      { expiresIn: '1h' },
    );
    designerToken = jwt.sign(
      { sub: designerUserId, email: `${TEST_PREFIX}_des@example.com`, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] },
      jwtSecret,
      { expiresIn: '1h' },
    );

    // 4. Initialize Nest Application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // 5. Seed Test Vendor
    const vendRes = await pgClient.query(
      `INSERT INTO vendors (code, name, category, is_active)
       VALUES ($1, $2, 'HEAT_TREATMENT', true) RETURNING id`,
      [`${TEST_PREFIX}_V1`, 'Apex Thermal Tech'],
    );
    testVendorId = vendRes.rows[0].id;
    createdVendorIds.push(testVendorId);

    // 6. Seed Test Production Processes (one allowing outside vendor, one internal only)
    const baseSeq = 94000 + Math.floor(Math.random() * 5000);
    const proc1Res = await pgClient.query(
      `INSERT INTO production_processes (code, name, sequence_number, is_active, allows_outside_vendor)
       VALUES ($1, $2, $3, true, true) RETURNING id`,
      [`${TEST_PREFIX}_HT`, 'Heat Treatment', baseSeq],
    );
    vendorCapableProcId = proc1Res.rows[0].id;
    createdProcessIds.push(vendorCapableProcId);

    const proc2Res = await pgClient.query(
      `INSERT INTO production_processes (code, name, sequence_number, is_active, allows_outside_vendor)
       VALUES ($1, $2, $3, true, false) RETURNING id`,
      [`${TEST_PREFIX}_CNC`, 'CNC Turning Internal', baseSeq + 1],
    );
    internalOnlyProcId = proc2Res.rows[0].id;
    createdProcessIds.push(internalOnlyProcId);
  });

  afterAll(async () => {
    try {
      if (createdVendorIds.length > 0) {
        await pgClient.query(`DELETE FROM vendors WHERE id = ANY($1)`, [createdVendorIds]);
      }
      if (createdProcessIds.length > 0) {
        await pgClient.query(`DELETE FROM production_processes WHERE id = ANY($1)`, [createdProcessIds]);
      }
      await pgClient.query(`DELETE FROM users WHERE email LIKE $1`, [`${TEST_PREFIX}%`]);
      await pgClient.end();
    } catch {
      // Ignore cleanup error
    }
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // RBAC & SECURITY
  // =========================================================================
  it('E2E-VPC-001: POST /api/vendors/:id/capabilities requires JWT authentication (401)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/capabilities`)
      .send({ processId: vendorCapableProcId });

    expect(res.status).toBe(401);
  });

  it('E2E-VPC-002: POST /api/vendors/:id/capabilities denies DESIGNER role (403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/capabilities`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ processId: vendorCapableProcId });

    expect(res.status).toBe(403);
  });

  // =========================================================================
  // ASSIGNMENT & BUSINESS RULES
  // =========================================================================
  it('E2E-VPC-003: POST /api/vendors/:id/capabilities assigns capability with STORES role (201)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/capabilities`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        processId: vendorCapableProcId,
        isApproved: true,
        leadTimeDays: 4,
        notes: 'Pre-qualified vendor',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.vendorId).toBe(testVendorId);
    expect(res.body.processId).toBe(vendorCapableProcId);
    expect(res.body.leadTimeDays).toBe(4);
    expect(res.body.isApproved).toBe(true);
  });

  it('E2E-VPC-004: POST /api/vendors/:id/capabilities rejects duplicate assignment (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/capabilities`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        processId: vendorCapableProcId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already assigned capability');
  });

  it('E2E-VPC-005: POST /api/vendors/:id/capabilities rejects process that forbids outside vendor (400)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/capabilities`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        processId: internalOnlyProcId,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('not configured to permit outside-vendor');
  });

  // =========================================================================
  // RETRIEVAL & VALIDATION (DC TYPE 1 FOUNDATION)
  // =========================================================================
  it('E2E-VPC-006: GET /api/vendors/:id/capabilities returns all capabilities for vendor (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/capabilities`)
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].process.id).toBe(vendorCapableProcId);
  });

  it('E2E-VPC-007: GET /api/vendors/capabilities/by-process/:processId returns vendors certified for process (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/capabilities/by-process/${vendorCapableProcId}`)
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((c: any) => c.vendorId === testVendorId);
    expect(found).toBeDefined();
    expect(found.vendor.name).toBe('Apex Thermal Tech');
  });

  it('E2E-VPC-008: GET /api/vendors/:id/capabilities/:processId/validate validates approved mapping (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/capabilities/${vendorCapableProcId}/validate`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.vendor.id).toBe(testVendorId);
    expect(res.body.process.id).toBe(vendorCapableProcId);
  });

  it('E2E-VPC-009: PATCH /api/vendors/:id/capabilities/:processId updates lead time and notes (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/vendors/${testVendorId}/capabilities/${vendorCapableProcId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadTimeDays: 7,
        notes: 'Lead time extended due to peak season',
      });

    expect(res.status).toBe(200);
    expect(res.body.leadTimeDays).toBe(7);
    expect(res.body.notes).toBe('Lead time extended due to peak season');
  });

  it('E2E-VPC-010: DELETE /api/vendors/:id/capabilities/:processId removes capability mapping (200)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/vendors/${testVendorId}/capabilities/${vendorCapableProcId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is no longer valid
    const checkRes = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/capabilities/${vendorCapableProcId}/validate`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.isValid).toBe(false);
    expect(checkRes.body.reason).toContain('not certified or assigned');
  });
});
