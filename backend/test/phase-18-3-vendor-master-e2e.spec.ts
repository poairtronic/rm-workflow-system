import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.3 — Vendor Master HTTP API (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `vend_e2e_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let storesUserId: string;
  let storesToken: string;
  let designerUserId: string;
  let designerToken: string;

  const createdVendorIds: string[] = [];

  beforeAll(async () => {
    // 1. Direct PG Client for seeding test users and cleaning up
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
  });

  afterAll(async () => {
    try {
      if (createdVendorIds.length > 0) {
        await pgClient.query(`DELETE FROM vendors WHERE id = ANY($1)`, [createdVendorIds]);
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
  // AUTHENTICATION & RBAC ENFORCEMENT
  // =========================================================================
  it('E2E-VEND-001: POST /api/vendors requires JWT authentication (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendors')
      .send({
        code: `${TEST_PREFIX}_V1`,
        name: 'Unauthenticated Vendor',
      });

    expect(res.status).toBe(401);
  });

  it('E2E-VEND-002: POST /api/vendors denies DESIGNER role (403 Forbidden)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendors')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({
        code: `${TEST_PREFIX}_V1`,
        name: 'Unauthorized Vendor Attempt',
      });

    expect(res.status).toBe(403);
  });

  // =========================================================================
  // CRUD OPERATIONS & BUSINESS RULES
  // =========================================================================
  let createdVendorId: string;
  const testCode = `${TEST_PREFIX}_V01`;

  it('E2E-VEND-003: POST /api/vendors creates a new vendor successfully with STORES role (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendors')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        code: testCode,
        name: 'Apex Heat Treatment Ltd.',
        category: 'HEAT_TREATMENT',
        contactPerson: 'Vikram Sharma',
        email: 'vikram@apexheat.com',
        phone: '+91 9876543210',
        address: 'Plot 45, GIDC Industrial Estate',
        notes: 'ISO 9001 certified',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toBe(testCode);
    expect(res.body.name).toBe('Apex Heat Treatment Ltd.');
    expect(res.body.isActive).toBe(true);

    createdVendorId = res.body.id;
    createdVendorIds.push(createdVendorId);
  });

  it('E2E-VEND-004: POST /api/vendors rejects duplicate vendor code (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendors')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        code: testCode,
        name: 'Duplicate Vendor Code',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already registered');
  });

  it('E2E-VEND-005: POST /api/vendors validates email format and required fields (400 Bad Request)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendors')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        code: `${TEST_PREFIX}_V_INV`,
        name: 'Invalid Email Vendor',
        email: 'invalid-email-address',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeInstanceOf(Array);
  });

  it('E2E-VEND-006: GET /api/vendors allows authenticated read including DESIGNER (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/vendors')
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((v: any) => v.id === createdVendorId);
    expect(found).toBeDefined();
    expect(found.code).toBe(testCode);
  });

  it('E2E-VEND-007: GET /api/vendors filters by category and search keyword (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors?category=HEAT_TREATMENT&search=Vikram`)
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((v: any) => v.id === createdVendorId);
    expect(found).toBeDefined();
  });

  it('E2E-VEND-008: GET /api/vendors/:id returns the single vendor (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/vendors/${createdVendorId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdVendorId);
    expect(res.body.name).toBe('Apex Heat Treatment Ltd.');
  });

  it('E2E-VEND-009: PATCH /api/vendors/:id updates vendor details (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/vendors/${createdVendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Apex Thermal & Hardening Solutions Ltd.',
        phone: '+91 9999888877',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Apex Thermal & Hardening Solutions Ltd.');
    expect(res.body.phone).toBe('+91 9999888877');
  });

  it('E2E-VEND-010: PATCH /api/vendors/:id/toggle-active toggles is_active (200)', async () => {
    // 1. Toggle to false
    const res1 = await request(app.getHttpServer())
      .patch(`/api/vendors/${createdVendorId}/toggle-active`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.isActive).toBe(false);

    // 2. Toggle back to true
    const res2 = await request(app.getHttpServer())
      .patch(`/api/vendors/${createdVendorId}/toggle-active`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.isActive).toBe(true);
  });

  it('E2E-VEND-011: DELETE /api/vendors/:id deactivates vendor (200)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/vendors/${createdVendorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is now inactive
    const checkRes = await request(app.getHttpServer())
      .get(`/api/vendors/${createdVendorId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.isActive).toBe(false);
  });
});

