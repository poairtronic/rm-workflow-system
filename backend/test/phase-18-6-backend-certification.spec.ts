import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.6 — Phase 18 Backend Testing & Certification (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `p18_cert_${Date.now()}`;
  let adminToken: string;
  let storesToken: string;
  let designerToken: string;

  const createdProcessIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdSlaIds: string[] = [];

  let proc1Id: string;
  let proc2Id: string;
  let vendorId: string;

  beforeAll(async () => {
    // 1. Direct PG Client for seeding test users and cleaning up
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
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

    const adminUserId = await createUser(`Admin ${TEST_PREFIX}`, `${TEST_PREFIX}_admin@example.com`, adminRoleId);
    const storesUserId = await createUser(`Stores ${TEST_PREFIX}`, `${TEST_PREFIX}_stores@example.com`, storesRoleId);
    const designerUserId = await createUser(`Designer ${TEST_PREFIX}`, `${TEST_PREFIX}_des@example.com`, designerRoleId);

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
      if (createdSlaIds.length > 0) {
        await pgClient.query(`DELETE FROM vendor_slas WHERE id = ANY($1)`, [createdSlaIds]);
      }
      if (createdVendorIds.length > 0) {
        await pgClient.query(`DELETE FROM vendor_process_capabilities WHERE vendor_id = ANY($1)`, [createdVendorIds]);
        await pgClient.query(`DELETE FROM vendors WHERE id = ANY($1)`, [createdVendorIds]);
      }
      if (createdProcessIds.length > 0) {
        await pgClient.query(`DELETE FROM production_processes WHERE id = ANY($1)`, [createdProcessIds]);
      }
      await pgClient.query(`DELETE FROM users WHERE email LIKE $1`, [`${TEST_PREFIX}%`]);
      await pgClient.end();
    } catch (e) {
      // Ignore cleanup error
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Production Process Master & Routing Validation', () => {
    it('E2E-CERT-001: Should create processes with ordered sequences', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/api/production-processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `${TEST_PREFIX}_CUT`,
          name: 'Cert Cutting',
          sequenceNumber: 10,
          category: 'CUTTING',
          allowsOutsideVendor: true,
        });
      expect(res1.status).toBe(201);
      proc1Id = res1.body.id;
      createdProcessIds.push(proc1Id);

      const res2 = await request(app.getHttpServer())
        .post('/api/production-processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `${TEST_PREFIX}_WELD`,
          name: 'Cert Welding',
          sequenceNumber: 20,
          category: 'ASSEMBLY',
          allowsOutsideVendor: false,
        });
      expect(res2.status).toBe(201);
      proc2Id = res2.body.id;
      createdProcessIds.push(proc2Id);
    });

    it('E2E-CERT-002: Should reject duplicate process sequence and duplicate code (409)', async () => {
      const duplicateCodeRes = await request(app.getHttpServer())
        .post('/api/production-processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `${TEST_PREFIX}_CUT`,
          name: 'Duplicate Cutting',
          sequenceNumber: 30,
        });
      expect(duplicateCodeRes.status).toBe(409);

      const duplicateSeqRes = await request(app.getHttpServer())
        .post('/api/production-processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `${TEST_PREFIX}_CNC`,
          name: 'CNC Milling',
          sequenceNumber: 10,
        });
      expect(duplicateSeqRes.status).toBe(409);
    });

    it('E2E-CERT-003: Should toggle active/inactive process status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/production-processes/${proc1Id}/toggle-active`)
        .set('Authorization', `Bearer ${storesToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      await request(app.getHttpServer())
        .patch(`/api/production-processes/${proc1Id}/toggle-active`)
        .set('Authorization', `Bearer ${storesToken}`);
    });

    it('E2E-CERT-004: Should validate sequence navigation boundaries', async () => {
      // getFirstProcess
      const firstRes = await request(app.getHttpServer())
        .get('/api/production-processes/routing/first')
        .set('Authorization', `Bearer ${designerToken}`);
      expect(firstRes.status).toBe(200);
      expect(firstRes.body).toBeDefined();

      // navigation (contains next and previous process info)
      const nav1Res = await request(app.getHttpServer())
        .get(`/api/production-processes/${proc1Id}/navigation`)
        .set('Authorization', `Bearer ${designerToken}`);
      expect(nav1Res.status).toBe(200);

      const nav2Res = await request(app.getHttpServer())
        .get(`/api/production-processes/${proc2Id}/navigation`)
        .set('Authorization', `Bearer ${designerToken}`);
      expect(nav2Res.status).toBe(200);
    });

    it('E2E-CERT-005: Should validate forward steps and transitions', async () => {
      const validateRes = await request(app.getHttpServer())
        .post(`/api/production-processes/routing/validate-transition`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ fromProcessId: proc1Id, toProcessId: proc2Id });
      
      expect(validateRes.status).toBe(201); // POST returns 201 by default in NestJS
      expect(validateRes.body.isValid).toBeDefined();
    });
  });

  describe('2. Vendor Master & Capability Mapping Validation', () => {
    it('E2E-CERT-006: Should create vendor and reject duplicate code (case-insensitive)', async () => {
      const vendorRes = await request(app.getHttpServer())
        .post('/api/vendors')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          code: `${TEST_PREFIX}_V1`,
          name: 'Cert Vendor 1',
          category: 'GENERAL',
        });
      expect(vendorRes.status).toBe(201);
      vendorId = vendorRes.body.id;
      createdVendorIds.push(vendorId);

      const duplicateRes = await request(app.getHttpServer())
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `${TEST_PREFIX}_v1`, // case insensitive check
          name: 'Duplicate Vendor',
        });
      expect(duplicateRes.status).toBe(409);
    });

    it('E2E-CERT-007: Should assign vendor process capability', async () => {
      const capRes = await request(app.getHttpServer())
        .post(`/api/vendors/${vendorId}/capabilities`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          processId: proc1Id, // this process allows outside vendor
          isApproved: true,
          leadTimeDays: 5,
        });
      expect(capRes.status).toBe(201);
      expect(capRes.body.processId).toBe(proc1Id);
    });

    it('E2E-CERT-008: Should prevent unauthorized vendor/process capability mapping', async () => {
      // process2 does not allow outside vendor
      const capRes = await request(app.getHttpServer())
        .post(`/api/vendors/${vendorId}/capabilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          processId: proc2Id,
        });
      expect(capRes.status).toBe(400); // 400 because not configured to permit outside-vendor
    });

    it('E2E-CERT-009: Should handle duplicate capability prevention', async () => {
      const capRes = await request(app.getHttpServer())
        .post(`/api/vendors/${vendorId}/capabilities`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          processId: proc1Id,
        });
      expect(capRes.status).toBe(409);
    });
  });

  describe('3. Vendor SLA Configuration', () => {
    let slaId: string;

    it('E2E-CERT-010: Should create SLA duration mapping for valid vendor-process pair', async () => {
      const slaRes = await request(app.getHttpServer())
        .post(`/api/vendors/${vendorId}/slas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          processId: proc1Id,
          slaDays: 3,
          effectiveDate: new Date().toISOString(),
          isActive: true,
        });
      
      expect(slaRes.status).toBe(201);
      slaId = slaRes.body.id;
      createdSlaIds.push(slaId);
    });

    it('E2E-CERT-011: Should retrieve active rule and calculate expected return date', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/vendors/${vendorId}/slas/${proc1Id}`)
        .set('Authorization', `Bearer ${designerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.slaDays).toBe(3);

      const dispatchDate = new Date();
      const calcRes = await request(app.getHttpServer())
        .get(`/api/vendors/${vendorId}/slas/${proc1Id}/expected-return?dispatchDate=${dispatchDate.toISOString()}`)
        .set('Authorization', `Bearer ${designerToken}`);

      expect(calcRes.status).toBe(200);
      expect(calcRes.body.slaDays).toBe(3);
      expect(new Date(calcRes.body.expectedReturnDate).getTime()).toBeGreaterThan(dispatchDate.getTime());
    });
  });

  describe('4. Security & RBAC Enforcement', () => {
    it('E2E-CERT-012: Should return 403 when non-admin/non-stores role attempts mutations', async () => {
      // Try to create process as designer
      const pRes = await request(app.getHttpServer())
        .post('/api/production-processes')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ code: `${TEST_PREFIX}_XXX`, name: 'Test', sequenceNumber: 99 });
      expect(pRes.status).toBe(403);

      // Try to assign capabilities as designer
      const cRes = await request(app.getHttpServer())
        .post(`/api/vendors/${vendorId}/capabilities`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ processId: proc1Id });
      expect(cRes.status).toBe(403);

      // Try to configure SLA as designer
      const sRes = await request(app.getHttpServer())
        .post(`/api/vendors/${vendorId}/slas`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ processId: proc1Id, slaDays: 2, effectiveDate: new Date().toISOString() });
      expect(sRes.status).toBe(403);
    });

    it('E2E-CERT-013: Should allow read endpoints for authorized factory roles', async () => {
      // Read process
      const pRes = await request(app.getHttpServer())
        .get(`/api/production-processes/${proc1Id}`)
        .set('Authorization', `Bearer ${designerToken}`);
      expect(pRes.status).toBe(200);

      // Read vendor capability
      const cRes = await request(app.getHttpServer())
        .get(`/api/vendors/${vendorId}/capabilities`)
        .set('Authorization', `Bearer ${designerToken}`);
      expect(cRes.status).toBe(200);
    });
  });
});
