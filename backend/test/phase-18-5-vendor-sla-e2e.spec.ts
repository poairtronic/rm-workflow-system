import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.5 — Vendor SLA Foundation HTTP API (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `sla_e2e_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let storesUserId: string;
  let storesToken: string;
  let designerUserId: string;
  let designerToken: string;

  let testVendorId: string;
  let testProcessId: string;
  let createdSlaId: string;

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

    // 6. Seed Test Production Process with dynamic sequence number
    const baseSeq = 96000 + Math.floor(Math.random() * 2000);
    const procRes = await pgClient.query(
      `INSERT INTO production_processes (code, name, sequence_number, is_active, allows_outside_vendor)
       VALUES ($1, $2, $3, true, true) RETURNING id`,
      [`${TEST_PREFIX}_HT`, 'Heat Treatment', baseSeq],
    );
    testProcessId = procRes.rows[0].id;
    createdProcessIds.push(testProcessId);
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
  it('E2E-SLA-001: POST /api/vendors/:id/slas requires JWT authentication (401)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/slas`)
      .send({
        processId: testProcessId,
        slaDays: 5,
        effectiveDate: '2026-10-01T00:00:00Z',
      });

    expect(res.status).toBe(401);
  });

  it('E2E-SLA-002: POST /api/vendors/:id/slas denies DESIGNER role (403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/slas`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({
        processId: testProcessId,
        slaDays: 5,
        effectiveDate: '2026-10-01T00:00:00Z',
      });

    expect(res.status).toBe(403);
  });

  // =========================================================================
  // SLA CREATION & CONSTRAINTS
  // =========================================================================
  it('E2E-SLA-003: POST /api/vendors/:id/slas creates SLA agreement with STORES role (201)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/slas`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        processId: testProcessId,
        slaDays: 5,
        effectiveDate: '2026-10-01T00:00:00Z',
        notes: 'Agreed 5 business days for vacuum hardening',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.vendorId).toBe(testVendorId);
    expect(res.body.processId).toBe(testProcessId);
    expect(res.body.slaDays).toBe(5);
    expect(res.body.isActive).toBe(true);

    createdSlaId = res.body.id;
  });

  it('E2E-SLA-004: POST /api/vendors/:id/slas rejects duplicate SLA agreement (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/slas`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        processId: testProcessId,
        slaDays: 6,
        effectiveDate: '2026-10-01T00:00:00Z',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already exists');
  });

  it('E2E-SLA-005: POST /api/vendors/:id/slas validates input constraints (400 Bad Request)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vendors/${testVendorId}/slas`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        processId: testProcessId,
        slaDays: 0, // min 1
        effectiveDate: 'invalid-date',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeInstanceOf(Array);
  });

  // =========================================================================
  // SLA RETRIEVAL & EXPECTED RETURN CALCULATION (DC TYPE 1 FOUNDATION)
  // =========================================================================
  it('E2E-SLA-006: GET /api/vendors/:id/slas returns all SLA agreements for vendor (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/slas`)
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].slaDays).toBe(5);
  });

  it('E2E-SLA-007: GET /api/vendors/:id/slas/:processId returns active SLA agreement (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/slas/${testProcessId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.vendorId).toBe(testVendorId);
    expect(res.body.processId).toBe(testProcessId);
    expect(res.body.slaDays).toBe(5);
  });

  it('E2E-SLA-008: GET /api/vendors/:id/slas/:processId/expected-return calculates expected return date (200)', async () => {
    const dispatchStr = '2026-10-10T08:00:00.000Z';
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/slas/${testProcessId}/expected-return?dispatchDate=${encodeURIComponent(dispatchStr)}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slaDays).toBe(5);

    const expectedDate = new Date(new Date(dispatchStr).getTime() + 5 * 24 * 60 * 60 * 1000);
    expect(new Date(res.body.expectedReturnDate).toISOString()).toBe(expectedDate.toISOString());
  });

  it('E2E-SLA-009: PATCH /api/vendors/slas/:slaId updates SLA days and notes (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/vendors/slas/${createdSlaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slaDays: 7,
        notes: 'Extended SLA agreed during contract renewal',
      });

    expect(res.status).toBe(200);
    expect(res.body.slaDays).toBe(7);
    expect(res.body.notes).toBe('Extended SLA agreed during contract renewal');
  });

  it('E2E-SLA-010: DELETE /api/vendors/slas/:slaId removes SLA agreement (200)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/vendors/slas/${createdSlaId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is no longer found
    const checkRes = await request(app.getHttpServer())
      .get(`/api/vendors/${testVendorId}/slas/${testProcessId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(checkRes.status).toBe(404);
  });
});

