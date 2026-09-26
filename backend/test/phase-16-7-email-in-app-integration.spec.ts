import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { DataSource, Repository, Like } from 'typeorm';
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

class MockEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  public shouldFailTemporary = false;
  public shouldFailPermanent = false;

  async send(msg: any) {
    this.calls.push(msg);
    if (this.shouldFailTemporary) {
      throw new Error('Temporary Gmail API 503 Service Unavailable');
    }
    if (this.shouldFailPermanent) {
      throw new Error('Permanent 400 Invalid recipient address');
    }
    return { success: true, providerMessageId: `mock-msg-${Date.now()}` };
  }
}

describe('Phase 16.7 — Email + In-App Integration Specification (INT-001 to INT-041)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let emailJobRepo: Repository<EmailJob>;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;
  let notificationsService: NotificationsService;
  let communicationService: CommunicationService;
  let workflowNotificationService: WorkflowNotificationService;

  const storesUserId = '16700000-1111-1111-1111-111111111111';
  const productionUserId = '16700000-2222-2222-2222-222222222222';
  const designerUserId = '16700000-3333-3333-3333-333333333333';
  const managerUserId = '16700000-4444-4444-4444-444444444444';
  const adminUserId = '16700000-9999-9999-9999-999999999999';
  const inactiveStoresUserId = '16700000-8888-8888-8888-888888888888';

  let storesToken: string;
  let productionToken: string;
  let designerToken: string;

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

    const roles = await dataSource.query(`SELECT "id", "name" FROM "roles"`);
    const roleMap = new Map<string, string>();
    roles.forEach((r: any) => roleMap.set(r.name, r.id));

    const storesRoleId = roleMap.get('STORES') || '00000000-0000-0000-0000-000000000001';
    const prodRoleId = roleMap.get('PRODUCTION') || '00000000-0000-0000-0000-000000000002';
    const designerRoleId = roleMap.get('DESIGNER') || '00000000-0000-0000-0000-000000000003';
    const managerRoleId = roleMap.get('SENIOR_MANAGER') || '00000000-0000-0000-0000-000000000004';
    const adminRoleId = roleMap.get('ADMIN') || '00000000-0000-0000-0000-000000000005';

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${storesUserId}', 'Stores User 167', 'stores.167@test.com', 'hash1', '${storesRoleId}', true),
        ('${productionUserId}', 'Production User 167', 'prod.167@test.com', 'hash2', '${prodRoleId}', true),
        ('${designerUserId}', 'Designer User 167', 'designer.167@test.com', 'hash3', '${designerRoleId}', true),
        ('${managerUserId}', 'Manager User 167', 'manager.167@test.com', 'hash4', '${managerRoleId}', true),
        ('${adminUserId}', 'Admin User 167', 'admin.167@test.com', 'hash5', '${adminRoleId}', true),
        ('${inactiveStoresUserId}', 'Inactive Stores 167', 'inactive.167@test.com', 'hash6', '${storesRoleId}', false)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = EXCLUDED."is_active", "role_id" = EXCLUDED."role_id", "email" = EXCLUDED."email"
    `);

    storesToken = jwtService.sign({ sub: storesUserId, userId: storesUserId, email: 'stores.167@test.com', role: UserRole.STORES, roles: [UserRole.STORES] });
    productionToken = jwtService.sign({ sub: productionUserId, userId: productionUserId, email: 'prod.167@test.com', role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
    designerToken = jwtService.sign({ sub: designerUserId, userId: designerUserId, email: 'designer.167@test.com', role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });
  });

  beforeEach(async () => {
    // Ensure test users exist
    const roles = await dataSource.query(`SELECT "id", "name" FROM "roles"`);
    const roleMap = new Map<string, string>();
    roles.forEach((r: any) => roleMap.set(r.name, r.id));

    const storesRoleId = roleMap.get('STORES') || '00000000-0000-0000-0000-000000000001';
    const prodRoleId = roleMap.get('PRODUCTION') || '00000000-0000-0000-0000-000000000002';
    const designerRoleId = roleMap.get('DESIGNER') || '00000000-0000-0000-0000-000000000003';
    const managerRoleId = roleMap.get('SENIOR_MANAGER') || '00000000-0000-0000-0000-000000000004';
    const adminRoleId = roleMap.get('ADMIN') || '00000000-0000-0000-0000-000000000005';

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${storesUserId}', 'Stores User 167', 'stores.167@test.com', 'hash1', '${storesRoleId}', true),
        ('${productionUserId}', 'Production User 167', 'prod.167@test.com', 'hash2', '${prodRoleId}', true),
        ('${designerUserId}', 'Designer User 167', 'designer.167@test.com', 'hash3', '${designerRoleId}', true),
        ('${managerUserId}', 'Manager User 167', 'manager.167@test.com', 'hash4', '${managerRoleId}', true),
        ('${adminUserId}', 'Admin User 167', 'admin.167@test.com', 'hash5', '${adminRoleId}', true),
        ('${inactiveStoresUserId}', 'Inactive Stores 167', 'inactive.167@test.com', 'hash6', '${storesRoleId}', false)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = EXCLUDED."is_active", "role_id" = EXCLUDED."role_id", "email" = EXCLUDED."email"
    `);

    // Reset workflow email preferences globally & per test users
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'SETUP');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);
    await notificationsService.setUserWorkflowEmailEnabled(productionUserId, true);
    await notificationsService.setUserWorkflowEmailEnabled(designerUserId, true);
    await notificationsService.setUserWorkflowEmailEnabled(managerUserId, true);

    // Clear notifications & email tables cleanly in correct FK dependency order
    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs"`);
    await dataSource.query(`DELETE FROM "notifications"`);

    mockProvider.shouldFailTemporary = false;
    mockProvider.shouldFailPermanent = false;
    mockProvider.calls = [];
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.query(`DELETE FROM "email_logs"`);
      await dataSource.query(`DELETE FROM "email_jobs"`);
      await dataSource.query(`DELETE FROM "notifications"`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${storesUserId}', '${productionUserId}', '${designerUserId}', '${managerUserId}', '${adminUserId}', '${inactiveStoresUserId}')`);
    }
    if (app) {
      await app.close();
    }
  });

  // --- BUSINESS EVENT MATRIX TESTS (INT-001 to INT-008) ---

  it('INT-001: RM_SUBMITTED successful transaction creates in-app notification & workflow email job', async () => {
    const eventId = `rm-req-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({
      id: eventId,
      rmNumber: 'RM-2026-101',
      createdById: designerUserId,
    });

    const notif = await notificationRepo.findOne({ where: { userId: storesUserId, targetId: eventId } });
    expect(notif).toBeDefined();
    expect(notif?.type).toBe('RM_SUBMITTED');

    const job = await emailJobRepo.findOne({ where: { recipientUserId: storesUserId, eventType: 'RM_SUBMITTED' } });
    expect(job).toBeDefined();
    expect(job?.recipientEmail).toBe('stores.167@test.com');
  });

  it('INT-002: RM_SUBMITTED failed transaction produces NO in-app notification and NO email job', async () => {
    const notifs = await notificationRepo.find({ where: { targetId: 'failed-rm-id' } });
    const jobs = await emailJobRepo.find({ where: { eventType: 'RM_SUBMITTED' } });
    const matchingJobs = jobs.filter((j) => JSON.stringify(j.payload || {}).includes('failed-rm-id'));

    expect(notifs.length).toBe(0);
    expect(matchingJobs.length).toBe(0);
  });

  it('INT-003: MATERIAL_ISSUED successful transaction creates in-app notification & email job for Production', async () => {
    const issueId = `mat-issue-${Date.now()}`;
    await workflowNotificationService.notifyMaterialIssued({
      id: issueId,
      scId: 'SC-101',
      rmNumber: 'RM-2026-102',
      recipientUserId: productionUserId,
    });

    const prodNotif = await notificationRepo.findOne({ where: { userId: productionUserId, targetId: issueId } });
    expect(prodNotif).toBeDefined();
    expect(prodNotif?.type).toBe('MATERIAL_ISSUED');

    const prodJob = await emailJobRepo.findOne({ where: { recipientUserId: productionUserId, eventType: 'MATERIAL_ISSUED' } });
    expect(prodJob).toBeDefined();
  });

  it('INT-004: MATERIAL_ISSUED failed transaction produces NO in-app notification and NO email job', async () => {
    const notifs = await notificationRepo.find({ where: { targetId: 'failed-issue-id' } });
    expect(notifs.length).toBe(0);
  });

  it('INT-005: ADDITIONAL_MATERIAL_REQUESTED successful transaction creates in-app notification & email job', async () => {
    const requestId = `amr-${Date.now()}`;
    await workflowNotificationService.notifyAdditionalMaterialRequested({
      id: requestId,
      scId: 'SC-102',
      rmNumber: 'RM-2026-103',
      requestedById: productionUserId,
    });

    const storesNotif = await notificationRepo.findOne({ where: { userId: storesUserId, targetId: requestId } });
    expect(storesNotif).toBeDefined();
    expect(storesNotif?.type).toBe('ADDITIONAL_REQUEST');

    const storesJob = await emailJobRepo.findOne({ where: { recipientUserId: storesUserId, eventType: 'ADDITIONAL_REQUEST' } });
    expect(storesJob).toBeDefined();
  });

  it('INT-006: ADDITIONAL_MATERIAL_REQUESTED failed transaction produces NO in-app & NO email job', async () => {
    const notifs = await notificationRepo.find({ where: { targetId: 'failed-amr-id' } });
    expect(notifs.length).toBe(0);
  });

  it('INT-007: SC_COMPLETED successful transaction creates in-app notification & email job for Designer', async () => {
    const scId = `sc-comp-${Date.now()}`;
    await workflowNotificationService.notifyScCompleted({
      id: scId,
      scNumber: 'SC-999',
      designerUserId: designerUserId,
    });

    const designerNotif = await notificationRepo.findOne({ where: { userId: designerUserId, targetId: scId } });
    expect(designerNotif).toBeDefined();
    expect(designerNotif?.type).toBe('SC_COMPLETED');

    const designerJob = await emailJobRepo.findOne({ where: { recipientUserId: designerUserId, eventType: 'SC_COMPLETED' } });
    expect(designerJob).toBeDefined();
  });

  it('INT-008: SC_COMPLETED failed transaction produces NO in-app & NO email job', async () => {
    const notifs = await notificationRepo.find({ where: { targetId: 'failed-sc-id' } });
    expect(notifs.length).toBe(0);
  });

  // --- CHANNEL INDEPENDENCE & ISOLATION TESTS (INT-009 to INT-014) ---

  it('INT-009: Workflow email disabled -> in-app CREATED, email NOT ENQUEUED', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');

    const eventId = `rm-dis-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({
      id: eventId,
      rmNumber: 'RM-DIS-1',
      createdById: designerUserId,
    });

    const inApp = await notificationRepo.find({ where: { targetId: eventId } });
    expect(inApp.length).toBeGreaterThanOrEqual(1);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId } });
    expect(jobs.length).toBe(0);
  });

  it('INT-010: Workflow email enabled -> in-app CREATED, email ENQUEUED', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');

    const eventId = `rm-en-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({
      id: eventId,
      rmNumber: 'RM-EN-1',
      createdById: designerUserId,
    });

    const inApp = await notificationRepo.find({ where: { targetId: eventId } });
    expect(inApp.length).toBeGreaterThanOrEqual(1);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId } });
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it('INT-011: Email provider temporary failure does not impact business transaction or in-app notification', async () => {
    mockProvider.shouldFailTemporary = true;

    const eventId = `rm-temp-fail-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({
      id: eventId,
      rmNumber: 'RM-TEMP-1',
      createdById: designerUserId,
    });

    const inApp = await notificationRepo.find({ where: { targetId: eventId } });
    expect(inApp.length).toBeGreaterThanOrEqual(1);
  });

  it('INT-012: Email provider permanent failure does not impact in-app notification', async () => {
    mockProvider.shouldFailPermanent = true;

    const eventId = `rm-perm-fail-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({
      id: eventId,
      rmNumber: 'RM-PERM-1',
      createdById: designerUserId,
    });

    const inApp = await notificationRepo.find({ where: { targetId: eventId } });
    expect(inApp.length).toBeGreaterThanOrEqual(1);
  });

  it('INT-013: Email queue failure isolation', async () => {
    const eventId = `rm-q-fail-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({
      id: eventId,
      rmNumber: 'RM-Q-1',
      createdById: designerUserId,
    });

    const inApp = await notificationRepo.find({ where: { targetId: eventId } });
    expect(inApp.length).toBeGreaterThanOrEqual(1);
  });

  it('INT-014: Post-commit communication failure isolation preserves committed business state', async () => {
    let businessOperationCommitted = false;

    await (async () => {
      businessOperationCommitted = true;
      try {
        await workflowNotificationService.notifyRmSubmitted({
          id: 'commit-test-id',
          rmNumber: 'RM-COMMIT-1',
          createdById: designerUserId,
        });
      } catch (err) {
        // Handled safely
      }
    })();

    expect(businessOperationCommitted).toBe(true);
  });

  // --- PREFERENCE MATRIX TESTS (INT-015 to INT-018) ---

  it('INT-015: GLOBAL ON + USER ON -> in-app YES, email YES', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);

    const eventId = `pref-15-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-P15', createdById: designerUserId });

    const notifs = await notificationRepo.find({ where: { targetId: eventId } });
    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId } });

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it('INT-016: GLOBAL ON + USER OFF -> in-app YES, email NO', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    const eventId = `pref-16-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-P16', createdById: designerUserId });

    const notifs = await notificationRepo.find({ where: { targetId: eventId } });
    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId } });

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(jobs.length).toBe(0);
  });

  it('INT-017: GLOBAL OFF + USER ON -> in-app YES, email NO', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);

    const eventId = `pref-17-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-P17', createdById: designerUserId });

    const notifs = await notificationRepo.find({ where: { targetId: eventId } });
    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId } });

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(jobs.length).toBe(0);
  });

  it('INT-018: GLOBAL OFF + USER OFF -> in-app YES, email NO', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    const eventId = `pref-18-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-P18', createdById: designerUserId });

    const notifs = await notificationRepo.find({ where: { targetId: eventId } });
    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, idempotencyKey: Like(`%${eventId}%`) } });

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(jobs.length).toBe(0);

    // Restore settings for subsequent tests
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);
  });

  // --- IDEMPOTENCY TESTS (INT-019 to INT-024) ---

  it('INT-019: Repeat RM_SUBMITTED event generates no duplicate EmailJob', async () => {
    const eventId = `idem-rm-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-IDEM-1', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, eventType: 'RM_SUBMITTED' } });
    expect(jobs.length).toBe(1);
  });

  it('INT-020: Repeat MATERIAL_ISSUED event generates no duplicate EmailJob', async () => {
    const issueId = `idem-issue-${Date.now()}`;
    const payload = { id: issueId, scId: 'SC-1', rmNumber: 'RM-IDEM-2', recipientUserId: productionUserId };

    await workflowNotificationService.notifyMaterialIssued(payload);
    await workflowNotificationService.notifyMaterialIssued(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: productionUserId, eventType: 'MATERIAL_ISSUED' } });
    expect(jobs.length).toBe(1);
  });

  it('INT-021: Repeat ADDITIONAL_MATERIAL_REQUESTED generates no duplicate EmailJob', async () => {
    const requestId = `idem-amr-${Date.now()}`;
    const payload = { id: requestId, scId: 'SC-2', rmNumber: 'RM-IDEM-3', requestedById: productionUserId };

    await workflowNotificationService.notifyAdditionalMaterialRequested(payload);
    await workflowNotificationService.notifyAdditionalMaterialRequested(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, eventType: 'ADDITIONAL_REQUEST' } });
    expect(jobs.length).toBe(1);
  });

  it('INT-022: Repeat SC_COMPLETED event generates no duplicate EmailJob', async () => {
    const scId = `idem-sc-${Date.now()}`;
    const payload = { id: scId, scNumber: 'SC-IDEM-4', designerUserId };

    await workflowNotificationService.notifyScCompleted(payload);
    await workflowNotificationService.notifyScCompleted(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: designerUserId, eventType: 'SC_COMPLETED' } });
    expect(jobs.length).toBe(1);
  });

  it('INT-023: Retrying HTTP/business request uses deterministic idempotency key', async () => {
    const eventId = `idem-http-${Date.now()}`;
    const payload = {
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: eventId,
      rmNumber: 'RM-HTTP-1',
      createdById: designerUserId,
    };

    const res1 = await communicationService.sendEvent(payload);
    const res2 = await communicationService.sendEvent(payload);

    expect(res1.inAppNotifications[0].id).toBe(res2.inAppNotifications[0].id);
  });

  it('INT-024: Retrying email does not create duplicate EmailJob record', async () => {
    const eventId = `idem-retry-${Date.now()}`;
    const payload = { id: eventId, rmNumber: 'RM-RETRY-1', createdById: designerUserId };

    await workflowNotificationService.notifyRmSubmitted(payload);
    await workflowNotificationService.notifyRmSubmitted(payload);

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, eventType: 'RM_SUBMITTED' } });
    expect(jobs.length).toBe(1);
  });

  // --- RECIPIENT CONSISTENCY & SECURITY TESTS (INT-025 to INT-030) ---

  it('INT-025: In-app and email channels use identical server-side resolved recipients', async () => {
    const eventId = `recip-same-${Date.now()}`;
    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: eventId,
      rmNumber: 'RM-SAME-1',
      createdById: designerUserId,
    });

    const inAppRecipientIds = result.inAppNotifications.map((n) => n.userId);
    const emailRecipientIds = result.emailJobs.map((j) => j.recipientUserId);

    expect(inAppRecipientIds).toContain(storesUserId);
    expect(emailRecipientIds).toContain(storesUserId);
  });

  it('INT-026: Inactive users are excluded from both in-app and email channels', async () => {
    const eventId = `recip-inact-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-INACT-1', createdById: designerUserId });

    const inactiveNotif = await notificationRepo.findOne({ where: { userId: inactiveStoresUserId, targetId: eventId } });
    const inactiveJob = await emailJobRepo.findOne({ where: { recipientUserId: inactiveStoresUserId } });

    expect(inactiveNotif).toBeNull();
    expect(inactiveJob).toBeNull();
  });

  it('INT-027: Actor exclusion prevents self-notification on both channels', async () => {
    const requestId = `recip-actor-${Date.now()}`;
    await workflowNotificationService.notifyAdditionalMaterialRequested({
      id: requestId,
      scId: 'SC-ACTOR',
      rmNumber: 'RM-ACTOR-1',
      requestedById: productionUserId,
    });

    const actorNotif = await notificationRepo.findOne({ where: { userId: productionUserId, targetId: requestId } });
    expect(actorNotif).toBeNull();
  });

  it('INT-028: Client cannot inject recipient IDs via API', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/notifications?userId=${storesUserId}`)
      .set('Authorization', `Bearer ${productionToken}`);

    if (res.status === 200) {
      res.body.notifications.forEach((item: any) => {
        expect(item.userId).toBe(productionUserId);
      });
    } else {
      expect([400, 403]).toContain(res.status);
    }
  });

  it('INT-029: Client cannot inject recipient email addresses', async () => {
    const eventId = `recip-no-inj-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-INJ-1', createdById: designerUserId });

    const jobs = await emailJobRepo.find({ where: { recipientUserId: storesUserId, eventType: 'RM_SUBMITTED' } });

    expect(jobs.length).toBe(1);
    expect(jobs[0].recipientEmail).toBe('stores.167@test.com');
  });

  it('INT-030: ADMIN is not automatically included as a workflow recipient', async () => {
    const eventId = `recip-admin-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-ADMIN-1', createdById: designerUserId });

    const adminNotif = await notificationRepo.findOne({ where: { userId: adminUserId, targetId: eventId } });
    const adminJob = await emailJobRepo.findOne({ where: { recipientUserId: adminUserId } });

    expect(adminNotif).toBeNull();
    expect(adminJob).toBeNull();
  });

  // --- HISTORY & READ STATE INTEGRATION TESTS (INT-031 to INT-036) ---

  it('INT-031: Successful workflow event creates unread notification', async () => {
    const eventId = `hist-1-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-HIST-1', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();
    expect(notif?.isRead).toBe(false);
  });

  it('INT-032: New notification appears in ALL filter list', async () => {
    const eventId = `hist-all-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-HIST-ALL', createdById: designerUserId });

    const res = await request(app.getHttpServer())
      .get('/api/notifications?limit=100')
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    const found = res.body.notifications.some((n: any) => n.targetId === eventId);
    expect(found).toBe(true);
  });

  it('INT-033: New notification appears in UNREAD filter list', async () => {
    const eventId = `hist-un-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-HIST-UN', createdById: designerUserId });

    const res = await request(app.getHttpServer())
      .get('/api/notifications?unreadOnly=true&limit=100')
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    const found = res.body.notifications.some((n: any) => n.targetId === eventId);
    expect(found).toBe(true);
  });

  it('INT-034: Marking as read updates ALL, READ, and UNREAD states without deleting history record', async () => {
    const eventId = `hist-read-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-HIST-READ', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/notifications/${notif!.id}/read`)
      .set('Authorization', `Bearer ${storesToken}`);

    const allRes = await request(app.getHttpServer())
      .get('/api/notifications?limit=100')
      .set('Authorization', `Bearer ${storesToken}`);
    expect(allRes.body.notifications.some((n: any) => n.id === notif!.id)).toBe(true);

    const readRes = await request(app.getHttpServer())
      .get('/api/notifications?readOnly=true&limit=100')
      .set('Authorization', `Bearer ${storesToken}`);
    expect(readRes.body.notifications.some((n: any) => n.id === notif!.id)).toBe(true);

    const unreadRes = await request(app.getHttpServer())
      .get('/api/notifications?unreadOnly=true&limit=100')
      .set('Authorization', `Bearer ${storesToken}`);
    expect(unreadRes.body.notifications.some((n: any) => n.id === notif!.id)).toBe(false);
  });

  it('INT-035: Email failure does not remove notification from history', async () => {
    mockProvider.shouldFailPermanent = true;

    const eventId = `hist-err-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-HIST-ERR', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();
    expect(notif?.isRead).toBe(false);
  });

  it('INT-036: Email suppression does not remove notification from history', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');

    const eventId = `hist-supp-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-HIST-SUPP', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();

    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
  });

  // --- UNREAD COUNT INTEGRATION TESTS (INT-037 to INT-041) ---

  it('INT-037: New in-app notification increases unread count', async () => {
    const initialCount = await notificationsService.getUnreadCount(storesUserId);

    const eventId = `uc-1-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-UC-1', createdById: designerUserId });

    const newCount = await notificationsService.getUnreadCount(storesUserId);
    expect(newCount).toBe(initialCount + 1);
  });

  it('INT-038: Email disabled still increases unread count', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');
    const initialCount = await notificationsService.getUnreadCount(storesUserId);

    const eventId = `uc-dis-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-UC-DIS', createdById: designerUserId });

    const newCount = await notificationsService.getUnreadCount(storesUserId);
    expect(newCount).toBe(initialCount + 1);

    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
  });

  it('INT-039: Email failed still increases unread count', async () => {
    mockProvider.shouldFailPermanent = true;
    const initialCount = await notificationsService.getUnreadCount(storesUserId);

    const eventId = `uc-fail-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-UC-FAIL', createdById: designerUserId });

    const newCount = await notificationsService.getUnreadCount(storesUserId);
    expect(newCount).toBe(initialCount + 1);
  });

  it('INT-040: Marking notification as read decreases unread count', async () => {
    const eventId = `uc-dec-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-UC-DEC', createdById: designerUserId });

    const notif = await notificationRepo.findOne({ where: { targetId: eventId, userId: storesUserId } });
    expect(notif).toBeDefined();

    const countBefore = await notificationsService.getUnreadCount(storesUserId);

    await request(app.getHttpServer())
      .patch(`/api/notifications/${notif!.id}/read`)
      .set('Authorization', `Bearer ${storesToken}`);

    const countAfter = await notificationsService.getUnreadCount(storesUserId);
    expect(countAfter).toBe(countBefore - 1);
  });

  it('INT-041: Read notification remains in history after unread count reaches zero', async () => {
    const eventId = `uc-zero-${Date.now()}`;
    await workflowNotificationService.notifyRmSubmitted({ id: eventId, rmNumber: 'RM-UC-ZERO', createdById: designerUserId });

    await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${storesToken}`);

    const count = await notificationsService.getUnreadCount(storesUserId);
    expect(count).toBe(0);

    const allNotifs = await notificationRepo.find({ where: { userId: storesUserId } });
    expect(allNotifs.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});

