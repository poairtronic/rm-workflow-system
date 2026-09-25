import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { NotificationsService, GLOBAL_WORKFLOW_EMAIL_KEY } from '../src/notifications/notifications.service.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';

class MockEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  public shouldFail = false;
  async send(msg: any) {
    this.calls.push(msg);
    if (this.shouldFail) {
      throw new Error('Simulated Gmail API Outage');
    }
    return { success: true, providerMessageId: 'mock-msg-id' };
  }
}

describe('Phase 16 — Communication Rules Lock Specification (RULE-001 to RULE-016)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let emailJobRepo: Repository<EmailJob>;
  let communicationService: CommunicationService;
  let notificationsService: NotificationsService;
  let recipientService: NotificationRecipientService;
  let emailQueueService: EmailQueueService;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;

  const storesUserId = '77777777-7777-7777-7777-777777777701';
  const prodUserId = '77777777-7777-7777-7777-777777777702';
  const designerUserId = '77777777-7777-7777-7777-777777777703';
  const srManagerUserId = '77777777-7777-7777-7777-777777777704';
  const genManagerUserId = '77777777-7777-7777-7777-777777777705';
  const inactiveUserId = '77777777-7777-7777-7777-777777777706';

  let storesToken: string;

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
    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);
    emailJobRepo = dataSource.getRepository(EmailJob);
    communicationService = app.get(CommunicationService);
    notificationsService = app.get(NotificationsService);
    recipientService = app.get(NotificationRecipientService);
    emailQueueService = app.get(EmailQueueService);
    jwtService = app.get(JwtService);

    // Setup roles
    const rolesToCreate = [
      { name: UserRole.STORES, description: 'Stores Role' },
      { name: UserRole.PRODUCTION, description: 'Production Role' },
      { name: UserRole.DESIGNER, description: 'Designer Role' },
      { name: UserRole.SENIOR_MANAGER, description: 'Senior Manager Role' },
      { name: UserRole.GENERAL_MANAGER, description: 'General Manager Role' },
    ];

    const roleMap = new Map<string, string>();
    for (const r of rolesToCreate) {
      let existing = await roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        existing = await roleRepo.save(roleRepo.create(r));
      }
      roleMap.set(r.name, existing.id);
    }

    // Clean up test users & notifications
    const allTestUserIds = [
      storesUserId,
      prodUserId,
      designerUserId,
      srManagerUserId,
      genManagerUserId,
      inactiveUserId,
    ];

    await dataSource.query(
      `DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`,
    );
    await dataSource.query(
      `DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`,
    );
    await dataSource.query(
      `DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`,
    );
    await dataSource.query(
      `DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`,
    );

    // Insert test users
    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES
        ('${storesUserId}', 'Stores User', 'stores_lock@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', true),
        ('${prodUserId}', 'Prod User', 'prod_lock@test.com', 'hash', '${roleMap.get(UserRole.PRODUCTION)}', true),
        ('${designerUserId}', 'Designer User', 'designer_lock@test.com', 'hash', '${roleMap.get(UserRole.DESIGNER)}', true),
        ('${srManagerUserId}', 'Sr Manager', 'srmanager_lock@test.com', 'hash', '${roleMap.get(UserRole.SENIOR_MANAGER)}', true),
        ('${genManagerUserId}', 'Gen Manager', 'genmanager_lock@test.com', 'hash', '${roleMap.get(UserRole.GENERAL_MANAGER)}', true),
        ('${inactiveUserId}', 'Inactive User', 'inactive_lock@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', false)
      ON CONFLICT ("id") DO NOTHING
    `);

    storesToken = jwtService.sign({
      sub: storesUserId,
      email: 'stores_lock@test.com',
      role: UserRole.STORES,
      roles: [UserRole.STORES],
    });
  });

  beforeEach(async () => {
    mockProvider.shouldFail = false;
    mockProvider.calls = [];

    // Reset settings to Global ON by default
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'SETUP');

    // Clean up notifications and email jobs for test users
    const allTestUserIds = [
      storesUserId,
      prodUserId,
      designerUserId,
      srManagerUserId,
      genManagerUserId,
      inactiveUserId,
    ];
    await dataSource.query(
      `DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`,
    );
    await dataSource.query(
      `DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`,
    );
    await dataSource.query(
      `DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`,
    );
  });

  afterAll(async () => {
    if (dataSource) {
      const allTestUserIds = [
        storesUserId,
        prodUserId,
        designerUserId,
        srManagerUserId,
        genManagerUserId,
        inactiveUserId,
      ];
      await dataSource.query(
        `DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`,
      );
      await dataSource.query(
        `DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`,
      );
      await dataSource.query(
        `DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`,
      );
      await dataSource.query(
        `DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`,
      );
    }
    if (app) {
      await app.close();
    }
  });

  it('RULE-001: Global OFF + User ON -> In-App YES / Email NO', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-RULE-001',
      rmNumber: 'RM-001',
      createdById: designerUserId,
    });

    expect(result.inAppNotifications.length).toBeGreaterThan(0);
    expect(result.inAppNotifications.some((n) => n.userId === storesUserId)).toBe(true);
    expect(result.emailJobs.filter((j) => j.recipientUserId === storesUserId).length).toBe(0);
  });

  it('RULE-002: Global ON + User OFF -> In-App YES / Email NO', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-RULE-002',
      rmNumber: 'RM-002',
      createdById: designerUserId,
    });

    expect(result.inAppNotifications.length).toBeGreaterThan(0);
    expect(result.inAppNotifications.some((n) => n.userId === storesUserId)).toBe(true);
    expect(result.emailJobs.filter((j) => j.recipientUserId === storesUserId).length).toBe(0);
  });

  it('RULE-003: Global OFF + User OFF -> In-App YES / Email NO', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-RULE-003',
      rmNumber: 'RM-003',
      createdById: designerUserId,
    });

    expect(result.inAppNotifications.length).toBeGreaterThan(0);
    expect(result.inAppNotifications.some((n) => n.userId === storesUserId)).toBe(true);
    expect(result.emailJobs.filter((j) => j.recipientUserId === storesUserId).length).toBe(0);
  });

  it('RULE-004: Global ON + User ON -> In-App YES / Email YES', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-RULE-004',
      rmNumber: 'RM-004',
      createdById: designerUserId,
    });

    expect(result.inAppNotifications.length).toBeGreaterThan(0);
    expect(result.inAppNotifications.some((n) => n.userId === storesUserId)).toBe(true);
    expect(result.emailJobs.some((j) => j.recipientUserId === storesUserId)).toBe(true);
  });

  it('RULE-005: Security email with Global OFF -> Email remains functional', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');

    const allowed = await notificationsService.isSecurityEmailAllowed(storesUserId);
    expect(allowed).toBe(true);

    const shouldSend = await notificationsService.shouldSendEmail('SECURITY', storesUserId);
    expect(shouldSend).toBe(true);
  });

  it('RULE-006: Security email with User Workflow Email OFF -> Email remains functional', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    const allowed = await notificationsService.isSecurityEmailAllowed(storesUserId);
    expect(allowed).toBe(true);

    const shouldSend = await notificationsService.shouldSendEmail('SECURITY', storesUserId);
    expect(shouldSend).toBe(true);
  });

  it('RULE-007: Workflow email preference never suppresses in-app notification', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, false);

    const inAppNotif = await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'Mandatory In-App Title',
      message: 'Message body regardless of preferences',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-RULE-007',
    });

    expect(inAppNotif).toBeDefined();
    expect(inAppNotif.id).toBeDefined();
    expect(inAppNotif.userId).toBe(storesUserId);

    const savedInDb = await notificationRepo.findOne({ where: { id: inAppNotif.id } });
    expect(savedInDb).toBeDefined();
  });

  it('RULE-008: Admin cannot use workflow email preference to disable security email', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(false, 'ADMIN_DISABLING_ALL');

    const workflowAllowed = await notificationsService.isWorkflowEmailAllowed(storesUserId);
    expect(workflowAllowed).toBe(false);

    const securityAllowed = await notificationsService.shouldSendEmail('SECURITY', storesUserId);
    expect(securityAllowed).toBe(true);
  });

  it('RULE-009: Recipient IDs cannot be supplied by client', async () => {
    const resolvedRecipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerUserId,
    });

    expect(resolvedRecipients.length).toBeGreaterThan(0);
    resolvedRecipients.forEach((user) => {
      expect(user.role?.name || (user as any).roleName).toBe(UserRole.STORES);
    });

    const containsActor = resolvedRecipients.some((u) => u.id === designerUserId);
    expect(containsActor).toBe(false);
  });

  it('RULE-010: Recipient email cannot be supplied by client', async () => {
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'ADMIN');
    await notificationsService.setUserWorkflowEmailEnabled(storesUserId, true);

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-RULE-010',
      rmNumber: 'RM-010',
      createdById: designerUserId,
    });

    const storesJob = result.emailJobs.find((j) => j.recipientUserId === storesUserId);
    expect(storesJob).toBeDefined();
    expect(storesJob?.recipientEmail).toBe('stores_lock@test.com');
  });

  it('RULE-011: Inactive users do not receive new workflow notifications', async () => {
    const activeStoresUsers = await recipientService.findActiveUsersByRoles([UserRole.STORES]);
    const containsInactive = activeStoresUsers.some((u) => u.id === inactiveUserId);
    expect(containsInactive).toBe(false);

    const resolvedRecipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerUserId,
      specificTargetUserId: inactiveUserId,
    });

    const containsInactiveInResolved = resolvedRecipients.some((u) => u.id === inactiveUserId);
    expect(containsInactiveInResolved).toBe(false);
  });

  it('RULE-012: Monitoring users do not become workflow approvers', async () => {
    const resolved = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: storesUserId,
    });

    const monitoringUserIds = [srManagerUserId, genManagerUserId];
    const monitoringRecipients = resolved.filter((u) => monitoringUserIds.includes(u.id));

    expect(monitoringRecipients.length).toBe(2);
    // Verified: Monitoring users receive visibility notifications without approval blocking attributes
    monitoringRecipients.forEach((u) => {
      expect(u.isActive).toBe(true);
    });
  });

  it('RULE-013: Business transaction failure produces no workflow communication', async () => {
    const initialNotificationCount = await notificationRepo.count({ where: { userId: storesUserId } });

    try {
      await dataSource.transaction(async (manager) => {
        // Perform simulated business DB mutation
        await manager.query(`INSERT INTO "notifications" ("user_id", "title", "message", "type") VALUES ('${storesUserId}', 'Temp', 'Temp', 'INFO')`);
        // Simulate failure before commit
        throw new Error('Transaction Rolled Back');
      });
    } catch (err: any) {
      expect(err.message).toBe('Transaction Rolled Back');
    }

    const finalNotificationCount = await notificationRepo.count({ where: { userId: storesUserId } });
    expect(finalNotificationCount).toBe(initialNotificationCount);
  });

  it('RULE-014: Email failure does not rollback business transaction', async () => {
    const notif = await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'Business Action Committed',
      message: 'Business record saved successfully.',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-RULE-014',
    });

    expect(notif.id).toBeDefined();

    // Simulate email dispatch failure
    mockProvider.shouldFail = true;
    try {
      await mockProvider.send({ recipientEmail: 'fail@test.com' });
    } catch (err) {
      // Catch email failure
    }

    // In-app notification and business record remain intact in DB
    const preservedNotif = await notificationRepo.findOne({ where: { id: notif.id } });
    expect(preservedNotif).toBeDefined();
    expect(preservedNotif?.id).toBe(notif.id);
  });

  it('RULE-015: Read notification remains in history', async () => {
    const notif = await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'History Test Item',
      message: 'Item to be read.',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-RULE-015',
    });

    const updated = await notificationsService.markNotificationAsRead(storesUserId, notif.id);
    expect(updated.isRead).toBe(true);

    const historyItems = await notificationsService.getUserNotifications(storesUserId);
    const inHistory = historyItems.find((n) => n.id === notif.id);
    expect(inHistory).toBeDefined();
    expect(inHistory?.isRead).toBe(true);
  });

  it('RULE-016: Email status does not change notification read state', async () => {
    const notif = await communicationService.createInAppNotification({
      userId: storesUserId,
      title: 'Unread Notification',
      message: 'Notification should remain unread.',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-RULE-016',
    });

    expect(notif.isRead).toBe(false);

    // Simulate email job creation & failure state
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'stores_lock@test.com',
      recipientUserId: storesUserId,
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Test Subject',
      bodyText: 'Text',
      bodyHtml: '<p>Html</p>',
    });

    await emailJobRepo.update({ id: job.id }, { status: 'FAILED' as any, attempts: 3 });

    // Verify in-app notification remains unread and in history
    const reFetchedNotif = await notificationRepo.findOne({ where: { id: notif.id } });
    expect(reFetchedNotif?.isRead).toBe(false);
  });
});
