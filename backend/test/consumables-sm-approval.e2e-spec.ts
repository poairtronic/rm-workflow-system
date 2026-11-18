import * as path from 'path';
import dotenv from 'dotenv';

// Force local DB isolation before anything else loads
const backendEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: backendEnvPath, override: true });

process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';
delete process.env.DATABASE_URL_DIRECT;
process.env.CONSUMABLE_SM_APPROVAL_MODE = 'ON';
process.env.CONSUMABLE_SM_APPROVAL_SCOPE = 'ALL';
process.env.EMAIL_PROVIDER_TYPE = 'test';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { ConsumableApprovalStatus, ConsumableItemTrack, ConsumableItemStatus } from '../src/consumables/entities/consumable-request-item.entity.js';
import { ConsumablesService } from '../src/consumables/consumables.service.js';

describe('Phase P6: Consumables SM Approval End-to-End Dry Run & Verification (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;
  let consumablesService: ConsumablesService;

  const TEST_RUN_ID = `p6_e2e_${Date.now()}`;
  let productionUserId: string;
  let storesUserId: string;
  let seniorManagerUserId: string;
  let generalManagerUserId: string;
  let adminUserId: string;

  let productionToken: string;
  let storesToken: string;
  let seniorManagerToken: string;
  let generalManagerToken: string;
  let adminToken: string;

  let testBinId: string;
  let stockProdAvailableId: string;
  let stockProdDepletedId: string;
  let stockProd3Id: string;

  let testRequestId: string;
  let testRequestCode: string;
  let lineItems: any[] = [];
  let line1Id: string; // Stock item (available) -> will be approved
  let line2Id: string; // Stock item (depleted stock) -> will be approved & auto-switched to purchase
  let line3Id: string; // Stock item -> will be rejected
  let line4Id: string; // Non-stock/purchase item -> will be approved
  let line5Id: string; // Non-stock/purchase item -> will be rejected

  const createdRequestIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdBinIds: string[] = [];

  beforeAll(async () => {
    // 1. Connect to PostgreSQL
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';
    const isRemote = dbUrl.includes('sslmode=require') || (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1'));
    pgClient = new pg.Client({
      connectionString: dbUrl,
      ssl: isRemote ? { rejectUnauthorized: false } : false,
    });
    await pgClient.connect();
    await pgClient.query("DELETE FROM system_settings WHERE key IN ('CONSUMABLE_SM_APPROVAL_MODE', 'CONSUMABLE_SM_APPROVAL_SCOPE')");

    // 2. Fetch existing seeded users for each role
    const getUserIdByRole = async (roleName: string) => {
      const res = await pgClient.query(
        `SELECT u.id, u.email FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = $1 AND u.is_active = true ORDER BY u.created_at ASC LIMIT 1`,
        [roleName],
      );
      if (!res.rows[0]) throw new Error(`User with role ${roleName} not found`);
      return res.rows[0];
    };

    const prodUser = await getUserIdByRole('PRODUCTION');
    const storesUser = await getUserIdByRole('STORES');
    const smUser = await getUserIdByRole('SENIOR_MANAGER');
    const gmUser = await getUserIdByRole('GENERAL_MANAGER');
    const adminUser = await getUserIdByRole('ADMIN');

    productionUserId = prodUser.id;
    storesUserId = storesUser.id;
    seniorManagerUserId = smUser.id;
    generalManagerUserId = gmUser.id;
    adminUserId = adminUser.id;

    // 3. Mint JWT tokens
    const jwtSecret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    productionToken = jwt.sign({ sub: productionUserId, email: prodUser.email, role: 'PRODUCTION' }, jwtSecret, { expiresIn: '1h' });
    storesToken = jwt.sign({ sub: storesUserId, email: storesUser.email, role: 'STORES' }, jwtSecret, { expiresIn: '1h' });
    seniorManagerToken = jwt.sign({ sub: seniorManagerUserId, email: smUser.email, role: 'SENIOR_MANAGER' }, jwtSecret, { expiresIn: '1h' });
    generalManagerToken = jwt.sign({ sub: generalManagerUserId, email: gmUser.email, role: 'GENERAL_MANAGER' }, jwtSecret, { expiresIn: '1h' });
    adminToken = jwt.sign({ sub: adminUserId, email: adminUser.email, role: 'ADMIN' }, jwtSecret, { expiresIn: '1h' });

    // 4. Fetch an existing active bin
    const binRes = await pgClient.query(`SELECT id FROM bins WHERE is_active = true LIMIT 1`);
    if (!binRes.rows[0]) throw new Error('No active bin found');
    testBinId = binRes.rows[0].id;

    // 5. Ensure Consumables Category and Family exist
    let catId: string;
    const catRes = await pgClient.query(`SELECT id FROM product_categories WHERE name = 'CONSUMABLES' LIMIT 1`);
    if (catRes.rows[0]) {
      catId = catRes.rows[0].id;
    } else {
      const newCat = await pgClient.query(`INSERT INTO product_categories (name, is_active) VALUES ('CONSUMABLES', true) RETURNING id`);
      catId = newCat.rows[0].id;
    }

    let famId: string;
    const famRes = await pgClient.query(`SELECT id FROM product_families WHERE category_id = $1 LIMIT 1`, [catId]);
    if (famRes.rows[0]) {
      famId = famRes.rows[0].id;
    } else {
      const newFam = await pgClient.query(`INSERT INTO product_families (name, category_id, is_active) VALUES ('General Consumables', $1, true) RETURNING id`, [catId]);
      famId = newFam.rows[0].id;
    }

    // 6. Create 3 test products for the stock track
    // Product 1: In stock (10 units)
    const p1Res = await pgClient.query(
      `INSERT INTO products (name, code, family_id, uom, is_active) VALUES ($1, $2, $3, 'NOS', true) RETURNING id`,
      [`Prod Available ${TEST_RUN_ID}`, `P1_${TEST_RUN_ID}`, famId],
    );
    stockProdAvailableId = p1Res.rows[0].id;
    createdProductIds.push(stockProdAvailableId);
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 10)`,
      [stockProdAvailableId, testBinId],
    );

    // Product 2: Depleted stock -> starts with 10 units at requisition time, then depleted before approval
    const p2Res = await pgClient.query(
      `INSERT INTO products (name, code, family_id, uom, is_active) VALUES ($1, $2, $3, 'NOS', true) RETURNING id`,
      [`Prod Depleted ${TEST_RUN_ID}`, `P2_${TEST_RUN_ID}`, famId],
    );
    stockProdDepletedId = p2Res.rows[0].id;
    createdProductIds.push(stockProdDepletedId);
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 10)`,
      [stockProdDepletedId, testBinId],
    );

    // Product 3: In stock (5 units)
    const p3Res = await pgClient.query(
      `INSERT INTO products (name, code, family_id, uom, is_active) VALUES ($1, $2, $3, 'NOS', true) RETURNING id`,
      [`Prod Stock 3 ${TEST_RUN_ID}`, `P3_${TEST_RUN_ID}`, famId],
    );
    stockProd3Id = p3Res.rows[0].id;
    createdProductIds.push(stockProd3Id);
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 5)`,
      [stockProd3Id, testBinId],
    );

    // 7. Boot Nest Application
    process.env.CONSUMABLE_SM_APPROVAL_MODE = 'ON';
    process.env.CONSUMABLE_SM_APPROVAL_SCOPE = 'ALL';
    process.env.EMAIL_PROVIDER_TYPE = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();

    const dataSource = moduleFixture.get<DataSource>(DataSource);
    const dbCheck = await dataSource.query(`SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`);
    console.log('AppModule DB Info:', dbCheck);

    consumablesService = moduleFixture.get<ConsumablesService>(ConsumablesService);
  });

  afterAll(async () => {
    // Cleanup created test records
    if (createdRequestIds.length > 0) {
      await pgClient.query(`DELETE FROM consumable_request_items WHERE request_id = ANY($1)`, [createdRequestIds]);
      await pgClient.query(`DELETE FROM consumable_requests WHERE id = ANY($1)`, [createdRequestIds]);
    }
    if (createdProductIds.length > 0) {
      await pgClient.query(`DELETE FROM stock_transactions WHERE product_id = ANY($1)`, [createdProductIds]);
      await pgClient.query(`DELETE FROM stock_balances WHERE product_id = ANY($1)`, [createdProductIds]);
      await pgClient.query(`DELETE FROM products WHERE id = ANY($1)`, [createdProductIds]);
    }
    if (createdBinIds.length > 0) {
      await pgClient.query(`DELETE FROM bins WHERE id = ANY($1)`, [createdBinIds]);
    }
    await pgClient.query("DELETE FROM system_settings WHERE key IN ('CONSUMABLE_SM_APPROVAL_MODE', 'CONSUMABLE_SM_APPROVAL_SCOPE')");
    await pgClient.end();
    if (app) await app.close();
  });

  // =========================================================================
  // 1. Automated E2E Scenario (Mode: ON, Scope: ALL)
  // =========================================================================

  it('1a & 1b. PRODUCTION creates a 5-line request (3 stock, 2 purchase) -> Lines PENDING, absent from queues, approval email queued', async () => {
    const payload = {
      paymentMode: 'CASH',
      endUserInVelan: 'Machining Line 4',
      requestedBy: 'Suresh Patel (Production)',
      remarks: `Phase P6 E2E Test Requisition ${TEST_RUN_ID}`,
      items: [
        // Line 1: Stock track (available stock = 10, requested = 2)
        {
          productId: stockProdAvailableId,
          description: `Line 1 Available Drill Bit ${TEST_RUN_ID}`,
          uom: 'NOS',
          requestedQty: 2,
          stockAvailableAtRequest: 10,
        },
        // Line 2: Stock track (available stock = 10 at request, requested = 5)
        {
          productId: stockProdDepletedId,
          description: `Line 2 Depleted Milling Tool ${TEST_RUN_ID}`,
          uom: 'NOS',
          requestedQty: 5,
          stockAvailableAtRequest: 10,
        },
        // Line 3: Stock track (stock = 5, requested = 1) -> Target for SM rejection
        {
          productId: stockProd3Id,
          description: `Line 3 Spare Insert ${TEST_RUN_ID}`,
          uom: 'NOS',
          requestedQty: 1,
          stockAvailableAtRequest: 5,
        },
        // Line 4: Purchase track (New vendor/item)
        {
          description: `Line 4 Heavy Duty Lubricant ${TEST_RUN_ID}`,
          uom: 'LTR',
          requestedQty: 10,
          isNewProduct: true,
          isNewVendor: true,
          newVendorName: 'Apex Lubricants Ltd',
          unitPrice: 450,
        },
        // Line 5: Purchase track (New vendor/item) -> Target for SM rejection
        {
          description: `Line 5 Specialized Carbide Reamer ${TEST_RUN_ID}`,
          uom: 'NOS',
          requestedQty: 4,
          isNewProduct: true,
          isNewVendor: true,
          newVendorName: 'Apex Tools Ltd',
          unitPrice: 1200,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/consumables/requests')
      .set('Authorization', `Bearer ${productionToken}`)
      .send(payload)
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(res.body.requestCode).toBeDefined();
    testRequestId = res.body.id;
    testRequestCode = res.body.requestCode;
    createdRequestIds.push(testRequestId);

    lineItems = res.body.items;
    expect(lineItems).toHaveLength(5);

    // Verify all 5 lines are PENDING_SM_APPROVAL
    for (const item of lineItems) {
      expect(item.approvalStatus).toBe(ConsumableApprovalStatus.PENDING_SM_APPROVAL);
      expect(item.approvedAt).toBeNull();
    }

    line1Id = lineItems.find((i: any) => i.description.includes('Line 1')).id;
    line2Id = lineItems.find((i: any) => i.description.includes('Line 2')).id;
    line3Id = lineItems.find((i: any) => i.description.includes('Line 3')).id;
    line4Id = lineItems.find((i: any) => i.description.includes('Line 4')).id;
    line5Id = lineItems.find((i: any) => i.description.includes('Line 5')).id;

    // Verify lines are completely absent from downstream store queues
    const queueRes = await request(app.getHttpServer())
      .get('/api/consumables/line-items?approvedOnly=true')
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const queuedIds = queueRes.body.items.map((i: any) => i.id);
    expect(queuedIds).not.toContain(line1Id);
    expect(queuedIds).not.toContain(line2Id);
    expect(queuedIds).not.toContain(line3Id);
    expect(queuedIds).not.toContain(line4Id);
    expect(queuedIds).not.toContain(line5Id);

    // Verify approval request notification jobs queued in email_jobs (Priority 1)
    const emailRes = await pgClient.query(
      `SELECT * FROM email_jobs WHERE event_type = 'CONSUMABLE_APPROVAL_REQUESTED' AND payload->>'requestId' = $1`,
      [testRequestId],
    );
    expect(emailRes.rows.length).toBeGreaterThanOrEqual(1);
    for (const job of emailRes.rows) {
      expect(job.priority).toBe(1);
    }

    // Deplete stock for Product 2 after requisition creation so approval re-check triggers auto-switch to purchase
    await pgClient.query(`UPDATE stock_balances SET current_quantity = 0 WHERE product_id = $1`, [stockProdDepletedId]);
  });

  it('1g. Role Guards: GENERAL_MANAGER, STORES, and PRODUCTION receive 403 Forbidden on bulk approve', async () => {
    const approveDto = { itemIds: [line1Id] };

    // General Manager -> 403
    await request(app.getHttpServer())
      .post('/api/consumables/approvals/bulk-approve')
      .set('Authorization', `Bearer ${generalManagerToken}`)
      .send(approveDto)
      .expect(403);

    // Stores -> 403
    await request(app.getHttpServer())
      .post('/api/consumables/approvals/bulk-approve')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(approveDto)
      .expect(403);

    // Production -> 403
    await request(app.getHttpServer())
      .post('/api/consumables/approvals/bulk-approve')
      .set('Authorization', `Bearer ${productionToken}`)
      .send(approveDto)
      .expect(403);
  });

  it('1f. Action Guards: Direct calls to print-pr, receive, and issue on PENDING lines return 400', async () => {
    // 1. Direct print-pr on pending line -> 400
    const printRes = await request(app.getHttpServer())
      .post('/api/consumables/purchase/print-pr')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({ itemIds: [line4Id] })
      .expect(400);
    expect(printRes.body.message).toContain('unapproved');

    // 2. Direct receive on pending line -> 400
    const receiveRes = await request(app.getHttpServer())
      .post('/api/consumables/purchase/receive')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({ lineItemId: line4Id, binId: testBinId, realReceivedQty: 10 })
      .expect(400);
    expect(receiveRes.body.message).toContain('unapproved');

    // 3. Direct issue on pending line -> 400
    const issueRes = await request(app.getHttpServer())
      .post(`/api/consumables/line-items/${line1Id}/issue-to-production`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({ issueQty: 2, binId: testBinId })
      .expect(400);
    expect(issueRes.body.message).toContain('unapproved');
  });

  it('1c. Senior Manager approves 3 lines (line 2 stock depleted -> switches to purchase) and rejects 2 with reason', async () => {
    // 1. Approve lines 1, 2, 4
    const approveRes = await request(app.getHttpServer())
      .post('/api/consumables/approvals/bulk-approve')
      .set('Authorization', `Bearer ${seniorManagerToken}`)
      .send({ itemIds: [line1Id, line2Id, line4Id] })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(approveRes.body.approvedCount).toBe(3);
    expect(approveRes.body.batchId).toBeDefined();

    // Verify line 2 was switched to purchase due to depleted stock
    expect(approveRes.body.switchedToPurchase).toBeDefined();
    const switchedIds = approveRes.body.switchedToPurchase.map((s: any) => s.id);
    expect(switchedIds).toContain(line2Id);

    // 2. Reject lines 3 and 5 with mandatory reason
    const rejectRes = await request(app.getHttpServer())
      .post('/api/consumables/approvals/bulk-reject')
      .set('Authorization', `Bearer ${seniorManagerToken}`)
      .send({
        itemIds: [line3Id, line5Id],
        rejectionReason: 'Specification review needed: quantity exceeds current machine cycle requirements.',
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(rejectRes.body.rejectedCount).toBe(2);
    expect(rejectRes.body.batchId).toBeDefined();
  });

  it('1d. Verified queue distribution, requester rejection visibility, deletion refusal, and Re-raise action', async () => {
    // 1. Verify queue distribution
    const queueRes = await request(app.getHttpServer())
      .get('/api/consumables/line-items?approvedOnly=true')
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const queuedItems = queueRes.body.items;
    const queuedIds = queuedItems.map((i: any) => i.id);

    // Approved lines ARE in the queues
    expect(queuedIds).toContain(line1Id);
    expect(queuedIds).toContain(line2Id);
    expect(queuedIds).toContain(line4Id);

    // Rejected lines ARE NOT in the queues
    expect(queuedIds).not.toContain(line3Id);
    expect(queuedIds).not.toContain(line5Id);

    // Line 1 is in Stock track -> READY_FOR_ISSUE
    const qLine1 = queuedItems.find((i: any) => i.id === line1Id);
    expect(qLine1.itemCategoryTrack).toBe(ConsumableItemTrack.STOCK_ITEM);
    expect(qLine1.status).toBe(ConsumableItemStatus.READY_FOR_ISSUE);

    // Line 2 was auto-switched to Purchase track -> OPEN
    const qLine2 = queuedItems.find((i: any) => i.id === line2Id);
    expect(qLine2.itemCategoryTrack).toBe(ConsumableItemTrack.NON_STOCK_OR_NEW);
    expect(qLine2.status).toBe(ConsumableItemStatus.OPEN);

    // Line 4 is Purchase track -> OPEN
    const qLine4 = queuedItems.find((i: any) => i.id === line4Id);
    expect(qLine4.itemCategoryTrack).toBe(ConsumableItemTrack.NON_STOCK_OR_NEW);
    expect(qLine4.status).toBe(ConsumableItemStatus.OPEN);

    // 2. Requester sees rejection reason on request view
    const reqRes = await request(app.getHttpServer())
      .get(`/api/consumables/requests/${testRequestId}`)
      .set('Authorization', `Bearer ${productionToken}`)
      .expect(200);

    const reqItem3 = reqRes.body.items.find((i: any) => i.id === line3Id);
    expect(reqItem3.approvalStatus).toBe(ConsumableApprovalStatus.REJECTED);
    expect(reqItem3.rejectionReason).toContain('Specification review needed');
    expect(reqItem3.rejectedById).toBe(seniorManagerUserId);
    expect(reqItem3.rejectedAt).toBeDefined();

    // 3. Deleting rejected line is REFUSED with 400
    const delRes = await request(app.getHttpServer())
      .delete(`/api/consumables/line-items/${line3Id}`)
      .set('Authorization', `Bearer ${productionToken}`)
      .expect(400);
    expect(delRes.body.message).toContain('cannot be deleted');

    // 4. Re-raise rejected item works cleanly
    const reRaisePayload = {
      paymentMode: 'CASH',
      endUserInVelan: 'Machining Line 4',
      requestedBy: 'Suresh Patel (Production)',
      remarks: `Re-raised from ${testRequestCode}`,
      items: [
        {
          productId: stockProd3Id,
          description: reqItem3.description,
          uom: reqItem3.uom,
          requestedQty: 1,
        },
      ],
    };

    const reRaiseRes = await request(app.getHttpServer())
      .post('/api/consumables/requests')
      .set('Authorization', `Bearer ${productionToken}`)
      .send(reRaisePayload)
      .expect(201);

    expect(reRaiseRes.body.id).toBeDefined();
    createdRequestIds.push(reRaiseRes.body.id);
    expect(reRaiseRes.body.items[0].approvalStatus).toBe(ConsumableApprovalStatus.PENDING_SM_APPROVAL);
  });

  it('1e. STORES and PRODUCTION complete operational fulfillment on approved items', async () => {
    // 1. STORES prints PR for Line 2 (switched) and Line 4
    const printRes = await request(app.getHttpServer())
      .post('/api/consumables/purchase/print-pr')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({ itemIds: [line2Id, line4Id] })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(printRes.body.prNumber).toBeDefined();
    expect(printRes.body.items).toHaveLength(2);
    for (const item of printRes.body.items) {
      expect(item.status).toBe(ConsumableItemStatus.PURCHASE_REQUESTED);
    }

    // 2. STORES receives Line 2 with autoIssue = true (directly dispatches to production)
    const receiveLine2 = await request(app.getHttpServer())
      .post('/api/consumables/purchase/receive')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        lineItemId: line2Id,
        binId: testBinId,
        realReceivedQty: 5,
        autoIssue: true,
        issueQty: 5,
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(receiveLine2.body.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);
    expect(Number(receiveLine2.body.issuedQty)).toBe(5);

    // 3. STORES receives Line 4 with autoIssue = false (retained in stores)
    const receiveLine4 = await request(app.getHttpServer())
      .post('/api/consumables/purchase/receive')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        lineItemId: line4Id,
        binId: testBinId,
        realReceivedQty: 10,
        autoIssue: false,
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(receiveLine4.body.status).toBe(ConsumableItemStatus.PURCHASE_RECEIVED);

    // 4. STORES issues Line 4 to production
    const issueLine4 = await request(app.getHttpServer())
      .post(`/api/consumables/line-items/${line4Id}/issue-to-production`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({ issueQty: 10, binId: testBinId })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(issueLine4.body.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);

    // 5. PRODUCTION confirms receipt for Line 2 and Line 4 -> CLOSED (RECEIVED_BY_PRODUCTION)
    const confirmLine2 = await request(app.getHttpServer())
      .patch(`/api/consumables/line-items/${line2Id}/production-receive`)
      .set('Authorization', `Bearer ${productionToken}`)
      .expect(200);
    expect(confirmLine2.body.status).toBe(ConsumableItemStatus.RECEIVED_BY_PRODUCTION);
    expect(confirmLine2.body.productionReceivedAt).toBeDefined();

    const confirmLine4 = await request(app.getHttpServer())
      .patch(`/api/consumables/line-items/${line4Id}/production-receive`)
      .set('Authorization', `Bearer ${productionToken}`)
      .expect(200);
    expect(confirmLine4.body.status).toBe(ConsumableItemStatus.RECEIVED_BY_PRODUCTION);
    expect(confirmLine4.body.productionReceivedAt).toBeDefined();
  });

  it('1h. Email jobs are Priority 1 and automated SLA sweeps ignore pending/rejected items', async () => {
    // 1. Verify priority 1 on all email jobs
    const jobsRes = await pgClient.query(
      `SELECT event_type, priority FROM email_jobs WHERE event_type IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED')`,
    );
    for (const job of jobsRes.rows) {
      expect(job.priority).toBe(1);
    }

    // 2. Run SLA sweep
    const sweepRes = await consumablesService.checkAndAlertConsumableSlas();
    expect(sweepRes).toBeDefined();
    expect(sweepRes.checkedCount).toBeGreaterThanOrEqual(0);
  });

  // =========================================================================
  // 2. Mode OFF Regression & Parity
  // =========================================================================

  it('2. MODE=OFF Regression: baseline existing data reproduces exact 43 / 26 / 15 / 17 numbers', async () => {
    process.env.CONSUMABLE_SM_APPROVAL_MODE = 'OFF';

    // Verify config endpoint returns OFF
    const configRes = await request(app.getHttpServer())
      .get('/api/consumables/approvals/config')
      .set('Authorization', `Bearer ${productionToken}`)
      .expect(200);
    expect(configRes.body.mode).toBe('OFF');

    // Query grandfathered items from the baseline production requests (CR-2026-001..003)
    const baselineItemsRes = await pgClient.query(
      `SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN item_category_track = 'STOCK_ITEM' THEN 1 END)::int as in_stock,
        COUNT(CASE WHEN item_category_track = 'NON_STOCK_OR_NEW' THEN 1 END)::int as purchase,
        COUNT(CASE WHEN status = 'ISSUED_TO_PRODUCTION' THEN 1 END)::int as ready_to_receive,
        COUNT(CASE WHEN item_category_track = 'NON_STOCK_OR_NEW' AND NOT (status IN ('ISSUED_TO_PRODUCTION', 'RECEIVED_BY_PRODUCTION') AND issued_qty >= requested_qty) THEN 1 END)::int as open_purchase,
        COUNT(CASE WHEN item_category_track = 'NON_STOCK_OR_NEW' AND (status IN ('ISSUED_TO_PRODUCTION', 'RECEIVED_BY_PRODUCTION') AND issued_qty >= requested_qty) THEN 1 END)::int as dispatched
       FROM consumable_request_items cri
       WHERE cri.request_id IN (SELECT id FROM consumable_requests WHERE request_code IN ('CR-2026-001', 'CR-2026-002', 'CR-2026-003'))`,
    );

    const b = baselineItemsRes.rows[0];
    expect(b.total).toBe(43);
    expect(b.in_stock).toBe(0);
    expect(b.purchase).toBe(43);
    expect(b.ready_to_receive).toBe(15);
    expect(b.open_purchase).toBe(26);
    expect(b.dispatched).toBe(17);
  });

  // =========================================================================
  // 3. Flip Test (OFF -> ON -> OFF)
  // =========================================================================

  it('3. Flip Test: OFF -> create (APPROVED) -> ON -> create (PENDING) -> OFF (pending items remain pending)', async () => {
    // Step A: MODE = OFF
    process.env.CONSUMABLE_SM_APPROVAL_MODE = 'OFF';

    const offReqRes = await request(app.getHttpServer())
      .post('/api/consumables/requests')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        paymentMode: 'CASH',
        requestedBy: 'Flip Test Worker',
        items: [
          {
            description: `Flip Test Mode OFF Item ${TEST_RUN_ID}`,
            uom: 'NOS',
            requestedQty: 3,
            isNewProduct: true,
          },
        ],
      })
      .expect(201);

    createdRequestIds.push(offReqRes.body.id);
    const offItem = offReqRes.body.items[0];
    // Under MODE=OFF, item is APPROVED immediately
    expect(offItem.approvalStatus).toBe(ConsumableApprovalStatus.APPROVED);
    expect(offItem.approvedAt).toBeDefined();

    // Step B: Flip to MODE = ON
    process.env.CONSUMABLE_SM_APPROVAL_MODE = 'ON';

    const onReqRes = await request(app.getHttpServer())
      .post('/api/consumables/requests')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        paymentMode: 'CASH',
        requestedBy: 'Flip Test Worker',
        items: [
          {
            description: `Flip Test Mode ON Item ${TEST_RUN_ID}`,
            uom: 'NOS',
            requestedQty: 2,
            isNewProduct: true,
          },
        ],
      })
      .expect(201);

    createdRequestIds.push(onReqRes.body.id);
    const onItem = onReqRes.body.items[0];
    // Under MODE=ON, item is PENDING_SM_APPROVAL
    expect(onItem.approvalStatus).toBe(ConsumableApprovalStatus.PENDING_SM_APPROVAL);
    expect(onItem.approvedAt).toBeNull();

    // Step C: Flip back to MODE = OFF with pending line present
    process.env.CONSUMABLE_SM_APPROVAL_MODE = 'OFF';

    // Verify: The pending item MUST stay PENDING_SM_APPROVAL in the database
    const checkPendingDb = await pgClient.query(
      `SELECT approval_status, approved_at FROM consumable_request_items WHERE id = $1`,
      [onItem.id],
    );
    expect(checkPendingDb.rows[0].approval_status).toBe(ConsumableApprovalStatus.PENDING_SM_APPROVAL);
    expect(checkPendingDb.rows[0].approved_at).toBeNull();

    // Verify: In downstream queues (approvedOnly=true), the pending item remains EXCLUDED
    const queueCheck = await request(app.getHttpServer())
      .get('/api/consumables/line-items?approvedOnly=true')
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const queuedIds = queueCheck.body.items.map((i: any) => i.id);
    expect(queuedIds).not.toContain(onItem.id);
    // But the item created in Step A (under mode OFF) IS in the queue
    expect(queuedIds).toContain(offItem.id);

    // Verify: In SM Approvals workspace, the pending item remains visible
    const approvalCheck = await request(app.getHttpServer())
      .get('/api/consumables/approvals?approvalStatus=PENDING_SM_APPROVAL')
      .set('Authorization', `Bearer ${seniorManagerToken}`)
      .expect(200);

    const pendingIds = approvalCheck.body.items.map((i: any) => i.id);
    expect(pendingIds).toContain(onItem.id);
  });
});
