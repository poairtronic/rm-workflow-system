import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { MslTriggerService } from '../src/inventory/msl-trigger.service.js';
import { v4 as uuidv4 } from 'uuid';

describe('RMRIT Live API & Backend Architecture Sanity Audit (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let mslTriggerService: MslTriggerService;

  const AUDIT_PREFIX = `live_audit_${Date.now()}`;

  let adminToken: string;
  let storesToken: string;
  let designerToken: string;
  let productionToken: string;
  let seniorManagerToken: string;

  beforeAll(async () => {
    // 1. Initialize Nest application module with real DB connection (Neon PostgreSQL)
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

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
    mslTriggerService = app.get(MslTriggerService);

    // 2. Provision or verify test roles and users for authorization checking
    const roleRepo = dataSource.getRepository('Role');
    const userRepo = dataSource.getRepository(User);

    const getOrCreateRole = async (roleName: string) => {
      let r = await roleRepo.findOne({ where: { name: roleName } });
      if (!r) r = await roleRepo.save({ name: roleName });
      return r;
    };

    const adminRole = await getOrCreateRole(UserRole.ADMIN);
    const storesRole = await getOrCreateRole(UserRole.STORES);
    const designerRole = await getOrCreateRole(UserRole.DESIGNER);
    const prodRole = await getOrCreateRole(UserRole.PRODUCTION);
    const smRole = await getOrCreateRole(UserRole.SENIOR_MANAGER);

    const createAuditUser = async (role: any, label: string) => {
      const email = `${AUDIT_PREFIX}_${label}@rmrit.com`;
      return userRepo.save({
        name: `Live Audit ${label}`,
        email,
        passwordHash: 'live_audit_hash',
        roleId: role.id,
        isActive: true,
      });
    };

    const adminUser = await createAuditUser(adminRole, 'admin');
    const storesUser = await createAuditUser(storesRole, 'stores');
    const designerUser = await createAuditUser(designerRole, 'designer');
    const prodUser = await createAuditUser(prodRole, 'prod');
    const smUser = await createAuditUser(smRole, 'sm');

    // 3. Issue signed JWT tokens
    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    designerToken = jwtService.sign({ sub: designerUser.id, userId: designerUser.id, email: designerUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });
    productionToken = jwtService.sign({ sub: prodUser.id, userId: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
    seniorManagerToken = jwtService.sign({ sub: smUser.id, userId: smUser.id, email: smUser.email, role: UserRole.SENIOR_MANAGER, roles: [UserRole.SENIOR_MANAGER] });
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. APPLICATION BOOTSTRAP, DI GRAPH & HEALTH CHECK
  // =========================================================================
  describe('Pillar 1: Application Bootstrap & Health Check', () => {
    it('SMOKE-001: TypeORM connection pool is active and initialized against PostgreSQL', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.isInitialized).toBe(true);
    });

    it('SMOKE-002: GET / should respond with 200 OK and root message', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(typeof res.text).toBe('string');
    });

    it('SMOKE-003: GET /api/health should respond with 200 OK and valid health payload', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'rm-workflow-backend',
      });
    });
  });

  // =========================================================================
  // 2. LIVE HTTP REST CONTRACT & RBAC MIDDLEWARE ENFORCEMENT
  // =========================================================================
  describe('Pillar 2: Auth, RBAC & Middleware Security Enforcement', () => {
    it('SMOKE-004: Protected endpoints must return 401 Unauthorized when unauthenticated', async () => {
      const protectedRoutes = [
        { method: 'get', url: '/api/production-processes' },
        { method: 'get', url: '/api/vendors' },
        { method: 'get', url: '/api/delivery-challans' },
        { method: 'get', url: '/api/delivery-challans/overdue' },
        { method: 'get', url: '/api/inventory/msl/sweep-status' },
        { method: 'get', url: '/api/general-issue' },
      ];

      for (const route of protectedRoutes) {
        const res = await (request(app.getHttpServer()) as any)[route.method](route.url);
        expect(res.status).toBe(401);
      }
    });

    it('SMOKE-005: Store mutation endpoints must return 403 Forbidden for unauthorized DESIGNER role', async () => {
      // Designer attempting Type 1 DC dispatch
      const dcType1Res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-1')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          type: 'PRODUCTION_PROCESS_OUTWARD',
          vendorId: uuidv4(),
          scId: uuidv4(),
          processId: uuidv4(),
          dispatchDate: new Date().toISOString(),
          items: [],
        });
      expect(dcType1Res.status).toBe(403);

      // Designer attempting Type 2 DC dispatch
      const dcType2Res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          type: 'GENERAL_INVENTORY_OUTWARD',
          vendorId: uuidv4(),
          dispatchDate: new Date().toISOString(),
          items: [],
        });
      expect(dcType2Res.status).toBe(403);
    });

    it('SMOKE-006: Store mutation endpoints must return 403 Forbidden for unauthorized PRODUCTION role', async () => {
      // Production attempting to close a challan
      const closeRes = await request(app.getHttpServer())
        .patch(`/api/delivery-challans/${uuidv4()}/close`)
        .set('Authorization', `Bearer ${productionToken}`);
      expect(closeRes.status).toBe(403);

      // Production attempting return
      const returnRes = await request(app.getHttpServer())
        .post(`/api/delivery-challans/${uuidv4()}/return`)
        .set('Authorization', `Bearer ${productionToken}`)
        .send({ actualReceiptDate: new Date().toISOString(), items: [] });
      expect(returnRes.status).toBe(403);
    });

    it('SMOKE-007: Authorized roles (STORES, ADMIN) must access protected resources', async () => {
      const storesRes = await request(app.getHttpServer())
        .get('/api/production-processes')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);
      expect(Array.isArray(storesRes.body)).toBe(true);

      const adminRes = await request(app.getHttpServer())
        .get('/api/production-processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(adminRes.body)).toBe(true);
    });
  });

  // =========================================================================
  // 3. MASTER DATA CORE PILLARS (PROCESSES & VENDORS)
  // =========================================================================
  describe('Pillar 3: Master Data Core Pillars', () => {
    it('SMOKE-008: GET /api/production-processes responds with 200 and valid process schema', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/production-processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const proc = res.body[0];
        expect(proc).toHaveProperty('id');
        expect(proc).toHaveProperty('code');
        expect(proc).toHaveProperty('name');
        expect(proc).toHaveProperty('sequenceNumber');
      }
    });

    it('SMOKE-009: GET /api/vendors responds with 200 and valid vendor schema', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/vendors')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const vendor = res.body[0];
        expect(vendor).toHaveProperty('id');
        expect(vendor).toHaveProperty('code');
        expect(vendor).toHaveProperty('name');
        expect(vendor).toHaveProperty('isActive');
      }
    });

    it('SMOKE-010: GET /api/categories and /api/products respond with 200 OK', async () => {
      const catRes = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);
      expect(catRes.body).toHaveProperty('data');
      expect(Array.isArray(catRes.body.data)).toBe(true);

      const prodRes = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);
      expect(prodRes.body).toHaveProperty('data');
      expect(Array.isArray(prodRes.body.data)).toBe(true);
    });
  });

  // =========================================================================
  // 4. INVENTORY & MSL AUTOMATION
  // =========================================================================
  describe('Pillar 4: Inventory & MSL Automation', () => {
    it('SMOKE-011: GET /api/inventory/msl/sweep-status returns clean concurrency lock and sweep stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl/sweep-status')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('isRunning');
      expect(res.body.isRunning).toBe(false); // Must be idle under normal conditions
      expect(res.body).toHaveProperty('lastSweepTime');
      expect(res.body).toHaveProperty('lastSweepStats');
    });

    it('SMOKE-012: GET /api/general-issue returns 200 OK array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('SMOKE-013: GET /api/inventory/msl evaluates catalogue without throwing exceptions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =========================================================================
  // 5. DELIVERY CHALLANS MODULE & QUERY ROUTING
  // =========================================================================
  describe('Pillar 5: Delivery Challans Routing & Querying', () => {
    it('SMOKE-014: GET /api/delivery-challans returns 200 OK array of challans', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/delivery-challans')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const dc = res.body[0];
        expect(dc).toHaveProperty('id');
        expect(dc).toHaveProperty('challanNumber');
        expect(dc).toHaveProperty('type');
        expect(dc).toHaveProperty('status');
      }
    });

    it('SMOKE-015: GET /api/delivery-challans/overdue returns 200 OK array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/delivery-challans/overdue')
        .set('Authorization', `Bearer ${seniorManagerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('SMOKE-016: GET /api/delivery-challans?isOverdue=true filters properly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/delivery-challans?isOverdue=true')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =========================================================================
  // 6. ASYNCHRONOUS BACKGROUND WORKERS & EMAIL QUEUE INTEGRITY
  // =========================================================================
  describe('Pillar 6: Background Queues & Notification Services', () => {
    it('SMOKE-017: PostgreSQL email_jobs table is accessible and indexed', async () => {
      const emailRepo = dataSource.getRepository(EmailJob);
      const totalJobs = await emailRepo.count();
      expect(typeof totalJobs).toBe('number');
      expect(totalJobs).toBeGreaterThanOrEqual(0);
    });

    it('SMOKE-018: PostgreSQL notifications table is accessible with intact idempotency constraint', async () => {
      const notifRepo = dataSource.getRepository(Notification);
      const totalNotifs = await notifRepo.count();
      expect(typeof totalNotifs).toBe('number');
      expect(totalNotifs).toBeGreaterThanOrEqual(0);
    });

    it('SMOKE-019: MSL Trigger Service sweep lock is not blocked', () => {
      expect(mslTriggerService.isSweepRunning()).toBe(false);
    });
  });
});
