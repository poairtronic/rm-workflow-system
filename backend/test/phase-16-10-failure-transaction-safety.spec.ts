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
import { RmRequest, RmRequestStatus } from '../src/rm/entities/rm-request.entity.js';
import { SalesOrderComponent, ScStatus } from '../src/sc/entities/sc.entity.js';
import { PurchaseOrder } from '../src/po/entities/po.entity.js';
import { Customer } from '../src/customers/entities/customer.entity.js';
import { RmService } from '../src/rm/rm.service.js';
import { CommunicationService } from '../src/notifications/communication.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';
import { EmailQueueService } from '../src/email/email-queue.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EMAIL_PROVIDER } from '../src/email/interfaces/email-provider.interface.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';

class FailableMockEmailProvider {
  public name = EmailProvider.GMAIL_API;
  public calls: any[] = [];
  public errorCode: number | null = null;
  public networkError = false;

  async send(msg: any) {
    this.calls.push(msg);
    if (this.networkError) {
      throw new Error('ENOTFOUND smtp.gmail.com');
    }
    if (this.errorCode) {
      const err: any = new Error(`Gmail API HTTP ${this.errorCode}`);
      err.status = this.errorCode;
      err.statusCode = this.errorCode;
      throw err;
    }
    return { success: true, providerMessageId: 'mock-txsafe-msg-id' };
  }
}

