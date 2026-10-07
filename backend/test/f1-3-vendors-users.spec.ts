import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('F1.3 — Vendors & Users Master API (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `f13_${Date.now()}`;
  let adminUserId: string;
  let adminToken: string;
  let gmUserId: string;
  let gmToken: string;
  let designerUserId: string;
  let designerToken: string;

  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];

  beforeAll(async () => {
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();

    const getRoleId = async (roleName: string) => {
      let res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      if (!res.rows.length) {
        await pgClient.query(`INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [roleName]);
        res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      }
      return res.rows[0].id;
    };

    const adminRoleId = await getRoleId('ADMIN');
    const gmRoleId = await getRoleId('GENERAL_MANAGER');
    const designerRoleId = await getRoleId('DESIGNER');

    const createUser = async (name: string, email: string, roleId: string) => {
      const res = await pgClient.query(
        `INSERT INTO users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, 'hash', $3, true) RETURNING id`,
        [name, email, roleId],
      );
      return res.rows[0].id;
    };

    adminUserId = await createUser(`Admin ${TEST_PREFIX}`, `${TEST_PREFIX}_admin@example.com`, adminRoleId);
    gmUserId = await createUser(`GM ${TEST_PREFIX}`, `${TEST_PREFIX}_gm@example.com`, gmRoleId);
    designerUserId = await createUser(`Designer ${TEST_PREFIX}`, `${TEST_PREFIX}_des@example.com`, designerRoleId);

    createdUserIds.push(adminUserId, gmUserId, designerUserId);

    const jwtSecret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    const makeToken = (id: string, email: string, role: string) => {
      return jwt.sign(
        { sub: id, email, role, roles: [role] },
        jwtSecret,
        { expiresIn: '1h' },
      );
    };

    adminToken = makeToken(adminUserId, `${TEST_PREFIX}_admin@example.com`, 'ADMIN');
    gmToken = makeToken(gmUserId, `${TEST_PREFIX}_gm@example.com`, 'GENERAL_MANAGER');
    designerToken = makeToken(designerUserId, `${TEST_PREFIX}_des@example.com`, 'DESIGNER');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (pgClient) {
      if (createdVendorIds.length > 0) {
        await pgClient.query(`DELETE FROM vendors WHERE id = ANY($1)`, [createdVendorIds]);
      }
      if (createdUserIds.length > 0) {
        await pgClient.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]);
      }
      await pgClient.end();
    }
  });

  describe('1. Vendor Write RBAC (Purely Additive GENERAL_MANAGER)', () => {
    it('GENERAL_MANAGER can create a vendor record (201)', async () => {
      const payload = {
        code: `VND-GM-${Date.now()}`.substring(0, 48),
        name: 'GM Certified Vendor',
        category: 'Machining',
      };

      const res = await request(app.getHttpServer())
        .post('/api/vendors')
        .set('Authorization', `Bearer ${gmToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(payload.name);
      createdVendorIds.push(res.body.id);
    });

    it('ADMIN can update a vendor via PATCH /api/vendors/:id (200)', async () => {
      const vendor = await pgClient.query(
        `INSERT INTO vendors (code, name, is_active) VALUES ($1, $2, true) RETURNING id`,
        [`VND-UPD-${Date.now()}`.substring(0, 48), 'Original Name'],
      );
      const vId = vendor.rows[0].id;
      createdVendorIds.push(vId);

      const res = await request(app.getHttpServer())
        .patch(`/api/vendors/${vId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Vendor Name', contactPerson: 'Jane Doe' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Vendor Name');
      expect(res.body.contactPerson).toBe('Jane Doe');
    });
  });

  describe('2. User Creation & Password Handling', () => {
    it('ADMIN can create a new user with default password (201)', async () => {
      const payload = {
        name: 'New Stores Agent',
        email: `${TEST_PREFIX}_agent@airtronic.com`,
        role: UserRole.STORES,
        department: 'Inventory Management',
        isActive: true,
      };

      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(payload.name);
      expect(res.body.email).toBe(payload.email);
      expect(res.body.passwordHash).toBeUndefined(); // Password hash must NOT be returned
      expect(res.body.isActive).toBe(true);
      createdUserIds.push(res.body.id);

      // Verify user can authenticate with SEED_DEFAULT_PASSWORD
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: payload.email,
          password: process.env.SEED_DEFAULT_PASSWORD || 'airtronic123A@',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.user.role).toBe(UserRole.STORES);
    });

    it('Non-admin cannot create users (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          name: 'Forbidden User',
          email: `${TEST_PREFIX}_forbidden@airtronic.com`,
          role: UserRole.PRODUCTION,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. User Active Status Toggle & Self-Lock Guard', () => {
    it('ADMIN can toggle isActive via PATCH /api/users/:id/active (200)', async () => {
      const userRes = await pgClient.query(
        `INSERT INTO users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, 'hash', (SELECT id FROM roles WHERE name = 'STORES'), true) RETURNING id`,
        ['Toggled User', `${TEST_PREFIX}_toggle@example.com`],
      );
      const targetUserId = userRes.rows[0].id;
      createdUserIds.push(targetUserId);

      // Toggle to false
      const res1 = await request(app.getHttpServer())
        .patch(`/api/users/${targetUserId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res1.status).toBe(200);
      expect(res1.body.isActive).toBe(false);

      // Toggle to true without explicit body
      const res2 = await request(app.getHttpServer())
        .patch(`/api/users/${targetUserId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res2.status).toBe(200);
      expect(res2.body.isActive).toBe(true);
    });

    it('ADMIN is blocked from deactivating their own account via PATCH /api/users/:id/active (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${adminUserId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Administrators cannot deactivate their own account');
    });

    it('ADMIN is blocked from deactivating their own account via PATCH /api/users/:id/deactivate (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${adminUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Administrators cannot deactivate their own account');
    });
  });

  describe('4. User Role Update', () => {
    it('ADMIN can change role via PATCH /api/users/:id/role (200)', async () => {
      const userRes = await pgClient.query(
        `INSERT INTO users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, 'hash', (SELECT id FROM roles WHERE name = 'DESIGNER'), true) RETURNING id`,
        ['Role Change User', `${TEST_PREFIX}_rolechange@example.com`],
      );
      const targetUserId = userRes.rows[0].id;
      createdUserIds.push(targetUserId);

      const res = await request(app.getHttpServer())
        .patch(`/api/users/${targetUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.PRODUCTION });

      expect(res.status).toBe(200);
      expect(res.body.role.name).toBe(UserRole.PRODUCTION);
    });
  });
});

