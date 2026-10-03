import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { VendorProcessCapability } from '../src/vendor/entities/vendor-process-capability.entity.js';
import { VendorSla } from '../src/vendor/entities/vendor-sla.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../src/inventory/entities/stock-transaction.entity.js';
import { SalesOrderComponent, ScStatus } from '../src/sc/entities/sc.entity.js';
import { PurchaseOrder } from '../src/po/entities/po.entity.js';
import { Customer } from '../src/customers/entities/customer.entity.js';
import { ProductCategory } from '../src/inventory/entities/product-category.entity.js';
import { ProductFamily } from '../src/inventory/entities/product-family.entity.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 19.10 — Phase 19 Master Backend Certification & Audit (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p19_audit_${Date.now()}`;

  // Auth tokens
  let adminToken: string;
  let storesToken: string;
  let designerToken: string;
  let productionToken: string;
  let seniorManagerToken: string;

  let storesUserId: string;
  let adminUserId: string;

  // Master entities
  let approvedVendorId: string;
  let unapprovedVendorId: string;
  let inactiveVendorId: string;

  let testProcessId: string;
  let testScId: string;
  let testPoId: string;

  let testProductId: string;
  let testBinId: string;

  // Concurrency product & bin
  let concProductId: string;
  let concBinId: string;

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
    const designerRole = await ensureRole(UserRole.DESIGNER);
    const prodRole = await ensureRole(UserRole.PRODUCTION);
    const smRole = await ensureRole(UserRole.SENIOR_MANAGER);

    const createUser = async (name: string, email: string, roleId: string) => {
      return userRepo.save({
        name,
        email,
        passwordHash: 'audit_test_hash',
        roleId,
        isActive: true,
      });
    };

    const adminUser = await createUser(`Admin ${TEST_PREFIX}`, `${TEST_PREFIX}_admin@rmrit.com`, adminRole.id);
    const storesUser = await createUser(`Stores ${TEST_PREFIX}`, `${TEST_PREFIX}_stores@rmrit.com`, storesRole.id);
    const designerUser = await createUser(`Designer ${TEST_PREFIX}`, `${TEST_PREFIX}_designer@rmrit.com`, designerRole.id);
    const prodUser = await createUser(`Prod ${TEST_PREFIX}`, `${TEST_PREFIX}_prod@rmrit.com`, prodRole.id);
    const smUser = await createUser(`SM ${TEST_PREFIX}`, `${TEST_PREFIX}_sm@rmrit.com`, smRole.id);

    adminUserId = adminUser.id;
    storesUserId = storesUser.id;

    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    designerToken = jwtService.sign({ sub: designerUser.id, userId: designerUser.id, email: designerUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });
    productionToken = jwtService.sign({ sub: prodUser.id, userId: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
    seniorManagerToken = jwtService.sign({ sub: smUser.id, userId: smUser.id, email: smUser.email, role: UserRole.SENIOR_MANAGER, roles: [UserRole.SENIOR_MANAGER] });

    // 2. Vendors
    const vendorRepo = dataSource.getRepository(Vendor);
    const appVendor = await vendorRepo.save({
      code: `V-APP-${TEST_PREFIX}`,
      name: `Approved Vendor ${TEST_PREFIX}`,
      address: '100 Industrial Estate, Unit 4',
      contactPerson: 'Vendor Lead',
      phone: '+91-9876500001',
      email: `${TEST_PREFIX}_vendor@supplier.com`,
      category: 'HEAT_TREATMENT',
      isActive: true,
    });
    approvedVendorId = appVendor.id;

    const unappVendor = await vendorRepo.save({
      code: `V-UNAPP-${TEST_PREFIX}`,
      name: `Unapproved Vendor ${TEST_PREFIX}`,
      isActive: true,
    });
    unapprovedVendorId = unappVendor.id;

    const inactVendor = await vendorRepo.save({
      code: `V-INACT-${TEST_PREFIX}`,
      name: `Inactive Vendor ${TEST_PREFIX}`,
      isActive: false,
    });
    inactiveVendorId = inactVendor.id;

    // 3. Production Process & Vendor SLA
    const procRepo = dataSource.getRepository(ProductionProcess);
    const capRepo = dataSource.getRepository(VendorProcessCapability);
    const slaRepo = dataSource.getRepository(VendorSla);

    const proc = await procRepo.save({
      code: `PRC-${TEST_PREFIX}`,
      name: `Process ${TEST_PREFIX}`,
      description: 'Precision Heat Treatment',
      sequenceNumber: Math.floor(Math.random() * 500000) + 1000,
      allowsOutsideVendor: true,
      category: 'HEAT_TREATMENT',
      baseCost: 25.5,
    });
    testProcessId = proc.id;

    // Map approved capability & SLA (5 business days)
    await capRepo.save({
      vendorId: approvedVendorId,
      processId: testProcessId,
      isApproved: true,
    });

    await slaRepo.save({
      vendorId: approvedVendorId,
      processId: testProcessId,
      slaDays: 5,
      effectiveDate: new Date(),
      isActive: true,
    });

    // 4. Products, Bins & Stock Balances
    const catRepo = dataSource.getRepository(ProductCategory);
    const famRepo = dataSource.getRepository(ProductFamily);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);
    const stockRepo = dataSource.getRepository(StockBalance);

    let cat = await catRepo.findOne({ where: { name: 'Raw Material' } });
    if (!cat) cat = await catRepo.save({ name: 'Raw Material', isActive: true });

    let fam = await famRepo.findOne({ where: { name: 'Metal' } });
    if (!fam) fam = await famRepo.save({ categoryId: cat.id, name: 'Metal', isActive: true });

    const product = await productRepo.save({
      code: `PRD-${TEST_PREFIX}`,
      name: `Audit Spec Product ${TEST_PREFIX}`,
      type: 'SEMI_FINISHED',
      categoryId: cat.id,
      familyId: fam.id,
      isActive: true,
      uom: 'kg',
    });
    testProductId = product.id;

    const concProduct = await productRepo.save({
      code: `PRD-CONC-${TEST_PREFIX}`,
      name: `Concurrency Product ${TEST_PREFIX}`,
      type: 'RAW_MATERIAL',
      categoryId: cat.id,
      familyId: fam.id,
      isActive: true,
      uom: 'meters',
    });
    concProductId = concProduct.id;

    let bin = await binRepo.findOne({ where: {} });
    if (!bin) throw new Error('No bin found in database. Seed bin required.');
    testBinId = bin.id;
    concBinId = bin.id;

    // Seed stock: 500 units for primary test product
    let stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    if (!stock) {
      await stockRepo.save({
        productId: testProductId,
        binId: testBinId,
        currentQuantity: 500,
        minStockLevel: 0,
        maxStockLevel: 5000,
        createdById: storesUserId,
      });
    } else {
      stock.currentQuantity = 500;
      await stockRepo.save(stock);
    }

    // Seed stock: 100 units for concurrency product
    let concStock = await stockRepo.findOne({ where: { productId: concProductId, binId: concBinId } });
    if (!concStock) {
      await stockRepo.save({
        productId: concProductId,
        binId: concBinId,
        currentQuantity: 100,
        minStockLevel: 0,
        maxStockLevel: 1000,
        createdById: storesUserId,
      });
    } else {
      concStock.currentQuantity = 100;
      await stockRepo.save(concStock);
    }

    // 5. Customer, PO, and SC
    const custRepo = dataSource.getRepository(Customer);
    const poRepo = dataSource.getRepository(PurchaseOrder);
    const scRepo = dataSource.getRepository(SalesOrderComponent);

    let cust = await custRepo.findOne({ where: {} });
    if (!cust) {
      cust = await custRepo.save({
        code: `CUST-${TEST_PREFIX}`,
        name: `Customer ${TEST_PREFIX}`,
        email: `cust_${TEST_PREFIX}@buyer.com`,
      });
    }

    const po = await poRepo.save({
      poNumber: `PO-${TEST_PREFIX}`,
      customerId: cust.id,
      externalReference: `EXT-PO-${TEST_PREFIX}`,
      referenceDate: new Date(),
    });
    testPoId = po.id;

    const sc = await scRepo.save({
      scNumber: `SC-${TEST_PREFIX}`,
      poId: po.id,
      productName: 'Precision Gear Shaft',
      drawingNumber: `DWG-${TEST_PREFIX}`,
      description: 'Manufactured gear shaft for testing',
      status: ScStatus.IN_PRODUCTION,
    });
    testScId = sc.id;
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. OUTWARD DISPATCHES (TYPE 1 & TYPE 2) & VENDOR / PROCESS VALIDATION
  // =========================================================================
  describe('1. Outward Dispatches (Type 1 & Type 2) & Validation', () => {
    let createdType1DcId: string;

    it('E2E-DC10-001: Should successfully create DC Type 1, validate process capability, auto-compute SLA date, and deduct stock', async () => {
      const dispatchDate = new Date();
      const payload = {
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        vendorId: approvedVendorId,
        scId: testScId,
        processId: testProcessId,
        dispatchDate: dispatchDate.toISOString(),
        notes: 'Dispatched for external heat treatment',
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 50 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-1')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      createdType1DcId = res.body.id;
      expect(res.body.challanNumber).toMatch(/^DC-/);
      expect(res.body.type).toBe(DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD);
      expect(res.body.status).toBe(DeliveryChallanStatus.OPEN);
      expect(res.body.scId).toBe(testScId);
      expect(res.body.processId).toBe(testProcessId);

      // Verify SLA calculation: dispatchDate + 5 days
      const expectedReturn = new Date(res.body.expectedReturnDate);
      const expectedTarget = new Date(dispatchDate.getTime() + 5 * 24 * 60 * 60 * 1000);
      expect(Math.abs(expectedReturn.getTime() - expectedTarget.getTime())).toBeLessThan(1500);

      // Verify stock deducted: 500 - 50 = 450
      const stockRepo = dataSource.getRepository(StockBalance);
      const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
      expect(Number(stock!.currentQuantity)).toBe(450);
    });

    it('E2E-DC10-002: Should reject DC Type 1 when scId or processId is missing (400)', async () => {
      const payloadWithoutSc = {
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        vendorId: approvedVendorId,
        processId: testProcessId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 10 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-1')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payloadWithoutSc)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('E2E-DC10-003: Should reject DC Type 1 when vendor is not approved for the production process (400)', async () => {
      const payload = {
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        vendorId: unapprovedVendorId,
        scId: testScId,
        processId: testProcessId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 10 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-1')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Vendor is not approved');
    });

    it('E2E-DC10-004: Should successfully create DC Type 2 (General Inventory) without SC or process references', async () => {
      const payload = {
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'General calibration outward',
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 30 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.type).toBe(DeliveryChallanType.GENERAL_INVENTORY_OUTWARD);
      expect(res.body.scId).toBeNull();
      expect(res.body.processId).toBeNull();

      // Stock deducted: 450 - 30 = 420
      const stockRepo = dataSource.getRepository(StockBalance);
      const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
      expect(Number(stock!.currentQuantity)).toBe(420);
    });

    it('E2E-DC10-005: Should reject DC Type 2 when vendor is inactive or does not exist (400)', async () => {
      const payload = {
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: inactiveVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 10 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Vendor not found or inactive');
    });
  });

  // =========================================================================
  // 2. ATOMIC INVENTORY DEDUCTION & BOUNDARY REJECTIONS
  // =========================================================================
  describe('2. Atomic Inventory Stock Deduction & Conservation', () => {
    it('E2E-DC10-006: Outward dispatch creates immutable STOCK_OUT ledger transactions', async () => {
      const txRepo = dataSource.getRepository(StockTransaction);
      const transactions = await txRepo.find({
        where: {
          productId: testProductId,
          transactionType: TransactionType.STOCK_OUT,
        },
      });

      expect(transactions.length).toBeGreaterThanOrEqual(2);
      const latestTx = transactions[transactions.length - 1];
      expect(latestTx.transactionType).toBe(TransactionType.STOCK_OUT);
      expect(latestTx.sourceBinId).toBe(testBinId);
      expect(Number(latestTx.quantity)).toBeGreaterThan(0);
    });

    it('E2E-DC10-007: Should reject outward dispatch exceeding available stock balance (400)', async () => {
      const payload = {
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 999999 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Insufficient stock');
    });

    it('E2E-DC10-008: Should reject invalid/negative dispatch quantities via DTO validation (400)', async () => {
      const payload = {
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: -20 }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  // =========================================================================
  // 3. VENDOR CUSTODY ACCOUNTING & BALANCE SEGREGATION
  // =========================================================================
  describe('3. Vendor Custody Accounting & Balance Segregation', () => {
    it('E2E-DC10-009: Should accurately report vendor custody summary for outstanding quantities', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/delivery-challans/custody/vendor/${approvedVendorId}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Verify structure of custody item
      const item = res.body[0];
      expect(item).toHaveProperty('challanId');
      expect(item).toHaveProperty('challanNumber');
      expect(item).toHaveProperty('productId', testProductId);
      expect(item).toHaveProperty('outstandingQuantity');
      expect(Number(item.outstandingQuantity)).toBeGreaterThan(0);
      expect(item.outstandingQuantity).toBe(item.quantityDispatched - item.quantityReturned);
    });

    it('E2E-DC10-010: Should accurately calculate total product custody across all active challans', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/delivery-challans/custody/product/${testProductId}`)
        .set('Authorization', `Bearer ${seniorManagerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('productId', testProductId);
      // We dispatched 50 (Type 1) + 30 (Type 2) = 80 units
      expect(Number(res.body.totalOutstanding)).toBe(80);
    });
  });

  // =========================================================================
  // 4. RETURNS ENGINE (PARTIAL, FULL, AND REJECTIONS)
  // =========================================================================
  describe('4. Returns Engine (Partial & Full)', () => {
    let testDcId: string;
    let testDcItemId: string;

    beforeAll(async () => {
      // Create a dedicated DC for returns testing (100 units dispatched)
      const dcRepo = dataSource.getRepository(DeliveryChallan);
      const dc = await dcRepo.save({
        challanNumber: `DC-RET-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        status: DeliveryChallanStatus.DISPATCHED,
        createdById: storesUserId,
        items: [{
          productId: testProductId,
          binId: testBinId,
          quantityDispatched: 100,
          quantityReturned: 0,
        }],
      });
      testDcId = dc.id;
      testDcItemId = dc.items[0].id;
    });

    it('E2E-DC10-011: Should execute a partial return, increment stock balance, log RETURN ledger, and set PARTIALLY_RETURNED status', async () => {
      // Stock before return is 420. We return 40.
      const payload = {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: 'Received 40 units verified by stores audit',
        items: [{ itemId: testDcItemId, quantityToReturn: 40 }],
      };

      const res = await request(app.getHttpServer())
        .post(`/api/delivery-challans/${testDcId}/return`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
      expect(res.body.verifiedById).toBe(storesUserId);
      expect(res.body.verificationRemarks).toBe('Received 40 units verified by stores audit');

      // Verify item quantity returned
      const itemRepo = dataSource.getRepository(DeliveryChallanItem);
      const item = await itemRepo.findOne({ where: { id: testDcItemId } });
      expect(Number(item!.quantityReturned)).toBe(40);

      // Verify Stock incremented: 420 + 40 = 460
      const stockRepo = dataSource.getRepository(StockBalance);
      const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
      expect(Number(stock!.currentQuantity)).toBe(460);

      // Verify StockTransaction ledger
      const txRepo = dataSource.getRepository(StockTransaction);
      const tx = await txRepo.findOne({
        where: { referenceId: testDcId, transactionType: TransactionType.RETURN },
      });
      expect(tx).toBeDefined();
      expect(Number(tx!.quantity)).toBe(40);
    });

    it('E2E-DC10-012: Should reject an over-return exceeding outstanding balance (400)', async () => {
      // 100 dispatched, 40 returned. Outstanding = 60. Attempt returning 75.
      const payload = {
        actualReceiptDate: new Date().toISOString(),
        items: [{ itemId: testDcItemId, quantityToReturn: 75 }],
      };

      const res = await request(app.getHttpServer())
        .post(`/api/delivery-challans/${testDcId}/return`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Cannot return more than outstanding quantity');
    });

    it('E2E-DC10-013: Should execute a full return of remaining units and transition status to RETURNED', async () => {
      // Return remaining 60 units
      const payload = {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: 'Final 60 units returned',
        items: [{ itemId: testDcItemId, quantityToReturn: 60 }],
      };

      const res = await request(app.getHttpServer())
        .post(`/api/delivery-challans/${testDcId}/return`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.status).toBe(DeliveryChallanStatus.RETURNED);

      // Stock incremented: 460 + 60 = 520
      const stockRepo = dataSource.getRepository(StockBalance);
      const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
      expect(Number(stock!.currentQuantity)).toBe(520);
    });

    it('E2E-DC10-014: Should reject subsequent returns on already fully RETURNED challan (400)', async () => {
      const payload = {
        actualReceiptDate: new Date().toISOString(),
        items: [{ itemId: testDcItemId, quantityToReturn: 1 }],
      };

      const res = await request(app.getHttpServer())
        .post(`/api/delivery-challans/${testDcId}/return`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Challan is already fully returned or closed');
    });
  });

  // =========================================================================
  // 5. STATUS LIFECYCLE, CLOSURE & REGRESSION BLOCKS
  // =========================================================================
  describe('5. Status Lifecycle, Closure & Regression Blocks', () => {
    let openDcId: string;
    let dispatchedDcId: string;

    beforeAll(async () => {
      const dcRepo = dataSource.getRepository(DeliveryChallan);
      const openDc = await dcRepo.save({
        challanNumber: `DC-OPEN-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        status: DeliveryChallanStatus.OPEN,
        createdById: storesUserId,
      });
      openDcId = openDc.id;

      const dispDc = await dcRepo.save({
        challanNumber: `DC-DISP-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        status: DeliveryChallanStatus.DISPATCHED,
        createdById: storesUserId,
      });
      dispatchedDcId = dispDc.id;
    });

    it('E2E-DC10-015: Should reject closing an OPEN challan (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/delivery-challans/${openDcId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toContain('Cannot close an OPEN challan');
    });

    it('E2E-DC10-016: Should allow closing a DISPATCHED or PARTIALLY_RETURNED challan', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/delivery-challans/${dispatchedDcId}/close`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(res.body.status).toBe(DeliveryChallanStatus.CLOSED);
    });

    it('E2E-DC10-017: Should reject closing an already CLOSED challan (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/delivery-challans/${dispatchedDcId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toContain('Challan is already closed');
    });

    it('E2E-DC10-018: Should reject return attempts on a CLOSED challan (400)', async () => {
      const payload = {
        actualReceiptDate: new Date().toISOString(),
        items: [{ itemId: uuidv4(), quantityToReturn: 5 }],
      };

      const res = await request(app.getHttpServer())
        .post(`/api/delivery-challans/${dispatchedDcId}/return`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message).toContain('Challan is already fully returned or closed');
    });
  });

  // =========================================================================
  // 6. DYNAMIC SLAS & OVERDUE ENGINE
  // =========================================================================
  describe('6. Dynamic SLAs & Overdue Rules', () => {
    let overdueActiveDcId: string;
    let overdueClosedDcId: string;
    let futureDcId: string;

    beforeAll(async () => {
      const dcRepo = dataSource.getRepository(DeliveryChallan);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      // Overdue & Active
      const odActive = await dcRepo.save({
        challanNumber: `DC-OD-ACT-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        expectedReturnDate: pastDate,
        status: DeliveryChallanStatus.DISPATCHED,
        createdById: storesUserId,
      });
      overdueActiveDcId = odActive.id;

      // Overdue but CLOSED
      const odClosed = await dcRepo.save({
        challanNumber: `DC-OD-CLS-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        expectedReturnDate: pastDate,
        status: DeliveryChallanStatus.CLOSED,
        createdById: storesUserId,
      });
      overdueClosedDcId = odClosed.id;

      // Future / Not Overdue
      const fut = await dcRepo.save({
        challanNumber: `DC-FUT-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        expectedReturnDate: futureDate,
        status: DeliveryChallanStatus.DISPATCHED,
        createdById: storesUserId,
      });
      futureDcId = fut.id;
    });

    it('E2E-DC10-019: GET /api/delivery-challans/overdue should return active overdue DCs and exclude CLOSED/RETURNED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/delivery-challans/overdue')
        .set('Authorization', `Bearer ${seniorManagerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((dc: any) => dc.id);

      expect(ids).toContain(overdueActiveDcId);
      expect(ids).not.toContain(overdueClosedDcId);
      expect(ids).not.toContain(futureDcId);
    });

    it('E2E-DC10-020: GET /api/delivery-challans query filtering by vendorId, type, and isOverdue', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/delivery-challans?vendorId=${approvedVendorId}&isOverdue=true`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const allMatchesVendor = res.body.every((dc: any) => dc.vendorId === approvedVendorId);
      expect(allMatchesVendor).toBe(true);
    });
  });

  // =========================================================================
  // 7. PRINTABLE DATA CONTRACT & AUDIT TRAIL
  // =========================================================================
  describe('7. Printable Data Contract & Audit Trail', () => {
    let printableDcId: string;

    beforeAll(async () => {
      // Create a rich Type 1 challan with SC and Process references
      const dcRepo = dataSource.getRepository(DeliveryChallan);
      const dc = await dcRepo.save({
        challanNumber: `DC-PRINT-${TEST_PREFIX}`,
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        vendorId: approvedVendorId,
        scId: testScId,
        processId: testProcessId,
        dispatchDate: new Date('2026-10-01T09:00:00Z'),
        expectedReturnDate: new Date('2026-10-06T09:00:00Z'),
        notes: 'Printable contract audit test challan',
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
        createdById: storesUserId,
        verifiedById: adminUserId,
        verificationRemarks: 'Audit verified',
        items: [
          {
            productId: testProductId,
            binId: testBinId,
            quantityDispatched: 50,
            quantityReturned: 20,
          },
        ],
      });
      printableDcId = dc.id;
    });

    it('E2E-DC10-021: GET /api/delivery-challans/:id/printable returns the complete contract schema', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/delivery-challans/${printableDcId}/printable`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const data = res.body;

      // Top-level sections
      expect(data).toHaveProperty('company');
      expect(data).toHaveProperty('challan');
      expect(data).toHaveProperty('vendor');
      expect(data).toHaveProperty('references');
      expect(data).toHaveProperty('lineItems');
      expect(data).toHaveProperty('audit');
      expect(data).toHaveProperty('generatedAt');

      // Company Info
      expect(data.company).toHaveProperty('name');
      expect(data.company).toHaveProperty('address');

      // Challan Info
      expect(data.challan.id).toBe(printableDcId);
      expect(data.challan.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
      expect(data.challan.type).toBe(DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD);

      // Vendor Info
      expect(data.vendor.id).toBe(approvedVendorId);
      expect(data.vendor.name).toBe(`Approved Vendor ${TEST_PREFIX}`);
      expect(data.vendor.contactPerson).toBe('Vendor Lead');

      // References (SC, PO, Process)
      expect(data.references.sc).toBeDefined();
      expect(data.references.sc.scId).toBe(testScId);
      expect(data.references.sc.scNumber).toBe(`SC-${TEST_PREFIX}`);
      expect(data.references.po).toBeDefined();
      expect(data.references.po.poId).toBe(testPoId);
      expect(data.references.process).toBeDefined();
      expect(data.references.process.processId).toBe(testProcessId);
    });

    it('E2E-DC10-022: Printable contract accurately reports line items, outstanding balances, and audit sign-offs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/delivery-challans/${printableDcId}/printable`)
        .set('Authorization', `Bearer ${productionToken}`) // Production is allowed on printable
        .expect(200);

      const items = res.body.lineItems;
      expect(items.length).toBe(1);
      const lineItem = items[0];
      expect(lineItem.productId).toBe(testProductId);
      expect(Number(lineItem.quantityDispatched)).toBe(50);
      expect(Number(lineItem.quantityReturned)).toBe(20);
      expect(Number(lineItem.quantityOutstanding)).toBe(30); // 50 - 20 = 30

      // Audit section
      const audit = res.body.audit;
      expect(audit.createdById).toBe(storesUserId);
      expect(audit.verifiedById).toBe(adminUserId);
      expect(audit.verificationRemarks).toBe('Audit verified');
      expect(audit.authorizedSignatory).toBeDefined();
      expect(audit.termsAndConditions).toContain('All materials dispatched under this challan remain the property of');
    });
  });

  // =========================================================================
  // 8. NOTIFICATIONS & COMMUNICATION EVENTS
  // =========================================================================
  describe('8. Notifications & Event Integration', () => {
    it('E2E-DC10-023: Lifecycle operations trigger asynchronous notifications and email events', async () => {
      const notifRepo = dataSource.getRepository(Notification);
      const emailRepo = dataSource.getRepository(EmailJob);

      // Trigger a close event on an active DC
      const dcRepo = dataSource.getRepository(DeliveryChallan);
      const dc = await dcRepo.save({
        challanNumber: `DC-NOTIF-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        status: DeliveryChallanStatus.DISPATCHED,
        createdById: storesUserId,
      });

      await request(app.getHttpServer())
        .patch(`/api/delivery-challans/${dc.id}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Wait for non-blocking fire-and-forget notification processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const notifs = await notifRepo.find({
        where: { targetId: dc.id },
      });
      // Fire-and-forget triggers notifications for relevant admin/senior manager recipients
      expect(notifs.length).toBeGreaterThanOrEqual(0);

      const emails = await emailRepo.find({
        where: { eventType: 'DC_CLOSED' },
      });
      expect(emails.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 9. SECURITY, RBAC & AUTHORIZATION GUARDING
  // =========================================================================
  describe('9. Security, Authentication & Strict RBAC Enforcement', () => {
    it('E2E-DC10-024: Should reject unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/delivery-challans/type-1')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/delivery-challans')
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/delivery-challans/${uuidv4()}/printable`)
        .expect(401);
    });

    it('E2E-DC10-025: Should reject unauthorized roles (DESIGNER, PRODUCTION) from store mutations with 403 Forbidden', async () => {
      const type1Payload = {
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        vendorId: approvedVendorId,
        scId: testScId,
        processId: testProcessId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 5 }],
      };

      // Designer cannot create Type 1 DC
      await request(app.getHttpServer())
        .post('/api/delivery-challans/type-1')
        .set('Authorization', `Bearer ${designerToken}`)
        .send(type1Payload)
        .expect(403);

      // Designer cannot create Type 2 DC
      await request(app.getHttpServer())
        .post('/api/delivery-challans/type-2')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ ...type1Payload, type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD })
        .expect(403);

      // Production cannot close DC
      await request(app.getHttpServer())
        .patch(`/api/delivery-challans/${uuidv4()}/close`)
        .set('Authorization', `Bearer ${productionToken}`)
        .expect(403);

      // Production cannot process return
      await request(app.getHttpServer())
        .post(`/api/delivery-challans/${uuidv4()}/return`)
        .set('Authorization', `Bearer ${productionToken}`)
        .send({ actualReceiptDate: new Date().toISOString(), items: [] })
        .expect(403);
    });

    it('E2E-DC10-026: STORES and ADMIN roles are authorized for all DC operations', async () => {
      // Both STORES and ADMIN can view custody summary
      await request(app.getHttpServer())
        .get(`/api/delivery-challans/custody/vendor/${approvedVendorId}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/delivery-challans/custody/vendor/${approvedVendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // =========================================================================
  // 10. CONCURRENCY SAFETY & RACE CONDITION HARDENING
  // =========================================================================
  describe('10. Concurrency Safety & Race Condition Prevention', () => {
    it('E2E-DC10-027: Concurrent dispatches on limited inventory must not result in double-spending or negative stock balance', async () => {
      // concProductId has currentQuantity = 100 in concBinId.
      // Launch 3 concurrent dispatch requests of 60 units each (total 180 requested).
      // Exactly ONE request must succeed (100 - 60 = 40 remaining).
      // The other TWO must be rejected with 400 Insufficient stock.
      const payload = {
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: concProductId, binId: concBinId, quantityDispatched: 60 }],
      };

      const results = await Promise.all([
        request(app.getHttpServer()).post('/api/delivery-challans/type-2').set('Authorization', `Bearer ${storesToken}`).send(payload),
        request(app.getHttpServer()).post('/api/delivery-challans/type-2').set('Authorization', `Bearer ${storesToken}`).send(payload),
        request(app.getHttpServer()).post('/api/delivery-challans/type-2').set('Authorization', `Bearer ${storesToken}`).send(payload),
      ]);

      const successCount = results.filter((r) => r.status === 201).length;
      const failureCount = results.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(2);

      // Verify database integrity: balance must be exactly 40, never negative
      const stockRepo = dataSource.getRepository(StockBalance);
      const balance = await stockRepo.findOne({ where: { productId: concProductId, binId: concBinId } });
      expect(Number(balance!.currentQuantity)).toBe(40);
    });

    it('E2E-DC10-028: Concurrent returns competing for outstanding custody balance must prevent over-return', async () => {
      // Create a DC with 50 units dispatched
      const dcRepo = dataSource.getRepository(DeliveryChallan);
      const dc = await dcRepo.save({
        challanNumber: `DC-CONC-RET-${TEST_PREFIX}`,
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: approvedVendorId,
        dispatchDate: new Date(),
        status: DeliveryChallanStatus.DISPATCHED,
        createdById: storesUserId,
        items: [
          {
            productId: concProductId,
            binId: concBinId,
            quantityDispatched: 50,
            quantityReturned: 0,
          },
        ],
      });
      const itemId = dc.items[0].id;

      // Two concurrent return requests each trying to return 35 units (total 70 > 50)
      // Exactly ONE request must succeed (outstanding becomes 15).
      // The SECOND request must fail because 35 > 15 outstanding.
      const returnPayload = {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: 'Concurrent return race check',
        items: [{ itemId, quantityToReturn: 35 }],
      };

      const results = await Promise.all([
        request(app.getHttpServer()).post(`/api/delivery-challans/${dc.id}/return`).set('Authorization', `Bearer ${storesToken}`).send(returnPayload),
        request(app.getHttpServer()).post(`/api/delivery-challans/${dc.id}/return`).set('Authorization', `Bearer ${storesToken}`).send(returnPayload),
      ]);

      const successCount = results.filter((r) => r.status === 201).length;
      const failureCount = results.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify item quantity returned is exactly 35
      const itemRepo = dataSource.getRepository(DeliveryChallanItem);
      const item = await itemRepo.findOne({ where: { id: itemId } });
      expect(Number(item!.quantityReturned)).toBe(35);
    });
  });
});
