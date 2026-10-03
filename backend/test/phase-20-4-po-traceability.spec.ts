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
import { StockTransaction, TransactionType } from '../src/inventory/entities/stock-transaction.entity.js';
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import {
  DeliveryChallan,
  DeliveryChallanType,
  DeliveryChallanStatus,
} from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { RmLifecycleCategory } from '../src/traceability/dto/rm-lifecycle.dto.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 20.4 — PO Consolidated Traceability API (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p20_4_${Date.now()}`;

  let storesToken: string;
  let productionToken: string;
  let adminToken: string;
  let seniorManagerToken: string;
  let designerToken: string;

  let testUserId: string;

  // Master References
  let testPoId: string;
  let emptyPoId: string;
  let expectedPoNumber: string;
  let expectedCustomerName: string;
  let vendorAName: string;
  let vendorBName: string;

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
      name: `Manager ${TEST_PREFIX}`,
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

    // 2. Base Repositories
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
    const stockTxRepo = dataSource.getRepository(StockTransaction);
    const processRepo = dataSource.getRepository(ProductionProcess);
    const vendorRepo = dataSource.getRepository(Vendor);
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    const dcItemRepo = dataSource.getRepository(DeliveryChallanItem);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);

    // 3. Customer & Master PO Setup
    expectedCustomerName = `Global Marine Turbines ${TEST_PREFIX}`;
    const cust = await custRepo.save({
      code: `CUST-PO-${TEST_PREFIX}`,
      name: expectedCustomerName,
      email: `marine_${TEST_PREFIX}@test.com`,
      phone: '+44 20 7946 0991',
    });

    expectedPoNumber = `PO-CONSOL-${TEST_PREFIX}`;
    const po = await poRepo.save({
      poNumber: expectedPoNumber,
      customerId: cust.id,
      externalReference: `EXT-PO-${TEST_PREFIX}`,
      referenceDate: new Date(),
      remarks: 'Multi-component marine propulsion order',
    });
    testPoId = po.id;

    // Empty PO setup for edge-case verification
    const emptyPo = await poRepo.save({
      poNumber: `PO-EMPTY-${TEST_PREFIX}`,
      customerId: cust.id,
      externalReference: `EMPTY-REF-${TEST_PREFIX}`,
    });
    emptyPoId = emptyPo.id;

    // Processes with dynamic sequence numbers
    const maxProcess = await processRepo
      .createQueryBuilder('p')
      .select('MAX(p.sequenceNumber)', 'max')
      .getRawOne();
    let nextSeq = (Number(maxProcess?.max) || 0) + 1;

    const proc1 = await processRepo.save({
      name: `Precision Milling ${TEST_PREFIX}`,
      code: `MILL-${uuidv4().substring(0, 8)}`,
      sequenceNumber: nextSeq++,
      allowsOutsideVendor: true,
      isActive: true,
    });

    const proc2 = await processRepo.save({
      name: `Electroless Plating ${TEST_PREFIX}`,
      code: `PLATE-${uuidv4().substring(0, 8)}`,
      sequenceNumber: nextSeq++,
      allowsOutsideVendor: true,
      isActive: true,
    });

    // Vendors
    vendorAName = `Apex Machining Services ${TEST_PREFIX}`;
    const vendorA = await vendorRepo.save({
      name: vendorAName,
      code: `V-APEX-${uuidv4().substring(0, 8)}`,
      contactPerson: 'David Miller',
      email: `apex_${TEST_PREFIX}@test.com`,
      isActive: true,
    });

    vendorBName = `Surface Tech Finishing ${TEST_PREFIX}`;
    const vendorB = await vendorRepo.save({
      name: vendorBName,
      code: `V-SURF-${uuidv4().substring(0, 8)}`,
      contactPerson: 'Sarah Jenkins',
      email: `surfacetech_${TEST_PREFIX}@test.com`,
      isActive: true,
    });

    let prd = await productRepo.findOne({ where: {} });
    let b = await binRepo.findOne({ where: {} });

    // -------------------------------------------------------------
    // CHILD SC 1: OPEN (Target Qty: 10, Orig: 100, Issued: 80, Cons: 50, Ret: 10, Pend: 5)
    // -------------------------------------------------------------
    const sc1 = await scRepo.save({
      scNumber: `SC-01-${TEST_PREFIX}`,
      poId: po.id,
      productName: 'Impeller Blisk',
      drawingNumber: `DWG-01-${TEST_PREFIX}`,
      targetQuantity: 10,
      status: ScStatus.IN_PRODUCTION,
    });

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
      material: 'Titanium Ti-6Al-4V',
      materialType: 'ROUND_BAR',
      grade: 'Grade 5',
      size: '50mm',
      quantity: 100,
      weightUnit: 'KG',
    });

    const issue1 = await issueRepo.save({
      scId: sc1.id,
      issueNumber: `ISS-01-${TEST_PREFIX}`,
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

    const ret1 = await returnRepo.save({
      scId: sc1.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
    });

    await returnItemRepo.save({
      materialReturnId: ret1.id,
      rmItemId: item1.id,
      quantityReturned: 10,
    });

    const pendRet1 = await returnRepo.save({
      scId: sc1.id,
      status: ReturnStatus.PENDING_STORE_ACK,
      returnedById: testUserId,
    });

    await returnItemRepo.save({
      materialReturnId: pendRet1.id,
      rmItemId: item1.id,
      quantityReturned: 5,
    });

    // DC 1 (DISPATCHED to Vendor A)
    const dc1 = await dcRepo.save({
      challanNumber: `DC-01-${TEST_PREFIX}`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: vendorA.id,
      scId: sc1.id,
      processId: proc1.id,
      dispatchDate: new Date(),
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: testUserId,
    });

    if (prd && b) {
      await dcItemRepo.save({
        challanId: dc1.id,
        productId: prd.id,
        binId: b.id,
        quantityDispatched: 5,
        quantityReturned: 0,
      });
    }

    // -------------------------------------------------------------
    // CHILD SC 2: COMPLETED (Target Qty: 5, Orig: 50, Issued: 50, Cons: 45, Ret: 5, Pend: 0)
    // -------------------------------------------------------------
    const sc2 = await scRepo.save({
      scNumber: `SC-02-${TEST_PREFIX}`,
      poId: po.id,
      productName: 'Diffuser Vane Ring',
      drawingNumber: `DWG-02-${TEST_PREFIX}`,
      targetQuantity: 5,
      status: ScStatus.COMPLETED,
      completedAt: new Date(),
    });

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
      material: 'Inconel 625',
      materialType: 'FORGING',
      grade: 'Alloy 625',
      size: '75mm',
      quantity: 50,
      weightUnit: 'KG',
    });

    const issue2 = await issueRepo.save({
      scId: sc2.id,
      issueNumber: `ISS-02-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issue2.id,
      rmItemId: item2.id,
      quantityIssued: 50,
    });

    await consumptionRepo.save({
      scId: sc2.id,
      rmItemId: item2.id,
      consumedQuantity: 45,
      unit: 'KG',
      recordedById: testUserId,
    });

    const ret2 = await returnRepo.save({
      scId: sc2.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
    });

    await returnItemRepo.save({
      materialReturnId: ret2.id,
      rmItemId: item2.id,
      quantityReturned: 5,
    });

    // DC 2 (CLOSED / RETURNED with Vendor B)
    const dc2 = await dcRepo.save({
      challanNumber: `DC-02-${TEST_PREFIX}`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: vendorB.id,
      scId: sc2.id,
      processId: proc2.id,
      dispatchDate: new Date(),
      status: DeliveryChallanStatus.CLOSED,
      createdById: testUserId,
    });

    if (prd && b) {
      await dcItemRepo.save({
        challanId: dc2.id,
        productId: prd.id,
        binId: b.id,
        quantityDispatched: 3,
        quantityReturned: 3,
      });
    }

    // -------------------------------------------------------------
    // CHILD SC 3: CLOSED (Target Qty: 5, Orig: 30, Issued: 30, Cons: 30, Ret: 0, Pend: 0)
    // -------------------------------------------------------------
    const sc3 = await scRepo.save({
      scNumber: `SC-03-${TEST_PREFIX}`,
      poId: po.id,
      productName: 'Exhaust Casing Strut',
      drawingNumber: `DWG-03-${TEST_PREFIX}`,
      targetQuantity: 5,
      status: ScStatus.CLOSED,
      completedAt: new Date(),
    });

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
      material: 'Stainless Steel 316L',
      materialType: 'BILLET',
      grade: 'SS 316L',
      size: '30mm',
      quantity: 30,
      weightUnit: 'KG',
    });

    const issue3 = await issueRepo.save({
      scId: sc3.id,
      issueNumber: `ISS-03-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issue3.id,
      rmItemId: item3.id,
      quantityIssued: 30,
    });

    await consumptionRepo.save({
      scId: sc3.id,
      rmItemId: item3.id,
      consumedQuantity: 30,
      unit: 'KG',
      recordedById: testUserId,
    });

    // PO-level stock transaction
    await stockTxRepo.save({
      productId: prd?.id,
      sourceBinId: b?.id,
      transactionType: TransactionType.STOCK_OUT,
      quantity: 160,
      referenceType: 'PO',
      referenceId: po.id,
      remarks: 'Bulk materials issued for PO consolidated schedule',
      createdById: testUserId,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. RBAC & SECURITY RESTRICTIONS
  // =========================================================================
  describe('1. Security & RBAC Enforcement', () => {
    it('E2E-POT-001: Should reject unauthenticated request with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/po/${testPoId}/consolidated`)
        .expect(401);
    });

    it('E2E-POT-002: Should reject unauthorized role (DESIGNER) with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/po/${testPoId}/consolidated`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(403);
    });

    it('E2E-POT-003: Should allow authorized operational roles (STORES, PRODUCTION, SENIOR_MANAGER, ADMIN)', async () => {
      for (const token of [storesToken, productionToken, seniorManagerToken, adminToken]) {
        const res = await request(app.getHttpServer())
          .get(`/api/traceability/po/${testPoId}/consolidated`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body.po.id).toBe(testPoId);
      }
    });

    it('E2E-POT-004: Should reject invalid UUID with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/traceability/po/not-a-valid-uuid/consolidated')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(400);
    });

    it('E2E-POT-005: Should return 404 Not Found for non-existent PO', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/po/${uuidv4()}/consolidated`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // 2. PO-LEVEL CONSOLIDATED TRACEABILITY AGGREGATION
  // =========================================================================
  describe('2. PO Consolidated Multi-SC Tree Aggregation', () => {
    it('E2E-POT-006: Should compute macro-level summary counts and fulfillment percentage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/po/${testPoId}/consolidated`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const { summary, po } = res.body;

      expect(po.id).toBe(testPoId);
      expect(po.poNumber).toBe(expectedPoNumber);
      expect(po.customer.name).toBe(expectedCustomerName);

      // Summary counts
      expect(summary.totalScCount).toBe(3);
      expect(summary.openScCount).toBe(1); // SC-01 (IN_PRODUCTION)
      expect(summary.completedScCount).toBe(1); // SC-02 (COMPLETED)
      expect(summary.closedScCount).toBe(1); // SC-03 (CLOSED)

      // Target quantity: 10 + 5 + 5 = 20
      expect(summary.totalTargetQuantity).toBe(20);
      // Completed target quantity: SC-02 (5) + SC-03 (5) = 10
      expect(summary.completedTargetQuantity).toBe(10);
      // Overall fulfillment: 10 / 20 * 100 = 50%
      expect(summary.overallFulfillmentPercentage).toBe(50);
    });

    it('E2E-POT-007: Should compute cumulative raw material (RM) summary across all child SCs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/po/${testPoId}/consolidated`)
        .set('Authorization', `Bearer ${productionToken}`)
        .expect(200);

      const { rmSummary } = res.body;

      // Original RM: 100 + 50 + 30 = 180
      expect(rmSummary.totalOriginalRm).toBe(180);
      // Initial Issued: 80 + 50 + 30 = 160
      expect(rmSummary.totalInitialIssued).toBe(160);
      expect(rmSummary.totalIssued).toBe(160);
      // Consumed: 50 + 45 + 30 = 125
      expect(rmSummary.totalConsumed).toBe(125);
      // Returned (acknowledged): 10 + 5 + 0 = 15
      expect(rmSummary.totalReturned).toBe(15);
      // Pending Returned: 5 (from SC-01)
      expect(rmSummary.totalPendingReturn).toBe(5);
      // Outstanding WIP: (80 - 50 - 10) + 0 + 0 = 20
      expect(rmSummary.totalOutstanding).toBe(20);
      // Final RM Used: (100 - 10) + (50 - 5) + (30 - 0) = 90 + 45 + 30 = 165
      expect(rmSummary.totalFinalRmUsed).toBe(165);
      // Total Variance: 20 + 0 + 0 = 20
      expect(rmSummary.totalVariance).toBe(20);
      // isAllZeroLossVerified is false because SC-01 has 20 kg floor variance
      expect(rmSummary.isAllZeroLossVerified).toBe(false);
    });

    it('E2E-POT-008: Should aggregate delivery challans and external vendor movements across the PO', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/po/${testPoId}/consolidated`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const { deliveryChallans, vendors } = res.body;

      // 2 DCs created: DC-01 (DISPATCHED) and DC-02 (CLOSED)
      expect(deliveryChallans.totalChallans).toBe(2);
      expect(deliveryChallans.dispatchedChallans).toBe(1);
      expect(deliveryChallans.closedChallans).toBe(1);
      expect(deliveryChallans.items.length).toBe(2);

      // 2 unique vendors: Vendor A and Vendor B
      expect(vendors.length).toBe(2);
      const vA = vendors.find((v: any) => v.name === vendorAName);
      const vB = vendors.find((v: any) => v.name === vendorBName);
      expect(vA).toBeDefined();
      expect(vA.totalChallans).toBe(1);
      expect(vA.activeChallans).toBe(1); // DC-01 is dispatched/active

      expect(vB).toBeDefined();
      expect(vB.totalChallans).toBe(1);
      expect(vB.activeChallans).toBe(0); // DC-02 is closed
    });

    it('E2E-POT-009: Should provide child components breakdown with individual metrics and status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/po/${testPoId}/consolidated`)
        .set('Authorization', `Bearer ${seniorManagerToken}`)
        .expect(200);

      const { childComponents } = res.body;

      expect(childComponents.length).toBe(3);

      const c1 = childComponents.find((c: any) => c.scNumber === `SC-01-${TEST_PREFIX}`);
      expect(c1).toBeDefined();
      expect(c1.productName).toBe('Impeller Blisk');
      expect(c1.lifecycleCategory).toBe(RmLifecycleCategory.OPEN);
      expect(c1.rmSummary.originalRm).toBe(100);
      expect(c1.rmSummary.totalIssued).toBe(80);
      expect(c1.rmSummary.totalConsumed).toBe(50);
      expect(c1.rmSummary.totalReturned).toBe(10);
      expect(c1.rmSummary.pendingReturned).toBe(5);
      expect(c1.deliveryChallanCount).toBe(1);
      expect(c1.vendorNames).toContain(vendorAName);
      expect(c1.isZeroLossVerified).toBe(false);
      expect(c1.isPendingReconciliation).toBe(true);

      const c2 = childComponents.find((c: any) => c.scNumber === `SC-02-${TEST_PREFIX}`);
      expect(c2).toBeDefined();
      expect(c2.lifecycleCategory).toBe(RmLifecycleCategory.COMPLETED);
      expect(c2.rmSummary.originalRm).toBe(50);
      expect(c2.rmSummary.variance).toBe(0);
      expect(c2.isZeroLossVerified).toBe(true);
      expect(c2.deliveryChallanCount).toBe(1);
      expect(c2.vendorNames).toContain(vendorBName);

      const c3 = childComponents.find((c: any) => c.scNumber === `SC-03-${TEST_PREFIX}`);
      expect(c3).toBeDefined();
      expect(c3.lifecycleCategory).toBe(RmLifecycleCategory.CLOSED);
      expect(c3.rmSummary.originalRm).toBe(30);
      expect(c3.rmSummary.variance).toBe(0);
      expect(c3.isZeroLossVerified).toBe(true);
      expect(c3.deliveryChallanCount).toBe(0);
    });

    it('E2E-POT-010: Should gracefully handle empty PO with 0 child components', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/po/${emptyPoId}/consolidated`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tree = res.body;

      expect(tree.po.id).toBe(emptyPoId);
      expect(tree.summary.totalScCount).toBe(0);
      expect(tree.summary.openScCount).toBe(0);
      expect(tree.summary.completedScCount).toBe(0);
      expect(tree.summary.closedScCount).toBe(0);
      expect(tree.summary.overallFulfillmentPercentage).toBe(0);

      expect(tree.rmSummary.totalOriginalRm).toBe(0);
      expect(tree.rmSummary.totalIssued).toBe(0);
      expect(tree.rmSummary.totalConsumed).toBe(0);
      expect(tree.rmSummary.totalReturned).toBe(0);
      expect(tree.rmSummary.totalOutstanding).toBe(0);
      expect(tree.rmSummary.isAllZeroLossVerified).toBe(true);

      expect(tree.inventorySummary.totalTransactions).toBe(0);
      expect(tree.deliveryChallans.totalChallans).toBe(0);
      expect(tree.vendors).toEqual([]);
      expect(tree.childComponents).toEqual([]);
    });
  });
});
