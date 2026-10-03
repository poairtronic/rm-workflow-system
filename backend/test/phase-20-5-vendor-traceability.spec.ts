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
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { VendorSla } from '../src/vendor/entities/vendor-sla.entity.js';
import {
  DeliveryChallan,
  DeliveryChallanType,
  DeliveryChallanStatus,
} from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 20.5 — Vendor Traceability & Performance Analytics API (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p20_5_${Date.now()}`;

  let storesToken: string;
  let productionToken: string;
  let adminToken: string;
  let seniorManagerToken: string;
  let designerToken: string;

  let testUserId: string;

  // Master References
  let testVendorId: string;
  let emptyVendorId: string;
  let testVendorCode: string;
  let testVendorName: string;
  let testProcessId: string;
  let testProcessCode: string;
  let testProcessName: string;
  let productAId: string;
  let productBId: string;
  let productAName: string;
  let productBName: string;
  let poNumber: string;
  let scNumber: string;

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

    storesToken = jwtService.sign({
      sub: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.STORES,
      roles: [UserRole.STORES],
    });
    productionToken = jwtService.sign({
      sub: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.PRODUCTION,
      roles: [UserRole.PRODUCTION],
    });
    adminToken = jwtService.sign({
      sub: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.ADMIN,
      roles: [UserRole.ADMIN],
    });
    seniorManagerToken = jwtService.sign({
      sub: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.SENIOR_MANAGER,
      roles: [UserRole.SENIOR_MANAGER],
    });
    designerToken = jwtService.sign({
      sub: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.DESIGNER,
      roles: [UserRole.DESIGNER],
    });

    // 2. Repositories
    const customerRepo = dataSource.getRepository(Customer);
    const poRepo = dataSource.getRepository(PurchaseOrder);
    const scRepo = dataSource.getRepository(SalesOrderComponent);
    const processRepo = dataSource.getRepository(ProductionProcess);
    const vendorRepo = dataSource.getRepository(Vendor);
    const vendorSlaRepo = dataSource.getRepository(VendorSla);
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    const dcItemRepo = dataSource.getRepository(DeliveryChallanItem);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);

    // Customer & PO
    const customer = await customerRepo.save({
      name: `Customer ${TEST_PREFIX}`,
      code: `CUST-${uuidv4().substring(0, 8)}`,
      email: `${TEST_PREFIX}@cust.com`,
    });

    poNumber = `PO-${TEST_PREFIX}`;
    const po = await poRepo.save({
      poNumber,
      orderDate: new Date(),
      status: 'ACTIVE',
      customerId: customer.id,
      createdById: testUserId,
    });

    // Sales Order Component
    scNumber = `SC-01-${TEST_PREFIX}`;
    const sc = await scRepo.save({
      scNumber,
      poId: po.id,
      productName: 'Turbine Casing',
      drawingNumber: `DWG-${TEST_PREFIX}`,
      targetQuantity: 20,
      status: ScStatus.IN_PRODUCTION,
    });

    // Production Process
    const maxSeqResult = await dataSource.query(
      'SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM production_processes',
    );
    const nextSeq = Number(maxSeqResult[0]?.max_seq || 0) + 1;

    testProcessCode = `PROC-${uuidv4().substring(0, 8)}`;
    testProcessName = `Electroplating ${TEST_PREFIX}`;
    const process = await processRepo.save({
      name: testProcessName,
      code: testProcessCode,
      sequenceNumber: nextSeq,
      allowsOutsideVendor: true,
      isActive: true,
    });
    testProcessId = process.id;

    // Test Vendors
    testVendorCode = `V-ELECTRO-${uuidv4().substring(0, 8)}`;
    testVendorName = `Precision Coatings Ltd ${TEST_PREFIX}`;
    const testVendor = await vendorRepo.save({
      name: testVendorName,
      code: testVendorCode,
      category: 'PLATING',
      contactPerson: 'Arthur Vance',
      email: `arthur_${TEST_PREFIX}@precision.com`,
      phone: '+1-555-0199',
      address: '100 Industrial Parkway',
      isActive: true,
    });
    testVendorId = testVendor.id;

    const emptyVendor = await vendorRepo.save({
      name: `Idle Vendor ${TEST_PREFIX}`,
      code: `V-IDLE-${uuidv4().substring(0, 8)}`,
      contactPerson: 'None',
      isActive: true,
    });
    emptyVendorId = emptyVendor.id;

    // Vendor SLA: 7 days turnaround
    await vendorSlaRepo.save({
      vendorId: testVendor.id,
      processId: process.id,
      slaDays: 7,
      effectiveDate: new Date(),
      isActive: true,
    });

    // Products & Bin for Delivery Challans
    let bin = await binRepo.findOne({ where: {} });
    if (!bin) {
      // Find or create warehouse
      let wh = await dataSource.getRepository('Warehouse').findOne({ where: {} });
      if (!wh) {
        wh = await dataSource.getRepository('Warehouse').save({
          code: `WH-${uuidv4().substring(0, 8)}`,
          name: 'Main Stores',
        });
      }
      bin = await binRepo.save({
        code: `BIN-${uuidv4().substring(0, 8)}`,
        warehouseId: wh.id,
      });
    }

    let existingProducts = await productRepo.find({ take: 2 });
    let prdA: Product;
    let prdB: Product;

    if (existingProducts.length >= 2) {
      prdA = existingProducts[0];
      prdB = existingProducts[1];
    } else {
      let fam = await dataSource.getRepository('ProductFamily').findOne({ where: {} });
      if (!fam) {
        let cat = await dataSource.getRepository('ProductCategory').findOne({ where: {} });
        if (!cat) {
          cat = await dataSource.getRepository('ProductCategory').save({
            code: `CAT-${uuidv4().substring(0, 8)}`,
            name: 'Components',
          });
        }
        fam = await dataSource.getRepository('ProductFamily').save({
          categoryId: cat.id,
          name: `Fam-${uuidv4().substring(0, 8)}`,
        });
      }
      prdA = await productRepo.save({
        name: `Product A ${TEST_PREFIX}`,
        familyId: fam.id,
        minimumInventory: 0,
      });
      prdB = await productRepo.save({
        name: `Product B ${TEST_PREFIX}`,
        familyId: fam.id,
        minimumInventory: 0,
      });
    }

    productAId = prdA.id;
    productBId = prdB.id;
    productAName = prdA.name;
    productBName = prdB.name;

    // Delivery Challan 1: CLOSED / RETURNED
    // Dispatched 10 days ago, actual return 6 days ago (turnaround: 4 days)
    // Expected return: 5 days ago (returned on day 4 vs expected day 5 -> compliant!)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const dc1 = await dcRepo.save({
      challanNumber: `DC-01-${TEST_PREFIX}`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: testVendor.id,
      scId: sc.id,
      processId: process.id,
      dispatchDate: tenDaysAgo,
      expectedReturnDate: fiveDaysAgo,
      actualReturnDate: sixDaysAgo,
      status: DeliveryChallanStatus.RETURNED,
      createdById: testUserId,
    });

    await dcItemRepo.save({
      challanId: dc1.id,
      productId: productAId,
      binId: bin.id,
      quantityDispatched: 50,
      quantityReturned: 50, // Balance: 0
    });

    // Delivery Challan 2: OPEN / ACTIVE (Not Overdue)
    // Dispatched 3 days ago, expected return in 4 days
    // Dispatched 30, returned 10 -> Balance: 20
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysLater = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    const dc2 = await dcRepo.save({
      challanNumber: `DC-02-${TEST_PREFIX}`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: testVendor.id,
      scId: sc.id,
      processId: process.id,
      dispatchDate: threeDaysAgo,
      expectedReturnDate: fourDaysLater,
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: testUserId,
    });

    await dcItemRepo.save({
      challanId: dc2.id,
      productId: productAId,
      binId: bin.id,
      quantityDispatched: 30,
      quantityReturned: 10, // Balance: 20
    });

    // Delivery Challan 3: OPEN / OVERDUE
    // Dispatched 8 days ago, expected return 2 days ago
    // Dispatched 15, returned 0 -> Balance: 15
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const dc3 = await dcRepo.save({
      challanNumber: `DC-03-${TEST_PREFIX}`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: testVendor.id,
      scId: sc.id,
      processId: process.id,
      dispatchDate: eightDaysAgo,
      expectedReturnDate: twoDaysAgo,
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: testUserId,
    });

    await dcItemRepo.save({
      challanId: dc3.id,
      productId: productBId,
      binId: bin.id,
      quantityDispatched: 15,
      quantityReturned: 0, // Balance: 15
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // =========================================================================
  // 1. RBAC & SECURITY VERIFICATION
  // =========================================================================
  describe('RBAC & Security Validation', () => {
    it('E2E-VT-001: should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${testVendorId}/traceability`);

      expect(res.status).toBe(401);
    });

    it('E2E-VT-002: should reject unauthorized role (DESIGNER) with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${testVendorId}/traceability`)
        .set('Authorization', `Bearer ${designerToken}`);

      expect(res.status).toBe(403);
    });

    it('E2E-VT-003: should allow authorized operational roles (STORES, PRODUCTION, SENIOR_MANAGER, ADMIN)', async () => {
      const tokens = [storesToken, productionToken, seniorManagerToken, adminToken];
      for (const token of tokens) {
        const res = await request(app.getHttpServer())
          .get(`/api/traceability/vendors/${testVendorId}/traceability`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
      }
    });

    it('E2E-VT-004: should reject invalid UUID format with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/vendors/not-a-valid-uuid/traceability')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(400);
    });

    it('E2E-VT-005: should return 404 Not Found for non-existent vendor UUID', async () => {
      const fakeUuid = uuidv4();
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${fakeUuid}/traceability`)
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('was not found');
    });

    it('E2E-VT-006: should reject unauthenticated request on performance-analytics with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/vendors/performance-analytics');

      expect(res.status).toBe(401);
    });

    it('E2E-VT-007: should reject unauthorized role (DESIGNER) on performance-analytics with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/vendors/performance-analytics')
        .set('Authorization', `Bearer ${designerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. VENDOR TRACEABILITY LOGISTICS & AUDIT METRICS
  // =========================================================================
  describe('Vendor Traceability Logistics Aggregation', () => {
    it('E2E-VT-008: should aggregate high-level metrics (total, open, closed, overdue, custody, turnaround, SLA)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${testVendorId}/traceability`)
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // Vendor Metadata
      expect(data.vendor).toBeDefined();
      expect(data.vendor.id).toBe(testVendorId);
      expect(data.vendor.code).toBe(testVendorCode);
      expect(data.vendor.name).toBe(testVendorName);
      expect(data.vendor.contactPerson).toBe('Arthur Vance');
      expect(data.vendor.isActive).toBe(true);

      // Summary Metrics:
      // Total DCs: 3
      // Closed DCs: 1 (DC1)
      // Open DCs: 2 (DC2, DC3)
      // Overdue DCs: 1 (DC3)
      // Total Dispatched: 50 + 30 + 15 = 95
      // Total Returned: 50 + 10 + 0 = 60
      // Net Balance in Custody: 95 - 60 = 35
      // Avg Turnaround: 4 days (DC1 took 4 days)
      // SLA Compliance: 1 compliant closed DC, 1 breached overdue DC -> 1/2 = 50%
      expect(data.summary.totalDcCount).toBe(3);
      expect(data.summary.openDcCount).toBe(2);
      expect(data.summary.closedDcCount).toBe(1);
      expect(data.summary.overdueDcCount).toBe(1);
      expect(data.summary.totalDispatchedQty).toBe(95);
      expect(data.summary.totalReturnedQty).toBe(60);
      expect(data.summary.netBalanceInCustody).toBe(35);
      expect(data.summary.averageTurnaroundDays).toBe(4);
      expect(data.summary.slaComplianceRate).toBe(50);
    });

    it('E2E-VT-009: should list detailed challan breakdown with timing, overdue flag, SLA status, and items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${testVendorId}/traceability`)
        .set('Authorization', `Bearer ${productionToken}`);

      expect(res.status).toBe(200);
      const { challanBreakdown } = res.body;

      expect(Array.isArray(challanBreakdown)).toBe(true);
      expect(challanBreakdown.length).toBe(3);

      // Find DC1 (Closed)
      const dc1Data = challanBreakdown.find((d: any) => d.challanNumber === `DC-01-${TEST_PREFIX}`);
      expect(dc1Data).toBeDefined();
      expect(dc1Data.status).toBe(DeliveryChallanStatus.RETURNED);
      expect(dc1Data.actualReceiptDate).toBeDefined();
      expect(dc1Data.actualTimeTakenDays).toBe(4);
      expect(dc1Data.isOverdue).toBe(false);
      expect(dc1Data.isSlaBreached).toBe(false);
      expect(dc1Data.scNumber).toBe(scNumber);
      expect(dc1Data.poNumber).toBe(poNumber);
      expect(dc1Data.processName).toBe(testProcessName);
      expect(dc1Data.items.length).toBe(1);
      expect(dc1Data.items[0].quantityDispatched).toBe(50);
      expect(dc1Data.items[0].quantityReturned).toBe(50);
      expect(dc1Data.items[0].balanceInCustody).toBe(0);

      // Find DC2 (Open, Not Overdue)
      const dc2Data = challanBreakdown.find((d: any) => d.challanNumber === `DC-02-${TEST_PREFIX}`);
      expect(dc2Data).toBeDefined();
      expect(dc2Data.status).toBe(DeliveryChallanStatus.DISPATCHED);
      expect(dc2Data.actualReceiptDate).toBeNull();
      expect(dc2Data.actualTimeTakenDays).toBeNull();
      expect(dc2Data.isOverdue).toBe(false);
      expect(dc2Data.isSlaBreached).toBe(false);
      expect(dc2Data.items[0].quantityDispatched).toBe(30);
      expect(dc2Data.items[0].quantityReturned).toBe(10);
      expect(dc2Data.items[0].balanceInCustody).toBe(20);

      // Find DC3 (Open, Overdue)
      const dc3Data = challanBreakdown.find((d: any) => d.challanNumber === `DC-03-${TEST_PREFIX}`);
      expect(dc3Data).toBeDefined();
      expect(dc3Data.status).toBe(DeliveryChallanStatus.DISPATCHED);
      expect(dc3Data.isOverdue).toBe(true);
      expect(dc3Data.isSlaBreached).toBe(true);
      expect(dc3Data.items[0].quantityDispatched).toBe(15);
      expect(dc3Data.items[0].quantityReturned).toBe(0);
      expect(dc3Data.items[0].balanceInCustody).toBe(15);
    });

    it('E2E-VT-010: should aggregate items residing outside in vendor custody', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${testVendorId}/traceability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { itemsInCustody } = res.body;

      expect(Array.isArray(itemsInCustody)).toBe(true);
      // Product A balance: 20 (from DC2), Product B balance: 15 (from DC3)
      expect(itemsInCustody.length).toBe(2);

      const itemA = itemsInCustody.find((i: any) => i.productId === productAId);
      expect(itemA).toBeDefined();
      expect(itemA.totalDispatched).toBe(80); // 50 + 30
      expect(itemA.totalReturned).toBe(60);   // 50 + 10
      expect(itemA.balanceInCustody).toBe(20);

      const itemB = itemsInCustody.find((i: any) => i.productId === productBId);
      expect(itemB).toBeDefined();
      expect(itemB.totalDispatched).toBe(15);
      expect(itemB.totalReturned).toBe(0);
      expect(itemB.balanceInCustody).toBe(15);
    });

    it('E2E-VT-011: should summarize associated processes executed by the vendor', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${testVendorId}/traceability`)
        .set('Authorization', `Bearer ${seniorManagerToken}`);

      expect(res.status).toBe(200);
      const { associatedProcesses } = res.body;

      expect(Array.isArray(associatedProcesses)).toBe(true);
      const proc = associatedProcesses.find((p: any) => p.processId === testProcessId);
      expect(proc).toBeDefined();
      expect(proc.processCode).toBe(testProcessCode);
      expect(proc.processName).toBe(testProcessName);
      expect(proc.totalDcCount).toBe(3);
      expect(proc.openDcCount).toBe(2);
      expect(proc.totalDispatchedQty).toBe(95);
      expect(proc.totalReturnedQty).toBe(60);
      expect(proc.balanceInCustody).toBe(35);
    });

    it('E2E-VT-012: should gracefully handle vendor with 0 delivery challans', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/vendors/${emptyVendorId}/traceability`)
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      expect(data.summary.totalDcCount).toBe(0);
      expect(data.summary.openDcCount).toBe(0);
      expect(data.summary.closedDcCount).toBe(0);
      expect(data.summary.overdueDcCount).toBe(0);
      expect(data.summary.totalDispatchedQty).toBe(0);
      expect(data.summary.totalReturnedQty).toBe(0);
      expect(data.summary.netBalanceInCustody).toBe(0);
      expect(data.summary.averageTurnaroundDays).toBe(0);
      expect(data.summary.slaComplianceRate).toBe(100);
      expect(data.challanBreakdown).toEqual([]);
      expect(data.itemsInCustody).toEqual([]);
      expect(data.associatedProcesses).toEqual([]);
    });
  });

  // =========================================================================
  // 3. GLOBAL VENDOR PERFORMANCE ANALYTICS & AGEING DISTRIBUTION
  // =========================================================================
  describe('Global Vendor Performance Analytics API', () => {
    it('E2E-VT-013: should compute global metrics, DC ageing buckets, and vendor rankings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/vendors/performance-analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // Summary
      expect(data.summary).toBeDefined();
      expect(data.summary.totalVendors).toBeGreaterThanOrEqual(2);
      expect(data.summary.activeVendors).toBeGreaterThanOrEqual(2);
      expect(data.summary.totalDcs).toBeGreaterThanOrEqual(3);
      expect(data.summary.openDcs).toBeGreaterThanOrEqual(2);
      expect(data.summary.closedDcs).toBeGreaterThanOrEqual(1);
      expect(data.summary.overdueDcs).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalCustodyQty).toBeGreaterThanOrEqual(35);
      expect(typeof data.summary.overallSlaComplianceRate).toBe('number');
      expect(typeof data.summary.avgTurnaroundDays).toBe('number');

      // Ageing Distribution Buckets
      expect(data.ageingDistribution).toBeDefined();
      expect(data.ageingDistribution.lessThan7Days).toBeDefined();
      expect(data.ageingDistribution.sevenTo14Days).toBeDefined();
      expect(data.ageingDistribution.fifteenTo30Days).toBeDefined();
      expect(data.ageingDistribution.moreThan30Days).toBeDefined();

      const totalBucketedDcs =
        data.ageingDistribution.lessThan7Days.count +
        data.ageingDistribution.sevenTo14Days.count +
        data.ageingDistribution.fifteenTo30Days.count +
        data.ageingDistribution.moreThan30Days.count;

      expect(totalBucketedDcs).toBe(data.summary.openDcs);

      // Vendor Rankings
      expect(Array.isArray(data.vendorRankings)).toBe(true);
      const ranking = data.vendorRankings.find((v: any) => v.vendorId === testVendorId);
      expect(ranking).toBeDefined();
      expect(ranking.vendorCode).toBe(testVendorCode);
      expect(ranking.vendorName).toBe(testVendorName);
      expect(ranking.totalDcs).toBe(3);
      expect(ranking.openDcs).toBe(2);
      expect(ranking.closedDcs).toBe(1);
      expect(ranking.overdueDcs).toBe(1);
      expect(ranking.slaComplianceRate).toBe(50);
      expect(ranking.avgTurnaroundDays).toBe(4);
      expect(ranking.activeItemsInCustody).toBe(35);
    });
  });
});
