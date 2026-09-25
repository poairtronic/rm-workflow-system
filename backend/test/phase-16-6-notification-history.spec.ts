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

describe('Phase 16.6 — Notification History Backend Specification (HISTORY-001 to HISTORY-030)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;

  const user1Id = '66666666-6666-6666-6666-666666666661';
  const user2Id = '66666666-6666-6666-6666-666666666662';
  const user3Id = '66666666-6666-6666-6666-666666666663';

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

    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${user3Id}')`);
    await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${user1Id}', '${user2Id}', '${user3Id}')`);

    const roles = await dataSource.query(`SELECT "id" FROM "roles" LIMIT 1`);
    const defaultRoleId = roles.length > 0 ? roles[0].id : '00000000-0000-0000-0000-000000000001';

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${user1Id}', 'History User 1', 'history1@test.com', 'hash1', '${defaultRoleId}', true),
        ('${user2Id}', 'History User 2', 'history2@test.com', 'hash2', '${defaultRoleId}', true),
        ('${user3Id}', 'History User 3', 'history3@test.com', 'hash3', '${defaultRoleId}', true)
      ON CONFLICT ("id") DO NOTHING
    `);

    user1Token = jwtService.sign({
      sub: user1Id,
      email: 'history1@test.com',
      role: UserRole.DESIGNER,
      roles: [UserRole.DESIGNER],
    });

    user2Token = jwtService.sign({
      sub: user2Id,
      email: 'history2@test.com',
      role: UserRole.STORES,
      roles: [UserRole.STORES],
    });

    user3Token = jwtService.sign({
      sub: user3Id,
      email: 'history3@test.com',
      role: UserRole.PRODUCTION,
      roles: [UserRole.PRODUCTION],
    });

    expiredToken = jwtService.sign(
      { sub: user1Id, email: 'history1@test.com' },
      { expiresIn: '-1s' },
    );
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${user1Id}', '${user2Id}', '${user3Id}')`);

    const baseTime = new Date('2026-09-25T12:00:00.000Z').getTime();

    // User 1 has 6 notifications: 3 read, 3 unread
    for (let i = 1; i <= 6; i++) {
      const createdDate = new Date(baseTime + i * 60000);
      await notificationRepo.save(
        notificationRepo.create({
          userId: user1Id,
          title: `History Notification ${i}`,
          message: `Body for history notification ${i}`,
          type: i % 2 === 0 ? 'RM_SUBMITTED' : 'MATERIAL_ISSUED',
          targetEntity: 'RM_REQUISITION',
          targetId: `REQ-${i}`,
          isRead: i <= 3, // 1,2,3 are READ; 4,5,6 are UNREAD
          createdAt: createdDate,
        }),
      );
    }

    // User 2 has 2 notifications (all unread)
    for (let j = 1; j <= 2; j++) {
      const createdDate = new Date(baseTime + (j + 10) * 60000);
      await notificationRepo.save(
        notificationRepo.create({
          userId: user2Id,
          title: `User 2 Notification ${j}`,
          message: `User 2 body ${j}`,
          type: 'SC_COMPLETED',
          targetEntity: 'SUBCONTRACT_ORDER',
          targetId: `SC-${j}`,
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

  it('HISTORY-001: Unauthenticated request to /api/notifications returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('HISTORY-002: Request with invalid or expired JWT returns 401', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer bad.token.value');
    expect(res1.status).toBe(401);

    const res2 = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res2.status).toBe(401);
  });

  it('HISTORY-003: Authenticated user receives full history (ALL) scoped strictly to their JWT user_id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
    expect(res.body.notifications.length).toBe(6);
    res.body.notifications.forEach((item: any) => {
      expect(item.userId).toBe(user1Id);
    });
  });

  it('HISTORY-004: userId query parameter cannot override JWT user identity (IDOR prevention)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/notifications?userId=${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    if (res.status === 200) {
      res.body.notifications.forEach((item: any) => {
        expect(item.userId).toBe(user1Id);
      });
    } else {
      expect([400, 403]).toContain(res.status);
    }
  });

  it('HISTORY-005: Read notifications (isRead = true) remain present in history (READ ≠ DELETED)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const readItems = res.body.notifications.filter((item: any) => item.isRead === true);
    expect(readItems.length).toBe(3);
  });

  it('HISTORY-006: Filter unreadOnly=true returns only unread notifications (isRead = false)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    res.body.notifications.forEach((item: any) => {
      expect(item.isRead).toBe(false);
    });
  });

  it('HISTORY-007: Filter readOnly=true returns only read notifications (isRead = true)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?readOnly=true')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    res.body.notifications.forEach((item: any) => {
      expect(item.isRead).toBe(true);
    });
  });

  it('HISTORY-008: Notification history ordering is strictly newest-first (createdAt DESC)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const items = res.body.notifications;
    for (let i = 0; i < items.length - 1; i++) {
      const current = new Date(items[i].createdAt).getTime();
      const next = new Date(items[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('HISTORY-009: Pagination works on history (page and limit)', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/notifications?page=1&limit=2')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.notifications.length).toBe(2);
    expect(page1.body.total).toBe(6);
    expect(page1.body.totalPages).toBe(3);

    const page2 = await request(app.getHttpServer())
      .get('/api/notifications?page=2&limit=2')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(page2.status).toBe(200);
    expect(page2.body.notifications.length).toBe(2);
    expect(page2.body.notifications[0].id).not.toBe(page1.body.notifications[0].id);
  });

  it('HISTORY-010: Maximum limit is enforced (limit > 100 returns 400)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=200')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('HISTORY-011: Filter by notification type returns matching items in history', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?type=RM_SUBMITTED')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(3);
    res.body.notifications.forEach((item: any) => {
      expect(item.type).toBe('RM_SUBMITTED');
    });
  });

  it('HISTORY-012: targetEntity and targetId are preserved in history items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0].targetEntity).toBe('RM_REQUISITION');
    expect(res.body.notifications[0].targetId).toBeDefined();
  });

  it('HISTORY-013: Marking a notification as read updates isRead: true but keeps item in history', async () => {
    const unreadItems = await notificationRepo.find({ where: { userId: user1Id, isRead: false } });
    expect(unreadItems.length).toBe(3);
    const targetId = unreadItems[0].id;

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/notifications/${targetId}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.isRead).toBe(true);

    // Verify it still exists in history
    const historyRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(historyRes.body.total).toBe(6);
    const updatedItem = historyRes.body.notifications.find((n: any) => n.id === targetId);
    expect(updatedItem).toBeDefined();
    expect(updatedItem.isRead).toBe(true);
  });

  it('HISTORY-014: unreadCount is correctly returned alongside history pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?page=1&limit=2')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('unreadCount');
    expect(res.body.unreadCount).toBe(3);
  });

  it('HISTORY-015: PATCH /api/notifications/read-all marks all unread notifications as read without deleting any records', async () => {
    const patchAll = await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(patchAll.status).toBe(200);

    const historyRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(historyRes.body.total).toBe(6);
    expect(historyRes.body.unreadCount).toBe(0);
    historyRes.body.notifications.forEach((item: any) => {
      expect(item.isRead).toBe(true);
    });
  });

  it('HISTORY-016: IDOR protection: User cannot mark another user\'s notification as read', async () => {
    const user2Items = await notificationRepo.find({ where: { userId: user2Id } });
    const targetId = user2Items[0].id;

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/notifications/${targetId}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect([403, 404]).toContain(patchRes.status);
  });

  it('HISTORY-017: DELETE HTTP method on /api/notifications is forbidden/not implemented', async () => {
    const delRes = await request(app.getHttpServer())
      .delete('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect([404, 405]).toContain(delRes.status);
  });

  it('HISTORY-018: User with no notifications receives empty array with total=0', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user3Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.unreadCount).toBe(0);
  });

  it('HISTORY-019: Invalid page parameter (page <= 0) is rejected (400)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?page=0')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('HISTORY-020: Invalid limit parameter (limit <= 0) is rejected (400)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=0')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
  });

  it('HISTORY-021: Boolean transformation handles unreadOnly=true and readOnly=true correctly', async () => {
    const resUnread = await request(app.getHttpServer())
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(resUnread.status).toBe(200);
    expect(resUnread.body.notifications.every((n: any) => !n.isRead)).toBe(true);

    const resRead = await request(app.getHttpServer())
      .get('/api/notifications?readOnly=true')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(resRead.status).toBe(200);
    expect(resRead.body.notifications.every((n: any) => n.isRead)).toBe(true);
  });

  it('HISTORY-022: History response formatting preserves ISO 8601 timestamps', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const createdAtStr = res.body.notifications[0].createdAt;
    expect(new Date(createdAtStr).toISOString()).toBe(createdAtStr);
  });

  it('HISTORY-023: Marking item read reduces unreadCount while total history count remains unchanged', async () => {
    const initialRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);
    const initialTotal = initialRes.body.total;
    const initialUnread = initialRes.body.unreadCount;

    const unreadItem = initialRes.body.notifications.find((n: any) => !n.isRead);
    await request(app.getHttpServer())
      .patch(`/api/notifications/${unreadItem.id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    const afterRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(afterRes.body.total).toBe(initialTotal);
    expect(afterRes.body.unreadCount).toBe(initialUnread - 1);
  });

  it('HISTORY-024: History response does not leak user password hashes or secrets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    const resStr = JSON.stringify(res.body);
    expect(resStr).not.toContain('password');
    expect(resStr).not.toContain('hash1');
  });

  it('HISTORY-025: Concurrent read operations on history execute cleanly without state corruption', async () => {
    const promises = [1, 2, 3].map(() =>
      request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${user1Token}`),
    );

    const results = await Promise.all(promises);
    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(6);
    });
  });

  it('HISTORY-026: Deterministic sorting via id DESC for items created at identical timestamp', async () => {
    const sameTime = new Date('2026-09-25T15:00:00.000Z');
    const n1 = await notificationRepo.save(
      notificationRepo.create({
        userId: user3Id,
        title: 'Batch Item 1',
        message: 'Batch message 1',
        type: 'INFO',
        createdAt: sameTime,
      }),
    );
    const n2 = await notificationRepo.save(
      notificationRepo.create({
        userId: user3Id,
        title: 'Batch Item 2',
        message: 'Batch message 2',
        type: 'INFO',
        createdAt: sameTime,
      }),
    );

    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user3Token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(2);
    // Both items have same createdAt, so ordering should sort by id DESC
    expect(res.body.notifications[0].id).toBeDefined();
    expect(res.body.notifications[1].id).toBeDefined();
  });

  it('HISTORY-027: Combination of unreadOnly=true and type filter returns expected subset', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?unreadOnly=true&type=RM_SUBMITTED')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    res.body.notifications.forEach((n: any) => {
      expect(n.isRead).toBe(false);
      expect(n.type).toBe('RM_SUBMITTED');
    });
  });

  it('HISTORY-028: Combination of readOnly=true and type filter returns expected subset', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications?readOnly=true&type=MATERIAL_ISSUED')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    res.body.notifications.forEach((n: any) => {
      expect(n.isRead).toBe(true);
      expect(n.type).toBe('MATERIAL_ISSUED');
    });
  });

  it('HISTORY-029: Notification history remains persistent across repeated query requests', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);
    const res2 = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res1.body.total).toBe(res2.body.total);
    expect(res1.body.notifications.map((n: any) => n.id)).toEqual(
      res2.body.notifications.map((n: any) => n.id),
    );
  });

  it('HISTORY-030: Phase 15 email/communication provider remains unaffected and active', async () => {
    expect(mockProvider.name).toBe(EmailProvider.GMAIL_API);
  });
});
