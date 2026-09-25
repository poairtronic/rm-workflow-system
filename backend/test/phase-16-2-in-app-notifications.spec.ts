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

describe('Phase 16.2 — In-App Notifications Backend API Specification (NAPI-001 to NAPI-023)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;

  const user1Id = '11111111-1111-1111-1111-111111111111';
  const user2Id = '22222222-2222-2222-2222-222222222222';
  const user3Id = '33333333-3333-3333-3333-333333333333';

  let user1Token: string;
  let user2Token: string;
  let user3Token: string;
  let expiredToken: string;

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

    // Clean up test notifications and users
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${user3Id}')`);
    await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${user1Id}', '${user2Id}', '${user3Id}')`);

    // Ensure a default role exists or insert test users
    const roles = await dataSource.query(`SELECT "id" FROM "roles" LIMIT 1`);
    const defaultRoleId = roles.length > 0 ? roles[0].id : '00000000-0000-0000-0000-000000000001';

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${user1Id}', 'Test User 1', 'user1@test.com', 'hash1', '${defaultRoleId}', true),
        ('${user2Id}', 'Test User 2', 'user2@test.com', 'hash2', '${defaultRoleId}', true),
        ('${user3Id}', 'Test User 3', 'user3@test.com', 'hash3', '${defaultRoleId}', true)
      ON CONFLICT ("id") DO NOTHING
    `);

    // Generate tokens
    user1Token = jwtService.sign({
      sub: user1Id,
      email: 'user1@test.com',
      role: UserRole.DESIGNER,
      roles: [UserRole.DESIGNER],
    });

    user2Token = jwtService.sign({
      sub: user2Id,
      email: 'user2@test.com',
      role: UserRole.STORES,
      roles: [UserRole.STORES],
    });

    user3Token = jwtService.sign({
      sub: user3Id,
      email: 'user3@test.com',
      role: UserRole.PRODUCTION,
      roles: [UserRole.PRODUCTION],
    });

    expiredToken = jwtService.sign(
      {
        sub: user1Id,
        email: 'user1@test.com',
        role: UserRole.DESIGNER,
      },
      { expiresIn: '-1s' },
    );

    // Seed test notifications for User 1 (5 items) and User 2 (3 items)
    const baseTime = new Date('2026-09-25T10:00:00.000Z').getTime();

    for (let i = 1; i <= 5; i++) {
      const createdDate = new Date(baseTime + i * 60000);
      await notificationRepo.save(
        notificationRepo.create({
          userId: user1Id,
          title: `User 1 Notification ${i}`,
          message: `Message body for notification ${i}`,
          type: i % 2 === 0 ? 'RM_SUBMITTED' : 'MATERIAL_ISSUED',
          targetEntity: 'RM_REQUISITION',
          targetId: `RM-REQ-00${i}`,
          isRead: i === 1,
          createdAt: createdDate,
        }),
      );
    }

    for (let j = 1; j <= 3; j++) {
      const createdDate = new Date(baseTime + (j + 10) * 60000);
      await notificationRepo.save(
        notificationRepo.create({
          userId: user2Id,
          title: `User 2 Notification ${j}`,
          message: `User 2 notification body ${j}`,
          type: 'ADDITIONAL_MATERIAL_REQUESTED',
          targetEntity: 'ADDITIONAL_MATERIAL_REQUEST',
          targetId: `AMR-00${j}`,
          isRead: false,
          createdAt: createdDate,
        }),
      );
    }
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${user3Id}')`);
    }
    if (app) {
      await app.close();
    }
  });

  it('NAPI-001: Unauthenticated request should return 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('NAPI-002: Request with invalid JWT should return 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer invalid.token.value');
    expect(res.status).toBe(401);
  });

  it('NAPI-003: Request with expired JWT should return 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('NAPI-004: Authenticated user receives own notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body).toHaveProperty('total');
    expect(res.body.total).toBe(5);

    const items = res.body.notifications;
    expect(items.length).toBe(5);
    items.forEach((item: any) => {
      expect(item.userId).toBe(user1Id);
    });
  });

  it('NAPI-005: Authenticated user cannot receive another user\'s notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const items = res.body.notifications;
    const containsUser2Item = items.some((item: any) => item.userId === user2Id);
    expect(containsUser2Item).toBe(false);
  });

  it('NAPI-006: userId query parameter cannot override JWT identity', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/notifications?userId=${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    // If userId query param is passed for another user, request must be rejected (403) or not override JWT identity
    if (res.status === 200) {
      expect(res.body.notifications.every((item: any) => item.userId === user1Id)).toBe(true);
    } else {
      expect([400, 403]).toContain(res.status);
    }
  });

  it('NAPI-007: Spoofed userId does not expose another user\'s notifications', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/notifications?userId=${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    if (res.status === 200) {
      const user2Items = res.body.notifications.filter((item: any) => item.userId === user2Id);
      expect(user2Items.length).toBe(0);
    } else {
      expect([400, 403]).toContain(res.status);
    }
  });

  it('NAPI-008: Pagination cannot cross user boundary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    res.body.notifications.forEach((item: any) => {
      expect(item.userId).toBe(user1Id);
    });
  });

  it('NAPI-009: Notification response does not expose secrets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('hash');
  });

  it('NAPI-010: Notification response does not expose unrelated user data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    res.body.notifications.forEach((item: any) => {
      expect(item).not.toHaveProperty('user');
    });
  });

  it('NAPI-011: Newest notifications are returned first', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const items = res.body.notifications;
    expect(items.length).toBeGreaterThan(1);

    for (let i = 0; i < items.length - 1; i++) {
      const dateCurrent = new Date(items[i].createdAt).getTime();
      const dateNext = new Date(items[i + 1].createdAt).getTime();
      expect(dateCurrent).toBeGreaterThanOrEqual(dateNext);
    }
  });

  it('NAPI-012: Pagination works correctly (page 1 and page 2)', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/notifications?page=1&limit=2')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.notifications.length).toBe(2);
    expect(page1.body.page).toBe(1);
    expect(page1.body.limit).toBe(2);
    expect(page1.body.totalPages).toBe(3);

    const page2 = await request(app.getHttpServer())
      .get('/api/notifications?page=2&limit=2')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(page2.status).toBe(200);
    expect(page2.body.notifications.length).toBe(2);
    expect(page2.body.page).toBe(2);
    expect(page2.body.notifications[0].id).not.toBe(page1.body.notifications[0].id);
  });

  it('NAPI-013: Invalid page parameter is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?page=-1')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('NAPI-014: Invalid limit parameter is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=0')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('NAPI-015: Maximum page size is enforced', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=1000')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('NAPI-016: Empty notification result is handled correctly', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user3Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('NAPI-017: Notification type is returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toHaveProperty('type');
    expect(typeof res.body.notifications[0].type).toBe('string');
  });

  it('NAPI-018: targetEntity is returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toHaveProperty('targetEntity');
    expect(res.body.notifications[0].targetEntity).toBe('RM_REQUISITION');
  });

  it('NAPI-019: targetId is returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toHaveProperty('targetId');
    expect(typeof res.body.notifications[0].targetId).toBe('string');
  });

  it('NAPI-020: isRead is returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toHaveProperty('isRead');
    expect(typeof res.body.notifications[0].isRead).toBe('boolean');
  });

  it('NAPI-021: createdAt is returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toHaveProperty('createdAt');
  });

  it('NAPI-022: Existing notification records remain accessible', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.notifications[0].type).toBe('ADDITIONAL_MATERIAL_REQUESTED');
  });

  it('NAPI-023: Existing notification status endpoint remains compatible', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ module: 'notifications', status: 'ready' });
  });
});
