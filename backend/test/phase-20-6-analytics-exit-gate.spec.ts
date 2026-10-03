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
import { MaterialConsumption } from '../src/production/entities/material-consumption.entity.js';
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import {
  DeliveryChallan,
  DeliveryChallanType,
  DeliveryChallanStatus,
} from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 20.6 — Enterprise Analytics & Exit Gate Certification (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p20_6_${Date.now()}`;

  let storesToken: string;
  let productionToken: string;
  let adminToken: string;
  let seniorManagerToken: string;
  let designerToken: string;

  let testUserId: string;

  // Master References
  let testProcessId: string;
  let testProcessCode: string;
  let testProcessName: string;
  let testVendorId: string;
  let testVendorName: string;
  let testScId: string;
  let productAId: string;
  let productBId: string;
  let productAName: string;
  let productBName: string;
  let testMaterialName: string;
  let testGrade: string;

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
      name: `Analyst ${TEST_PREFIX}`,
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
    const rmReqRepo = dataSource.getRepository(RmRequest);
    const rmItemRepo = dataSource.getRepository(RmItem);
    const consumptionRepo = dataSource.getRepository(MaterialConsumption);
    const processRepo = dataSource.getRepository(ProductionProcess);
    const vendorRepo = dataSource.getRepository(Vendor);
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    const dcItemRepo = dataSource.getRepository(DeliveryChallanItem);
    const productRepo = dataSource.getRepository(Product);
    const stockBalanceRepo = dataSource.getRepository(StockBalance);
    const binRepo = dataSource.getRepository(Bin);

    // Customer & PO
    const customer = await customerRepo.save({
      name: `Global Aero ${TEST_PREFIX}`,
      code: `CUST-${uuidv4().substring(0, 8)}`,
      email: `${TEST_PREFIX}@aero.com`,
    });

    const po = await poRepo.save({
      poNumber: `PO-ANL-${TEST_PREFIX}`,
      orderDate: new Date(),
      status: 'ACTIVE',
      customerId: customer.id,
      createdById: testUserId,
    });

    // SC
    const sc = await scRepo.save({
      scNumber: `SC-ANL-${TEST_PREFIX}`,
      poId: po.id,
      productName: 'Aero Rotor Disc',
      drawingNumber: `DWG-ANL-${TEST_PREFIX}`,
      targetQuantity: 15,
      status: ScStatus.IN_PRODUCTION,
    });
    testScId = sc.id;

    // RM Request & Items
    const rmReq = await rmReqRepo.save({
      scId: sc.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      createdById: testUserId,
    });

    testMaterialName = `Inconel-718-${uuidv4().substring(0, 6)}`;
    testGrade = 'AMS-5662';
    const rmItem = await rmItemRepo.save({
      rmFormId: rmReq.id,
      scId: sc.id,
      material: testMaterialName,
      materialType: 'FORGED_BILLET',
      grade: testGrade,
      size: '120mm',
      quantity: 100,
      weightUnit: 'KG',
    });

    // Material Consumption (75 KG consumed)
    await consumptionRepo.save({
      scId: sc.id,
      rmItemId: rmItem.id,
      consumedQuantity: 75,
      unit: 'KG',
      recordedById: testUserId,
      remarks: 'Rough turning and milling consumption',
    });

    // Production Process
    const maxSeqResult = await dataSource.query(
      'SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM production_processes',
    );
    const nextSeq = Number(maxSeqResult[0]?.max_seq || 0) + 1;

    testProcessCode = `PROC-${uuidv4().substring(0, 8)}`;
    testProcessName = `Vacuum Brazing ${TEST_PREFIX}`;
    const process = await processRepo.save({
      name: testProcessName,
      code: testProcessCode,
      sequenceNumber: nextSeq,
      allowsOutsideVendor: true,
      isActive: true,
    });
    testProcessId = process.id;

    // Vendor
    testVendorName = `Specialized Heat Tech ${TEST_PREFIX}`;
    const vendor = await vendorRepo.save({
      name: testVendorName,
      code: `V-BRAZE-${uuidv4().substring(0, 8)}`,
      category: 'BRAZING',
      contactPerson: 'David Ross',
      isActive: true,
    });
    testVendorId = vendor.id;

    // Products & Stock Balances for MSL and Outward Tracking
    let bin = await binRepo.findOne({ where: {} });
    if (!bin) {
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

    let fam = await dataSource.getRepository('ProductFamily').findOne({ where: {} });
    if (!fam) {
      let cat = await dataSource.getRepository('ProductCategory').findOne({ where: {} });
      if (!cat) {
        cat = await dataSource.getRepository('ProductCategory').save({
          code: `CAT-${uuidv4().substring(0, 8)}`,
          name: 'Precision Parts',
        });
      }
      fam = await dataSource.getRepository('ProductFamily').save({
        categoryId: cat.id,
        name: `Fam-${uuidv4().substring(0, 8)}`,
      });
    }

    productAName = `Aero Seal Ring ${TEST_PREFIX}`;
    const prdA = await productRepo.save({
      name: productAName,
      familyId: fam.id,
      minimumInventory: 50,
      maximumInventory: 200,
      isActive: true,
    });
    productAId = prdA.id;

    // PrdA has 10 units stock -> BELOW_MSL / CRITICAL (10 <= 50 * 0.5)
    await stockBalanceRepo.save({
      productId: prdA.id,
      binId: bin.id,
      currentQuantity: 10,
    });

    productBName = `Titanium Fastener ${TEST_PREFIX}`;
    const prdB = await productRepo.save({
      name: productBName,
      familyId: fam.id,
      minimumInventory: 100,
      maximumInventory: 500,
      isActive: true,
    });
    productBId = prdB.id;

    // PrdB has 0 units stock -> OUT_OF_STOCK
    await stockBalanceRepo.save({
      productId: prdB.id,
      binId: bin.id,
      currentQuantity: 0,
    });

    // Delivery Challan for Outward Tracking
    // Dispatched 40 units of product A, 15 returned -> Balance in custody: 25
    const dc = await dcRepo.save({
      challanNumber: `DC-ANL-${TEST_PREFIX}`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: vendor.id,
      scId: sc.id,
      processId: process.id,
      dispatchDate: new Date(),
      expectedReturnDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: testUserId,
    });

    await dcItemRepo.save({
      challanId: dc.id,
      productId: prdA.id,
      binId: bin.id,
      quantityDispatched: 40,
      quantityReturned: 15, // Balance: 25
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // =========================================================================
  // 1. RBAC & SECURITY VERIFICATION ACROSS ALL REPORTING ENDPOINTS
  // =========================================================================
  describe('RBAC & Security Validation across Analytics Endpoints', () => {
    it('E2E-ANL-001: should reject unauthenticated requests on all analytics endpoints with 401 Unauthorized', async () => {
      const endpoints = [
        '/api/traceability/analytics/process-outward',
        '/api/traceability/analytics/item-outward',
        '/api/traceability/analytics/rm-consumption',
        '/api/traceability/analytics/inventory-msl-status',
      ];

      for (const ep of endpoints) {
        const res = await request(app.getHttpServer()).get(ep);
        expect(res.status).toBe(401);
      }
    });

    it('E2E-ANL-002: should reject unauthorized role (DESIGNER) with 403 Forbidden', async () => {
      const endpoints = [
        '/api/traceability/analytics/process-outward',
        '/api/traceability/analytics/item-outward',
        '/api/traceability/analytics/rm-consumption',
        '/api/traceability/analytics/inventory-msl-status',
      ];

      for (const ep of endpoints) {
        const res = await request(app.getHttpServer())
          .get(ep)
          .set('Authorization', `Bearer ${designerToken}`);
        expect(res.status).toBe(403);
      }
    });

    it('E2E-ANL-003: should allow authorized operational roles (STORES, PRODUCTION, SENIOR_MANAGER, ADMIN)', async () => {
      const tokens = [storesToken, productionToken, seniorManagerToken, adminToken];
      for (const token of tokens) {
        const res = await request(app.getHttpServer())
          .get('/api/traceability/analytics/process-outward')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });
  });

  // =========================================================================
  // 2. PROCESS-WISE OUTWARD SUMMARY ANALYTICS
  // =========================================================================
  describe('Process-wise Outward Tracking API', () => {
    it('E2E-ANL-004: should aggregate challans, quantities, and vendor movements by production process', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/analytics/process-outward')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // Summary
      expect(data.summary).toBeDefined();
      expect(data.summary.totalProcesses).toBeGreaterThanOrEqual(1);
      expect(data.summary.activeProcesses).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalDcs).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalCustodyQty).toBeGreaterThanOrEqual(25);

      // Processes array
      expect(Array.isArray(data.processes)).toBe(true);
      const procItem = data.processes.find((p: any) => p.processId === testProcessId);
      expect(procItem).toBeDefined();
      expect(procItem.processCode).toBe(testProcessCode);
      expect(procItem.processName).toBe(testProcessName);
      expect(procItem.totalDcCount).toBeGreaterThanOrEqual(1);
      expect(procItem.openDcCount).toBeGreaterThanOrEqual(1);
      expect(procItem.totalDispatchedQty).toBe(40);
      expect(procItem.totalReturnedQty).toBe(15);
      expect(procItem.balanceInCustody).toBe(25);
      expect(procItem.activeVendorCount).toBe(1);
      expect(procItem.vendorNames).toContain(testVendorName);
    });
  });

  // =========================================================================
  // 3. ITEM-WISE OUTWARD SUMMARY ANALYTICS
  // =========================================================================
  describe('Item-wise Outward Tracking API', () => {
    it('E2E-ANL-005: should aggregate external material dispatches, returns, and custody balances per product', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/analytics/item-outward')
        .set('Authorization', `Bearer ${productionToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // Summary
      expect(data.summary).toBeDefined();
      expect(data.summary.totalItemsDispatched).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalDispatchedQty).toBeGreaterThanOrEqual(40);
      expect(data.summary.totalReturnedQty).toBeGreaterThanOrEqual(15);
      expect(data.summary.totalBalanceInCustody).toBeGreaterThanOrEqual(25);

      // Items array
      expect(Array.isArray(data.items)).toBe(true);
      const itemData = data.items.find((i: any) => i.productId === productAId);
      expect(itemData).toBeDefined();
      expect(itemData.productName).toBe(productAName);
      expect(itemData.totalDispatchedQty).toBe(40);
      expect(itemData.totalReturnedQty).toBe(15);
      expect(itemData.balanceInCustody).toBe(25);
      expect(itemData.dcCount).toBeGreaterThanOrEqual(1);
      expect(itemData.vendorCount).toBeGreaterThanOrEqual(1);
      expect(itemData.activeVendors).toContain(testVendorName);
    });
  });

  // =========================================================================
  // 4. RM CONSUMPTION METRICS ANALYTICS
  // =========================================================================
  describe('RM Consumption Analytics API', () => {
    it('E2E-ANL-006: should aggregate raw material consumption grouped by material, grade, and unit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/analytics/rm-consumption')
        .set('Authorization', `Bearer ${seniorManagerToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      expect(data.summary).toBeDefined();
      expect(data.summary.totalConsumptionsLogged).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalConsumedQty).toBeGreaterThanOrEqual(75);
      expect(data.summary.uniqueMaterialsCount).toBeGreaterThanOrEqual(1);
      expect(data.summary.uniqueScsCount).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(data.consumptions)).toBe(true);
      const group = data.consumptions.find((c: any) => c.materialName === testMaterialName);
      expect(group).toBeDefined();
      expect(group.grade).toBe(testGrade);
      expect(group.unit).toBe('KG');
      expect(group.totalConsumedQty).toBe(75);
      expect(group.consumptionCount).toBeGreaterThanOrEqual(1);
      expect(group.scCount).toBeGreaterThanOrEqual(1);
      expect(group.lastRecordedAt).toBeDefined();
    });

    it('E2E-ANL-007: should filter RM consumptions by scId query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/analytics/rm-consumption?scId=${testScId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      expect(data.summary.totalConsumptionsLogged).toBe(1);
      expect(data.summary.totalConsumedQty).toBe(75);
      expect(data.consumptions.length).toBe(1);
      expect(data.consumptions[0].materialName).toBe(testMaterialName);
    });
  });

  // =========================================================================
  // 5. INVENTORY MSL & STOCK STATUS DASHBOARD
  // =========================================================================
  describe('Inventory MSL & Stock Status Dashboard API', () => {
    it('E2E-ANL-008: should report real-time MSL alerts, critical deficiencies, and out-of-stock items', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/analytics/inventory-msl-status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // Summary
      expect(data.summary).toBeDefined();
      expect(data.summary.totalMonitoredProducts).toBeGreaterThanOrEqual(2);
      expect(data.summary.criticalStockCount).toBeGreaterThanOrEqual(1);
      expect(data.summary.outOfStockCount).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalDeficitQty).toBeGreaterThan(0);

      // Check product A (Critical / Below MSL: stock = 10, MSL = 50, deficit = 40)
      const itemA = data.items.find((i: any) => i.productId === productAId);
      expect(itemA).toBeDefined();
      expect(itemA.currentStock).toBe(10);
      expect(itemA.minimumInventory).toBe(50);
      expect(itemA.deficitQty).toBe(40);
      expect(itemA.status).toBe('CRITICAL');

      // Check product B (Out of stock: stock = 0, MSL = 100, deficit = 100)
      const itemB = data.items.find((i: any) => i.productId === productBId);
      expect(itemB).toBeDefined();
      expect(itemB.currentStock).toBe(0);
      expect(itemB.minimumInventory).toBe(100);
      expect(itemB.deficitQty).toBe(100);
      expect(itemB.status).toBe('OUT_OF_STOCK');
    });

    it('E2E-ANL-009: should filter MSL dashboard by status query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/traceability/analytics/inventory-msl-status?status=OUT_OF_STOCK')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // All returned items must have status === OUT_OF_STOCK
      for (const item of data.items) {
        expect(item.status).toBe('OUT_OF_STOCK');
      }
      expect(data.items.some((i: any) => i.productId === productBId)).toBe(true);
      expect(data.items.some((i: any) => i.productId === productAId)).toBe(false);
    });
  });
});
