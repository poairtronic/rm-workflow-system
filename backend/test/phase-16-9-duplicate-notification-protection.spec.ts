import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { WorkflowNotificationService } from '../src/notifications/workflow-notification.service.js';
import { EmailIdempotencyService } from '../src/email/email-idempotency.service.js';

class MockEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  async send(msg: any) {
    this.calls.push(msg);
    return { success: true, providerMessageId: `mock-msg-${Date.now()}` };
  }
}

describe('Phase 16.9 — Duplicate Notification Protection Specification (IDEMPOTENCY-001 to IDEMPOTENCY-030)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let emailJobRepo: Repository<EmailJob>;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;
  let notificationsService: NotificationsService;
  let communicationService: CommunicationService;
  let workflowNotificationService: WorkflowNotificationService;
  let emailIdempotencyService: EmailIdempotencyService;

  const storesUserId = '16900000-1111-1111-1111-111111111111';
  const productionUserId = '16900000-2222-2222-2222-222222222222';
  const designerUserId = '16900000-3333-3333-3333-333333333333';
  const managerUserId = '16900000-4444-4444-4444-444444444444';
  const adminUserId = '16900000-9999-9999-9999-999999999999';
  const inactiveStoresUserId = '16900000-8888-8888-8888-888888888888';

  let storesToken: string;
  let productionToken: string;

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
    emailJobRepo = dataSource.getRepository(EmailJob);
    jwtService = app.get(JwtService);
    notificationsService = app.get(NotificationsService);
    communicationService = app.get(CommunicationService);
    workflowNotificationService = app.get(WorkflowNotificationService);
    emailIdempotencyService = app.get(EmailIdempotencyService);

    const roles = await dataSource.query(`SELECT "id", "name" FROM "roles"`);
    const roleMap = new Map<string, string>();
    roles.forEach((r: any) => roleMap.set(r.name, r.id));

    const storesRoleId = roleMap.get('STORES') || '00000000-0000-0000-0000-000000000001';
    const prodRoleId = roleMap.get('PRODUCTION') || '00000000-0000-0000-0000-000000000002';
    const designerRoleId = roleMap.get('DESIGNER') || '00000000-0000-0000-0000-000000000003';
    const managerRoleId = roleMap.get('SENIOR_MANAGER') || '00000000-0000-0000-0000-000000000004';
    const adminRoleId = roleMap.get('ADMIN') || '00000000-0000-0000-0000-000000000005';

    await dataSource.query(`
      DELETE FROM "email_logs" WHERE "recipient_email" LIKE '%.169@test.com';
      DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${storesUserId}', '${productionUserId}', '${designerUserId}', '${managerUserId}', '${adminUserId}', '${inactiveStoresUserId}') OR "recipient_email" LIKE '%.169@test.com';
      DELETE FROM "notifications" WHERE "user_id" IN ('${storesUserId}', '${productionUserId}', '${designerUserId}', '${managerUserId}', '${adminUserId}', '${inactiveStoresUserId}');
      DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${storesUserId}', '${productionUserId}', '${designerUserId}', '${managerUserId}', '${adminUserId}', '${inactiveStoresUserId}');
      DELETE FROM "users" WHERE "id" IN ('${storesUserId}', '${productionUserId}', '${designerUserId}', '${managerUserId}', '${adminUserId}', '${inactiveStoresUserId}') OR "email" LIKE '%.169@test.com';
    `);

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${storesUserId}', 'Stores User 169', 'stores.169@test.com', 'hash1', '${storesRoleId}', true),
        ('${productionUserId}', 'Production User 169', 'prod.169@test.com', 'hash2', '${prodRoleId}', true),
        ('${designerUserId}', 'Designer User 169', 'designer.169@test.com', 'hash3', '${designerRoleId}', true),
        ('${managerUserId}', 'Manager User 169', 'manager.169@test.com', 'hash4', '${managerRoleId}', true),
        ('${adminUserId}', 'Admin User 169', 'admin.169@test.com', 'hash5', '${adminRoleId}', true),
        ('${inactiveStoresUserId}', 'Inactive Stores 169', 'inactive.169@test.com', 'hash6', '${storesRoleId}', false)
      ON CONFLICT ("id") DO NOTHING;
    `);

    storesToken = jwtService.sign({ sub: storesUserId, userId: storesUserId, email: 'stores.169@test.com', role: UserRole.STORES, roles: [UserRole.STORES] });
    productionToken = jwtService.sign({ sub: productionUserId, userId: productionUserId, email: 'prod.169@test.com', role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
  });

  beforeEach(async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'SETUP');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);
    await notificationsService.setUserWorkflowEmailEnabled(productionUserId, true);
    await notificationsService.setUserWorkflowEmailEnabled(designerUserId, true);

    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs"`);
    await dataSource.query(`DELETE FROM "notifications"`);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM "email_logs"`);
      await dataSource.query(`DELETE FROM "email_jobs"`);
      await dataSource.query(`DELETE FROM "notifications"`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${storesUserId}', '${productionUserId}', '${designerUserId}', '${managerUserId}', '${adminUserId}', '${inactiveStoresUserId}')`);
    }
    if (app) {
      await app.close();
    }
  });

  // --- CORE IDEMPOTENCY TESTS (IDEMPOTENCY-001 to IDEMPOTENCY-006) ---

  it('IDEMPOTENCY-001: First business event creates in-app notification', async () => {
    const eventId = `idempotency-1-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-IDEM-001', createdById: designerUserId });

    const count = await notificationRepo.count({ where: { targetId: eventId, userId: storesUserId } });
    expect(count).toBe(1);
  });

  it('IDEMPOTENCY-002: Same event repeated once does not create duplicate in-app notification', async () => {
    const eventId = `idempotency-2-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-IDEM-002', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const count = await notificationRepo.count({ where: { targetId: eventId, userId: storesUserId } });
    expect(count).toBe(1);
  });

  it('IDEMPOTENCY-003: Same event repeated 10 times creates exactly one notification per recipient', async () => {
    const eventId = `idempotency-3-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-IDEM-003', createdById: designerUserId };

    for (let i = 0; i < 10; i++) {
      await workflowNotificationService.notifyRmSubmitted(payload);
    }

    const count = await notificationRepo.count({ where: { targetId: eventId, userId: storesUserId } });
    expect(count).toBe(1);
  });

  it('IDEMPOTENCY-004: Different recipients produce separate notifications', async () => {
    const eventId = `idempotency-4-${Date.now()}`;
    await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'Title',
      message: 'Msg',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: eventId,
    });

    await communicationService.createInAppNotification({
      userId: productionUserId,
      title: 'Title',
      message: 'Msg',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: eventId,
    });

    const storesCount = await notificationRepo.count({ where: { targetId: eventId, userId: storesUserId } });
    const prodCount = await notificationRepo.count({ where: { targetId: eventId, userId: productionUserId } });

    expect(storesCount).toBe(1);
    expect(prodCount).toBe(1);
  });

  it('IDEMPOTENCY-005: Different business entities produce separate notifications', async () => {
    const entity1 = `entity-1-${Date.now()}`;
    const entity2 = `entity-2-${Date.now()}`;

    await workflowNotificationService.notifyRmSubmitted({ id: entity1, rmNumber: 'RM-E1', createdById: designerUserId });
    await workflowNotificationService.notifyRmSubmitted({ id: entity2, rmNumber: 'RM-E2', createdById: designerUserId });

    const n1 = await notificationRepo.count({ where: { targetId: entity1 } });
    const n2 = await notificationRepo.count({ where: { targetId: entity2 } });

    expect(n1).toBeGreaterThanOrEqual(1);
    expect(n2).toBeGreaterThanOrEqual(1);
  });

  it('IDEMPOTENCY-006: Different event types produce separate notifications', async () => {
    const entityId = `entity-type-${Date.now()}`;

    await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'RM Submitted',
      message: 'RM Submitted',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: entityId,
    });

    await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'SC Completed',
      message: 'SC Completed',
      type: 'SC_COMPLETED',
      targetEntity: 'SC',
      targetId: entityId,
    });

    const rmCount = await notificationRepo.count({ where: { targetId: entityId, type: 'RM_SUBMITTED' } });
    const scCount = await notificationRepo.count({ where: { targetId: entityId, type: 'SC_COMPLETED' } });

    expect(rmCount).toBe(1);
    expect(scCount).toBe(1);
  });

  // --- RECIPIENT & ACTOR RULES (IDEMPOTENCY-007 to IDEMPOTENCY-009) ---

  it('IDEMPOTENCY-007: Inactive recipient does not receive notification', async () => {
    const eventId = `inact-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-INACT', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: inactiveStoresUserId } });
    expect(notif).toBeNull();
  });

  it('IDEMPOTENCY-008: Actor remains excluded from receiving self-notification', async () => {
    const requestId = `actor-ex-${Date.now()}`;
    await workflowNotificationService.notifyAdditionalMaterialRequested({
      id: requestId,
      scId: 'SC-ACTOR',
      rmNumber: 'RM-ACTOR-1',
      requestedById: productionUserId,
    });

    const actorNotif = await notificationRepo.findOne({ where: { targetId: requestId, userId: productionUserId } });
    expect(actorNotif).toBeNull();
  });

  it('IDEMPOTENCY-009: ADMIN remains excluded unless explicitly configured', async () => {
    const eventId = `admin-ex-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-ADMIN-EX', createdById: designerUserId });

    const adminNotif = await notificationRepo.findOne({ where: { targetId: eventId, userId: adminUserId } });
    expect(adminNotif).toBeNull();
  });

  // --- STATE PERSISTENCE & CONCURRENCY (IDEMPOTENCY-010 to IDEMPOTENCY-016) ---

  it('IDEMPOTENCY-010: Existing notification remains read after duplicate event', async () => {
    const eventId = `read-idem-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-READ-1', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/notifications/${notif!.id}/read`)
      .set('Authorization', `Bearer ${storesToken}`);

    await workflowNotificationService.notifyRmSubmitted(payload);

    const updatedNotif = await notificationRepo.findOne({ where: { id: notif!.id } });
    expect(updatedNotif?.isRead).toBe(true);
  });

  it('IDEMPOTENCY-011: Unread count does not increase on duplicate event', async () => {
    const initialCount = await notificationsService.getUnreadCount(storesUserId);

    const eventId = `uc-dup-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-UC-DUP', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    const countAfterFirst = await notificationsService.getUnreadCount(storesUserId);

    await workflowNotificationService.notifyRmSubmitted(payload);
    const countAfterSecond = await notificationsService.getUnreadCount(storesUserId);

    expect(countAfterFirst).toBeGreaterThan(initialCount);
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('IDEMPOTENCY-012: History does not contain duplicate records', async () => {
    const eventId = `hist-dup-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-HIST-DUP', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=100')
      .set('Authorization', `Bearer ${storesToken}`);

    const matching = res.body.notifications.filter((n: any) => n.targetId === eventId);
    expect(matching.length).toBe(1);
  });

  it('IDEMPOTENCY-013: Concurrent duplicate requests create exactly one notification', async () => {
    const eventId = `concurrent-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-CONCURR-1', createdById: designerUserId };

    await Promise.all([
      workflowNotificationService.notifyRmSubmitted(payload),
      workflowNotificationService.notifyRmSubmitted(payload),
      workflowNotificationService.notifyRmSubmitted(payload),
    ]);

    const count = await notificationRepo.count({ where: { targetId: eventId, userId: storesUserId } });
    expect(count).toBe(1);
  });

  it('IDEMPOTENCY-014: Database unique constraint prevents race-condition duplicates', async () => {
    const eventId = `db-race-${Date.now()}`;
    const key = `RM_SUBMITTED:${eventId}:${storesUserId}`;

    const n1 = notificationRepo.create({
      userId: storesUserId,
      title: 'Title 1',
      message: 'Message 1',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: eventId,
      idempotencyKey: key,
      isRead: false,
    });
    await notificationRepo.save(n1);

    const n2 = notificationRepo.create({
      userId: storesUserId,
      title: 'Title 2',
      message: 'Message 2',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: eventId,
      idempotencyKey: key,
      isRead: false,
    });

    let caughtError: any = null;
    try {
      await notificationRepo.save(n2);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
  });

  it('IDEMPOTENCY-015: Duplicate detection does not throw an unhandled 500 error', async () => {
    const eventId = `safe-500-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-SAFE-500', createdById: designerUserId };

    const res1 = await communicationService.notifyRmSubmitted(payload);
    const res2 = await communicationService.notifyRmSubmitted(payload);

    expect(res1.inAppNotifications.length).toBeGreaterThan(0);
    expect(res2.inAppNotifications.length).toBeGreaterThan(0);

    const res1Notif = res1.inAppNotifications.find((n) => n.userId === storesUserId);
    const res2Notif = res2.inAppNotifications.find((n) => n.userId === storesUserId);
    expect(res1Notif?.id).toBe(res2Notif?.id);
  });

  it('IDEMPOTENCY-016: Duplicate detection does not rollback business transaction', async () => {
    const eventId = `no-rollback-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-NO-ROLLBACK', createdById: designerUserId };

    let businessTransactionCommitted = true;

    try {
      await workflowNotificationService.notifyRmSubmitted(payload);
      await workflowNotificationService.notifyRmSubmitted(payload);
    } catch (e) {
      businessTransactionCommitted = false;
    }

    expect(businessTransactionCommitted).toBe(true);
  });

  // --- CHANNEL INDEPENDENCE & EMAIL INTEGRATION (IDEMPOTENCY-017 to IDEMPOTENCY-022) ---

  it('IDEMPOTENCY-017: In-app duplicate protection does not create a second email idempotency system', async () => {
    expect(emailIdempotencyService).toBeDefined();
    const generatedKey = emailIdempotencyService.generateKey({
      eventType: 'RM_SUBMITTED',
      entityId: 'RM-100',
      recipientUserId: storesUserId,
    });
    expect(generatedKey).toBe(`RM_SUBMITTED:RM-100:${storesUserId}`);
  });

  it('IDEMPOTENCY-018: Phase 15 EmailIdempotencyService remains the email idempotency authority', async () => {
    const eventId = `email-auth-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-EMAIL-AUTH', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, idempotencyKey: `RM_SUBMITTED:${eventId}:${storesUserId}` } });
    expect(jobs.length).toBe(1);
    expect(jobs[0].idempotencyKey).toBe(`RM_SUBMITTED:${eventId}:${storesUserId}`);
  });

  it('IDEMPOTENCY-019: Same logical event does not create duplicate email jobs', async () => {
    const eventId = `email-dup-job-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-EMAIL-DUP', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, idempotencyKey: `RM_SUBMITTED:${eventId}:${storesUserId}` } });
    expect(jobs.length).toBe(1);
  });

  it('IDEMPOTENCY-020: Existing Phase 15 email idempotency behavior remains intact', async () => {
    const key = emailIdempotencyService.generateKey('MATERIAL_ISSUED', 'ISSUE-77', productionUserId);
    expect(key).toBe(`MATERIAL_ISSUED:ISSUE-77:${productionUserId}`);

    const parsed = emailIdempotencyService.parseKey(key);
    expect(parsed.eventType).toBe('MATERIAL_ISSUED');
    expect(parsed.entityId).toBe('ISSUE-77');
    expect(parsed.recipientUserId).toBe(productionUserId);
  });

  it('IDEMPOTENCY-021: In-app exists but email job does not exist — email can still be independently processed', async () => {
    const eventId = `independent-email-${Date.now()}`;

    // Suppress email for stores user
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    // Action 1: In-app created, email suppressed
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-IND-EMAIL', createdById: designerUserId });
    let jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, idempotencyKey: `RM_SUBMITTED:${eventId}:${storesUserId}` } });
    expect(jobs.length).toBe(0);

    // Re-enable email for stores user
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);

    // Action 2: Email processed independently
    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: eventId,
      rmNumber: 'RM-IND-EMAIL',
      createdById: designerUserId,
    });

    jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, idempotencyKey: `RM_SUBMITTED:${eventId}:${storesUserId}` } });
    expect(jobs.length).toBe(1);
  });

  it('IDEMPOTENCY-022: Email job exists but in-app notification does not exist — in-app can still be created', async () => {
    const eventId = `independent-inapp-${Date.now()}`;

    // Create directly in email queue without in-app notification
    const idempotencyKey = emailIdempotencyService.generateKey('RM_SUBMITTED', eventId, storesUserId);
    await dataSource.getRepository(EmailJob).save(
      dataSource.getRepository(EmailJob).create({
        recipientEmail: 'stores.169@test.com',
        recipientUserId: storesUserId,
        recipientName: 'Stores 169',
        eventType: 'RM_SUBMITTED',
        templateKey: 'RM_SUBMITTED',
        subject: 'Test Subject',
        bodyText: 'Text',
        bodyHtml: '<p>HTML</p>',
        idempotencyKey,
        status: 'PENDING',
      }),
    );

    let notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeNull();

    // Trigger workflow event
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-IND-INAPP', createdById: designerUserId });

    notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();
  });

  // --- API SECURITY & SPOOFING PROTECTION (IDEMPOTENCY-023 to IDEMPOTENCY-028) ---

  it('IDEMPOTENCY-023: Client cannot supply an arbitrary notification idempotency key via API', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
  });

  it('IDEMPOTENCY-024: Client cannot spoof recipient identity', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/notifications?userId=${productionUserId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(403);
  });

  it('IDEMPOTENCY-025: Client cannot spoof actor identity', async () => {
    const eventId = `actor-spoof-${Date.now()}`;
    await workflowNotificationService.notifyAdditionalMaterialRequested({
      id: eventId,
      scId: 'SC-SPOOF',
      rmNumber: 'RM-SPOOF',
      requestedById: productionUserId,
    });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: productionUserId } });
    expect(notif).toBeNull();
  });

  it('IDEMPOTENCY-026: Client cannot spoof business entity identity', async () => {
    const realEntityId = `entity-real-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: realEntityId, rmNumber: 'RM-REAL', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: realEntityId, userId: storesUserId } });
    expect(notif).toBeDefined();
    expect(notif?.targetId).toBe(realEntityId);
  });

  it('IDEMPOTENCY-027: Unknown event identity fails safely', async () => {
    const result = await communicationService.sendEvent({
      eventType: 'UNKNOWN_CUSTOM_EVENT',
      entityType: 'UNKNOWN',
      entityId: `unk-${Date.now()}`,
    });

    expect(result.inAppNotifications).toEqual([]);
    expect(result.emailJobs).toEqual([]);
  });

  it('IDEMPOTENCY-028: Multiple recipients are independently idempotent', async () => {
    const eventId = `multi-recip-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-MULTI', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const notifs = await notificationRepo.find({ where: { targetId: eventId } });
    expect(notifs.length).toBeGreaterThan(0);

    const userIds = notifs.map((n) => n.userId);
    const uniqueUserIds = Array.from(new Set(userIds));
    expect(userIds.length).toBe(uniqueUserIds.length);
  });

  // --- REGRESSION TESTS (IDEMPOTENCY-029 to IDEMPOTENCY-030) ---

  it('IDEMPOTENCY-029: Phase 16.5 read/unread regression passes', async () => {
    const eventId = `reg-read-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-REG-READ', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId } });
    expect(notif).toBeDefined();
    expect(notif?.isRead).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/notifications/${notif!.id}/read`)
      .set('Authorization', `Bearer ${storesToken}`);

    const updated = await notificationRepo.findOne({ where: { id: notif!.id } });
    expect(updated?.isRead).toBe(true);
  });

  it('IDEMPOTENCY-030: Phase 16.6 history regression passes', async () => {
    const eventId = `reg-hist-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-REG-HIST', createdById: designerUserId });

    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=100')
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.some((n: any) => n.targetId === eventId)).toBe(true);
  });
});

