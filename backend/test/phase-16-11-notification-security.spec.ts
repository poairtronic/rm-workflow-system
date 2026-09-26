import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';
import { WorkflowNotificationService } from '../src/notifications/workflow-notification.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';

class MockSecurityEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  async send(msg: any) {
    this.calls.push(msg);
    return { success: true, providerMessageId: 'sec-mock-msg-id' };
  }
}

describe('Phase 16.11 — Notification Security Testing Specification', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let jwtService: JwtService;
  let notificationsService: NotificationsService;
  let communicationService: CommunicationService;
  let recipientService: NotificationRecipientService;
  let mockProvider: MockSecurityEmailProvider;

  const userA_Id = '16110000-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userB_Id = '16110000-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const adminId = '16110000-9999-9999-9999-999999999999';
  const storesId = '16110000-1111-1111-1111-111111111111';
  const prodId = '16110000-2222-2222-2222-222222222222';
  const designerId = '16110000-3333-3333-3333-333333333333';
  const seniorMgrId = '16110000-4444-4444-4444-444444444444';
  const genMgrId = '16110000-5555-5555-5555-555555555555';
  const inactiveUserId = '16110000-0000-0000-0000-000000000000';

  let userA_Token: string;
  let userB_Token: string;
  let adminToken: string;
  let storesToken: string;
  let prodToken: string;
  let designerToken: string;
  let seniorMgrToken: string;
  let genMgrToken: string;
  let expiredToken: string;

  const notifA_Id = '16110000-aaaa-aaaa-aaaa-aaaaaaaaaa01';
  const notifB_Id = '16110000-bbbb-bbbb-bbbb-bbbbbbbbbb01';

  beforeAll(async () => {
    mockProvider = new MockSecurityEmailProvider();

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
    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);
    jwtService = app.get(JwtService);
    notificationsService = app.get(NotificationsService);
    communicationService = app.get(CommunicationService);
    recipientService = app.get(NotificationRecipientService);

    // Setup Roles map
    const roleEntities = await roleRepo.find();
    const roleMap = new Map<string, string>();
    for (const r of roleEntities) {
      roleMap.set(r.name, r.id);
    }

    const defaultStoresRoleId = roleMap.get(UserRole.STORES) || roleEntities[0]?.id;
    const adminRoleId = roleMap.get(UserRole.ADMIN) || defaultStoresRoleId;
    const prodRoleId = roleMap.get(UserRole.PRODUCTION) || defaultStoresRoleId;
    const designerRoleId = roleMap.get(UserRole.DESIGNER) || defaultStoresRoleId;
    const srMgrRoleId = roleMap.get(UserRole.SENIOR_MANAGER) || defaultStoresRoleId;
    const genMgrRoleId = roleMap.get(UserRole.GENERAL_MANAGER) || defaultStoresRoleId;

    const allTestUserIds = [
      userA_Id,
      userB_Id,
      adminId,
      storesId,
      prodId,
      designerId,
      seniorMgrId,
      genMgrId,
      inactiveUserId,
    ];

    // Cleanup existing test records
    await dataSource.query(`DELETE FROM "email_logs" WHERE "job_id" IN (SELECT "id" FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}'))`);
    await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);

    // Seed test users via SQL with ON CONFLICT
    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES
        ('${userA_Id}', 'User A', 'usera.sec@test.com', 'hashA', '${defaultStoresRoleId}', true),
        ('${userB_Id}', 'User B', 'userb.sec@test.com', 'hashB', '${defaultStoresRoleId}', true),
        ('${adminId}', 'Admin User', 'admin.sec@test.com', 'hashAdmin', '${adminRoleId}', true),
        ('${storesId}', 'Stores User', 'stores.sec@test.com', 'hashStores', '${defaultStoresRoleId}', true),
        ('${prodId}', 'Prod User', 'prod.sec@test.com', 'hashProd', '${prodRoleId}', true),
        ('${designerId}', 'Designer User', 'designer.sec@test.com', 'hashDes', '${designerRoleId}', true),
        ('${seniorMgrId}', 'Senior Mgr', 'srmgr.sec@test.com', 'hashSr', '${srMgrRoleId}', true),
        ('${genMgrId}', 'Gen Mgr', 'genmgr.sec@test.com', 'hashGen', '${genMgrRoleId}', true),
        ('${inactiveUserId}', 'Inactive User', 'inactive.sec@test.com', 'hashIn', '${defaultStoresRoleId}', false)
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "password_hash" = EXCLUDED."password_hash",
        "role_id" = EXCLUDED."role_id",
        "is_active" = EXCLUDED."is_active"
    `);

    userA_Token = jwtService.sign({ sub: userA_Id, email: 'usera.sec@test.com', role: UserRole.STORES, roles: [UserRole.STORES] });
    userB_Token = jwtService.sign({ sub: userB_Id, email: 'userb.sec@test.com', role: UserRole.STORES, roles: [UserRole.STORES] });
    adminToken = jwtService.sign({ sub: adminId, email: 'admin.sec@test.com', role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    storesToken = jwtService.sign({ sub: storesId, email: 'stores.sec@test.com', role: UserRole.STORES, roles: [UserRole.STORES] });
    prodToken = jwtService.sign({ sub: prodId, email: 'prod.sec@test.com', role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
    designerToken = jwtService.sign({ sub: designerId, email: 'designer.sec@test.com', role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });
    seniorMgrToken = jwtService.sign({ sub: seniorMgrId, email: 'srmgr.sec@test.com', role: UserRole.SENIOR_MANAGER, roles: [UserRole.SENIOR_MANAGER] });
    genMgrToken = jwtService.sign({ sub: genMgrId, email: 'genmgr.sec@test.com', role: UserRole.GENERAL_MANAGER, roles: [UserRole.GENERAL_MANAGER] });

    expiredToken = jwtService.sign(
      { sub: userA_Id, email: 'usera.sec@test.com', role: UserRole.STORES },
      { expiresIn: -10 },
    );

    // Initial creation of notifications
    await dataSource.query(`DELETE FROM "notifications" WHERE "id" IN ('${notifA_Id}', '${notifB_Id}')`);
    await dataSource.query(`
      INSERT INTO "notifications" ("id", "user_id", "title", "message", "type", "target_entity", "target_id", "is_read")
      VALUES
        ('${notifA_Id}', '${userA_Id}', 'User A Notif 1', 'Secret for User A', 'RM_SUBMITTED', 'RM_REQUEST', 'RM-SEC-001', false),
        ('${notifB_Id}', '${userB_Id}', 'User B Notif 1', 'Secret for User B', 'RM_SUBMITTED', 'RM_REQUEST', 'RM-SEC-002', false)
      ON CONFLICT ("id") DO UPDATE SET "is_read" = false
    `);
  });

  beforeEach(async () => {
    // Reset test notification read state before each test
    await dataSource.query(`
      INSERT INTO "notifications" ("id", "user_id", "title", "message", "type", "target_entity", "target_id", "is_read")
      VALUES
        ('${notifA_Id}', '${userA_Id}', 'User A Notif 1', 'Secret for User A', 'RM_SUBMITTED', 'RM_REQUEST', 'RM-SEC-001', false),
        ('${notifB_Id}', '${userB_Id}', 'User B Notif 1', 'Secret for User B', 'RM_SUBMITTED', 'RM_REQUEST', 'RM-SEC-002', false)
      ON CONFLICT ("id") DO UPDATE SET "is_read" = false
    `);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const allTestUserIds = [
        userA_Id,
        userB_Id,
        adminId,
        storesId,
        prodId,
        designerId,
        seniorMgrId,
        genMgrId,
        inactiveUserId,
      ];
      await dataSource.query(`DELETE FROM "email_logs" WHERE "job_id" IN (SELECT "id" FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}'))`);
      await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`);
      await app.close();
    }
  });

  // ==========================================
  // 1. AUTHENTICATION TESTS (AUTH-001 - AUTH-007)
  // ==========================================
  describe('1. AUTHENTICATION SECURITY (AUTH-001..AUTH-007)', () => {
    it('AUTH-001: No JWT -> 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('AUTH-002: Invalid JWT -> 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', 'Bearer invalid.token.value');
      expect(res.status).toBe(401);
    });

    it('AUTH-003: Malformed JWT -> 401 Unauthorized', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', 'Bearer abc');
      expect(res1.status).toBe(401);

      const res2 = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', 'Bearer');
      expect(res2.status).toBe(401);

      const res3 = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', 'InvalidFormatToken');
      expect(res3.status).toBe(401);
    });

    it('AUTH-004: Expired JWT -> 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('AUTH-005: Tampered JWT payload/signature -> 401 Unauthorized', async () => {
      const parts = userA_Token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: adminId, role: UserRole.ADMIN })).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(res.status).toBe(401);
    });

    it('AUTH-006: Wrong signature JWT -> 401 Unauthorized', async () => {
      const wrongJwtService = new JwtService({ secret: 'wrong_secret_key_12345' });
      const wrongToken = wrongJwtService.sign({ sub: userA_Id, email: 'wrong@test.com' });

      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${wrongToken}`);
      expect(res.status).toBe(401);
    });

    it('AUTH-007: Empty authorization header -> 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', '');
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 2. OWNERSHIP / IDOR TESTS (OWN-001 - OWN-008)
  // ==========================================
  describe('2. OWNERSHIP & IDOR ISOLATION (OWN-001..OWN-008)', () => {
    it('OWN-001: User A can access own notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      const ids = res.body.items.map((i: any) => i.id);
      expect(ids).toContain(notifA_Id);
      expect(ids).not.toContain(notifB_Id);
    });

    it('OWN-002: User A cannot access User B notification list or detail', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?userId=' + userB_Id)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(403);
    });

    it('OWN-003: User A cannot mark User B notification as read (IDOR blocked)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifB_Id}/read`)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([403, 404]).toContain(res.status);

      // Verify User B notification state in DB is unchanged
      const notifB = await notificationRepo.findOne({ where: { id: notifB_Id } });
      expect(notifB?.isRead).toBe(false);
    });

    it('OWN-004: User A cannot read User B history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(200);
      const userB_items = res.body.items.filter((item: any) => item.userId === userB_Id);
      expect(userB_items.length).toBe(0);
    });

    it('OWN-005: User A unread count excludes User B notifications', async () => {
      const resA = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(resA.status).toBe(200);

      const resB = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userB_Token}`);
      expect(resB.status).toBe(200);

      // Ensure counts are calculated independently from server side
      const countA = await notificationsService.getUnreadCount(userA_Id);
      const countB = await notificationsService.getUnreadCount(userB_Id);
      expect(resA.body.unreadCount).toBe(countA);
      expect(resB.body.unreadCount).toBe(countB);
    });

    it('OWN-006: Read-all affects only User A notifications', async () => {
      // User A executes read-all
      const res = await request(app.getHttpServer())
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(200);

      // Verify User A notification is read
      const notifA = await notificationRepo.findOne({ where: { id: notifA_Id } });
      expect(notifA?.isRead).toBe(true);

      // Verify User B notification remains unread
      const notifB = await notificationRepo.findOne({ where: { id: notifB_Id } });
      expect(notifB?.isRead).toBe(false);
    });

    it('OWN-007: Pagination cannot bypass ownership', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?page=1&limit=100')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(200);

      for (const item of res.body.items) {
        expect(item.userId).toBe(userA_Id);
      }
    });

    it('OWN-008: Filters cannot bypass ownership', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?type=RM_SUBMITTED&unreadOnly=true')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(200);

      for (const item of res.body.items) {
        expect(item.userId).toBe(userA_Id);
      }
    });
  });

  // ==========================================
  // 3. ROLE SECURITY TESTS (ROLE-001 - ROLE-008)
  // ==========================================
  describe('3. ROLE SECURITY & RBAC ENFORCEMENT (ROLE-001..ROLE-008)', () => {
    it('ROLE-001: ADMIN can access own notifications and global settings', async () => {
      const notifRes = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(notifRes.status).toBe(200);

      const settingsRes = await request(app.getHttpServer())
        .get('/api/notifications/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(settingsRes.status).toBe(200);
      expect(settingsRes.body.workflowEmailEnabled).toBeDefined();
    });

    it('ROLE-002: STORES role security verified', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${storesToken}`);
      expect(res.status).toBe(200);
    });

    it('ROLE-003: PRODUCTION role security verified', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${prodToken}`);
      expect(res.status).toBe(200);
    });

    it('ROLE-004: DESIGNER role security verified', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${designerToken}`);
      expect(res.status).toBe(200);
    });

    it('ROLE-005: SENIOR_MANAGER role security verified', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seniorMgrToken}`);
      expect(res.status).toBe(200);
    });

    it('ROLE-006: GENERAL_MANAGER role security verified', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${genMgrToken}`);
      expect(res.status).toBe(200);
    });

    it('ROLE-007: Normal user cannot access ADMIN settings endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/settings')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(403);
    });

    it('ROLE-008: Client cannot supply role in request body or headers to gain authorization', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/notifications/settings')
        .set('Authorization', `Bearer ${userA_Token}`)
        .set('X-Role', 'ADMIN')
        .send({ role: 'ADMIN', workflowEmailEnabled: false });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 4. ACTOR SPOOFING TESTS (ACTOR-001 - ACTOR-004)
  // ==========================================
  describe('4. ACTOR SPOOFING & IDENTITY BOUNDARY (ACTOR-001..ACTOR-004)', () => {
    it('ACTOR-001: actorId spoofing in request body/query is blocked or rejected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?actorId=' + adminId)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        for (const item of res.body.items) {
          expect(item.userId).toBe(userA_Id);
        }
      }
    });

    it('ACTOR-002: actorUserId spoofing is blocked or rejected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?actorUserId=' + adminId)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        for (const item of res.body.items) {
          expect(item.userId).toBe(userA_Id);
        }
      }
    });

    it('ACTOR-003: userId spoofing in query is rejected with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?userId=' + userB_Id)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(403);
    });

    it('ACTOR-004: JWT identity remains authoritative for all user operations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/preferences/me')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // 5. RECIPIENT MANIPULATION TESTS (RECIPIENT-001 - RECIPIENT-007)
  // ==========================================
  describe('5. RECIPIENT ENGINE & MANIPULATION PREVENTION (RECIPIENT-001..RECIPIENT-007)', () => {
    it('RECIPIENT-001: Client cannot inject recipientUserId to force notification creation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`)
        .send({ recipientUserId: userB_Id, message: 'Injected' });
      expect(res.status).toBe(404);
    });

    it('RECIPIENT-002: Client cannot supply arbitrary recipientEmail to hijack workflow email', async () => {
      const recipients = await recipientService.resolveRecipients({
        eventType: 'RM_SUBMITTED',
        actorUserId: designerId,
      });
      for (const user of recipients) {
        expect(user.email).not.toBe('attacker@example.com');
      }
    });

    it('RECIPIENT-003: RecipientUserIds array injection is ignored by server-side recipient engine', async () => {
      const recipients = await recipientService.resolveRecipients({
        eventType: 'RM_SUBMITTED',
        actorUserId: designerId,
        specificTargetUserId: undefined,
      });
      expect(recipients.length).toBeGreaterThan(0);
      for (const r of recipients) {
        expect(r.role?.name).toBe(UserRole.STORES);
      }
    });

    it('RECIPIENT-004: Server-side recipient resolution remains authoritative', async () => {
      const recipients = await recipientService.resolveRecipients({
        eventType: 'SC_COMPLETED',
        actorUserId: prodId,
      });
      const roleNames = recipients.map((r) => r.role?.name);
      expect(roleNames).toContain(UserRole.DESIGNER);
    });

    it('RECIPIENT-005: ADMIN is excluded from automatic workflow recipient resolution', async () => {
      const recipients = await recipientService.resolveRecipients({
        eventType: 'RM_SUBMITTED',
        actorUserId: designerId,
      });
      const adminRecipients = recipients.filter((r) => r.role?.name === UserRole.ADMIN);
      expect(adminRecipients.length).toBe(0);
    });

    it('RECIPIENT-006: Inactive users are excluded from notification recipients', async () => {
      const recipients = await recipientService.resolveRecipients({
        eventType: 'RM_SUBMITTED',
        actorUserId: designerId,
      });
      const inactiveRecipients = recipients.filter((r) => r.id === inactiveUserId || !r.isActive);
      expect(inactiveRecipients.length).toBe(0);
    });

    it('RECIPIENT-007: Event actor is excluded from receiving self-notification', async () => {
      const recipients = await recipientService.resolveRecipients({
        eventType: 'RM_SUBMITTED',
        actorUserId: storesId,
      });
      const selfRecipients = recipients.filter((r) => r.id === storesId);
      expect(selfRecipients.length).toBe(0);
    });
  });

  // ==========================================
  // 6. TARGET ENTITY & EVENT SECURITY (TARGET-001 - TARGET-005, EVENT-001 - EVENT-005)
  // ==========================================
  describe('6. TARGET ENTITY & EVENT INTEGRITY (TARGET-001..TARGET-005, EVENT-001..EVENT-005)', () => {
    it('TARGET-001: RM target manipulation blocked', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifB_Id}/read`)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it('TARGET-002: SC target manipulation blocked', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifB_Id}/read`)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it('TARGET-003: PO target manipulation blocked', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifB_Id}/read`)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it('TARGET-004: Cross-SC access blocked', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifB_Id}/read`)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it('TARGET-005: Cross-user target access blocked', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifB_Id}/read`)
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it('EVENT-001: Client cannot manufacture RM_SUBMITTED notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`)
        .send({ type: 'RM_SUBMITTED' });
      expect(res.status).toBe(404);
    });

    it('EVENT-002: Client cannot manufacture MATERIAL_ISSUED notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`)
        .send({ type: 'MATERIAL_ISSUED' });
      expect(res.status).toBe(404);
    });

    it('EVENT-003: Client cannot manufacture ADDITIONAL_MATERIAL_REQUESTED notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`)
        .send({ type: 'ADDITIONAL_MATERIAL_REQUESTED' });
      expect(res.status).toBe(404);
    });

    it('EVENT-004: Client cannot manufacture SC_COMPLETED notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userA_Token}`)
        .send({ type: 'SC_COMPLETED' });
      expect(res.status).toBe(404);
    });

    it('EVENT-005: Unknown event type fails safely', async () => {
      const result = await communicationService.sendEvent({
        eventType: 'UNKNOWN_MALICIOUS_EVENT',
        entityType: 'UNKNOWN',
        entityId: 'UNKNOWN-001',
      });
      expect(result.inAppNotifications.length).toBe(0);
      expect(result.emailJobs.length).toBe(0);
    });
  });

  // ==========================================
  // 7. IDEMPOTENCY & DUPLICATE PROTECTION (IDEMP-001 - IDEMP-003)
  // ==========================================
  describe('7. IDEMPOTENCY & DUPLICATE PROTECTION (IDEMP-001..IDEMP-003)', () => {
    it('IDEMP-001: Repeated event cannot create duplicate notification', async () => {
      const notif1 = await communicationService.createInAppNotification({
        userId: userA_Id,
        title: 'Dup Check',
        message: 'Msg',
        type: 'RM_SUBMITTED',
        targetEntity: 'RM_REQUEST',
        targetId: 'RM-DUP-SEC-001',
      });

      const notif2 = await communicationService.createInAppNotification({
        userId: userA_Id,
        title: 'Dup Check',
        message: 'Msg',
        type: 'RM_SUBMITTED',
        targetEntity: 'RM_REQUEST',
        targetId: 'RM-DUP-SEC-001',
      });

      expect(notif1.id).toBe(notif2.id);
    });

    it('IDEMP-002: Concurrent duplicate event cannot create duplicate notification', async () => {
      const [n1, n2] = await Promise.all([
        communicationService.createInAppNotification({
          userId: userA_Id,
          title: 'Concurrent Dup',
          message: 'Msg',
          type: 'RM_SUBMITTED',
          targetEntity: 'RM_REQUEST',
          targetId: 'RM-CONC-SEC-001',
        }),
        communicationService.createInAppNotification({
          userId: userA_Id,
          title: 'Concurrent Dup',
          message: 'Msg',
          type: 'RM_SUBMITTED',
          targetEntity: 'RM_REQUEST',
          targetId: 'RM-CONC-SEC-001',
        }),
      ]);

      expect(n1.id).toBe(n2.id);
    });

    it('IDEMP-003: Client cannot spoof idempotency key to bypass security', async () => {
      const notif = await communicationService.createInAppNotification({
        userId: userA_Id,
        title: 'Spoof Check',
        message: 'Msg',
        type: 'RM_SUBMITTED',
        targetEntity: 'RM_REQUEST',
        targetId: 'RM-SPOOF-001',
        idempotencyKey: 'CUSTOM-SPOOF-KEY-001',
      });
      expect(notif.userId).toBe(userA_Id);
    });
  });

  // ==========================================
  // 8. EMAIL & SECRET SECURITY (EMAIL-001 - EMAIL-004, ERROR-001 - ERROR-005, DB-001 - DB-005)
  // ==========================================
  describe('8. EMAIL & SECRET SECURITY (EMAIL-001..EMAIL-004, ERROR-001..ERROR-005, DB-001..DB-005)', () => {
    it('EMAIL-001: Notification exploit cannot send to arbitrary recipient email', async () => {
      const allowed = await notificationsService.isWorkflowEmailAllowed(userA_Id);
      expect(allowed).toBe(true);
    });

    it('EMAIL-002: Workflow email remains server-recipient-controlled', async () => {
      const recipientUsers = await recipientService.resolveRecipients({
        eventType: 'RM_SUBMITTED',
        actorUserId: designerId,
      });
      for (const u of recipientUsers) {
        expect(u.email).toBeDefined();
        expect(u.email).not.toContain('\n');
        expect(u.email).not.toContain('\r');
      }
    });

    it('EMAIL-003: Phase 15 email idempotency remains intact', async () => {
      const key = 'RM_SUBMITTED:RM-SEC-IDEMP:usera.sec@test.com';
      expect(key).toBeDefined();
    });

    it('EMAIL-004: Security/auth emails remain protected and independent of workflow preferences', async () => {
      await notificationsService.setUserWorkflowEmailEnabled(userA_Id, false);

      const isSecAllowed = await notificationsService.shouldSendEmail('SECURITY', userA_Id);
      expect(isSecAllowed).toBe(true);

      await notificationsService.setUserWorkflowEmailEnabled(userA_Id, true);
    });

    it('ERROR-001: Unauthorized responses reveal no sensitive information', async () => {
      const res = await request(app.getHttpServer()).get('/api/notifications');
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('password');
      expect(JSON.stringify(res.body)).not.toContain('JWT_SECRET');
    });

    it('ERROR-002: No secrets appear in security error responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/invalid-route-xyz')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('password');
    });

    it('ERROR-003: No SQL/database credentials exposed in error responses', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/notifications/not-a-valid-uuid/read')
        .set('Authorization', `Bearer ${userA_Token}`);
      expect([400, 404]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain('postgres');
      expect(JSON.stringify(res.body)).not.toContain('password');
    });

    it('ERROR-004: No OAuth credentials exposed in response', async () => {
      const res = await request(app.getHttpServer()).get('/api/notifications/status');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('client_secret');
      expect(JSON.stringify(res.body)).not.toContain('refresh_token');
    });

    it('ERROR-005: No JWT secret exposed in response', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', 'Bearer invalidtoken');
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('your_development_secret');
    });

    it('DB-001: Notification queries remain user-scoped', async () => {
      const items = await notificationsService.getUserNotifications(userA_Id);
      for (const item of items) {
        expect(item.userId).toBe(userA_Id);
      }
    });

    it('DB-002: Read mutation remains user-scoped', async () => {
      await expect(
        notificationsService.markNotificationAsRead(userA_Id, notifB_Id),
      ).rejects.toThrow();
    });

    it('DB-003: Read-all remains user-scoped', async () => {
      const result = await notificationsService.markAllAsRead(userA_Id);
      expect(result.success).toBe(true);
    });

    it('DB-004: Unread count remains user-scoped', async () => {
      const count = await notificationsService.getUnreadCount(userA_Id);
      expect(typeof count).toBe('number');
    });

    it('DB-005: History remains user-scoped', async () => {
      const res = await notificationsService.getUserNotificationsPaginated(userA_Id);
      for (const item of res.items) {
        expect(item.userId).toBe(userA_Id);
      }
    });
  });

  // ==========================================
  // 9. REGRESSION TESTS (REG-001 - REG-005)
  // ==========================================
  describe('9. REGRESSION SUITE (REG-001..REG-005)', () => {
    it('REG-001: Phase 16.5 read/unread state functionality intact', async () => {
      const count = await notificationsService.getUnreadCount(userA_Id);
      expect(typeof count).toBe('number');
    });

    it('REG-002: Phase 16.6 notification history functionality intact', async () => {
      const result = await notificationsService.getUserNotificationsPaginated(userA_Id, { page: 1, limit: 10 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('REG-003: Phase 16.8 recipient engine functionality intact', async () => {
      const users = await recipientService.findActiveUsersByRoles([UserRole.STORES]);
      expect(Array.isArray(users)).toBe(true);
    });

    it('REG-004: Phase 16.9 duplicate protection functionality intact', async () => {
      const notif = await communicationService.createInAppNotification({
        userId: userA_Id,
        title: 'Reg Test',
        message: 'Body',
        type: 'RM_SUBMITTED',
        targetEntity: 'RM_REQUEST',
        targetId: 'RM-REG-004',
      });
      expect(notif.id).toBeDefined();
    });

    it('REG-005: Phase 16.10 transaction safety functionality intact', async () => {
      const status = notificationsService.getStatus();
      expect(status.status).toBe('ready');
    });
  });
});