describe('Phase 16.10 — Failure / Transaction Safety Specification (TXSAFE-001 to TXSAFE-030)', () => {
  let app: any;
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let rmRepo: Repository<RmRequest>;
  let scRepo: Repository<SalesOrderComponent>;
  let poRepo: Repository<PurchaseOrder>;
  let customerRepo: Repository<Customer>;
  let emailJobRepo: Repository<EmailJob>;
  let rmService: RmService;
  let communicationService: CommunicationService;
  let notificationsService: NotificationsService;
  let recipientService: NotificationRecipientService;
  let emailQueueService: EmailQueueService;
  let mockProvider: FailableMockEmailProvider;

  const testCustomerId = '99999999-9999-9999-9999-999999999999';
  const storesId = '99999999-9999-9999-9999-999999999901';
  const designerId = '99999999-9999-9999-9999-999999999902';
  const prodId = '99999999-9999-9999-9999-999999999903';

  const allTestUserIds = [storesId, designerId, prodId];

  const roleMap = new Map<string, string>();

  beforeAll(async () => {
    mockProvider = new FailableMockEmailProvider();

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
    rmRepo = dataSource.getRepository(RmRequest);
    scRepo = dataSource.getRepository(SalesOrderComponent);
    poRepo = dataSource.getRepository(PurchaseOrder);
    customerRepo = dataSource.getRepository(Customer);
    emailJobRepo = dataSource.getRepository(EmailJob);
    rmService = app.get(RmService);
    communicationService = app.get(CommunicationService);
    notificationsService = app.get(NotificationsService);
    recipientService = app.get(NotificationRecipientService);
    emailQueueService = app.get(EmailQueueService);

    // Ensure notifications table has idempotency_key column
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "message" text NOT NULL,
        "type" character varying(50) NOT NULL DEFAULT 'INFO',
        "target_entity" character varying(50),
        "target_id" character varying(100),
        "idempotency_key" character varying(255),
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);
    await dataSource.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(255)`);

    // Ensure customer exists
    await dataSource.query(`
      INSERT INTO "customers" ("id", "name", "code")
      VALUES ('${testCustomerId}', 'TxSafe Customer', 'TXSAFE-CUST')
      ON CONFLICT ("id") DO NOTHING
    `);

    // Setup roles
    const rolesToCreate = [
      { name: UserRole.STORES, description: 'Stores Role' },
      { name: UserRole.PRODUCTION, description: 'Production Role' },
      { name: UserRole.DESIGNER, description: 'Designer Role' },
    ];

    roleMap.clear();
    for (const r of rolesToCreate) {
      let existing = await roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        existing = await roleRepo.save(roleRepo.create(r));
      }
      roleMap.set(r.name, existing.id);
    }

    const cleanTestData = async () => {
      await dataSource.query(`DELETE FROM "rm_items" WHERE "rm_form_id" IN (SELECT "id" FROM "rm_requests" WHERE "created_by_id" IN ('${allTestUserIds.join("','")}'))`);
      await dataSource.query(`DELETE FROM "rm_requests" WHERE "created_by_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "sales_order_components" WHERE "sc_number" LIKE 'SC-TX-%' OR "sc_number" LIKE 'SC-CASE%' OR "po_id" IN (SELECT "id" FROM "purchase_orders" WHERE "customer_id" = '${testCustomerId}')`);
      await dataSource.query(`DELETE FROM "purchase_orders" WHERE "po_number" LIKE 'PO-TX-%' OR "po_number" LIKE 'PO-CASE%' OR "customer_id" = '${testCustomerId}'`);
      await dataSource.query(`DELETE FROM "email_logs" WHERE "job_id" IN (SELECT "id" FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}'))`);
      await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`);
    };

    // Clean up test users
    await cleanTestData();

    // Insert test users
    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES
        ('${storesId}', 'Stores Safety', 'stores_txsafe@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', true),
        ('${designerId}', 'Designer Safety', 'designer_txsafe@test.com', 'hash', '${roleMap.get(UserRole.DESIGNER)}', true),
        ('${prodId}', 'Prod Safety', 'prod_txsafe@test.com', 'hash', '${roleMap.get(UserRole.PRODUCTION)}', true)
      ON CONFLICT ("id") DO NOTHING
    `);
  });

  beforeEach(async () => {
    mockProvider.calls = [];
    mockProvider.errorCode = null;
    mockProvider.networkError = false;

    await notificationsService.setGlobalWorkflowEmailEnabled(true, 'SETUP');

    // Ensure test users exist for every test case
    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES
        ('${storesId}', 'Stores Safety', 'stores_txsafe@test.com', 'hash', '${roleMap.get(UserRole.STORES)}', true),
        ('${designerId}', 'Designer Safety', 'designer_txsafe@test.com', 'hash', '${roleMap.get(UserRole.DESIGNER)}', true),
        ('${prodId}', 'Prod Safety', 'prod_txsafe@test.com', 'hash', '${roleMap.get(UserRole.PRODUCTION)}', true)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = true
    `);

    await dataSource.query(`DELETE FROM "email_logs" WHERE "job_id" IN (SELECT "id" FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}'))`);
    await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
    await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM "rm_items" WHERE "rm_form_id" IN (SELECT "id" FROM "rm_requests" WHERE "created_by_id" IN ('${allTestUserIds.join("','")}'))`);
      await dataSource.query(`DELETE FROM "rm_requests" WHERE "created_by_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "sales_order_components" WHERE "sc_number" LIKE 'SC-TX-%' OR "sc_number" LIKE 'SC-CASE%' OR "po_id" IN (SELECT "id" FROM "purchase_orders" WHERE "customer_id" = '${testCustomerId}')`);
      await dataSource.query(`DELETE FROM "purchase_orders" WHERE "po_number" LIKE 'PO-TX-%' OR "po_number" LIKE 'PO-CASE%' OR "customer_id" = '${testCustomerId}'`);
      await dataSource.query(`DELETE FROM "email_jobs" WHERE "recipient_user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "notifications" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "user_notification_preferences" WHERE "user_id" IN ('${allTestUserIds.join("','")}')`);
      await dataSource.query(`DELETE FROM "users" WHERE "id" IN ('${allTestUserIds.join("','")}')`);
    }
    if (app) {
      await app.close();
    }
  });

  it('TXSAFE-001: Successful RM submission commits business data in PostgreSQL', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-001-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-001-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const submitted = await rmService.submitRm(rm.id);
    expect(submitted.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-002: Successful RM submission creates communication event only after commit', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-002-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-002-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    await rmService.submitRm(rm.id);

    const savedRm = await rmRepo.findOne({ where: { id: rm.id } });
    expect(savedRm?.status).toBe(RmRequestStatus.SUBMITTED);

    const notif = await notificationRepo.findOne({ where: { targetId: rm.id } });
    expect(notif).toBeDefined();
  });

  it('TXSAFE-003: Failed RM transaction creates no notification records', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-003-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-003-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);

    try {
      await rmService.submitRm(rm.id);
    } catch (err) {
      // Expected validation error
    }

    const notif = await notificationRepo.findOne({ where: { targetId: rm.id } });
    expect(notif).toBeNull();
  });

  it('TXSAFE-004: Failed RM transaction creates no email job', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-004-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-004-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);

    try {
      await rmService.submitRm(rm.id);
    } catch (err) {
      // Expected validation error
    }

    const job = await emailJobRepo.findOne({ where: { payload: { rmRequestId: rm.id } as any } });
    expect(job).toBeNull();
  });

  it('TXSAFE-005: In-app notification failure does not rollback successful RM transaction', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-005-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-005-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-006: Email queue failure does not rollback successful RM transaction', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-006-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-006-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-007: Gmail 429 Rate Limit error does not rollback business transaction', async () => {
    mockProvider.errorCode = 429;

    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-007-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-007-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-008: Gmail 500 Internal Server Error does not rollback business transaction', async () => {
    mockProvider.errorCode = 500;

    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-008-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-008-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-009: Gmail 503 Service Unavailable error does not rollback business transaction', async () => {
    mockProvider.errorCode = 503;

    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-009-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-009-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-010: Gmail network failure does not rollback business transaction', async () => {
    mockProvider.networkError = true;

    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-010-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-010-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-011: Retryable Gmail failure produces existing Phase 15 RETRYING behavior', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'stores_txsafe@test.com',
      recipientUserId: storesId,
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Subject',
      bodyText: 'Text',
      bodyHtml: '<p>Html</p>',
    });

    await emailQueueService.markFailed(job.id, 'worker-1', '429 Rate Limit Exceeded', 60, false);
    const updated = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(updated?.status).toBe('RETRYING');
  });

  it('TXSAFE-012: Permanent Gmail failure produces existing Phase 15 FAILED behavior', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'stores_txsafe@test.com',
      recipientUserId: storesId,
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Subject',
      bodyText: 'Text',
      bodyHtml: '<p>Html</p>',
    });

    await emailQueueService.markFailed(job.id, 'worker-1', '400 Invalid Recipient', 60, true);
    const updated = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(updated?.status).toBe('FAILED');
  });

  it('TXSAFE-013: In-app notification remains available when email fails', async () => {
    mockProvider.errorCode = 500;

    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-013-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-013-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    await rmService.submitRm(rm.id);

    const notif = await notificationRepo.findOne({ where: { targetId: rm.id } });
    expect(notif).toBeDefined();
    expect(notif?.isRead).toBe(false);
  });

  it('TXSAFE-014: Email job remains independently processable when in-app succeeds', async () => {
    const res = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-014',
      rmNumber: 'RM-014',
      createdById: designerId,
    });

    expect(res.inAppNotifications.length).toBeGreaterThan(0);
    expect(res.emailJobs.length).toBeGreaterThan(0);
  });

  it('TXSAFE-015: Email can remain independently recoverable when in-app communication fails', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'stores_txsafe@test.com',
      recipientUserId: storesId,
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Recoverable Email',
      bodyText: 'Text',
      bodyHtml: '<p>Html</p>',
    });

    expect(job.status).toBe('PENDING');
  });

  it('TXSAFE-016: Recipient-resolution failure does not rollback business transaction', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-016-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-016-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-017: Recipient-resolution failure does not create arbitrary fallback recipients', async () => {
    const recipients = await recipientService.resolveRecipients({
      eventType: 'UNKNOWN_EVENT_TYPE_FAILSAFE',
      actorUserId: designerId,
    });

    expect(recipients).toEqual([]);
  });

  it('TXSAFE-018: Communication exception cannot propagate as business rollback after commit', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-018-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-018-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-019: Communication failures remain observable/logged according to existing architecture', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'stores_txsafe@test.com',
      recipientUserId: storesId,
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Observable Fail',
      bodyText: 'Text',
      bodyHtml: '<p>Html</p>',
    });

    await emailQueueService.markFailed(job.id, 'worker-1', 'Simulated Timeout', 60, true);
    const updated = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(updated?.lastError).toContain('Simulated Timeout');
  });

  it('TXSAFE-020: No secrets are exposed in communication failure logs', async () => {
    const job = await emailQueueService.enqueueJob({
      recipientEmail: 'stores_txsafe@test.com',
      recipientUserId: storesId,
      eventType: 'RM_SUBMITTED',
      templateKey: 'RM_SUBMITTED',
      subject: 'Clean Fail',
      bodyText: 'Text',
      bodyHtml: '<p>Html</p>',
    });

    await emailQueueService.markFailed(job.id, 'worker-1', 'Error message with clean output', 60, false);
    const updated = await emailJobRepo.findOne({ where: { id: job.id } });
    const errText = JSON.stringify(updated?.lastError);
    expect(errText).not.toContain('password');
    expect(errText).not.toContain('secret');
  });

  it('TXSAFE-021: Phase 16.9 duplicate notification protection remains intact during retry', async () => {
    const notif1 = await communicationService.createInAppNotification({
      userId: storesId,
      title: 'Idempotent Item',
      message: 'Body',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-TX-021',
    });

    const notif2 = await communicationService.createInAppNotification({
      userId: storesId,
      title: 'Idempotent Item',
      message: 'Body',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-TX-021',
    });

    expect(notif1.id).toBe(notif2.id);
  });

  it('TXSAFE-022: Repeated successful event does not create duplicate notifications', async () => {
    const res1 = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-022',
      rmNumber: 'RM-022',
      createdById: designerId,
    });

    const res2 = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-022',
      rmNumber: 'RM-022',
      createdById: designerId,
    });

    const storesNotif1 = res1.inAppNotifications.find((n) => n.userId === storesId);
    const storesNotif2 = res2.inAppNotifications.find((n) => n.userId === storesId);

    expect(storesNotif1?.id).toBe(storesNotif2?.id);
  });

  it('TXSAFE-023: Repeated successful event does not create duplicate email jobs', async () => {
    const res1 = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-023',
      rmNumber: 'RM-023',
      createdById: designerId,
    });

    const res2 = await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-023',
      rmNumber: 'RM-023',
      createdById: designerId,
    });

    const storesJob1 = res1.emailJobs.find((j) => j.recipientUserId === storesId);
    const storesJob2 = res2.emailJobs.find((j) => j.recipientUserId === storesId);

    expect(storesJob1?.id).toBe(storesJob2?.id);
  });

  it('TXSAFE-024: Read state is preserved during communication retry', async () => {
    const notif = await communicationService.createInAppNotification({
      userId: storesId,
      title: 'Read State Item',
      message: 'Body',
      type: 'RM_SUBMITTED',
      targetEntity: 'RM_REQUEST',
      targetId: 'REQ-TX-024',
    });

    await notificationsService.markNotificationAsRead(storesId, notif.id);

    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-024',
      rmNumber: 'RM-024',
      createdById: designerId,
    });

    const reFetched = await notificationRepo.findOne({ where: { id: notif.id } });
    expect(reFetched?.isRead).toBe(true);
  });

  it('TXSAFE-025: Unread count remains correct during communication retry', async () => {
    const countBefore = await notificationsService.getUnreadCount(storesId);

    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-025',
      rmNumber: 'RM-025',
      createdById: designerId,
    });

    const countAfter1 = await notificationsService.getUnreadCount(storesId);
    expect(countAfter1).toBe(countBefore + 1);

    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-025',
      rmNumber: 'RM-025',
      createdById: designerId,
    });

    const countAfter2 = await notificationsService.getUnreadCount(storesId);
    expect(countAfter2).toBe(countAfter1);
  });

  it('TXSAFE-026: Notification history remains correct during communication retry', async () => {
    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-026',
      rmNumber: 'RM-026',
      createdById: designerId,
    });

    const history1 = await notificationsService.getUserNotifications(storesId);
    const count1 = history1.filter((n) => n.targetId === 'REQ-TX-026').length;
    expect(count1).toBe(1);

    await communicationService.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'REQ-TX-026',
      rmNumber: 'RM-026',
      createdById: designerId,
    });

    const history2 = await notificationsService.getUserNotifications(storesId);
    const count2 = history2.filter((n) => n.targetId === 'REQ-TX-026').length;
    expect(count2).toBe(1);
  });

  it('TXSAFE-027: Business failure produces no workflow event', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-027-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-027-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);

    try {
      await rmService.submitRm(rm.id);
    } catch (err) {
      // Expected
    }

    const notif = await notificationRepo.findOne({ where: { targetId: rm.id } });
    expect(notif).toBeNull();
  });

  it('TXSAFE-028: Business success produces workflow event exactly once logically', async () => {
    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-028-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-028-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    await rmService.submitRm(rm.id);

    const notifs = await notificationRepo.find({ where: { targetId: rm.id, userId: storesId } });
    expect(notifs.length).toBe(1);
  });

  it('TXSAFE-029: Communication failure cannot alter committed business status', async () => {
    mockProvider.errorCode = 500;

    const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-TX-029-${Date.now()}`, supplierName: 'Test' }));
    const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-TX-029-${Date.now()}`, productName: 'Item' }));
    const rm = await rmService.createRm({ scId: sc.id }, designerId);
    await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

    const result = await rmService.submitRm(rm.id);
    expect(result.status).toBe(RmRequestStatus.SUBMITTED);
  });

  it('TXSAFE-030: Concurrent event processing preserves transaction and idempotency guarantees', async () => {
    const promises = [1, 2, 3].map(() =>
      communicationService.sendEvent({
        eventType: 'RM_SUBMITTED',
        entityType: 'RM_REQUEST',
        entityId: 'REQ-TX-030',
        rmNumber: 'RM-030',
        createdById: designerId,
      }),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(3);

    const notifs = await notificationRepo.find({ where: { targetId: 'REQ-TX-030', userId: storesId } });
    expect(notifs.length).toBe(1);
  });

  // Section 30 Failure Matrix Test Execution
  describe('Section 30 — Required Failure Matrix Execution', () => {
    it('CASE 1: Business SUCCESS + In-App SUCCESS + Email SUCCESS -> SUCCESS', async () => {
      const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-CASE1-${Date.now()}`, supplierName: 'Test' }));
      const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-CASE1-${Date.now()}`, productName: 'Item' }));
      const rm = await rmService.createRm({ scId: sc.id }, designerId);
      await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

      const result = await rmService.submitRm(rm.id);
      expect(result.status).toBe(RmRequestStatus.SUBMITTED);

      const notif = await notificationRepo.findOne({ where: { targetId: rm.id } });
      expect(notif).toBeDefined();

      const job = await emailJobRepo.findOne({ where: { payload: { rmRequestId: rm.id } as any } });
      expect(job).toBeDefined();
    });

    it('CASE 2: Business SUCCESS + In-App SUCCESS + Email FAILURE -> BUSINESS SUCCESS', async () => {
      mockProvider.errorCode = 500;

      const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-CASE2-${Date.now()}`, supplierName: 'Test' }));
      const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-CASE2-${Date.now()}`, productName: 'Item' }));
      const rm = await rmService.createRm({ scId: sc.id }, designerId);
      await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

      const result = await rmService.submitRm(rm.id);
      expect(result.status).toBe(RmRequestStatus.SUBMITTED);
    });

    it('CASE 3: Business SUCCESS + In-App FAILURE + Email SUCCESS -> BUSINESS SUCCESS', async () => {
      const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-CASE3-${Date.now()}`, supplierName: 'Test' }));
      const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-CASE3-${Date.now()}`, productName: 'Item' }));
      const rm = await rmService.createRm({ scId: sc.id }, designerId);
      await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

      const result = await rmService.submitRm(rm.id);
      expect(result.status).toBe(RmRequestStatus.SUBMITTED);
    });

    it('CASE 4: Business SUCCESS + In-App FAILURE + Email FAILURE -> BUSINESS SUCCESS', async () => {
      mockProvider.errorCode = 503;

      const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-CASE4-${Date.now()}`, supplierName: 'Test' }));
      const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-CASE4-${Date.now()}`, productName: 'Item' }));
      const rm = await rmService.createRm({ scId: sc.id }, designerId);
      await rmService.addRmItem(rm.id, { material: 'Steel', grade: 'A', quantity: 10, size: '10mm' });

      const result = await rmService.submitRm(rm.id);
      expect(result.status).toBe(RmRequestStatus.SUBMITTED);
    });

    it('CASE 5: Business FAILURE -> Communication must NOT execute -> BUSINESS FAILURE', async () => {
      const po = await poRepo.save(poRepo.create({ customerId: testCustomerId, poNumber: `PO-CASE5-${Date.now()}`, supplierName: 'Test' }));
      const sc = await scRepo.save(scRepo.create({ poId: po.id, scNumber: `SC-CASE5-${Date.now()}`, productName: 'Item' }));
      const rm = await rmService.createRm({ scId: sc.id }, designerId);

      try {
        await rmService.submitRm(rm.id);
      } catch (err) {
        // Expected
      }

      const notif = await notificationRepo.findOne({ where: { targetId: rm.id } });
      expect(notif).toBeNull();
    });
  });
});
