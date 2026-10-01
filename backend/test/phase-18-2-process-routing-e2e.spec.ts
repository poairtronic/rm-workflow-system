import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.2 — Process Sequence Rules & Routing Engine HTTP API (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `route_e2e_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let storesToken: string;
  let designerToken: string;

  let proc1Id: string; // Seq 80001 (Cut, unskippable, non-repeatable, internal)
  let proc2Id: string; // Seq 80002 (Milling, unskippable, repeatable, internal)
  let proc3Id: string; // Seq 80003 (Deburring, skippable, non-repeatable, internal)
  let proc4Id: string; // Seq 80004 (Heat Treat, unskippable, non-repeatable, vendor allowed)
  let proc5Id: string; // Seq 80005 (QC, unskippable, non-repeatable, internal)

  const createdProcessIds: string[] = [];

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

    // 5. Seed Test Production Processes
    const createProcess = async (
      code: string,
      name: string,
      seq: number,
      skippable: boolean,
      repeatable: boolean,
      vendor: boolean,
    ) => {
      const res = await pgClient.query(
        `INSERT INTO production_processes
         (code, name, sequence_number, is_active, is_skippable, is_repeatable, allows_outside_vendor)
         VALUES ($1, $2, $3, true, $4, $5, $6) RETURNING id`,
        [`${TEST_PREFIX}_${code}`, name, seq, skippable, repeatable, vendor],
      );
      const id = res.rows[0].id;
      createdProcessIds.push(id);
      return id;
    };

    proc1Id = await createProcess('CUT', 'Laser Cutting', 80001, false, false, false);
    proc2Id = await createProcess('CNC', 'CNC Machining', 80002, false, true, false); // Repeatable
    proc3Id = await createProcess('DEB', 'Deburring', 80003, true, false, false); // Skippable
    proc4Id = await createProcess('HT', 'Heat Treatment', 80004, false, false, true); // Outside Vendor
    proc5Id = await createProcess('QC', 'Final QC', 80005, false, false, false);
  });

  afterAll(async () => {
    try {
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
  // ROUTING NAVIGATION TESTS
  // =========================================================================
  it('E2E-ROUTE-001: GET /api/production-processes/routing/first returns lowest active process', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/production-processes/routing/first')
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('sequenceNumber');
  });

  it('E2E-ROUTE-002: GET /api/production-processes/routing/final returns highest active process', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/production-processes/routing/final')
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('sequenceNumber');
  });

  it('E2E-ROUTE-003: GET /api/production-processes/:id/navigation returns previous, next and flags', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/production-processes/${proc2Id}/navigation`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.current.id).toBe(proc2Id);
    expect(res.body.previous.id).toBe(proc1Id);
    expect(res.body.next.id).toBe(proc3Id);
    expect(res.body.isRepeatable).toBe(true);
    expect(res.body.isSkippable).toBe(false);
  });

  it('E2E-ROUTE-004: GET /api/production-processes/routing/vendor-eligible returns only outside vendor allowed processes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/production-processes/routing/vendor-eligible')
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ht = res.body.find((p: any) => p.id === proc4Id);
    expect(ht).toBeDefined();
    expect(ht.allowsOutsideVendor).toBe(true);
  });

  // =========================================================================
  // TRANSITION VALIDATION TESTS
  // =========================================================================
  it('E2E-ROUTE-005: POST /api/production-processes/routing/validate-transition allows direct progression', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes/routing/validate-transition')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        fromProcessId: proc1Id,
        toProcessId: proc2Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.isValid).toBe(true);
    expect(res.body.transitionType).toBe('DIRECT_NEXT');
  });

  it('E2E-ROUTE-006: POST /api/production-processes/routing/validate-transition allows skipping skippable Deburring step', async () => {
    // Jump from CNC (proc2Id) to Heat Treatment (proc4Id), skipping Deburring (proc3Id, isSkippable: true)
    const res = await request(app.getHttpServer())
      .post('/api/production-processes/routing/validate-transition')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        fromProcessId: proc2Id,
        toProcessId: proc4Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.isValid).toBe(true);
    expect(res.body.transitionType).toBe('SKIP');
    expect(res.body.skippedProcesses.length).toBe(1);
    expect(res.body.skippedProcesses[0].id).toBe(proc3Id);
  });

  it('E2E-ROUTE-007: POST /api/production-processes/routing/validate-transition rejects skipping unskippable CNC step', async () => {
    // Jump from Cutting (proc1Id) to Deburring (proc3Id), attempting to skip CNC (proc2Id, isSkippable: false)
    const res = await request(app.getHttpServer())
      .post('/api/production-processes/routing/validate-transition')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        fromProcessId: proc1Id,
        toProcessId: proc3Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.isValid).toBe(false);
    expect(res.body.transitionType).toBe('INVALID');
    expect(res.body.reason).toContain('Cannot skip mandatory');
  });

  it('E2E-ROUTE-008: POST /api/production-processes/routing/validate-transition allows loop on repeatable CNC step', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes/routing/validate-transition')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        fromProcessId: proc2Id,
        toProcessId: proc2Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.isValid).toBe(true);
    expect(res.body.transitionType).toBe('REPEAT');
  });

  it('E2E-ROUTE-009: POST /api/production-processes/routing/validate-transition rejects loop on non-repeatable Cutting step', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes/routing/validate-transition')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        fromProcessId: proc1Id,
        toProcessId: proc1Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.isValid).toBe(false);
    expect(res.body.transitionType).toBe('INVALID');
    expect(res.body.reason).toContain('not repeatable');
  });

  it('E2E-ROUTE-010: POST /api/production-processes/routing/validate-transition rejects backward transition without rework', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes/routing/validate-transition')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        fromProcessId: proc4Id,
        toProcessId: proc2Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.isValid).toBe(false);
    expect(res.body.transitionType).toBe('BACKWARD_REWORK');
    expect(res.body.reason).toContain('Backward transition');
  });
});
