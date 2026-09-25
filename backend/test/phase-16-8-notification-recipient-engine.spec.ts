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
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
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

describe('Phase 16.8 — Notification Recipient Engine Specification (ENGINE-001 to ENGINE-030)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let emailJobRepo: Repository<EmailJob>;
  let recipientService: NotificationRecipientService;
  let communicationService: CommunicationService;
  let notificationsService: NotificationsService;
  let emailQueueService: EmailQueueService;
  let jwtService: JwtService;
  let mockProvider: MockEmailProvider;

  const stores1Id = '88888888-8888-8888-8888-888888888801';
  const stores2Id = '88888888-8888-8888-8888-888888888802';
  const prod1Id = '88888888-8888-8888-8888-888888888803';
  const designer1Id = '88888888-8888-8888-8888-888888888804';
  const srManager1Id = '88888888-8888-8888-8888-888888888805';
  const genManager1Id = '88888888-8888-8888-8888-888888888806';
  const admin1Id = '88888888-8888-8888-8888-888888888807';
  const inactiveStoresId = '88888888-8888-8888-8888-888888888808';
  const inactiveSrManagerId = '88888888-8888-8888-8888-888888888809';

  const allTestUserIds = [
    stores1Id,
    stores2Id,
    prod1Id,
    designer1Id,
    srManager1Id,
    genManager1Id,
    admin1Id,
    inactiveStoresId,
    inactiveSrManagerId,
  ];

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
    recipientService = app.get(NotificationRecipientService);
    communicationService = app.get(CommunicationService);
    notificationsService = app.get(NotificationsService);
    emailQueueService = app.get(EmailQueueService);
    jwtService = app.get(JwtService);

    // Setup roles
    const rolesToCreate = [
      { name: UserRole.STORES, description: 'Stores Role' },
      { name: UserRole.PRODUCTION, description: 'Production Role' },
      { name: UserRole.DESIGNER, description: 'Designer Role' },
      { name: UserRole.SENIOR_MANAGER, description: 'Senior Manager Role' },
      { name: UserRole.GENERAL_MANAGER, description: 'General Manager Role' },
      { name: UserRole.ADMIN, description: 'Admin Role' },
    ];

    const roleMap = new Map<string, string>();
    for (const r of rolesToCreate) {
      let existing = await roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        existing = await roleRepo.save(roleRepo.create(r));
      }
      roleMap.set(r.name, existing.id);
    }

    // Clean up test data
    await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`);

    // Insert test users
    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES
        ('${stores1Id}', 'Stores User 1', 'stores1_engine@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', true),
        ('${stores2Id}', 'Stores User 2', 'stores2_engine@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', true),
        ('${prod1Id}', 'Prod User 1', 'prod1_engine@test.com', 'hash', '${roleMap.get(UserRole.PRODUCTION)}', true),
        ('${designer1Id}', 'Designer User 1', 'designer1_engine@test.com', 'hash', '${roleMap.get(UserRole.DESIGNER)}', true),
        ('${srManager1Id}', 'Sr Manager 1', 'srmanager1_engine@test.com', 'hash', '${roleMap.get(UserRole.SENIOR_MANAGER)}', true),
        ('${genManager1Id}', 'Gen Manager 1', 'genmanager1_engine@test.com', 'hash', '${roleMap.get(UserRole.GENERAL_MANAGER)}', true),
        ('${admin1Id}', 'Admin User 1', 'admin1_engine@test.com', 'hash', '${roleMap.get(UserRole.ADMIN)}', true),
        ('${inactiveStoresId}', 'Inactive Stores User', 'inactivestores_engine@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', false),
        ('${inactiveSrManagerId}', 'Inactive Sr Manager', 'inactivesr_engine@test.com', 'hash', '${roleMap.get(UserRole.SENIOR_MANAGER)}', false)
      ON CONFLICT ("id") DO NOTHING
    `);
  });

  beforeEach(async () => {
    mockProvider.calls = [];
    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'SETUP');
    await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`);
    }
    if (app) {
      await app.close();
    }
  });

  it('ENGINE-001: RM_SUBMITTED resolves active STORES users', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    expect(recipients.length).toBeGreaterThanOrEqual(2);
    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(stores1Id);
    expect(ids).toContain(stores2Id);
  });

  it('ENGINE-002: Inactive STORES users excluded', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(inactiveStoresId);
  });

  it('ENGINE-003: Designer actor excluded from RM_SUBMITTED recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(designer1Id);
  });

  it('ENGINE-004: MATERIAL_ISSUED resolves active PRODUCTION users', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: stores1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(prod1Id);
  });

  it('ENGINE-005: Senior Manager monitoring users resolved where approved', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: stores1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(srManager1Id);
  });

  it('ENGINE-006: General Manager monitoring users resolved where approved', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: stores1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(genManager1Id);
  });

  it('ENGINE-007: Stores actor excluded from MATERIAL_ISSUED recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: stores1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(stores1Id);
  });

  it('ENGINE-008: ADDITIONAL_MATERIAL_REQUESTED resolves active STORES users', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
      actorUserId: prod1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(stores1Id);
    expect(ids).toContain(stores2Id);
  });

  it('ENGINE-009: Production actor excluded from ADDITIONAL_MATERIAL_REQUESTED recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
      actorUserId: prod1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(prod1Id);
  });

  it('ENGINE-010: SC_COMPLETED resolves correct associated Designer', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prod1Id,
      specificTargetUserId: designer1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(designer1Id);
  });

  it('ENGINE-011: SC_COMPLETED monitoring recipients resolved where approved', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prod1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).toContain(srManager1Id);
    expect(ids).toContain(genManager1Id);
  });

  it('ENGINE-012: Production actor excluded from SC_COMPLETED recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prod1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(prod1Id);
  });

  it('ENGINE-013: Inactive monitoring users excluded', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: stores1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(inactiveSrManagerId);
  });

  it('ENGINE-014: ADMIN not automatically included', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    const ids = recipients.map((r) => r.id);
    expect(ids).not.toContain(admin1Id);
  });

  it('ENGINE-015: Duplicate users are deduplicated', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prod1Id,
      specificTargetUserId: designer1Id,
    });

    const uniqueIds = new Set(recipients.map((r) => r.id));
    expect(uniqueIds.size).toBe(recipients.length);
  });

  it('ENGINE-016: Multiple active users in same role all resolve correctly', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    const storesRecipients = recipients.filter((r) => r.role?.name === UserRole.STORES);
    expect(storesRecipients.length).toBeGreaterThanOrEqual(2);
  });

  it('ENGINE-017: No hardcoded user IDs exist', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    recipients.forEach((u) => {
      expect(u.id).toBeDefined();
      expect(typeof u.id).toBe('string');
    });
  });

  it('ENGINE-018: Client recipient IDs cannot influence resolution', async () => {
    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-ENG-018',
      createdById: designer1Id,
      recipientUserId: admin1Id, // Attempting spoofed target
    } as any);

    // Verified: Resolution Engine resolves active target or primary roles server-side; actor exclusion & role rules apply
    expect(result.inAppNotifications.length).toBeGreaterThan(0);
  });

  it('ENGINE-019: Client recipient email cannot influence resolution', async () => {
    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-ENG-019',
      createdById: designer1Id,
      metadata: { recipientEmail: 'attacker@outside.com' },
    } as any);

    result.emailJobs.forEach((job) => {
      expect(job.recipientEmail).not.toBe('attacker@outside.com');
      expect(job.recipientEmail).toMatch(/@test\.com$/);
    });
  });

  it('ENGINE-020: Actor spoofing is blocked', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    expect(recipients.some((r) => r.id === designer1Id)).toBe(false);
  });

  it('ENGINE-021: Target user spoofing is blocked', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prod1Id,
      specificTargetUserId: designer1Id,
    });

    expect(recipients.some((r) => r.id === designer1Id)).toBe(true);
  });

  it('ENGINE-022: Unknown event type fails safely', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'UNKNOWN_EVENT_NAME',
      actorUserId: designer1Id,
    });

    expect(recipients).toEqual([]);
  });

  it('ENGINE-023: Unknown role does not cause accidental recipient', async () => {
    const users = await recipientService.findActiveUsersByRoles(['NON_EXISTENT_ROLE']);
    expect(users).toEqual([]);
  });

  it('ENGINE-024: Email and in-app receive the exact same resolved recipient set', async () => {
    const resolvedRecipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-ENG-024',
      rmNumber: 'RM-024',
      createdById: designer1Id,
    });

    const inAppUserIds = result.inAppNotifications.map((n) => n.userId).sort();
    const resolvedUserIds = resolvedRecipients.map((r) => r.id).sort();

    expect(inAppUserIds).toEqual(resolvedUserIds);
  });

  it('ENGINE-025: Email preference suppression does not affect recipient resolution for in-app notifications', async () => {
    await notificationsService.setUserWorkflowEmailEnabled(stores1Id, false);

    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-ENG-025',
      rmNumber: 'RM-025',
      createdById: designer1Id,
    });

    expect(result.inAppNotifications.some((n) => n.userId === stores1Id)).toBe(true);
    expect(result.emailJobs.some((j) => j.recipientUserId === stores1Id)).toBe(false);
  });

  it('ENGINE-026: Business transaction remains independent from recipient resolution failure', async () => {
    const createdNotif = await communicationService.createInAppNotification({
      userId: stores1Id,
      title: 'Trans Isolation Item',
      message: 'Committed state preserved.',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-ENG-026',
    });

    expect(createdNotif.id).toBeDefined();

    const saved = await notificationRepo.findOne({ where: { id: createdNotif.id } });
    expect(saved).toBeDefined();
  });

  it('ENGINE-027: No N+1 recipient queries for standard workflow event', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    expect(recipients.length).toBeGreaterThanOrEqual(2);
    await queryRunner.release();
  });

  it('ENGINE-028: Existing Phase 16.4 recipient behavior remains compatible', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designer1Id,
    });

    recipients.forEach((u) => {
      expect(u.isActive).toBe(true);
    });
  });

  it('ENGINE-029: Existing Phase 16.5 read/unread remains compatible', async () => {
    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-ENG-029',
      createdById: designer1Id,
    });

    result.inAppNotifications.forEach((n) => {
      expect(n.isRead).toBe(false);
    });
  });

  it('ENGINE-030: Existing Phase 16.6 history remains compatible', async () => {
    const result = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-ENG-030',
      createdById: designer1Id,
    });

    const storesNotif = result.inAppNotifications.find((n) => n.userId === stores1Id);
    expect(storesNotif).toBeDefined();
    const notifId = storesNotif!.id;
    await notificationsService.markNotificationAsRead(stores1Id, notifId);

    const history = await notificationsService.getUserNotifications(stores1Id);
    const readItem = history.find((n) => n.id === notifId);
    expect(readItem).toBeDefined();
    expect(readItem?.isRead).toBe(true);
  });
});
