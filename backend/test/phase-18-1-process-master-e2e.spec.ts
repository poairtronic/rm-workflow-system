import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 18.1 — Production Process Master HTTP API (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `proc_e2e_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let storesUserId: string;
  let storesToken: string;
  let designerUserId: string;
  let designerToken: string;

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
    // Clean up created records
    try {
      if (createdProcessIds.length > 0) {
        await pgClient.query(`DELETE FROM production_processes WHERE id = ANY($1)`, [createdProcessIds]);
      }
      if (adminUserId || storesUserId || designerUserId) {
        await pgClient.query(`DELETE FROM users WHERE id = ANY($1)`, [
          [adminUserId, storesUserId, designerUserId].filter(Boolean),
        ]);
      }
      await pgClient.end();
    } catch {
      // Ignore cleanup error
    }
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // AUTH & RBAC VERIFICATION
  // =========================================================================
  it('E2E-PROC-001: POST /api/production-processes requires JWT authentication (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .send({
        code: `${TEST_PREFIX}_P0`,
        name: 'Unauthorized Attempt',
        sequenceNumber: 99990,
      });

    expect(res.status).toBe(401);
  });

  it('E2E-PROC-002: POST /api/production-processes denies DESIGNER role (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({
        code: `${TEST_PREFIX}_P0`,
        name: 'Forbidden Attempt',
        sequenceNumber: 99991,
      });

    expect(res.status).toBe(403);
  });

  // =========================================================================
  // CREATION & UNIQUENESS CONSTRAINTS
  // =========================================================================
  it('E2E-PROC-003: POST /api/production-processes creates a new process successfully (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `${TEST_PREFIX}_CUT`,
        name: 'Precision Laser Cutting',
        sequenceNumber: 90001,
        category: 'CUTTING',
        description: 'High precision CO2 laser cutter',
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toBe(`${TEST_PREFIX}_CUT`);
    expect(res.body.name).toBe('Precision Laser Cutting');
    expect(res.body.sequenceNumber).toBe(90001);
    expect(res.body.category).toBe('CUTTING');
    expect(res.body.isActive).toBe(true);

    createdProcessIds.push(res.body.id);
  });

  it('E2E-PROC-004: POST /api/production-processes rejects duplicate code (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `${TEST_PREFIX}_CUT`,
        name: 'Another Cutting Step',
        sequenceNumber: 90002,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already in use');
  });

  it('E2E-PROC-005: POST /api/production-processes rejects duplicate sequenceNumber (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `${TEST_PREFIX}_MCH`,
        name: 'CNC Milling',
        sequenceNumber: 90001,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already assigned');
  });

  it('E2E-PROC-006: POST /api/production-processes validates input constraints (400 Bad Request)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: '',
        name: '',
        sequenceNumber: -5,
      });

    expect(res.status).toBe(400);
  });

  // =========================================================================
  // RETRIEVAL & FILTERING
  // =========================================================================
  it('E2E-PROC-007: GET /api/production-processes allows authenticated read (including DESIGNER)', async () => {
    const p2Res = await request(app.getHttpServer())
      .post('/api/production-processes')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        code: `${TEST_PREFIX}_MCH`,
        name: 'CNC Milling Process',
        sequenceNumber: 90002,
        category: 'MACHINING',
      });
    expect(p2Res.status).toBe(201);
    createdProcessIds.push(p2Res.body.id);

    const res = await request(app.getHttpServer())
      .get('/api/production-processes')
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const filtered = res.body.filter((p: any) => p.code.startsWith(TEST_PREFIX));
    expect(filtered.length).toBe(2);
    expect(filtered[0].sequenceNumber).toBeLessThan(filtered[1].sequenceNumber);
  });

  it('E2E-PROC-008: GET /api/production-processes/:id returns the single process', async () => {
    const processId = createdProcessIds[0];
    const res = await request(app.getHttpServer())
      .get(`/api/production-processes/${processId}`)
      .set('Authorization', `Bearer ${designerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(processId);
    expect(res.body.code).toBe(`${TEST_PREFIX}_CUT`);
  });

  // =========================================================================
  // MUTATION & STATE TOGGLE
  // =========================================================================
  it('E2E-PROC-009: PATCH /api/production-processes/:id updates process fields', async () => {
    const processId = createdProcessIds[0];
    const res = await request(app.getHttpServer())
      .patch(`/api/production-processes/${processId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Laser Cutting (Updated)',
        description: 'Upgraded 4KW laser optics',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Laser Cutting (Updated)');
    expect(res.body.description).toBe('Upgraded 4KW laser optics');
  });

  it('E2E-PROC-010: PATCH /api/production-processes/:id/toggle-active toggles is_active', async () => {
    const processId = createdProcessIds[0];

    // 1. Toggle to false
    const toggle1 = await request(app.getHttpServer())
      .patch(`/api/production-processes/${processId}/toggle-active`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(toggle1.status).toBe(200);
    expect(toggle1.body.isActive).toBe(false);

    // 2. Toggle back to true
    const toggle2 = await request(app.getHttpServer())
      .patch(`/api/production-processes/${processId}/toggle-active`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(toggle2.status).toBe(200);
    expect(toggle2.body.isActive).toBe(true);
  });
});
