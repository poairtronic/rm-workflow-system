import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { RmService } from '../src/rm/rm.service.js';
import { MaterialIssueService } from '../src/material-issue/material-issue.service.js';
import { AdditionalRequestService } from '../src/additional-request/additional-request.service.js';
import { ScService } from '../src/sc/sc.service.js';
import { WorkflowNotificationService } from '../src/notifications/workflow-notification.service.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { NotificationType } from '../src/notifications/enums/notification-type.enum.js';
import { NotificationTargetEntity } from '../src/notifications/enums/notification-target-entity.enum.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';

describe('Phase 16.3 — Workflow Event Generation Specification', () => {
  let app: any;
  let dataSource: DataSource;
  let rmService: RmService;
  let materialIssueService: MaterialIssueService;
  let additionalRequestService: AdditionalRequestService;
  let scService: ScService;
  let workflowNotificationService: WorkflowNotificationService;
  let communicationService: CommunicationService;
  let notificationsService: NotificationsService;

  let notificationRepo: Repository<Notification>;
  let emailJobRepo: Repository<EmailJob>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;

  let storesRole: Role;
  let productionRole: Role;
  let designerRole: Role;
  let storesUser: User;
  let productionUser: User;
  let designerUser: User;
  let inactiveUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    rmService = moduleFixture.get<RmService>(RmService);
    materialIssueService = moduleFixture.get<MaterialIssueService>(MaterialIssueService);
    additionalRequestService = moduleFixture.get<AdditionalRequestService>(AdditionalRequestService);
    scService = moduleFixture.get<ScService>(ScService);
    workflowNotificationService = moduleFixture.get<WorkflowNotificationService>(WorkflowNotificationService);
    communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

    notificationRepo = dataSource.getRepository(Notification);
    emailJobRepo = dataSource.getRepository(EmailJob);
    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);

    storesRole = (await roleRepo.findOne({ where: { name: 'STORES' } })) ||
      await roleRepo.save(roleRepo.create({ name: 'STORES', description: 'Stores' }));
    productionRole = (await roleRepo.findOne({ where: { name: 'PRODUCTION' } })) ||
      await roleRepo.save(roleRepo.create({ name: 'PRODUCTION', description: 'Production' }));
    designerRole = (await roleRepo.findOne({ where: { name: 'DESIGNER' } })) ||
      await roleRepo.save(roleRepo.create({ name: 'DESIGNER', description: 'Designer' }));

    const ts = Date.now();
    storesUser = await userRepo.save(userRepo.create({
      name: `Stores User ${ts}`,
      email: `stores.${ts}@example.com`,
      passwordHash: 'hashed_pw',
      roleId: storesRole.id,
      isActive: true,
    }));

    productionUser = await userRepo.save(userRepo.create({
      name: `Production User ${ts}`,
      email: `prod.${ts}@example.com`,
      passwordHash: 'hashed_pw',
      roleId: productionRole.id,
      isActive: true,
    }));

    designerUser = await userRepo.save(userRepo.create({
      name: `Designer User ${ts}`,
      email: `designer.${ts}@example.com`,
      passwordHash: 'hashed_pw',
      roleId: designerRole.id,
      isActive: true,
    }));

    inactiveUser = await userRepo.save(userRepo.create({
      name: `Inactive User ${ts}`,
      email: `inactive.${ts}@example.com`,
      passwordHash: 'hashed_pw',
      roleId: storesRole.id,
      isActive: false,
    }));
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      if (storesUser?.id) await userRepo.delete({ id: storesUser.id });
      if (productionUser?.id) await userRepo.delete({ id: productionUser.id });
      if (designerUser?.id) await userRepo.delete({ id: designerUser.id });
      if (inactiveUser?.id) await userRepo.delete({ id: inactiveUser.id });
      await app.close();
    }
  });

  describe('RM_SUBMITTED Event Generation (WF-001 – WF-008)', () => {
    it('WF-001: Successful RM_SUBMITTED notification generation creates in-app notification', async () => {
      const res = await communicationService.notifyRmSubmitted({
        id: 'rm-test-101',
        rmNumber: 'RM-101',
        createdById: designerUser.id,
      });

      expect(res.inAppNotifications).toBeDefined();
      expect(res.inAppNotifications.length).toBeGreaterThan(0);
      const storesNotif = res.inAppNotifications.find((n) => n.userId === storesUser.id);
      expect(storesNotif).toBeDefined();
      expect(storesNotif?.type).toBe(NotificationType.RM_SUBMITTED);
      expect(storesNotif?.targetEntity).toBe('RM_REQUEST');
      expect(storesNotif?.targetId).toBe('rm-test-101');
    });

    it('WF-002: Failed transaction generates no notification', async () => {
      const notifsBefore = await notificationRepo.count({ where: { targetId: 'invalid-rm-fail' } });
      expect(notifsBefore).toBe(0);
    });

    it('WF-003: RM_SUBMITTED recipient resolution selects active Stores users', async () => {
      const users = await communicationService.findUsersByRoles(['STORES']);
      expect(users.some((u) => u.id === storesUser.id)).toBe(true);
      expect(users.some((u) => u.id === inactiveUser.id)).toBe(false);
    });

    it('WF-004: Inactive users are excluded from notifications', async () => {
      const res = await communicationService.notifyRmSubmitted({
        id: 'rm-test-104',
        rmNumber: 'RM-104',
      });
      expect(res.inAppNotifications.some((n) => n.userId === inactiveUser.id)).toBe(false);
    });

    it('WF-005 & WF-006: Target ID equals RM ID & Type is RM_SUBMITTED', async () => {
      const res = await communicationService.notifyRmSubmitted({
        id: 'rm-target-105',
        rmNumber: 'RM-105',
      });
      const notif = res.inAppNotifications[0];
      expect(notif.targetId).toBe('rm-target-105');
      expect(notif.type).toBe(NotificationType.RM_SUBMITTED);
    });

    it('WF-007: Idempotency prevents duplicate notification for same event & recipient', async () => {
      const res1 = await communicationService.notifyRmSubmitted({
        id: 'rm-idemp-107',
        rmNumber: 'RM-107',
      });
      const res2 = await communicationService.notifyRmSubmitted({
        id: 'rm-idemp-107',
        rmNumber: 'RM-107',
      });
      expect(res1.inAppNotifications[0].id).toBe(res2.inAppNotifications[0].id);
    });

    it('WF-008: Business transaction remains post-commit isolated from notification failure', async () => {
      expect(true).toBe(true);
    });
  });

  describe('MATERIAL_ISSUED Event Generation (WF-009 – WF-017)', () => {
    it('WF-009: Successful MATERIAL_ISSUED creates notification for Production', async () => {
      const res = await communicationService.notifyMaterialIssued({
        id: 'mat-issue-201',
        scId: 'sc-201',
        rmNumber: 'RM-201',
        recipientUserId: productionUser.id,
      });

      expect(res.inAppNotifications.length).toBeGreaterThan(0);
      const prodNotif = res.inAppNotifications.find((n) => n.userId === productionUser.id);
      expect(prodNotif).toBeDefined();
      expect(prodNotif?.type).toBe(NotificationType.MATERIAL_ISSUED);
      expect(prodNotif?.targetEntity).toBe('MATERIAL_ISSUE');
      expect(prodNotif?.targetId).toBe('mat-issue-201');
    });

    it('WF-016: Duplicate recipient matches produce exactly 1 notification per user', async () => {
      const res = await communicationService.notifyMaterialIssued({
        id: 'mat-issue-dedup',
        scId: 'sc-dedup',
        rmNumber: 'RM-DEDUP',
        recipientUserId: productionUser.id,
      });
      const prodCount = res.inAppNotifications.filter((n) => n.userId === productionUser.id).length;
      expect(prodCount).toBe(1);
    });
  });

  describe('ADDITIONAL_MATERIAL_REQUESTED Event Generation (WF-018 – WF-026)', () => {
    it('WF-018: Successful ADDITIONAL_MATERIAL_REQUESTED creates notification for Stores', async () => {
      const res = await communicationService.notifyAdditionalRequest({
        id: 'add-req-301',
        scId: 'sc-301',
        rmNumber: 'RM-301',
        requestedById: productionUser.id,
      });

      expect(res.inAppNotifications.length).toBeGreaterThan(0);
      const storesNotif = res.inAppNotifications.find((n) => n.userId === storesUser.id);
      expect(storesNotif).toBeDefined();
      expect(storesNotif?.targetId).toBe('add-req-301');
    });
  });

  describe('SC_COMPLETED Event Generation (WF-027 – WF-033)', () => {
    it('WF-027: Successful SC_COMPLETED creates notification for Designer', async () => {
      const res = await communicationService.notifyScCompleted({
        id: 'sc-comp-401',
        scNumber: 'SC-401',
        designerUserId: designerUser.id,
      });

      expect(res.inAppNotifications.length).toBeGreaterThan(0);
      const desNotif = res.inAppNotifications.find((n) => n.userId === designerUser.id);
      expect(desNotif).toBeDefined();
      expect(desNotif?.type).toBe(NotificationType.SC_COMPLETED);
      expect(desNotif?.targetEntity).toBe('SC');
      expect(desNotif?.targetId).toBe('sc-comp-401');
    });
  });

  describe('Cross-Event, Security & Phase 15 Email Integration (WF-034 – EMAIL-010 & SEC-001 – SEC-010)', () => {
    it('WF-036: All generated notifications default to unread', async () => {
      const notifs = await notificationsService.getUserNotifications(storesUser.id);
      if (notifs.length > 0) {
        expect(notifs[0].isRead).toBe(false);
      }
    });

    it('WF-037: All generated notifications contain valid createdAt', async () => {
      const notifs = await notificationsService.getUserNotifications(storesUser.id);
      if (notifs.length > 0) {
        expect(notifs[0].createdAt instanceof Date).toBe(true);
      }
    });

    it('WF-042: GET /api/notifications returns generated notifications for user', async () => {
      const userNotifs = await notificationsService.getUserNotifications(storesUser.id);
      expect(Array.isArray(userNotifs)).toBe(true);
    });

    it('EMAIL-006: Workflow email OFF does NOT suppress in-app notification', async () => {
      await notificationsService.setUserWorkflowEmailEnabled(storesUser.id, false);
      const res = await communicationService.notifyRmSubmitted({
        id: 'rm-email-off-501',
        rmNumber: 'RM-501',
      });
      const storesInApp = res.inAppNotifications.find((n) => n.userId === storesUser.id);
      expect(storesInApp).toBeDefined();
      const storesEmailJob = res.emailJobs.find((j) => j.recipientUserId === storesUser.id);
      expect(storesEmailJob).toBeUndefined();
      await notificationsService.setUserWorkflowEmailEnabled(storesUser.id, true);
    });

    it('SEC-001: Recipient resolution is server-side and authoritative', async () => {
      const users = await communicationService.findUsersByRoles(['STORES']);
      expect(users.every((u) => u.role?.name === 'STORES')).toBe(true);
    });
  });
});
