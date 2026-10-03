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
import { MaterialReceipt, ReceiptStatus } from '../src/production/entities/production-receipt.entity.js';
import { MaterialReceiptItem } from '../src/production/entities/material-receipt-item.entity.js';
import { MaterialConsumption } from '../src/production/entities/material-consumption.entity.js';
import { MaterialReturn, ReturnStatus } from '../src/production/entities/material-return.entity.js';
import { MaterialReturnItem } from '../src/production/entities/material-return-item.entity.js';
import {
  AdditionalMaterialRequest,
  AdditionalRequestStatus,
  AdditionalReason,
} from '../src/additional-request/entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from '../src/additional-request/entities/additional-request-item.entity.js';
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
import { v4 as uuidv4 } from 'uuid';

describe('Phase 20.3 — Consolidated SC Traceability API (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const TEST_PREFIX = `p20_3_${Date.now()}`;

  let storesToken: string;
  let productionToken: string;
  let adminToken: string;
  let seniorManagerToken: string;
  let designerToken: string;

  let testUserId: string;

  // Master SC IDs
  let richScId: string;
  let sparseScId: string;

  // Expected metadata references
  let expectedCustomerCode: string;
  let expectedPoNumber: string;
  let expectedScNumber: string;
  let expectedVendorName: string;
  let expectedProcessName: string;

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
      name: `Engineer ${TEST_PREFIX}`,
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
    const receiptRepo = dataSource.getRepository(MaterialReceipt);
    const receiptItemRepo = dataSource.getRepository(MaterialReceiptItem);
    const consumptionRepo = dataSource.getRepository(MaterialConsumption);
    const returnRepo = dataSource.getRepository(MaterialReturn);
    const returnItemRepo = dataSource.getRepository(MaterialReturnItem);
    const addlRepo = dataSource.getRepository(AdditionalMaterialRequest);
    const addlItemRepo = dataSource.getRepository(AdditionalMaterialRequestItem);
    const stockTxRepo = dataSource.getRepository(StockTransaction);
    const processRepo = dataSource.getRepository(ProductionProcess);
    const vendorRepo = dataSource.getRepository(Vendor);
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    const dcItemRepo = dataSource.getRepository(DeliveryChallanItem);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);

    // Customer & PO
    expectedCustomerCode = `CUST-${TEST_PREFIX}`;
    const cust = await custRepo.save({
      code: expectedCustomerCode,
      name: `Consolidated Aerospace ${TEST_PREFIX}`,
      email: `aerospace_${TEST_PREFIX}@test.com`,
      phone: '+1 555-0199',
    });

    expectedPoNumber = `PO-${TEST_PREFIX}`;
    const po = await poRepo.save({
      poNumber: expectedPoNumber,
      customerId: cust.id,
      externalReference: `EXT-PO-${TEST_PREFIX}`,
      referenceDate: new Date(),
      remarks: 'High-precision aerospace component purchase',
    });

    // -------------------------------------------------------------
    // 3. RICH SC: Full Lifecycle Node Population
    // -------------------------------------------------------------
    expectedScNumber = `SC-FULL-${TEST_PREFIX}`;
    const richSc = await scRepo.save({
      scNumber: expectedScNumber,
      poId: po.id,
      productName: 'Turbine Rotor Shaft Stage 1',
      drawingNumber: `DWG-ROTOR-${TEST_PREFIX}`,
      description: 'Forged nickel alloy turbine rotor',
      targetQuantity: 12,
      status: ScStatus.IN_PRODUCTION,
    });
    richScId = richSc.id;

    // RM Request & Items
    const rmReq = await rmReqRepo.save({
      scId: richSc.id,
      poId: po.id,
      formType: FormType.SC,
      status: RmRequestStatus.COMPLETED,
      revisionNumber: 1,
      createdById: testUserId,
      reviewedById: testUserId,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      completedAt: new Date(),
    });

    const item1 = await rmItemRepo.save({
      rmFormId: rmReq.id,
      scId: richSc.id,
      material: 'Nickel Inconel 718',
      materialType: 'FORGED_BILLET',
      grade: 'Alloy 718',
      size: '120mm Dia x 500mm',
      quantity: 150,
      weightUnit: 'KG',
      remarks: 'Primary shaft material',
    });

    // Material Issue
    const issue = await issueRepo.save({
      scId: richSc.id,
      issueNumber: `ISSUE-${TEST_PREFIX}-01`,
      issueType: MaterialIssueType.INITIAL_ISSUE,
      issuedById: testUserId,
      issueDate: new Date(),
      remarks: 'Initial stores release',
    });

    await issueItemRepo.save({
      materialIssueId: issue.id,
      rmItemId: item1.id,
      quantityIssued: 140,
      remarks: 'Initial bar cut',
    });

    // Material Receipt (Inward store receipt logged against the issue)
    const receipt = await receiptRepo.save({
      materialIssueId: issue.id,
      receivedById: testUserId,
      status: ReceiptStatus.RECEIVED,
      remarks: 'Floor intake received',
    });

    await receiptItemRepo.save({
      materialReceiptId: receipt.id,
      rmItemId: item1.id,
      quantityReceived: 140,
      remarks: 'Full intake checked',
    });

    // Material Consumption
    await consumptionRepo.save({
      scId: richSc.id,
      rmItemId: item1.id,
      consumedQuantity: 120,
      unit: 'KG',
      recordedById: testUserId,
      remarks: 'Machined into rotor core',
    });

    // Material Return
    const ret = await returnRepo.save({
      scId: richSc.id,
      status: ReturnStatus.ACKNOWLEDGED,
      returnedById: testUserId,
      confirmedById: testUserId,
      confirmedAt: new Date(),
      remarks: 'Offcut usable remnant returned to store',
    });

    await returnItemRepo.save({
      materialReturnId: ret.id,
      rmItemId: item1.id,
      quantityReturned: 15,
      remarks: '15 kg end billet',
    });

    // Additional Material Request
    const addlReq = await addlRepo.save({
      scId: richSc.id,
      status: AdditionalRequestStatus.APPROVED,
      reason: AdditionalReason.ADDITIONAL_REQUIREMENT,
      requestedById: testUserId,
      approvedById: testUserId,
      approvedAt: new Date(),
      remarks: 'Extra material approved for balancing ring',
    });

    await addlItemRepo.save({
      requestId: addlReq.id,
      rmItemId: item1.id,
      quantityRequested: 10,
      quantityApproved: 10,
      remarks: 'Approved by senior manager',
    });

    // Product & Bin for DC and stock transactions
    let prd = await productRepo.findOne({ where: {} });
    let b = await binRepo.findOne({ where: {} });

    // Immutable Stock Transaction tied to this SC
    await stockTxRepo.save({
      productId: prd?.id,
      sourceBinId: b?.id,
      transactionType: TransactionType.STOCK_OUT,
      quantity: 140,
      referenceType: 'SC',
      referenceId: richSc.id,
      remarks: 'Consolidated stock transaction trace',
      createdById: testUserId,
    });

    // Production Process & Vendor for Delivery Challan
    expectedProcessName = `CNC Turning ${TEST_PREFIX}`;
    const maxProcess = await processRepo
      .createQueryBuilder('p')
      .select('MAX(p.sequenceNumber)', 'max')
      .getRawOne();
    const nextSeq = (Number(maxProcess?.max) || 0) + 1;

    const process = await processRepo.save({
      name: expectedProcessName,
      code: `CNC-${TEST_PREFIX.substring(7, 15)}`,
      sequenceNumber: nextSeq,
      allowsOutsideVendor: true,
      isActive: true,
    });

    expectedVendorName = `Precision Heat Treatment Ltd ${TEST_PREFIX}`;
    const vendor = await vendorRepo.save({
      name: expectedVendorName,
      code: `VEND-${TEST_PREFIX.substring(7, 15)}`,
      contactPerson: 'Robert Smith',
      email: `vendor_${TEST_PREFIX}@precision.com`,
      phone: '+1 555-0245',
      isActive: true,
    });

    // Delivery Challan (Type 1 Outward)
    const dc = await dcRepo.save({
      challanNumber: `DC-${TEST_PREFIX}-01`,
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: vendor.id,
      scId: richSc.id,
      processId: process.id,
      dispatchDate: new Date(),
      status: DeliveryChallanStatus.DISPATCHED,
      notes: 'Outsourced specialized job work',
      createdById: testUserId,
    });

    if (prd && b) {
      await dcItemRepo.save({
        challanId: dc.id,
        productId: prd.id,
        binId: b.id,
        quantityDispatched: 5,
        quantityReturned: 2,
      });
    }

    // -------------------------------------------------------------
    // 4. SPARSE SC: Minimal Node Setup (Edge Case Validation)
    // -------------------------------------------------------------
    const sparseSc = await scRepo.save({
      scNumber: `SC-SPARSE-${TEST_PREFIX}`,
      poId: po.id,
      productName: 'Raw Shell Draft',
      targetQuantity: 1,
      status: ScStatus.DRAFT,
    });
    sparseScId = sparseSc.id;
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
    it('E2E-SCT-001: Should reject unauthenticated request with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/sc/${richScId}/consolidated`)
        .expect(401);
    });

    it('E2E-SCT-002: Should reject unauthorized role (DESIGNER) with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/sc/${richScId}/consolidated`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(403);
    });

    it('E2E-SCT-003: Should allow authorized operational roles (STORES, PRODUCTION, SENIOR_MANAGER, ADMIN)', async () => {
      for (const token of [storesToken, productionToken, seniorManagerToken, adminToken]) {
        const res = await request(app.getHttpServer())
          .get(`/api/traceability/sc/${richScId}/consolidated`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body.sc.id).toBe(richScId);
      }
    });

    it('E2E-SCT-004: Should reject invalid UUID with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/traceability/sc/not-a-valid-uuid/consolidated')
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(400);
    });

    it('E2E-SCT-005: Should return 404 Not Found for non-existent SC', async () => {
      await request(app.getHttpServer())
        .get(`/api/traceability/sc/${uuidv4()}/consolidated`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // 2. CONSOLIDATED TRACEABILITY TREE VERIFICATION
  // =========================================================================
  describe('2. Consolidated SC Traceability Tree Architecture', () => {
    it('E2E-SCT-006: Should return the complete 360-degree traceability tree with all nodes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/sc/${richScId}/consolidated`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(200);

      const tree = res.body;

      // 1. SC Metadata
      expect(tree.sc).toBeDefined();
      expect(tree.sc.id).toBe(richScId);
      expect(tree.sc.scNumber).toBe(expectedScNumber);
      expect(tree.sc.productName).toBe('Turbine Rotor Shaft Stage 1');
      expect(tree.sc.targetQuantity).toBe(12);
      expect(tree.sc.status).toBe(ScStatus.IN_PRODUCTION);

      // 2. Parent PO & Customer
      expect(tree.po).toBeDefined();
      expect(tree.po.poNumber).toBe(expectedPoNumber);
      expect(tree.po.customer).toBeDefined();
      expect(tree.po.customer.code).toBe(expectedCustomerCode);
      expect(tree.po.customer.name).toContain('Consolidated Aerospace');

      // 3. RM Requests & Items
      expect(tree.rmRequests).toBeInstanceOf(Array);
      expect(tree.rmRequests.length).toBeGreaterThanOrEqual(1);
      const rmItem = tree.rmRequests[0].items[0];
      expect(rmItem.material).toBe('Nickel Inconel 718');
      expect(rmItem.quantity).toBe(150);

      // 4. Material Issues
      expect(tree.issues).toBeInstanceOf(Array);
      expect(tree.issues.length).toBeGreaterThanOrEqual(1);
      const issue = tree.issues[0];
      expect(issue.items[0].quantityIssued).toBe(140);
      expect(issue.issuedBy).toBeDefined();

      // 5. Material Receipts (Inward intake)
      expect(tree.receipts).toBeInstanceOf(Array);
      expect(tree.receipts.length).toBeGreaterThanOrEqual(1);
      expect(tree.receipts[0].status).toBe(ReceiptStatus.RECEIVED);
      expect(tree.receipts[0].items[0].quantityReceived).toBe(140);

      // 6. Consumptions
      expect(tree.consumption).toBeInstanceOf(Array);
      expect(tree.consumption.length).toBeGreaterThanOrEqual(1);
      expect(tree.consumption[0].consumedQuantity).toBe(120);

      // 7. Returns
      expect(tree.returns).toBeInstanceOf(Array);
      expect(tree.returns.length).toBeGreaterThanOrEqual(1);
      expect(tree.returns[0].status).toBe(ReturnStatus.ACKNOWLEDGED);
      expect(tree.returns[0].items[0].quantityReturned).toBe(15);

      // 8. Additional Material
      expect(tree.additionalMaterial).toBeInstanceOf(Array);
      expect(tree.additionalMaterial.length).toBeGreaterThanOrEqual(1);
      expect(tree.additionalMaterial[0].status).toBe(AdditionalRequestStatus.APPROVED);
      expect(tree.additionalMaterial[0].items[0].requestedQuantity).toBe(10);
      expect(tree.additionalMaterial[0].items[0].approvedQuantity).toBe(10);

      // 9. Stock Transactions
      expect(tree.inventoryTransactions).toBeInstanceOf(Array);
      expect(tree.inventoryTransactions.length).toBeGreaterThanOrEqual(1);
      const tx = tree.inventoryTransactions.find((t: any) => t.referenceId === richScId);
      expect(tx).toBeDefined();
      expect(tx.quantity).toBe(140);
      expect(tx.transactionType).toBe(TransactionType.STOCK_OUT);

      // 10. Production Processes
      expect(tree.productionProcesses).toBeInstanceOf(Array);
      expect(tree.productionProcesses.length).toBeGreaterThanOrEqual(1);
      const procStep = tree.productionProcesses.find((p: any) => p.name === expectedProcessName);
      expect(procStep).toBeDefined();
      expect(procStep.status).toBe('DISPATCHED');
      expect(procStep.deliveryChallanCount).toBe(1);
      expect(procStep.vendorNames).toContain(expectedVendorName);

      // 11. Delivery Challans
      expect(tree.deliveryChallans).toBeInstanceOf(Array);
      expect(tree.deliveryChallans.length).toBeGreaterThanOrEqual(1);
      const dc = tree.deliveryChallans[0];
      expect(dc.challanNumber).toContain('DC-');
      expect(dc.vendor.name).toBe(expectedVendorName);
      expect(dc.process.name).toBe(expectedProcessName);
      expect(dc.items[0].quantityDispatched).toBe(5);
      expect(dc.items[0].quantityReturned).toBe(2);
      expect(dc.items[0].balanceQuantity).toBe(3);

      // 12. Participating Vendors
      expect(tree.vendors).toBeInstanceOf(Array);
      expect(tree.vendors.length).toBeGreaterThanOrEqual(1);
      const vendorSummary = tree.vendors.find((v: any) => v.name === expectedVendorName);
      expect(vendorSummary).toBeDefined();
      expect(vendorSummary.totalChallans).toBe(1);
      expect(vendorSummary.activeChallans).toBe(1);

      // 13. Authoritative Final RM Usage
      expect(tree.finalRmUsage).toBeDefined();
      expect(tree.finalRmUsage.summary).toBeDefined();
      expect(tree.finalRmUsage.summary.originalRm).toBe(150);
      expect(tree.finalRmUsage.summary.initialIssued).toBe(140);
      expect(tree.finalRmUsage.summary.totalConsumed).toBe(120);
      expect(tree.finalRmUsage.summary.totalReturned).toBe(15);
      // Variance: 140 - 120 - 15 = 5 kg
      expect(tree.finalRmUsage.summary.variance).toBe(5);

      expect(tree.generatedAt).toBeDefined();
    });

    it('E2E-SCT-007: Should handle sparse/draft SC with zero movements gracefully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/traceability/sc/${sparseScId}/consolidated`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tree = res.body;

      expect(tree.sc.id).toBe(sparseScId);
      expect(tree.sc.status).toBe(ScStatus.DRAFT);
      expect(tree.rmRequests).toEqual([]);
      expect(tree.issues).toEqual([]);
      expect(tree.receipts).toEqual([]);
      expect(tree.consumption).toEqual([]);
      expect(tree.returns).toEqual([]);
      expect(tree.additionalMaterial).toEqual([]);
      expect(tree.inventoryTransactions).toEqual([]);
      expect(tree.deliveryChallans).toEqual([]);
      expect(tree.vendors).toEqual([]);

      expect(tree.finalRmUsage.summary.originalRm).toBe(0);
      expect(tree.finalRmUsage.summary.totalIssued).toBe(0);
      expect(tree.finalRmUsage.summary.finalRmUsed).toBe(0);
      expect(tree.finalRmUsage.summary.isZeroLossVerified).toBe(true);
    });
  });
});
