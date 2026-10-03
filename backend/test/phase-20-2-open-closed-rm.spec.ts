import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { Customer } from '../src/customers/entities/customer.entity.js';
import { PurchaseOrder } from '../src/po/entities/po.entity.js';
import { SalesOrderComponent, ScStatus } from '../src/sc/entities/sc.entity.js';
import { RmRequest, FormType, RmRequestStatus } from '../src/rm/entities/rm-request.entity.js';
import { RmItem } from '../src/rm/entities/rm-item.entity.js';
import { MaterialIssue, MaterialIssueType } from '../src/material-issue/entities/material-issue.entity.js';
import { MaterialIssueItem } from '../src/material-issue/entities/material-issue-item.entity.js';
import { MaterialConsumption } from '../src/production/entities/material-consumption.entity.js';
import { MaterialReturn, ReturnStatus } from '../src/production/entities/material-return.entity.js';
import { MaterialReturnItem } from '../src/production/entities/material-return-item.entity.js';
import { RmLifecycleCategory, ReconciliationReason } from '../src/traceability/dto/rm-lifecycle.dto.js';

describe('Phase 20.2 — Open RM / Closed RM Lifecycle & Reconciliation Queries (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p20_2_${Date.now()}`;

  let storesToken: string;
  let productionToken: string;
  let adminToken: string;
  let seniorManagerToken: string;
  let designerToken: string;

  let testUserId: string;

  // Master references
  let scOpenId: string;
  let scCompletedId: string;
  let scClosedId: string;
  let scUnbalancedId: string;
  let pendingReturnId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    jwtService = app.get(JwtService);

    // 1. Roles & Users
    const roleRepo = dataSource.getRepository('Role');
    const userRepo = dataSource.getRepository('User');

    const ensureRole = async (roleName: string) => {
      let r = await roleRepo.findOne({ where: { name: roleName } });
      if (!r) r = await roleRepo.save({ name: roleName });
      return r;
    };

    const adminRole = await ensureRole(UserRole.ADMIN);
    const storesRole = await ensureRole(UserRole.STORES);
    const prodRole = await ensureRole(UserRole.PRODUCTION);
    const smRole = await ensureRole(UserRole.SENIOR_MANAGER);
    const designerRole = await ensureRole(UserRole.DESIGNER);

    const testUser = await userRepo.save({
      name: `User ${TEST_PREFIX}`,
      email: `${TEST_PREFIX}@rmrit.com`,
      passwordHash: 'hash',
      roleId: storesRole.id,
      isActive: true,
    });
    testUserId = testUser.id;

    storesToken = jwtService.sign({ sub: testUser.id, userId: testUser.id, email: testUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    productionToken = jwtService.sign({ sub: testUser.id, userId: testUser.id, email: testUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
    adminToken = jwtService.sign({ sub: testUser.id, userId: testUser.id, email: testUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    seniorManagerToken = jwtService.sign({ sub: testUser.id, userId: testUser.id, email: testUser.email, role: UserRole.SENIOR_MANAGER, roles: [UserRole.SENIOR_MANAGER] });
    designerToken = jwtService.sign({ sub: testUser.id, userId: testUser.id, email: testUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });

    // 2. Base Customer, PO
    const custRepo = dataSource.getRepository(Customer);
    const poRepo = dataSource.getRepository(PurchaseOrder);
    const scRepo = dataSource.getRepository(SalesOrderComponent);
    const rmReqRepo = dataSource.getRepository(RmRequest);
    const rmItemRepo = dataSource.getRepository(RmItem);
    const issueRepo = dataSource.getRepository(MaterialIssue);
    const issueItemRepo = dataSource.getRepository(MaterialIssueItem);
    const consumptionRepo = dataSource.getRepository(MaterialConsumption);
    const returnRepo = dataSource.getRepository(MaterialReturn);
    const returnItemRepo = dataSource.getRepository(MaterialReturnItem);

    let cust = await custRepo.findOne({ where: {} });
    if (!cust) {
      cust = await custRepo.save({
        code: `CUST-${TEST_PREFIX}`,
        name: `Trace Customer ${TEST_PREFIX}`,
        email: `cust_${TEST_PREFIX}@test.com`,
      });
    }

    const po = await poRepo.save({
      poNumber: `PO-${TEST_PREFIX}`,
      customerId: cust.id,
      externalReference: `REF-${TEST_PREFIX}`,
      referenceDate: new Date(),
    });

    // -------------------------------------------------------------
    // SC 1: OPEN RM (Active In-Production, Outstanding Qty, Pending Return)
    // -------------------------------------------------------------
    const sc1 = await scRepo.save({
      scNumber: `SC-OPEN-${TEST_PREFIX}`,
      poId: po.id,
      productName: `Open Impeller ${TEST_PREFIX}`,
      drawingNumber: `DWG-OPEN-${TEST_PREFIX}`,
      targetQuantity: 10,
      status: ScStatus.IN_PRODUCTION,
    });
    scOpenId = sc1.id;

    const rmReq1 = await rmReqRepo.save({
      scId: sc1.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    const item1 = await rmItemRepo.save({
      rmFormId: rmReq1.id,
      scId: sc1.id,
      material: 'Titanium Bar',
      materialType: 'ROUND_BAR',
      grade: 'Ti-6Al-4V',
      size: '50mm',
      quantity: 100,
      weightUnit: 'KG',
    });

    const issue1 = await issueRepo.save({
      scId: sc1.id,
      issueNumber: `ISSUE-OPEN-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issue1.id,
      rmItemId: item1.id,
      quantityIssued: 80,
    });

    await consumptionRepo.save({
      scId: sc1.id,
      rmItemId: item1.id,
      consumedQuantity: 50,
      unit: 'KG',
      recordedById: testUserId,
    });

    // Acknowledged return: 10 kg
    const ackReturn = await returnRepo.save({
      scId: sc1.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
    });
    await returnItemRepo.save({
      materialReturnId: ackReturn.id,
      rmItemId: item1.id,
      quantityReturned: 10,
    });

    // Pending store ack return: 5 kg
    const pendReturn = await returnRepo.save({
      scId: sc1.id,
      status: ReturnStatus.PENDING_STORE_ACK,
      returnedById: testUserId,
      remarks: `Pending store inspection ${TEST_PREFIX}`,
    });
    pendingReturnId = pendReturn.id;
    await returnItemRepo.save({
      materialReturnId: pendReturn.id,
      rmItemId: item1.id,
      quantityReturned: 5,
    });

    // -------------------------------------------------------------
    // SC 2: COMPLETED RM (Finished Production, Zero-Loss, Awaiting Final Closure)
    // -------------------------------------------------------------
    const sc2 = await scRepo.save({
      scNumber: `SC-COMPLETED-${TEST_PREFIX}`,
      poId: po.id,
      productName: `Completed Valve ${TEST_PREFIX}`,
      drawingNumber: `DWG-COMP-${TEST_PREFIX}`,
      targetQuantity: 5,
      status: ScStatus.COMPLETED,
      completedAt: new Date(),
    });
    scCompletedId = sc2.id;

    const rmReq2 = await rmReqRepo.save({
      scId: sc2.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    const item2 = await rmItemRepo.save({
      rmFormId: rmReq2.id,
      scId: sc2.id,
      material: 'Stainless Steel',
      materialType: 'FORGING',
      grade: 'SS 316L',
      size: '75mm',
      quantity: 60,
      weightUnit: 'KG',
    });

    const issue2 = await issueRepo.save({
      scId: sc2.id,
      issueNumber: `ISSUE-COMP-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issue2.id,
      rmItemId: item2.id,
      quantityIssued: 60,
    });

    await consumptionRepo.save({
      scId: sc2.id,
      rmItemId: item2.id,
      consumedQuantity: 55,
      unit: 'KG',
      recordedById: testUserId,
    });

    const ackReturn2 = await returnRepo.save({
      scId: sc2.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
    });
    await returnItemRepo.save({
      materialReturnId: ackReturn2.id,
      rmItemId: item2.id,
      quantityReturned: 5,
    });

    // -------------------------------------------------------------
    // SC 3: CLOSED RM (Fully Reconciled and Administratively Closed)
    // -------------------------------------------------------------
    const sc3 = await scRepo.save({
      scNumber: `SC-CLOSED-${TEST_PREFIX}`,
      poId: po.id,
      productName: `Closed Flange ${TEST_PREFIX}`,
      drawingNumber: `DWG-CLOSE-${TEST_PREFIX}`,
      targetQuantity: 4,
      status: ScStatus.CLOSED,
      completedAt: new Date(),
    });
    scClosedId = sc3.id;

    const rmReq3 = await rmReqRepo.save({
      scId: sc3.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    const item3 = await rmItemRepo.save({
      rmFormId: rmReq3.id,
      scId: sc3.id,
      material: 'Alloy Steel',
      materialType: 'PLATE',
      grade: 'AISI 4140',
      size: '20mm',
      quantity: 40,
      weightUnit: 'KG',
    });

    const issue3 = await issueRepo.save({
      scId: sc3.id,
      issueNumber: `ISSUE-CLOSE-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issue3.id,
      rmItemId: item3.id,
      quantityIssued: 40,
    });

    await consumptionRepo.save({
      scId: sc3.id,
      rmItemId: item3.id,
      consumedQuantity: 40,
      unit: 'KG',
      recordedById: testUserId,
    });

    // -------------------------------------------------------------
    // SC 4: UNBALANCED OPEN RM (Variance Discrepancy without Pending Returns)
    // -------------------------------------------------------------
    const sc4 = await scRepo.save({
      scNumber: `SC-UNBALANCED-${TEST_PREFIX}`,
      poId: po.id,
      productName: `Unbalanced Shaft ${TEST_PREFIX}`,
      drawingNumber: `DWG-UNBAL-${TEST_PREFIX}`,
      targetQuantity: 2,
      status: ScStatus.IN_PRODUCTION,
    });
    scUnbalancedId = sc4.id;

    const rmReq4 = await rmReqRepo.save({
      scId: sc4.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    const item4 = await rmItemRepo.save({
      rmFormId: rmReq4.id,
      scId: sc4.id,
      material: 'Brass Rod',
      materialType: 'ROUND_BAR',
      grade: 'C36000',
      size: '30mm',
      quantity: 50,
      weightUnit: 'KG',
    });

    const issue4 = await issueRepo.save({
      scId: sc4.id,
      issueNumber: `ISSUE-UNBAL-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issue4.id,
      rmItemId: item4.id,
      quantityIssued: 50,
    });

    await consumptionRepo.save({
      scId: sc4.id,
      rmItemId: item4.id,
      consumedQuantity: 40,
      unit: 'KG',
      recordedById: testUserId,
    });
    // No returns, so 10 kg discrepancy remains
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. RBAC & SECURITY ENFORCEMENT
  // =========================================================================
  describe('1. Security & RBAC Enforcement', () => {
    it('E2E-LIFECYCLE-001: Should reject unauthenticated requests to lifecycle summary with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/traceability/rm/lifecycle-summary')
        .expect(401);
    });

    it('E2E-LIFECYCLE-002: Should reject unauthenticated requests to reconciliation queue with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/traceability/rm/reconciliation-queue')
        .expect(401);
    });

    it('E2E-LIFECYCLE-003: Should reject unauthorized role (DESIGNER) with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/api/traceability/rm/lifecycle-summary')
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/traceability/rm/reconciliation-queue')
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(403);
    });

    it('E2E-LIFECYCLE-004: Should allow operational roles (STORES, PRODUCTION, SENIOR_MANAGER, ADMIN)', async () => {
      for (const token of [storesToken, productionToken, seniorManagerToken, adminToken]) {
        const res = await request(app.getHttpServer())
          .get('/api/traceability/rm/lifecycle-summary')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body).toHaveProperty('counts');
        expect(res.body).toHaveProperty('totals');
        expect(res.body).toHaveProperty('data');
      }
    });
  });

  // =========================================================================
  // 2. LIFECYCLE SUMMARY AGGREGATION & CATEGORIZATION
  // =========================================================================
  describe('2. Lifecycle Summary & Classification Engine', () => {
    it('E2E-LIFECYCLE-005: Should compute accurate global counts and material totals for test batch', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/lifecycle-summary?search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const { counts, totals, data } = res.body;

      // 4 SCs created in this batch
      expect(counts.totalSc).toBe(4);
      expect(counts.openRmCount).toBe(2); // scOpen + scUnbalanced
      expect(counts.completedRmCount).toBe(1); // scCompleted
      expect(counts.closedRmCount).toBe(1); // scClosed
      expect(counts.pendingReconciliationCount).toBe(3); // scOpen, scCompleted, scUnbalanced

      // Sum checks:
      // originalRm: 100 + 60 + 40 + 50 = 250
      expect(totals.totalOriginalRm).toBe(250);
      // totalIssued: 80 + 60 + 40 + 50 = 230
      expect(totals.totalIssued).toBe(230);
      // totalConsumed: 50 + 55 + 40 + 40 = 185
      expect(totals.totalConsumed).toBe(185);
      // totalReturned (acknowledged): 10 + 5 + 0 + 0 = 15
      expect(totals.totalReturned).toBe(15);
      // totalPendingReturn: 5 (from scOpen)
      expect(totals.totalPendingReturn).toBe(5);
      // totalOutstanding: (80 - 50 - 10) + 0 + 0 + (50 - 40 - 0) = 20 + 10 = 30
      expect(totals.totalOutstanding).toBe(30);

      expect(data.length).toBe(4);
    });

    it('E2E-LIFECYCLE-006: Should filter specifically for Open RM (category=OPEN)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/lifecycle-summary?category=OPEN&search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${productionToken}`)
        .expect(200);

      const { data, pagination, counts } = res.body;

      // Global counts still reflect the overall match
      expect(counts.totalSc).toBe(4);
      expect(counts.openRmCount).toBe(2);

      // Paginated items must only be OPEN
      expect(pagination.total).toBe(2);
      expect(data.length).toBe(2);
      data.forEach((item: any) => {
        expect(item.lifecycleCategory).toBe(RmLifecycleCategory.OPEN);
      });

      const openItem = data.find((i: any) => i.scId === scOpenId);
      expect(openItem).toBeDefined();
      expect(openItem.scNumber).toBe(`SC-OPEN-${TEST_PREFIX}`);
      expect(openItem.originalRm).toBe(100);
      expect(openItem.totalIssued).toBe(80);
      expect(openItem.totalConsumed).toBe(50);
      expect(openItem.totalReturned).toBe(10);
      expect(openItem.pendingReturn).toBe(5);
      expect(openItem.outstandingQuantity).toBe(20);
      expect(openItem.variance).toBe(20);
      expect(openItem.isZeroLossVerified).toBe(false);
      expect(openItem.isPendingReconciliation).toBe(true);
    });

    it('E2E-LIFECYCLE-007: Should filter specifically for Completed RM and Closed RM', async () => {
      // Completed filter
      const compRes = await request(app.getHttpServer())
        .get(`/api/traceability/rm/lifecycle-summary?category=COMPLETED&search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(compRes.body.pagination.total).toBe(1);
      const compItem = compRes.body.data[0];
      expect(compItem.scId).toBe(scCompletedId);
      expect(compItem.lifecycleCategory).toBe(RmLifecycleCategory.COMPLETED);
      expect(compItem.scStatus).toBe(ScStatus.COMPLETED);
      expect(compItem.outstandingQuantity).toBe(0);
      expect(compItem.isZeroLossVerified).toBe(true);
      expect(compItem.completedAt).toBeDefined();

      // Closed filter
      const closedRes = await request(app.getHttpServer())
        .get(`/api/traceability/rm/lifecycle-summary?category=CLOSED&search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(closedRes.body.pagination.total).toBe(1);
      const closedItem = closedRes.body.data[0];
      expect(closedItem.scId).toBe(scClosedId);
      expect(closedItem.lifecycleCategory).toBe(RmLifecycleCategory.CLOSED);
      expect(closedItem.scStatus).toBe(ScStatus.CLOSED);
      expect(closedItem.outstandingQuantity).toBe(0);
      expect(closedItem.variance).toBe(0);
      expect(closedItem.isZeroLossVerified).toBe(true);
      expect(closedItem.isPendingReconciliation).toBe(false);
    });

    it('E2E-LIFECYCLE-008: Search query matches product names and drawings', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/lifecycle-summary?search=Completed%20Valve%20${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(res.body.pagination.total).toBe(1);
      expect(res.body.data[0].scId).toBe(scCompletedId);
      expect(res.body.data[0].productName).toContain('Completed Valve');
    });
  });

  // =========================================================================
  // 3. RECONCILIATION QUEUE
  // =========================================================================
  describe('3. Reconciliation Queue & Variance Auditing', () => {
    it('E2E-RECON-001: Should list all items requiring reconciliation with reason breakdowns', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/reconciliation-queue?search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const { total, items } = res.body;

      // 3 SCs require reconciliation: scOpen, scCompleted, scUnbalanced
      // scClosed has variance 0, no pending return, and is closed -> not in reconciliation queue
      expect(total).toBe(3);
      expect(items.length).toBe(3);

      const openItem = items.find((i: any) => i.scId === scOpenId);
      expect(openItem).toBeDefined();
      expect(openItem.pendingReturn).toBe(5);
      expect(openItem.reconciliationReasons).toContain(ReconciliationReason.PENDING_STORE_ACK_RETURN);
      expect(openItem.reconciliationReasons).toContain(ReconciliationReason.VARIANCE_DISCREPANCY);
      expect(openItem.pendingReturns.length).toBe(1);
      expect(openItem.pendingReturns[0].returnId).toBe(pendingReturnId);
      expect(openItem.pendingReturns[0].quantity).toBe(5);

      const compItem = items.find((i: any) => i.scId === scCompletedId);
      expect(compItem).toBeDefined();
      expect(compItem.reconciliationReasons).toContain(ReconciliationReason.AWAITING_FINAL_CLOSURE);

      const unbalItem = items.find((i: any) => i.scId === scUnbalancedId);
      expect(unbalItem).toBeDefined();
      expect(unbalItem.reconciliationReasons).toContain(ReconciliationReason.VARIANCE_DISCREPANCY);
      expect(unbalItem.variance).toBe(10);
    });

    it('E2E-RECON-002: Should filter reconciliation queue by reason=PENDING_STORE_ACK_RETURN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/reconciliation-queue?reason=PENDING_STORE_ACK_RETURN&search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].scId).toBe(scOpenId);
      expect(res.body.items[0].pendingReturn).toBe(5);
    });

    it('E2E-RECON-003: Should filter reconciliation queue by reason=AWAITING_FINAL_CLOSURE', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/reconciliation-queue?reason=AWAITING_FINAL_CLOSURE&search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].scId).toBe(scCompletedId);
      expect(res.body.items[0].scStatus).toBe(ScStatus.COMPLETED);
    });

    it('E2E-RECON-004: Should filter reconciliation queue by reason=VARIANCE_DISCREPANCY', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/rm/reconciliation-queue?reason=VARIANCE_DISCREPANCY&search=${TEST_PREFIX}`)
        .set('Authorization', `Bearer ${seniorManagerToken}`)
        .expect(200);

      expect(res.body.total).toBe(2); // scOpen and scUnbalanced
      const ids = res.body.items.map((i: any) => i.scId);
      expect(ids).toContain(scOpenId);
      expect(ids).toContain(scUnbalancedId);
    });
  });
});
