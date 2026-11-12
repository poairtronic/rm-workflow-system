import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('User Role Change & Live Permissions Synchronization (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `role_sync_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let testUserId: string;
  let testUserTokenOldRole: string;
  let productionRoleId: string;
  let storesRoleId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();

    const getRoleId = async (roleName: string) => {
      const res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      return res.rows[0].id;
    };

    const adminRoleId = await getRoleId('ADMIN');
    productionRoleId = await getRoleId('PRODUCTION');
    storesRoleId = await getRoleId('STORES');

    const createUser = async (name: string, email: string, roleId: string) => {
      const res = await pgClient.query(
        `INSERT INTO users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, 'hash', $3, true) RETURNING id`,
        [name, email, roleId],
      );
      return res.rows[0].id;
    };

    adminUserId = await createUser(`Admin ${TEST_PREFIX}`, `${TEST_PREFIX}_admin@example.com`, adminRoleId);
    testUserId = await createUser(`Worker ${TEST_PREFIX}`, `${TEST_PREFIX}_worker@example.com`, productionRoleId);
    createdUserIds.push(adminUserId, testUserId);

    const jwtSecret = process.env.JWT_SECRET || 'your_development_secret';

    adminToken = jwt.sign(
      { sub: adminUserId, email: `${TEST_PREFIX}_admin@example.com`, role: 'ADMIN' },
      jwtSecret,
      { expiresIn: '1h' },
    );

    // Token minted with OLD role (PRODUCTION)
    testUserTokenOldRole = jwt.sign(
      { sub: testUserId, email: `${TEST_PREFIX}_worker@example.com`, role: 'PRODUCTION' },
      jwtSecret,
      { expiresIn: '1h' },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await pgClient.query(`DELETE FROM user_module_permissions WHERE user_id = ANY($1)`, [createdUserIds]);
      await pgClient.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]);
    }
    await pgClient.end();
    if (app) await app.close();
  });

  it('1. Initial state: test user has PRODUCTION role in DB and in /api/auth/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${testUserTokenOldRole}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('PRODUCTION');
  });

  it('2. Admin updates user role to STORES via PATCH /api/users/:id/role', async () => {
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/users/${testUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: UserRole.STORES });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.role.name).toBe('STORES');

    // VERIFY DATABASE ROW: role_id must be updated in PostgreSQL table
    const dbCheck = await pgClient.query(
      `SELECT u.role_id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [testUserId],
    );
    expect(dbCheck.rows[0].role_id).toBe(storesRoleId);
    expect(dbCheck.rows[0].role_name).toBe('STORES');
  });

  it('3. Live synchronization: Existing session with old JWT immediately receives STORES role and modules', async () => {
    // Calling /api/auth/me with the EXISTING token that had "PRODUCTION" baked into payload
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${testUserTokenOldRole}`);

    expect(meRes.status).toBe(200);
    // Role must be live STORES, not stale PRODUCTION
    expect(meRes.body.user.role).toBe('STORES');
    expect(meRes.body.user.effectiveModules).toContain('dc_type1');
    expect(meRes.body.user.effectiveModules).toContain('rm_issue');
  });

  it('4. Role-based access: Stores-only endpoint permits the user without 403 Forbidden', async () => {
    // Calling /api/delivery-challans/lock-check which requires STORES or ADMIN
    const lockCheckRes = await request(app.getHttpServer())
      .post('/api/delivery-challans/lock-check')
      .set('Authorization', `Bearer ${testUserTokenOldRole}`)
      .send({
        type: 'GENERAL_INVENTORY_OUTWARD',
        items: [{ quantity: 1 }],
      });

    // Must NOT be 403 Forbidden
    expect(lockCheckRes.status).not.toBe(403);
  });
});

