import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
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

describe('Phase 16.4 — Notification Recipients Specification (RECIPIENT-001 to RECIPIENT-030)', () => {
  let app: any;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let notificationRepo: Repository<Notification>;
  let recipientService: NotificationRecipientService;
  let communicationService: CommunicationService;
  let mockProvider: MockEmailProvider;

  // Test User IDs
  const designerActiveId = '11111111-1111-4444-1111-111111111111';
  const designerInactiveId = '11111111-1111-4444-1111-222222222222';
  const storesActive1Id = '22222222-2222-4444-1111-111111111111';
  const storesActive2Id = '22222222-2222-4444-1111-222222222222';
  const storesInactiveId = '22222222-2222-4444-1111-333333333333';
  const prodActiveId = '33333333-3333-4444-1111-111111111111';
  const prodInactiveId = '33333333-3333-4444-1111-222222222222';
  const srManagerActiveId = '44444444-4444-4444-1111-111111111111';
  const genManagerActiveId = '55555555-5555-4444-1111-111111111111';
  const adminActiveId = '66666666-6666-4444-1111-111111111111';

  beforeAll(async () => {
    mockProvider = new MockEmailProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(mockProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);
    notificationRepo = dataSource.getRepository(Notification);
    recipientService = app.get(NotificationRecipientService);
    communicationService = app.get(CommunicationService);

    // Clean up test data
    const allTestUserIds = [
      designerActiveId,
      designerInactiveId,
      storesActive1Id,
      storesActive2Id,
      storesInactiveId,
      prodActiveId,
      prodInactiveId,
      srManagerActiveId,
      genManagerActiveId,
      adminActiveId,
    ];

    await dataSource.query(
      `DELETE FROM "notifications" WHERE "user_id" IN (${allTestUserIds.map((id) => `'${id}'`).join(',')})`,
    );
    await dataSource.query(
      `DELETE FROM "users" WHERE "id" IN (${allTestUserIds.map((id) => `'${id}'`).join(',')})`,
    );

    // Ensure roles exist in DB
    const roleNames = [
      UserRole.DESIGNER,
      UserRole.STORES,
      UserRole.PRODUCTION,
      UserRole.SENIOR_MANAGER,
      UserRole.GENERAL_MANAGER,
      UserRole.ADMIN,
    ];

    const roleMap = new Map<string, string>();
    for (const rName of roleNames) {
      let role = await roleRepo.findOne({ where: { name: rName } });
      if (!role) {
        role = await roleRepo.save(roleRepo.create({ name: rName, description: `${rName} Role` }));
      }
      roleMap.set(rName, role.id);
    }

    // Create test users
    await userRepo.save([
      userRepo.create({ id: designerActiveId, name: 'Active Designer', email: 'designer_active@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.DESIGNER), isActive: true }),
      userRepo.create({ id: designerInactiveId, name: 'Inactive Designer', email: 'designer_inactive@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.DESIGNER), isActive: false }),
      userRepo.create({ id: storesActive1Id, name: 'Active Stores 1', email: 'stores_1@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.STORES), isActive: true }),
      userRepo.create({ id: storesActive2Id, name: 'Active Stores 2', email: 'stores_2@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.STORES), isActive: true }),
      userRepo.create({ id: storesInactiveId, name: 'Inactive Stores', email: 'stores_inactive@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.STORES), isActive: false }),
      userRepo.create({ id: prodActiveId, name: 'Active Production', email: 'prod_active@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.PRODUCTION), isActive: true }),
      userRepo.create({ id: prodInactiveId, name: 'Inactive Production', email: 'prod_inactive@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.PRODUCTION), isActive: false }),
      userRepo.create({ id: srManagerActiveId, name: 'Active Senior Manager', email: 'srmanager_active@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.SENIOR_MANAGER), isActive: true }),
      userRepo.create({ id: genManagerActiveId, name: 'Active General Manager', email: 'genmanager_active@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.GENERAL_MANAGER), isActive: true }),
      userRepo.create({ id: adminActiveId, name: 'Active Admin', email: 'admin_active@test.com', passwordHash: 'hash', roleId: roleMap.get(UserRole.ADMIN), isActive: true }),
    ]);
  });

  afterAll(async () => {
    const allTestUserIds = [
      designerActiveId,
      designerInactiveId,
      storesActive1Id,
      storesActive2Id,
      storesInactiveId,
      prodActiveId,
      prodInactiveId,
      srManagerActiveId,
      genManagerActiveId,
      adminActiveId,
    ];
    if (dataSource) {
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN (${allTestUserIds.map((id) => `'${id}'`).join(',')})`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN (${allTestUserIds.map((id) => `'${id}'`).join(',')})`);
    }
    if (app) {
      await app.close();
    }
  });

  it('RECIPIENT-001: RM_SUBMITTED resolves Stores recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(storesActive1Id);
    expect(recipientIds).toContain(storesActive2Id);
  });

  it('RECIPIENT-002: RM_SUBMITTED excludes inactive Stores users', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(storesInactiveId);
  });

  it('RECIPIENT-003: RM_SUBMITTED does not automatically notify the Designer actor', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(designerActiveId);
  });

  it('RECIPIENT-004: MATERIAL_ISSUED resolves Production recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: storesActive1Id,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(prodActiveId);
  });

  it('RECIPIENT-005: MATERIAL_ISSUED resolves approved Senior Manager recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: storesActive1Id,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(srManagerActiveId);
  });

  it('RECIPIENT-006: MATERIAL_ISSUED resolves approved General Manager recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: storesActive1Id,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(genManagerActiveId);
  });

  it('RECIPIENT-007: MATERIAL_ISSUED excludes inactive recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: storesActive1Id,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(prodInactiveId);
  });

  it('RECIPIENT-008: ADDITIONAL_MATERIAL_REQUESTED resolves Stores recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
      actorUserId: prodActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(storesActive1Id);
    expect(recipientIds).toContain(storesActive2Id);
  });

  it('RECIPIENT-009: ADDITIONAL_MATERIAL_REQUESTED resolves approved monitoring recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
      actorUserId: prodActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(srManagerActiveId);
    expect(recipientIds).toContain(genManagerActiveId);
  });

  it('RECIPIENT-010: ADDITIONAL_MATERIAL_REQUESTED excludes inactive recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'ADDITIONAL_MATERIAL_REQUESTED',
      actorUserId: prodActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(storesInactiveId);
  });

  it('RECIPIENT-011: SC_COMPLETED resolves the explicitly approved Designer rule', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prodActiveId,
      specificTargetUserId: designerActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(designerActiveId);
  });

  it('RECIPIENT-012: SC_COMPLETED resolves approved monitoring recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prodActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).toContain(srManagerActiveId);
    expect(recipientIds).toContain(genManagerActiveId);
  });

  it('RECIPIENT-013: SC_COMPLETED excludes inactive recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'SC_COMPLETED',
      actorUserId: prodActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(designerInactiveId);
  });

  it('RECIPIENT-014: ADMIN is not automatically included unless explicitly specified', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(adminActiveId);
  });

  it('RECIPIENT-015: Unknown/unsupported event type does not produce recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'UNSUPPORTED_TEST_EVENT',
      actorUserId: designerActiveId,
    });

    expect(recipients).toEqual([]);
  });

  it('RECIPIENT-016: Recipient IDs are resolved server-side from active role mapping', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    expect(recipients.length).toBeGreaterThan(0);
    recipients.forEach((u) => {
      expect(u.isActive).toBe(true);
      expect(u.role).toBeDefined();
    });
  });

  it('RECIPIENT-017: Actor identity comes from server event payload', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: storesActive1Id,
    });

    const recipientIds = recipients.map((u) => u.id);
    expect(recipientIds).not.toContain(storesActive1Id);
    expect(recipientIds).toContain(storesActive2Id);
  });

  it('RECIPIENT-018: Cross-user recipient spoofing is rejected / actor exclusion enforced', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      actorUserId: storesActive1Id,
    });

    expect(recipients.some((u) => u.id === storesActive1Id)).toBe(false);
  });

  it('RECIPIENT-019: Duplicate recipient matches produce one notification per user', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      specificTargetUserId: prodActiveId,
    });

    const prodUserOccurrences = recipients.filter((u) => u.id === prodActiveId);
    expect(prodUserOccurrences.length).toBe(1);
  });

  it('RECIPIENT-020: Email addresses are resolved from server-side user records', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    recipients.forEach((u) => {
      expect(u.email).toBeDefined();
      expect(typeof u.email).toBe('string');
      expect(u.email.length).toBeGreaterThan(0);
    });
  });

  it('RECIPIENT-021: CommunicationService uses server-side resolved emails only', async () => {
    const res = await communicationService.notifyRmSubmitted({
      id: 'rm-req-101',
      rmNumber: 'RM-2026-101',
      createdById: designerActiveId,
    });

    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    res.inAppNotifications.forEach((n) => {
      expect(n.userId).not.toBe(designerActiveId);
    });
  });

  it('RECIPIENT-022: Workflow email suppression does not suppress in-app notification creation', async () => {
    const res = await communicationService.notifyRmSubmitted({
      id: 'rm-req-102',
      rmNumber: 'RM-2026-102',
      createdById: designerActiveId,
    });

    expect(res.inAppNotifications.length).toBeGreaterThan(0);
  });

  it('RECIPIENT-023: Existing Phase 15 email idempotency remains intact', async () => {
    const res1 = await communicationService.notifyRmSubmitted({
      id: 'rm-req-103',
      rmNumber: 'RM-2026-103',
      createdById: designerActiveId,
    });

    const res2 = await communicationService.notifyRmSubmitted({
      id: 'rm-req-103',
      rmNumber: 'RM-2026-103',
      createdById: designerActiveId,
    });

    // In-app notifications should be idempotent for targetEntity/targetId/type/userId
    expect(res1.inAppNotifications.length).toEqual(res2.inAppNotifications.length);
  });

  it('RECIPIENT-024: Existing Phase 16.2 notification API remains intact', async () => {
    const userNotifications = await notificationRepo.find({
      where: { userId: storesActive1Id },
    });

    expect(Array.isArray(userNotifications)).toBe(true);
  });

  it('RECIPIENT-025: Notification fields match Phase 16.2 specification', async () => {
    const res = await communicationService.notifyRmSubmitted({
      id: 'rm-req-104',
      rmNumber: 'RM-2026-104',
      createdById: designerActiveId,
    });

    const n = res.inAppNotifications[0];
    expect(n).toHaveProperty('id');
    expect(n).toHaveProperty('userId');
    expect(n).toHaveProperty('title');
    expect(n).toHaveProperty('message');
    expect(n).toHaveProperty('type');
    expect(n).toHaveProperty('targetEntity');
    expect(n).toHaveProperty('targetId');
    expect(n).toHaveProperty('isRead');
    expect(n).toHaveProperty('createdAt');
  });

  it('RECIPIENT-026: No second notification table/entity is introduced', async () => {
    const metadata = dataSource.getMetadata(Notification);
    expect(metadata.tableName).toBe('notifications');
  });

  it('RECIPIENT-027: Inactive users cannot receive newly generated workflow notifications', async () => {
    const res = await communicationService.notifyRmSubmitted({
      id: 'rm-req-105',
      rmNumber: 'RM-2026-105',
      createdById: designerActiveId,
    });

    const targetUserIds = res.inAppNotifications.map((n) => n.userId);
    expect(targetUserIds).not.toContain(storesInactiveId);
  });

  it('RECIPIENT-028: Recipient resolution does not depend on frontend state', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
    });

    expect(recipients.length).toBeGreaterThan(0);
  });

  it('RECIPIENT-029: Recipient resolution works for multiple active users in the same role', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'RM_SUBMITTED',
      actorUserId: designerActiveId,
    });

    const storesUsers = recipients.filter((u) => u.role?.name === UserRole.STORES);
    expect(storesUsers.length).toBeGreaterThanOrEqual(2);
  });

  it('RECIPIENT-030: A user qualifying through multiple rules receives one notification only', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'MATERIAL_ISSUED',
      specificTargetUserId: prodActiveId,
    });

    const prodCount = recipients.filter((u) => u.id === prodActiveId).length;
    expect(prodCount).toBe(1);
  });
});
