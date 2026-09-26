import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { DataSource, Repository, Like } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { EmailWorkerService } from '../src/email/email-worker.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { UserNotificationPreference } from '../src/notifications/entities/user-notification-preference.entity.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import { NotificationType } from '../src/notifications/enums/notification-type.enum.js';

class CertificationMockEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  public shouldFailTemporary = false;
  public shouldFailPermanent = false;

  async send(msg: any) {
    this.calls.push(msg);
    if (this.shouldFailTemporary) {
      return { success: false, retryable: true, error: 'Gmail API 503 Service Unavailable' };
    }
    if (this.shouldFailPermanent) {
      return { success: false, retryable: false, error: '400 Invalid recipient address' };
    }
    return { success: true, providerMessageId: `cert-msg-${Date.now()}-${Math.random()}` };
  }
}

describe('Phase 16.12 — Final End-to-End Notification Certification Specification', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let emailJobRepo: Repository<EmailJob>;
  let userPrefRepo: Repository<UserNotificationPreference>;

  let communicationService: CommunicationService;
  let notificationsService: NotificationsService;
  let emailWorkerService: EmailWorkerService;
  let jwtService: JwtService;
  let mockProvider: CertificationMockEmailProvider;

  const storesUserId = '16120000-1111-1111-1111-111111111111';
  const designerUserId = '16120000-2222-2222-2222-222222222222';
  const productionUserId = '16120000-3333-3333-3333-333333333333';
  const managerUserId = '16120000-4444-4444-4444-444444444444';
  const adminUserId = '16120000-9999-9999-9999-999999999999';

  const allTestUserIds = [storesUserId, designerUserId, productionUserId, managerUserId, adminUserId];

  let storesToken: string;
  let designerToken: string;
  let productionToken: string;

  beforeAll(async () => {
    const providerInstance = new CertificationMockEmailProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(providerInstance)
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

    mockProvider = app.get(EMAIL_PROVIDER);
    dataSource = app.get(DataSource);
    notificationRepo = dataSource.getRepository(Notification);
    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);
    emailJobRepo = dataSource.getRepository(EmailJob);
    userPrefRepo = dataSource.getRepository(UserNotificationPreference);

    communicationService = app.get(CommunicationService);
    notificationsService = app.get(NotificationsService);
    emailWorkerService = app.get(EmailWorkerService);
    jwtService = app.get(JwtService);

    emailWorkerService.stop();
    (emailWorkerService as any).emailProvider = mockProvider;

    // Seed Roles and Test Users
    const roles = await roleRepo.find();
    const roleMap = new Map<string, string>();
    roles.forEach(r => roleMap.set(r.name, r.id));

    const storesRoleId = roleMap.get('STORES') || '00000000-0000-0000-0000-000000000001';
    const designerRoleId = roleMap.get('DESIGNER') || '00000000-0000-0000-0000-000000000003';
    const prodRoleId = roleMap.get('PRODUCTION') || '00000000-0000-0000-0000-000000000002';
    const managerRoleId = roleMap.get('SENIOR_MANAGER') || '00000000-0000-0000-0000-000000000004';
    const adminRoleId = roleMap.get('ADMIN') || '00000000-0000-0000-0000-000000000005';

    // Deactivate all non-certification users so recipient resolution returns only our active test users
    await dataSource.query(`UPDATE "users" SET "is_active" = false WHERE "id"::text NOT IN ('${allTestUserIds.join("','")}');`);

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${storesUserId}', 'Cert Stores User', 'stores.1612@test.com', 'hash', '${storesRoleId}', true),
        ('${designerUserId}', 'Cert Designer User', 'designer.1612@test.com', 'hash', '${designerRoleId}', true),
        ('${productionUserId}', 'Cert Production User', 'prod.1612@test.com', 'hash', '${prodRoleId}', true),
        ('${managerUserId}', 'Cert Manager User', 'manager.1612@test.com', 'hash', '${managerRoleId}', true),
        ('${adminUserId}', 'Cert Admin User', 'admin.1612@test.com', 'hash', '${adminRoleId}', true)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = true, "role_id" = EXCLUDED."role_id";
    `);

    // Tokens
    storesToken = jwtService.sign({ sub: storesUserId, role: UserRole.STORES, email: 'stores.1612@test.com' });
    designerToken = jwtService.sign({ sub: designerUserId, role: UserRole.DESIGNER, email: 'designer.1612@test.com' });
    productionToken = jwtService.sign({ sub: productionUserId, role: UserRole.PRODUCTION, email: 'prod.1612@test.com' });
  });

  beforeEach(async () => {
    mockProvider.calls = [];
    mockProvider.shouldFailTemporary = false;
    mockProvider.shouldFailPermanent = false;

    if (emailWorkerService) {
      emailWorkerService.stop();
      emailWorkerService.isEnabled = true;
      emailWorkerService.start(false);
    }

    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "email_logs" WHERE "job_id" IN (SELECT "id" FROM "email_jobs" WHERE "recipient_email" LIKE '%1612@test.com')`);
    await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_email" LIKE '%1612@test.com'`);
    await dataSource.query(`DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "system_settings" WHERE "key" = 'global_workflow_email_notifications_enabled'`);
  });

  afterAll(async () => {
    if (emailWorkerService) {
      emailWorkerService.stop();
    }
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "email_logs" WHERE "job_id" IN (SELECT "id" FROM "email_jobs" WHERE "recipient_email" LIKE '%1612@test.com')`);
    await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_email" LIKE '%1612@test.com'`);
    await dataSource.query(`DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`);
    if (app) {
      await app.close();
    }
  });

  describe('SECTION 1: Real Business Workflows End-to-End Certification', () => {
    it('E2E-1: RM_SUBMITTED triggers full chain (Commit -> Event -> Recipients -> In-App -> Email Job -> Worker)', async () => {
      const rmId = '16120000-0000-0000-0000-000000000001';

      // 1. Business Action & Event via CommunicationService
      const result = await communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-01',
        createdById: designerUserId,
      });

      expect(result).toBeDefined();

      // 2. In-App Notification check: STORES user received it, Designer actor excluded
      const storesNotifs = await notificationRepo.find({ where: { userId: storesUserId, targetId: rmId } });
      const designerNotifs = await notificationRepo.find({ where: { userId: designerUserId, targetId: rmId } });

      expect(storesNotifs.length).toBe(1);
      expect(designerNotifs.length).toBe(0); // Actor exclusion verified

      const storesNotif = storesNotifs[0];
      expect(storesNotif.isRead).toBe(false);

      // 3. Email Job check in Phase 15 Email Queue
      const emailJobs = await emailJobRepo.find({ where: { recipientEmail: 'stores.1612@test.com' } });
      expect(emailJobs.length).toBeGreaterThanOrEqual(1);
      const rmEmailJob = emailJobs.find(j => j.idempotencyKey.includes(rmId));
      expect(rmEmailJob).toBeDefined();

      // 4. Email Worker execution
      await emailWorkerService.pollTick();
      const updatedJob = await emailJobRepo.findOne({ where: { id: rmEmailJob?.id } });
      expect(updatedJob?.status).toBe(EmailJobStatus.SENT);
      expect(mockProvider.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('E2E-2: MATERIAL_ISSUED triggers full chain with Actor Exclusion', async () => {
      const rmId = '16120000-0000-0000-0000-000000000002';

      await communicationService.sendEvent({
        eventType: 'MATERIAL_ISSUED',
        entityType: 'MATERIAL_ISSUE',
        entityId: rmId,
        rmNumber: 'RM-1612-02',
        createdById: storesUserId, // STORES actor
        recipientUserId: productionUserId,
      });

      // Recipient check: PRODUCTION receives, STORES actor excluded
      const prodNotifs = await notificationRepo.find({ where: { userId: productionUserId, targetId: rmId } });
      const storesNotifs = await notificationRepo.find({ where: { userId: storesUserId, targetId: rmId } });

      expect(prodNotifs.length).toBe(1);
      expect(storesNotifs.length).toBe(0); // Actor excluded

      // Email Job
      const emailJobs = await emailJobRepo.find({ where: { recipientEmail: 'prod.1612@test.com' } });
      expect(emailJobs.length).toBeGreaterThanOrEqual(1);

      await emailWorkerService.pollTick();
      const updatedJob = await emailJobRepo.findOne({ where: { id: emailJobs[0].id } });
      expect(updatedJob?.status).toBe(EmailJobStatus.SENT);
    });

    it('E2E-3: ADDITIONAL_MATERIAL_REQUESTED triggers STORES recipient notification & email', async () => {
      const rmId = '16120000-0000-0000-0000-000000000003';

      await communicationService.sendEvent({
        eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
        entityType: 'ADDITIONAL_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-03',
        requestedById: productionUserId, // PRODUCTION actor
      });

      // Recipient check: STORES receives, PRODUCTION actor excluded
      const storesNotifs = await notificationRepo.find({ where: { userId: storesUserId, targetId: rmId } });
      const prodNotifs = await notificationRepo.find({ where: { userId: productionUserId, targetId: rmId } });

      expect(storesNotifs.length).toBe(1);
      expect(prodNotifs.length).toBe(0); // Actor excluded

      const emailJobs = await emailJobRepo.find({ where: { recipientEmail: 'stores.1612@test.com' } });
      expect(emailJobs.length).toBeGreaterThanOrEqual(1);
    });

    it('E2E-4: SC_COMPLETED triggers Relevant Designer notification & email', async () => {
      const scId = '16120000-0000-0000-0000-000000000004';

      await communicationService.sendEvent({
        eventType: 'SC_COMPLETED',
        entityType: 'SC',
        entityId: scId,
        scNumber: 'SC-1612-04',
        createdById: productionUserId, // PRODUCTION actor
        designerUserId: designerUserId, // Relevant Designer
      });

      const designerNotifs = await notificationRepo.find({ where: { userId: designerUserId, targetId: scId } });
      expect(designerNotifs.length).toBe(1);

      const emailJobs = await emailJobRepo.find({ where: { recipientEmail: 'designer.1612@test.com' } });
      expect(emailJobs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('SECTION 2: Failure & Transaction Safety Certification', () => {
    it('SAFE-1: Email Provider 503 failure does NOT rollback business state or in-app notification', async () => {
      mockProvider.shouldFailTemporary = true;
      const rmId = '16120000-0000-0000-0000-000000000010';

      const result = await communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-10',
        createdById: designerUserId,
      });

      expect(result.inAppNotifications.length).toBeGreaterThanOrEqual(1);

      // In-app notification persisted
      const storesNotif = await notificationRepo.findOne({ where: { userId: storesUserId, targetId: rmId } });
      expect(storesNotif).toBeDefined();

      // Process batch: Email Worker encounters 503 and marks job as RETRYING
      await emailWorkerService.pollTick();

      const job = await emailJobRepo.findOne({ where: { idempotencyKey: Like(`%${rmId}%`) } });
      expect(job).toBeDefined();
      expect(job?.status).toBe(EmailJobStatus.RETRYING);
      expect(job?.attempts).toBe(1);
    });

    it('SAFE-2: Permanent Email failure leaves in-app notification intact and marks job FAILED', async () => {
      mockProvider.shouldFailPermanent = true;
      const rmId = '16120000-0000-0000-0000-000000000011';

      await communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-11',
        createdById: designerUserId,
      });

      await emailWorkerService.pollTick();
      const job = await emailJobRepo.findOne({ where: { idempotencyKey: Like(`%${rmId}%`) } });
      expect(job).toBeDefined();
      expect(job?.status).toBe(EmailJobStatus.FAILED);

      // In-app notification remains intact
      const storesNotif = await notificationRepo.findOne({ where: { userId: storesUserId, targetId: rmId } });
      expect(storesNotif).toBeDefined();
    });
  });

  describe('SECTION 3: Duplicate Protection & Concurrency Certification', () => {
    it('DUP-1: Duplicate workflow event with same idempotency key produces exactly 1 notification per recipient', async () => {
      const rmId = '16120000-0000-0000-0000-000000000020';

      // First call
      await communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-20',
        createdById: designerUserId,
      });

      // Second call (Duplicate)
      await communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-20',
        createdById: designerUserId,
      });

      const storesNotifs = await notificationRepo.find({ where: { userId: storesUserId, targetId: rmId } });
      expect(storesNotifs.length).toBe(1);

      const emailJobs = await emailJobRepo.find({ where: { recipientEmail: 'stores.1612@test.com' } });
      expect(emailJobs.length).toBe(1);
    });
  });

  describe('SECTION 4: Read / Unread State & History Certification', () => {
    it('API-1: GET /api/notifications returns unread notifications and PATCH /:id/read updates state', async () => {
      // Create a notification for stores user
      const notif = await notificationRepo.save(
        notificationRepo.create({
          userId: storesUserId,
          title: 'Unread Test',
          message: 'Test message',
          type: NotificationType.INFO,
          isRead: false,
        }),
      );

      // GET /api/notifications
      const getRes = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(getRes.body.notifications).toBeDefined();
      const target = getRes.body.notifications.find((n: any) => n.id === notif.id);
      expect(target).toBeDefined();
      expect(target.isRead).toBe(false);

      // GET /api/notifications/unread-count
      const countRes = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(countRes.body.unreadCount).toBeGreaterThanOrEqual(1);

      // PATCH /api/notifications/:id/read
      await request(app.getHttpServer())
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const updatedNotif = await notificationRepo.findOne({ where: { id: notif.id } });
      expect(updatedNotif?.isRead).toBe(true);
    });

    it('API-2: History filtering by unreadOnly and readOnly works correctly', async () => {
      await notificationRepo.save([
        notificationRepo.create({ userId: storesUserId, title: 'Read 1', message: 'M', isRead: true }),
        notificationRepo.create({ userId: storesUserId, title: 'Unread 1', message: 'M', isRead: false }),
      ]);

      const unreadRes = await request(app.getHttpServer())
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(unreadRes.body.notifications.every((n: any) => n.isRead === false)).toBe(true);

      const readRes = await request(app.getHttpServer())
        .get('/api/notifications?readOnly=true')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(readRes.body.notifications.every((n: any) => n.isRead === true)).toBe(true);
    });
  });

  describe('SECTION 5: Preference Behavior & Authorization Security Certification', () => {
    it('PREF-1: User Workflow Email Preference OFF creates In-App notification but suppresses Email Job', async () => {
      // Set User Preference OFF for storesUser
      await userPrefRepo.save(
        userPrefRepo.create({
          userId: storesUserId,
          workflowEmailEnabled: false,
        }),
      );

      const rmId = '16120000-0000-0000-0000-000000000030';
      await communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: rmId,
        rmNumber: 'RM-1612-30',
        createdById: designerUserId,
      });

      // In-app created
      const notif = await notificationRepo.findOne({ where: { userId: storesUserId, targetId: rmId } });
      expect(notif).toBeDefined();

      // Email job NOT created because preference is OFF
      const emailJobs = await emailJobRepo.find({ where: { recipientEmail: 'stores.1612@test.com' } });
      const jobForRm = emailJobs.find(j => j.idempotencyKey.includes(rmId));
      expect(jobForRm).toBeUndefined();
    });

    it('SEC-1: User A cannot read or modify User B notification (IDOR Protection)', async () => {
      const userBNotif = await notificationRepo.save(
        notificationRepo.create({
          userId: designerUserId,
          title: 'Designer Private Notif',
          message: 'Private message',
          isRead: false,
        }),
      );

      // Stores user tries to mark Designer user's notification as read
      await request(app.getHttpServer())
        .patch(`/api/notifications/${userBNotif.id}/read`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(403); // Security isolation returns 403

      // User B notification remains unread
      const rechecked = await notificationRepo.findOne({ where: { id: userBNotif.id } });
      expect(rechecked?.isRead).toBe(false);
    });

    it('SEC-2: Unauthenticated requests are rejected with 401', async () => {
      await request(app.getHttpServer()).get('/api/notifications').expect(401);
      await request(app.getHttpServer()).get('/api/notifications/unread-count').expect(401);
    });
  });
});
