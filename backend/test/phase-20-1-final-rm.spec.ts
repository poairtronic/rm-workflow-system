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
import { GeneralIssue, GeneralIssueStatus } from '../src/general-issue/entities/general-issue.entity.js';
import { GeneralIssueItem } from '../src/general-issue/entities/general-issue-item.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 20.1 — Final RM Usage Calculation Engine (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p20_1_${Date.now()}`;

  let storesToken: string;
  let productionToken: string;
  let adminToken: string;
  let seniorManagerToken: string;
  let designerToken: string;

  let testUserId: string;

  // Master references
  let testScId: string;
  let rmItem1Id: string;
  let rmItem2Id: string;

  // Secondary SC for zero-loss verification scenario
  let balancedScId: string;
  let balancedRmItemId: string;

  // General Issue SC scenario
  let generalIssueScId: string;
  let generalIssueRmItemId: string;

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
    const generalIssueRepo = dataSource.getRepository(GeneralIssue);
    const generalIssueItemRepo = dataSource.getRepository(GeneralIssueItem);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);

    let cust = await custRepo.findOne({ where: {} });
    if (!cust) {
      cust = await custRepo.save({
        code: `CUST-${TEST_PREFIX}`,
        name: 'Traceability Test Customer',
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
    // SC 1: Rich Multi-Movement Scenario (Initial, Additional, Consumed, Returned, Pending Return, Variance)
    // -------------------------------------------------------------
    const sc1 = await scRepo.save({
      scNumber: `SC-TRACE-${TEST_PREFIX}-01`,
      poId: po.id,
      productName: 'Turbine Rotor Core',
      drawingNumber: `DWG-${TEST_PREFIX}-01`,
      targetQuantity: 10,
      status: ScStatus.IN_PRODUCTION,
    });
    testScId = sc1.id;

    const rmReq1 = await rmReqRepo.save({
      scId: sc1.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    // Item 1: Round Bar, Required: 100 kg
    const item1 = await rmItemRepo.save({
      rmFormId: rmReq1.id,
      scId: sc1.id,
      material: 'Titanium Ti-6Al-4V',
      materialType: 'ROUND_BAR',
      grade: 'Grade 5',
      size: '50mm Dia',
      quantity: 100,
      weightUnit: 'KG',
    });
    rmItem1Id = item1.id;

    // Item 2: Flat Bar, Required: 50 kg
    const item2 = await rmItemRepo.save({
      rmFormId: rmReq1.id,
      scId: sc1.id,
      material: 'Nickel Inconel 718',
      materialType: 'FLAT_BAR',
      grade: 'Alloy 718',
      size: '25x50mm',
      quantity: 50,
      weightUnit: 'KG',
    });
    rmItem2Id = item2.id;

    // Initial Material Issue:
    // Item 1: 100 kg issued
    // Item 2: 50 kg issued
    const initIssue = await issueRepo.save({
      scId: sc1.id,
      issueNumber: `ISSUE-INIT-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save([
      {
        materialIssueId: initIssue.id,
        rmItemId: item1.id,
        quantityIssued: 100,
      },
      {
        materialIssueId: initIssue.id,
        rmItemId: item2.id,
        quantityIssued: 50,
      },
    ]);

    // Additional Material Issue:
    // Item 1: 20 kg additional issued
    const addlIssue = await issueRepo.save({
      scId: sc1.id,
      issueNumber: `ISSUE-ADDL-${TEST_PREFIX}`,
      issueType: MaterialIssueType.ADDITIONAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: addlIssue.id,
      rmItemId: item1.id,
      quantityIssued: 20,
    });

    // Consumptions:
    // Item 1: 95 kg consumed
    // Item 2: 45 kg consumed
    await consumptionRepo.save([
      {
        scId: sc1.id,
        rmItemId: item1.id,
        consumedQuantity: 95,
        unit: 'KG',
        recordedById: testUserId,
      },
      {
        scId: sc1.id,
        rmItemId: item2.id,
        consumedQuantity: 45,
        unit: 'KG',
        recordedById: testUserId,
      },
    ]);

    // Material Returns (Acknowledged by Stores):
    // Item 1: 15 kg returned (usable remnant)
    // Item 2: 5 kg returned
    const ackReturn = await returnRepo.save({
      scId: sc1.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
    });

    await returnItemRepo.save([
      {
        materialReturnId: ackReturn.id,
        rmItemId: item1.id,
        quantityReturned: 15,
      },
      {
        materialReturnId: ackReturn.id,
        rmItemId: item2.id,
        quantityReturned: 5,
      },
    ]);

    // Material Returns (Pending Store ACK - not yet counted in acknowledged returns):
    // Item 1: 5 kg pending
    const pendReturn = await returnRepo.save({
      scId: sc1.id,
      status: ReturnStatus.PENDING_STORE_ACK,
      returnedById: testUserId,
    });

    await returnItemRepo.save({
      materialReturnId: pendReturn.id,
      rmItemId: item1.id,
      quantityReturned: 5,
    });

    // -------------------------------------------------------------
    // SC 2: Perfectly Balanced Zero-Loss Scenario
    // -------------------------------------------------------------
    // Original = 80, Issued = 80, Consumed = 70, Returned = 10 -> Variance = 80 - 70 - 10 = 0
    const sc2 = await scRepo.save({
      scNumber: `SC-TRACE-${TEST_PREFIX}-02`,
      poId: po.id,
      productName: 'Zero Loss Housing',
      targetQuantity: 5,
      status: ScStatus.COMPLETED,
    });
    balancedScId = sc2.id;

    const rmReq2 = await rmReqRepo.save({
      scId: sc2.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    const itemBalanced = await rmItemRepo.save({
      rmFormId: rmReq2.id,
      scId: sc2.id,
      material: 'Aluminum 6061-T6',
      materialType: 'BILLET',
      grade: 'Al 6061',
      size: '100mm Billet',
      quantity: 80,
      weightUnit: 'KG',
    });
    balancedRmItemId = itemBalanced.id;

    const issueBalanced = await issueRepo.save({
      scId: sc2.id,
      issueNumber: `ISSUE-BAL-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
    });

    await issueItemRepo.save({
      materialIssueId: issueBalanced.id,
      rmItemId: itemBalanced.id,
      quantityIssued: 80,
    });

    await consumptionRepo.save({
      scId: sc2.id,
      rmItemId: itemBalanced.id,
      consumedQuantity: 70,
      unit: 'KG',
      recordedById: testUserId,
    });

    const returnBalanced = await returnRepo.save({
      scId: sc2.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
    });

    await returnItemRepo.save({
      materialReturnId: returnBalanced.id,
      rmItemId: itemBalanced.id,
      quantityReturned: 10,
    });

    // -------------------------------------------------------------
    // SC 3: General Issue Linked Scenario
    // -------------------------------------------------------------
    const sc3 = await scRepo.save({
      scNumber: `SC-TRACE-${TEST_PREFIX}-03`,
      poId: po.id,
      productName: 'General Issue Component',
      targetQuantity: 2,
      status: ScStatus.IN_PRODUCTION,
    });
    generalIssueScId = sc3.id;

    const rmReq3 = await rmReqRepo.save({
      scId: sc3.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    const itemGI = await rmItemRepo.save({
      rmFormId: rmReq3.id,
      scId: sc3.id,
      material: 'Structural Steel',
      materialType: 'PLATE',
      grade: 'S355',
      size: '10mm Plate',
      quantity: 40,
      weightUnit: 'KG',
    });
    generalIssueRmItemId = itemGI.id;

    // Initial issue: 40 kg
    const issueGI = await issueRepo.save({
      scId: sc3.id,
      issueNumber: `ISSUE-GI-INIT-${TEST_PREFIX}`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
    });

    await issueItemRepo.save({
      materialIssueId: issueGI.id,
      rmItemId: itemGI.id,
      quantityIssued: 40,
    });

    // General Issue linked to SC: 15 kg
    let prd = await productRepo.findOne({ where: {} });
    let b = await binRepo.findOne({ where: {} });

    if (prd && b) {
      const genIssue = await generalIssueRepo.save({
        issueNumber: `GEN-ISSUE-${TEST_PREFIX}`,
        scId: sc3.id,
        poId: po.id,
        status: GeneralIssueStatus.ISSUED,
        issuedById: testUserId,
        createdById: testUserId,
      });

      await generalIssueItemRepo.save({
        generalIssueId: genIssue.id,
        productId: prd.id,
        binId: b.id,
        quantityIssued: 15,
      });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. ENDPOINT AUTHORIZATION & RBAC GUARDING
  // =========================================================================
  describe('1. Security & RBAC Enforcement', () => {
    it('E2E-RMU-001: Should reject unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/sc/${testScId}/rm-usage`)
        .expect(401);
    });

    it('E2E-RMU-002: Should reject unauthorized roles (DESIGNER) with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/sc/${testScId}/rm-usage`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(403);
    });

    it('E2E-RMU-003: Should allow authorized operational roles (STORES, PRODUCTION, SENIOR_MANAGER, ADMIN)', async () => {
      for (const token of [storesToken, productionToken, seniorManagerToken, adminToken]) {
        const res = await request(app.getHttpServer())
          .get(`/api/traceability/sc/${testScId}/rm-usage`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body).toHaveProperty('scId', testScId);
      }
    });

    it('E2E-RMU-004: Should reject invalid UUID format with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/traceability/sc/invalid-uuid-format/rm-usage')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(400);
    });

    it('E2E-RMU-005: Should return 404 Not Found when SC does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/sc/${uuidv4()}/rm-usage`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // 2. AUTHORITATIVE CALCULATION ACCURACY & FORMULA INTEGRITY
  // =========================================================================
  describe('2. Authoritative Calculation Engine Accuracy', () => {
    it('E2E-RMU-006: Should compute complete structured breakdown matching the exact business formula', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/sc/${testScId}/rm-usage`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const body = res.body;

      // Metadata check
      expect(body.scId).toBe(testScId);
      expect(body.scNumber).toContain('SC-TRACE-');
      expect(body.productName).toBe('Turbine Rotor Core');
      expect(body.targetQuantity).toBe(10);
      expect(body.status).toBe(ScStatus.IN_PRODUCTION);
      expect(body).toHaveProperty('generatedAt');

      // Top-level summary check
      const summary = body.summary;
      expect(summary).toHaveProperty('originalRm');
      expect(summary).toHaveProperty('initialIssued');
      expect(summary).toHaveProperty('additionalRm');
      expect(summary).toHaveProperty('totalIssued');
      expect(summary).toHaveProperty('totalConsumed');
      expect(summary).toHaveProperty('totalReturned');
      expect(summary).toHaveProperty('pendingReturned');
      expect(summary).toHaveProperty('finalRmUsed');
      expect(summary).toHaveProperty('variance');
      expect(summary).toHaveProperty('isZeroLossVerified');

      // Mathematical Verification:
      // Item 1: Required = 100, Initial = 100, Addl = 20, Consumed = 95, Returned = 15, Pending = 5
      // Item 2: Required = 50,  Initial = 50,  Addl = 0,  Consumed = 45, Returned = 5,  Pending = 0
      // Sums:
      // Original RM = 100 + 50 = 150
      expect(summary.originalRm).toBe(150);

      // Initial Issued = 100 + 50 = 150
      expect(summary.initialIssued).toBe(150);

      // Additional RM = 20
      expect(summary.additionalRm).toBe(20);

      // Total Issued = 150 + 20 = 170
      expect(summary.totalIssued).toBe(170);

      // Total Consumed = 95 + 45 = 140
      expect(summary.totalConsumed).toBe(140);

      // Total Returned (ACKNOWLEDGED) = 15 + 5 = 20
      expect(summary.totalReturned).toBe(20);

      // Pending Returned (PENDING_STORE_ACK) = 5
      expect(summary.pendingReturned).toBe(5);

      // Formula: Final RM Used = Original RM (150) + Additional RM (20) - Total Returned (20) = 150
      expect(summary.finalRmUsed).toBe(150);

      // Variance = Total Issued (170) - Total Consumed (140) - Total Returned (20) = 10
      // 10 kg remains on floor/in process (WIP / unaccounted)
      expect(summary.variance).toBe(10);
      expect(summary.isZeroLossVerified).toBe(false);
    });

    it('E2E-RMU-007: Should report item-level breakdowns for every RM component', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/sc/${testScId}/rm-usage`)
        .set('Authorization', `Bearer ${productionToken}`)
        .expect(200);

      const items = res.body.items;
      expect(items.length).toBe(2);

      // Verify Item 1 (Titanium Round Bar)
      const item1 = items.find((i: any) => i.rmItemId === rmItem1Id);
      expect(item1).toBeDefined();
      expect(item1.material).toBe('Titanium Ti-6Al-4V');
      expect(item1.originalRequested).toBe(100);
      expect(item1.initialIssued).toBe(100);
      expect(item1.additionalIssued).toBe(20);
      expect(item1.totalIssued).toBe(120);
      expect(item1.totalConsumed).toBe(95);
      expect(item1.totalReturned).toBe(15);
      expect(item1.pendingReturned).toBe(5);
      // Final RM Used: 100 + 20 - 15 = 105
      expect(item1.finalRmUsed).toBe(105);
      // Variance: 120 - 95 - 15 = 10
      expect(item1.variance).toBe(10);
      expect(item1.isZeroLossVerified).toBe(false);

      // Verify Item 2 (Nickel Flat Bar)
      const item2 = items.find((i: any) => i.rmItemId === rmItem2Id);
      expect(item2).toBeDefined();
      expect(item2.material).toBe('Nickel Inconel 718');
      expect(item2.originalRequested).toBe(50);
      expect(item2.initialIssued).toBe(50);
      expect(item2.additionalIssued).toBe(0);
      expect(item2.totalIssued).toBe(50);
      expect(item2.totalConsumed).toBe(45);
      expect(item2.totalReturned).toBe(5);
      // Final RM Used: 50 + 0 - 5 = 45
      expect(item2.finalRmUsed).toBe(45);
      // Variance: 50 - 45 - 5 = 0 (balanced)
      expect(item2.variance).toBe(0);
      expect(item2.isZeroLossVerified).toBe(true);
    });

    it('E2E-RMU-008: Zero-Loss verification evaluates to true when issued == consumed + returned', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/sc/${balancedScId}/rm-usage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const summary = res.body.summary;
      // Original = 80, Issued = 80, Consumed = 70, Returned = 10
      expect(summary.originalRm).toBe(80);
      expect(summary.totalIssued).toBe(80);
      expect(summary.totalConsumed).toBe(70);
      expect(summary.totalReturned).toBe(10);
      // Final RM Used = 80 + 0 - 10 = 70
      expect(summary.finalRmUsed).toBe(70);
      // Variance = 80 - 70 - 10 = 0
      expect(summary.variance).toBe(0);
      expect(summary.isZeroLossVerified).toBe(true);
    });

    it('E2E-RMU-009: Should include General Issues linked to SC in additional RM accounting', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/sc/${generalIssueScId}/rm-usage`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const summary = res.body.summary;
      // Original = 40, Initial Issue = 40, General Issue = 15 -> Additional RM >= 15
      expect(summary.originalRm).toBe(40);
      expect(summary.initialIssued).toBe(40);
      expect(summary.additionalRm).toBeGreaterThanOrEqual(15);
      expect(summary.totalIssued).toBe(summary.initialIssued + summary.additionalRm);
    });
  });
});
