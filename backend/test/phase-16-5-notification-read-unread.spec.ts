import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';

class MockEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  async send(msg: any) {
    this.calls.push(msg);
    return { success: true, providerMessageId: 'mock-msg-id' };
  }
}

describe('Phase 16.5 — Read / Unread Notification State Specification (READ-001 to READ-020, READ-ALL-001 to READ-ALL-007)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;

  const user1Id = '16500000-1111-1111-1111-111111111111';
  const user2Id = '16500000-2222-2222-2222-222222222222';
  const adminId = '16500000-9999-9999-9999-999999999999';

  let user1Token: string;
  let user2Token: string;
  let adminToken: string;
  let expiredToken: string;

  let user1Notif1Id: string;
  let user1Notif2Id: string;
  let user1Notif3Id: string;
  let user2Notif1Id: string;

  beforeAll(async () => {
    mockProvider = new MockEmailProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(mockProvider)
      .compile();

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
    notificationRepo = dataSource.getRepository(Notification);
    jwtService = app.get(JwtService);

    // Ensure notifications table exists
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "message" text NOT NULL,
        "type" character varying(50) NOT NULL DEFAULT 'INFO',
        "target_entity" character varying(50),
        "target_id" character varying(100),
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    // Clean up existing test data
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${adminId}')`);
    await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${user1Id}', '${user2Id}', '${adminId}')`);

    const roles = await dataSource.query(`SELECT "id" FROM "roles" LIMIT 1`);
    const defaultRoleId = roles.length > 0 ? roles[0].id : '00000000-0000-0000-0000-000000000001';

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${user1Id}', 'Phase 16.5 User 1', 'u1.165@test.com', 'hash1', '${defaultRoleId}', true),
        ('${user2Id}', 'Phase 16.5 User 2', 'u2.165@test.com', 'hash2', '${defaultRoleId}', true),
        ('${adminId}', 'Phase 16.5 Admin', 'admin.165@test.com', 'hash3', '${defaultRoleId}', true)
      ON CONFLICT ("id") DO NOTHING
    `);

    user1Token = jwtService.sign({
      sub: user1Id,
      email: 'u1.165@test.com',
      role: UserRole.DESIGNER,
      roles: [UserRole.DESIGNER],
    });

    user2Token = jwtService.sign({
      sub: user2Id,
      email: 'u2.165@test.com',
      role: UserRole.STORES,
      roles: [UserRole.STORES],
    });

    adminToken = jwtService.sign({
      sub: adminId,
      email: 'admin.165@test.com',
      role: UserRole.ADMIN,
      roles: [UserRole.ADMIN],
    });

    expiredToken = jwtService.sign(
      {
        sub: user1Id,
        email: 'u1.165@test.com',
        role: UserRole.DESIGNER,
      },
      { expiresIn: '-1s' },
    );
  });

  beforeEach(async () => {
    // Reset notification state before each test
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${adminId}')`);

    const roles = await dataSource.query(`SELECT "id" FROM "roles" LIMIT 1`);
    const defaultRoleId = roles.length > 0 ? roles[0].id : '00000000-0000-0000-0000-000000000001';

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${user1Id}', 'Phase 16.5 User 1', 'u1.165@test.com', 'hash1', '${defaultRoleId}', true),
        ('${user2Id}', 'Phase 16.5 User 2', 'u2.165@test.com', 'hash2', '${defaultRoleId}', true),
        ('${adminId}', 'Phase 16.5 Admin', 'admin.165@test.com', 'hash3', '${defaultRoleId}', true)
      ON CONFLICT ("id") DO NOTHING
    `);

    const baseTime = new Date('2026-09-25T10:00:00.000Z').getTime();

    // Seed 3 unread notifications for User 1
    const n1 = await notificationRepo.save(
      notificationRepo.create({
        userId: user1Id,
        title: 'User 1 - Unread Notif 1',
        message: 'Message 1',
        type: 'RM_SUBMITTED',
        targetEntity: 'RM_REQUISITION',
        targetId: 'RM-REQ-101',
        isRead: false,
        createdAt: new Date(baseTime + 10000),
      }),
    );
    user1Notif1Id = n1.id;

    const n2 = await notificationRepo.save(
      notificationRepo.create({
        userId: user1Id,
        title: 'User 1 - Unread Notif 2',
        message: 'Message 2',
        type: 'MATERIAL_ISSUED',
        targetEntity: 'MATERIAL_ISSUE',
        targetId: 'MI-202',
        isRead: false,
        createdAt: new Date(baseTime + 20000),
      }),
    );
    user1Notif2Id = n2.id;

    const n3 = await notificationRepo.save(
      notificationRepo.create({
        userId: user1Id,
        title: 'User 1 - Unread Notif 3',
        message: 'Message 3',
        type: 'SC_COMPLETED',
        targetEntity: 'SUBCONTRACT_WORK_ORDER',
        targetId: 'SC-303',
        isRead: false,
        createdAt: new Date(baseTime + 30000),
      }),
    );
    user1Notif3Id = n3.id;

    // Seed 1 unread notification for User 2
    const n4 = await notificationRepo.save(
      notificationRepo.create({
        userId: user2Id,
        title: 'User 2 - Unread Notif 1',
        message: 'Message U2',
        type: 'ADDITIONAL_MATERIAL_REQUESTED',
        targetEntity: 'ADDITIONAL_MATERIAL_REQUEST',
        targetId: 'AMR-404',
        isRead: false,
        createdAt: new Date(baseTime + 40000),
      }),
    );
    user2Notif1Id = n4.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${adminId}')`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${user1Id}', '${user2Id}', '${adminId}')`);
    }
    if (app) {
      await app.close();
    }
  });

  // --- SINGLE READ TESTS (READ-001 to READ-011) ---

  it('READ-001: Patch mark as read unauthenticated should return 401', async () => {
    const res = await request(app.getHttpServer()).patch(`/api/notifications/${user1Notif1Id}/read`);
    expect(res.status).toBe(401);
  });

  it('READ-002: Patch mark as read with invalid JWT should return 401', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', 'Bearer invalid.token.value');
    expect(res.status).toBe(401);
  });

  it('READ-003: Patch mark as read with expired JWT should return 401', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('READ-004: User marks own notification as read successfully', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user1Notif1Id);
    expect(res.body.isRead).toBe(true);
  });

  it('READ-005: IDOR Protection — User cannot mark another user\'s notification as read', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${user2Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(403);

    // Verify DB state was NOT mutated
    const notifInDb = await notificationRepo.findOne({ where: { id: user2Notif1Id } });
    expect(notifInDb?.isRead).toBe(false);
  });

  it('READ-006: ADMIN cannot mark another user\'s notification as read (ownership strictness)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);

    const notifInDb = await notificationRepo.findOne({ where: { id: user1Notif1Id } });
    expect(notifInDb?.isRead).toBe(false);
  });

  it('READ-007: Marking an already read notification as read is idempotent', async () => {
    // Mark read first time
    await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    // Mark read second time
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
  });

  it('READ-008: Non-existent notification ID returns 404', async () => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999';
    const res = await request(app.getHttpServer())
      .patch(`/api/notifications/${nonExistentId}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
  });

  it('READ-009: Invalid UUID format returns 400', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/notifications/invalid-uuid-123/read')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('READ-010: Read state change persists in PostgreSQL', async () => {
    await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    const dbRecord = await notificationRepo.findOne({ where: { id: user1Notif1Id } });
    expect(dbRecord).toBeDefined();
    expect(dbRecord?.isRead).toBe(true);
  });

  it('READ-011: Marking as read reduces unread count', async () => {
    const beforeCountRes = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(beforeCountRes.body.unreadCount).toBe(3);

    await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    const afterCountRes = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(afterCountRes.body.unreadCount).toBe(2);
  });

  // --- UNREAD COUNT & PAGINATION INTEGRATION (READ-012 to READ-020) ---

  it('READ-012: Unread count endpoint unauthenticated returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('READ-013: Unread count endpoint returns correct count for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unreadCount: 3 });
  });

  it('READ-014: Unread count endpoint does not include other users\' notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unreadCount: 1 });
  });

  it('READ-015: Unread count endpoint excludes read notifications', async () => {
    await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    const res = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
  });

  it('READ-016: GET /api/notifications response includes top-level unreadCount', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('unreadCount');
    expect(res.body.unreadCount).toBe(3);
  });

  it('READ-017: GET /api/notifications unreadCount matches GET /api/notifications/unread-count', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    const countRes = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(listRes.body.unreadCount).toBe(countRes.body.unreadCount);
  });

  it('READ-018: Paginated GET /api/notifications returns total unread count across all pages', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?page=1&limit=1')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(1);
    expect(res.body.total).toBe(3);
    expect(res.body.unreadCount).toBe(3);
  });

  it('READ-019: Marking as read preserves all other notification attributes', async () => {
    const original = await notificationRepo.findOne({ where: { id: user1Notif1Id } });

    await request(app.getHttpServer())
      .patch(`/api/notifications/${user1Notif1Id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    const updated = await notificationRepo.findOne({ where: { id: user1Notif1Id } });

    expect(updated?.title).toBe(original?.title);
    expect(updated?.message).toBe(original?.message);
    expect(updated?.type).toBe(original?.type);
    expect(updated?.targetEntity).toBe(original?.targetEntity);
    expect(updated?.targetId).toBe(original?.targetId);
    expect(updated?.userId).toBe(original?.userId);
    expect(updated?.createdAt.getTime()).toBe(original?.createdAt.getTime());
  });

  it('READ-020: Notification module status endpoint remains responsive', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ module: 'notifications', status: 'ready' });
  });

  // --- MARK ALL READ TESTS (READ-ALL-001 to READ-ALL-007) ---

  it('READ-ALL-001: Mark all read unauthenticated returns 401', async () => {
    const res = await request(app.getHttpServer()).patch('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('READ-ALL-002: Mark all read with invalid JWT returns 401', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', 'Bearer invalid.token');
    expect(res.status).toBe(401);
  });

  it('READ-ALL-003: User marks all own notifications as read successfully', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(3);

    const countRes = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(countRes.body.unreadCount).toBe(0);
  });

  it('READ-ALL-004: Mark all read only marks current user\'s notifications', async () => {
    // User 1 marks all read
    await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);

    // User 2 unread count must remain 1
    const user2CountRes = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(user2CountRes.body.unreadCount).toBe(1);

    const user2NotifInDb = await notificationRepo.findOne({ where: { id: user2Notif1Id } });
    expect(user2NotifInDb?.isRead).toBe(false);
  });

  it('READ-ALL-005: Mark all read when user has 0 unread notifications succeeds with count 0', async () => {
    // Admin has 0 notifications
    const res = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(0);
  });

  it('READ-ALL-006: Calling mark all read twice is idempotent', async () => {
    const res1 = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(res1.body.count).toBe(3);

    const res2 = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(res2.body.count).toBe(0);
  });

  it('READ-ALL-007: Mark all read state persists in PostgreSQL for all user records', async () => {
    await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);

    const user1Notifs = await notificationRepo.find({ where: { userId: user1Id } });
    expect(user1Notifs.length).toBe(3);
    user1Notifs.forEach((n) => {
      expect(n.isRead).toBe(true);
    });
  });
});
