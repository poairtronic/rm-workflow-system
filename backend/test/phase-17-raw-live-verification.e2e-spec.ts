import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';

describe('Phase 17 Raw Live Verification (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let designerToken: string;
  let storesToken: string;
  let prodToken: string;

  let designerUserId: string;
  let storesUserId: string;
  let prodUserId: string;

  let productId: string;
  let binId: string;
  let invItemId: string;

  let poId: string;
  let scId: string;
  let rmRequestId: string;
  let rmItemId: string;

  let initialIssue1Id: string;
  let initialIssue2Id: string;
  let extraReq1Id: string;
  let extraReq2Id: string;
  let extraIssueId: string;

  let receiptId: string;
  let returnId: string;

  let initialEmailJobsCount: number;
  let initialRmRequestsCount: number;
  let initialAddReqCount: number;
  let initialNotificationsCount: number;
  let initialStockBalanceQty: number;
  let initialInvBalanceQty: number;

  const uniqueStr = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const poNumber = `PO-RAW-${uniqueStr}`;
  const scNumber = `SC-RAW-${uniqueStr}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    // 1. Resolve or create test users
    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(Role);

    const designerRole = await roleRepo.findOne({ where: { name: UserRole.DESIGNER } });
    const storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    const prodRole = await roleRepo.findOne({ where: { name: UserRole.PRODUCTION } });

    const uDesigner = await userRepo.save(
      userRepo.create({
        email: `raw_des_${uniqueStr}@test.com`,
        name: `Designer Raw ${uniqueStr}`,
        passwordHash: 'dummy_hash',
        roleId: designerRole!.id,
        isActive: true,
      }),
    );
    designerUserId = uDesigner.id;
    designerToken = jwtService.sign({
      sub: uDesigner.id,
      userId: uDesigner.id,
      email: uDesigner.email,
      role: UserRole.DESIGNER,
      roles: [UserRole.DESIGNER],
    });

    const uStores = await userRepo.save(
      userRepo.create({
        email: `raw_sto_${uniqueStr}@test.com`,
        name: `Stores Raw ${uniqueStr}`,
        passwordHash: 'dummy_hash',
        roleId: storesRole!.id,
        isActive: true,
      }),
    );
    storesUserId = uStores.id;
    storesToken = jwtService.sign({
      sub: uStores.id,
      userId: uStores.id,
      email: uStores.email,
      role: UserRole.STORES,
      roles: [UserRole.STORES],
    });

    const uProd = await userRepo.save(
      userRepo.create({
        email: `raw_prd_${uniqueStr}@test.com`,
        name: `Prod Raw ${uniqueStr}`,
        passwordHash: 'dummy_hash',
        roleId: prodRole!.id,
        isActive: true,
      }),
    );
    prodUserId = uProd.id;
    prodToken = jwtService.sign({
      sub: uProd.id,
      userId: uProd.id,
      email: uProd.email,
      role: UserRole.PRODUCTION,
      roles: [UserRole.PRODUCTION],
    });

    // 2. Setup master data (Product, Bin, StockBalance, InventoryItem)
    const resProd = await dataSource.query(
      `INSERT INTO products (family_id, name, minimum_inventory, is_active)
       VALUES ((SELECT id FROM product_families LIMIT 1), 'RawProduct_${uniqueStr}', 10, true)
       RETURNING id`,
    );
    productId = resProd[0].id;

    const resBin = await dataSource.query(
      `INSERT INTO bins (rack_id, code, name, is_active)
       VALUES ((SELECT id FROM racks LIMIT 1), 'BIN-RAW-${uniqueStr}', 'Test Bin Raw', true)
       RETURNING id`,
    );
    binId = resBin[0].id;

    await dataSource.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity)
       VALUES ($1, $2, 500)`,
      [binId, productId],
    );
    initialStockBalanceQty = 500;

    const resInv = await dataSource.query(
      `INSERT INTO inventory_items (material, material_type, grade, size, unit, is_active)
       VALUES ('RawInvItem_${uniqueStr}', 'ROUND_BAR', 'EN31', '50mm', 'KG', true)
       RETURNING id`,
    );
    invItemId = resInv[0].id;

    await dataSource.query(
      `INSERT INTO stock_balances (inventory_item_id, current_quantity)
       VALUES ($1, 200)`,
      [invItemId],
    );
    initialInvBalanceQty = 200;

    await dataSource.query(
      `INSERT INTO system_settings (key, value)
       VALUES ('GLOBAL_WORKFLOW_EMAIL_ENABLED', 'false')
       ON CONFLICT (key) DO UPDATE SET value = 'false'`,
    );

    // Record baseline counts for Step 3.f and Step 4
    const countEmail = await dataSource.query(`SELECT count(*)::int as cnt FROM email_jobs`);
    initialEmailJobsCount = countEmail[0].cnt;

    const countRm = await dataSource.query(`SELECT count(*)::int as cnt FROM rm_requests`);
    initialRmRequestsCount = countRm[0].cnt;

    const countAddReq = await dataSource.query(`SELECT count(*)::int as cnt FROM additional_material_requests`);
    initialAddReqCount = countAddReq[0].cnt;

    const countNotif = await dataSource.query(`SELECT count(*)::int as cnt FROM notifications`);
    initialNotificationsCount = countNotif[0].cnt;
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  it('Execute Full Raw Live Verification for B3.2 and B3.3', async () => {
    // =========================================================================
    // SECTION 2: B3.2 LIVE SCENARIO
    // =========================================================================
    console.log('\n================================================================================');
    console.log('START SECTION 2: B3.2 LIVE SCENARIO');
    console.log('================================================================================\n');

    // 2.a Designer creates + submits draft RM for one SC, qty 100
    const draftRequestBody = {
      poNumber,
      scs: [
        {
          scNumber,
          productName: `Raw Component ${uniqueStr}`,
          items: [
            {
              productId,
              spec: 'EN31 Grade',
              quantity: 100,
            },
          ],
        },
      ],
    };
    console.log('--- STEP 2.a: POST /api/rm/draft ---');
    console.log('Request Body:\n', JSON.stringify(draftRequestBody, null, 2));

    const draftRes = await request(app.getHttpServer())
      .post('/api/rm/draft')
      .set('Authorization', `Bearer ${designerToken}`)
      .send(draftRequestBody);

    console.log('HTTP Status:', draftRes.status);
    console.log('Response Body:\n', JSON.stringify(draftRes.body, null, 2));

    poId = draftRes.body.poId;
    scId = draftRes.body.scs[0].scId;
    const dbRmInitial = await dataSource.query(`SELECT id FROM rm_requests WHERE sc_id = $1`, [scId]);
    rmRequestId = dbRmInitial[0].id;
    rmItemId = draftRes.body.scs[0].items[0].id;

    console.log('--- STEP 2.a: POST /api/rm/po/:poId/submit ---');
    console.log('Request URL: /api/rm/po/' + poId + '/submit');
    console.log('Request Body: {}');

    const submitRes = await request(app.getHttpServer())
      .post(`/api/rm/po/${poId}/submit`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({});

    console.log('HTTP Status:', submitRes.status);
    console.log('Response Body:\n', JSON.stringify(submitRes.body, null, 2));

    const dbScAfterSubmit = await dataSource.query(
      `SELECT id, sc_number, po_id, product_name, status, created_at, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('DB sales_order_components Row after Submit:\n', JSON.stringify(dbScAfterSubmit[0], null, 2));

    const dbRmAfterSubmit = await dataSource.query(
      `SELECT id, sc_id, po_id, status, created_by_id, submitted_at FROM rm_requests WHERE id = $1`,
      [rmRequestId],
    );
    console.log('DB rm_requests Row after Submit:\n', JSON.stringify(dbRmAfterSubmit[0], null, 2));

    // 2.b Stores reviews it -> expect STORES_PENDING
    console.log('\n--- STEP 2.b: POST /api/rm/:id/review ---');
    const reviewRequestBody = {
      itemMappings: [
        {
          rmItemId,
          productId,
        },
      ],
      remarks: 'Reviewed by Stores Manager',
    };
    console.log(`Request URL: /api/rm/${rmRequestId}/review`);
    console.log('Request Body:\n', JSON.stringify(reviewRequestBody, null, 2));

    const reviewRes = await request(app.getHttpServer())
      .post(`/api/rm/${rmRequestId}/review`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(reviewRequestBody);

    console.log('HTTP Status:', reviewRes.status);
    console.log('Response Body:\n', JSON.stringify(reviewRes.body, null, 2));

    const dbScAfterReview = await dataSource.query(
      `SELECT id, sc_number, status, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('DB sales_order_components Row after Review (Expect STORES_PENDING):\n', JSON.stringify(dbScAfterReview[0], null, 2));

    // 2.c Stores issues 60 units
    console.log('\n--- STEP 2.c: POST /api/material-issues (Issue 60 units) ---');
    const stockBalBefore60 = await dataSource.query(
      `SELECT product_id, bin_id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    console.log('stock_balances BEFORE issuing 60 units:\n', JSON.stringify(stockBalBefore60[0], null, 2));

    const issue60RequestBody = {
      scId,
      items: [
        {
          rmItemId,
          binId,
          quantityIssued: 60,
        },
      ],
      remarks: 'Partial batch issue 60%',
    };
    console.log('Request Body:\n', JSON.stringify(issue60RequestBody, null, 2));

    const issue60Res = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(issue60RequestBody);

    console.log('HTTP Status:', issue60Res.status);
    console.log('Response Body:\n', JSON.stringify(issue60Res.body, null, 2));
    initialIssue1Id = issue60Res.body.id;

    const dbScAfter60 = await dataSource.query(
      `SELECT id, sc_number, status, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('DB sales_order_components Row after 60 units (Expect PARTIALLY_ISSUED):\n', JSON.stringify(dbScAfter60[0], null, 2));

    const stockBalAfter60 = await dataSource.query(
      `SELECT product_id, bin_id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    console.log('stock_balances AFTER issuing 60 units:\n', JSON.stringify(stockBalAfter60[0], null, 2));

    const txRow60 = await dataSource.query(
      `SELECT id, transaction_type, product_id, source_bin_id, quantity, "referenceType", reference_id, remarks, created_at
       FROM stock_transactions WHERE "referenceType" = 'MATERIAL_ISSUE' AND reference_id = $1`,
      [initialIssue1Id],
    );
    console.log('stock_transactions Row for 60 units issue:\n', JSON.stringify(txRow60[0], null, 2));

    // 2.i PART 1: GET stores pending-grouped and production grouped after step c
    console.log('\n--- STEP 2.i (PART 1, after step c): GET Grouped Lists ---');
    const storesPendingGroupedAfterC = await request(app.getHttpServer())
      .get('/api/sc/stores/pending-grouped')
      .set('Authorization', `Bearer ${storesToken}`);
    console.log('GET /api/sc/stores/pending-grouped HTTP Status:', storesPendingGroupedAfterC.status);
    console.log('Raw JSON (Stores Pending Grouped after Step c):\n', JSON.stringify(storesPendingGroupedAfterC.body, null, 2));

    const prodGroupedAfterC = await request(app.getHttpServer())
      .get('/api/sc/production/grouped')
      .set('Authorization', `Bearer ${prodToken}`);
    console.log('GET /api/sc/production/grouped HTTP Status:', prodGroupedAfterC.status);
    console.log('Raw JSON (Production Grouped after Step c):\n', JSON.stringify(prodGroupedAfterC.body, null, 2));

    // 2.d Stores issues remaining 40 units
    console.log('\n--- STEP 2.d: POST /api/material-issues (Issue remaining 40 units) ---');
    const issue40RequestBody = {
      scId,
      items: [
        {
          rmItemId,
          binId,
          quantityIssued: 40,
        },
      ],
      remarks: 'Remaining batch issue 40%',
    };
    console.log('Request Body:\n', JSON.stringify(issue40RequestBody, null, 2));

    const issue40Res = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(issue40RequestBody);

    console.log('HTTP Status:', issue40Res.status);
    console.log('Response Body:\n', JSON.stringify(issue40Res.body, null, 2));
    initialIssue2Id = issue40Res.body.id;

    const dbScAfter40 = await dataSource.query(
      `SELECT id, sc_number, status, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('DB sales_order_components Row after remaining 40 units (Expect ISSUED):\n', JSON.stringify(dbScAfter40[0], null, 2));

    const stockBalAfter40 = await dataSource.query(
      `SELECT product_id, bin_id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    console.log('stock_balances AFTER issuing remaining 40 units:\n', JSON.stringify(stockBalAfter40[0], null, 2));

    // 2.e Stores tries to issue 1 more unit (over-issue attempt)
    console.log('\n--- STEP 2.e: Over-issue attempt (1 more unit beyond 100) ---');
    const overIssueRequestBody = {
      scId,
      items: [
        {
          rmItemId,
          binId,
          quantityIssued: 1,
        },
      ],
      remarks: 'Illegal over-issue attempt',
    };
    console.log('Request Body:\n', JSON.stringify(overIssueRequestBody, null, 2));

    const overIssueRes = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(overIssueRequestBody);

    console.log('HTTP Status (Expect 400 or 409):', overIssueRes.status);
    console.log('Response Body / Error:\n', JSON.stringify(overIssueRes.body, null, 2));

    // 2.f Production requests extra material
    console.log('\n--- STEP 2.f: POST /api/additional-requests (Request extra material) ---');
    const extraReq1Body = {
      scId,
      reason: 'WASTAGE',
      items: [
        {
          rmItemId,
          quantity: 10,
        },
      ],
      remarks: 'Machine tool vibration caused scrap',
    };
    console.log('Request Body:\n', JSON.stringify(extraReq1Body, null, 2));

    const extraReq1Res = await request(app.getHttpServer())
      .post('/api/additional-requests')
      .set('Authorization', `Bearer ${prodToken}`)
      .send(extraReq1Body);

    console.log('HTTP Status:', extraReq1Res.status);
    console.log('Response Body:\n', JSON.stringify(extraReq1Res.body, null, 2));
    extraReq1Id = extraReq1Res.body.id;

    const dbScAfterReq1 = await dataSource.query(
      `SELECT id, sc_number, status, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('DB sales_order_components Row after Extra Request (Expect ADDITIONAL_REQUEST):\n', JSON.stringify(dbScAfterReq1[0], null, 2));

    const dbAddReq1 = await dataSource.query(
      `SELECT id, sc_id, status, reason, remarks, created_at FROM additional_material_requests WHERE id = $1`,
      [extraReq1Id],
    );
    console.log('DB additional_material_requests Row:\n', JSON.stringify(dbAddReq1[0], null, 2));

    // 2.g Stores rejects it with a reason
    console.log('\n--- STEP 2.g: POST /api/additional-requests/:id/reject ---');
    const rejectBody = { rejectionReason: 'Scrap allowance already consumed for this shift' };
    console.log(`Request URL: /api/additional-requests/${extraReq1Id}/reject`);
    console.log('Request Body:\n', JSON.stringify(rejectBody, null, 2));

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/additional-requests/${extraReq1Id}/reject`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(rejectBody);

    console.log('HTTP Status:', rejectRes.status);
    console.log('Response Body:\n', JSON.stringify(rejectRes.body, null, 2));

    const dbScAfterReject = await dataSource.query(
      `SELECT id, sc_number, status, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('DB sales_order_components Row after Rejection (Expect Reverted Status):\n', JSON.stringify(dbScAfterReject[0], null, 2));

    const dbAddReq1AfterReject = await dataSource.query(
      `SELECT id, sc_id, status, reason, remarks, updated_at FROM additional_material_requests WHERE id = $1`,
      [extraReq1Id],
    );
    console.log('DB additional_material_requests Row after Rejection:\n', JSON.stringify(dbAddReq1AfterReject[0], null, 2));

    // 2.h Production requests extra again -> stores approves -> stores issues
    console.log('\n--- STEP 2.h: Extra Material Flow 2 (Request -> Approve -> Issue) ---');
    const extraReq2Body = {
      scId,
      reason: 'DAMAGE',
      items: [
        {
          rmItemId,
          quantity: 5,
        },
      ],
      remarks: 'Supervisor confirmed metallurgical defect',
    };
    console.log('1. POST /api/additional-requests Request Body:\n', JSON.stringify(extraReq2Body, null, 2));

    const extraReq2Res = await request(app.getHttpServer())
      .post('/api/additional-requests')
      .set('Authorization', `Bearer ${prodToken}`)
      .send(extraReq2Body);

    console.log('1. POST /api/additional-requests HTTP Status:', extraReq2Res.status);
    console.log('1. Response Body:\n', JSON.stringify(extraReq2Res.body, null, 2));
    extraReq2Id = extraReq2Res.body.id;

    console.log(`2. POST /api/additional-requests/${extraReq2Id}/approve Request Body: {}`);
    const approveRes = await request(app.getHttpServer())
      .post(`/api/additional-requests/${extraReq2Id}/approve`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({});

    console.log('2. POST /api/additional-requests/:id/approve HTTP Status:', approveRes.status);
    console.log('2. Response Body:\n', JSON.stringify(approveRes.body, null, 2));

    const stockBalBeforeExtraIssue = await dataSource.query(
      `SELECT product_id, bin_id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    console.log('stock_balances BEFORE extra material issue:\n', JSON.stringify(stockBalBeforeExtraIssue[0], null, 2));

    const extraIssueBody = {
      scId,
      additionalRequestId: extraReq2Id,
      items: [
        {
          rmItemId,
          binId,
          quantityIssued: 5,
        },
      ],
      remarks: 'Issuing approved extra replacement pieces',
    };
    console.log('3. POST /api/material-issues (Extra Issue) Request Body:\n', JSON.stringify(extraIssueBody, null, 2));

    const extraIssueRes = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(extraIssueBody);

    console.log('3. POST /api/material-issues HTTP Status:', extraIssueRes.status);
    console.log('3. Response Body:\n', JSON.stringify(extraIssueRes.body, null, 2));
    extraIssueId = extraIssueRes.body.id;

    const stockBalAfterExtraIssue = await dataSource.query(
      `SELECT product_id, bin_id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    console.log('stock_balances AFTER extra material issue:\n', JSON.stringify(stockBalAfterExtraIssue[0], null, 2));

    const dbScFinal = await dataSource.query(
      `SELECT id, sc_number, status, updated_at FROM sales_order_components WHERE id = $1`,
      [scId],
    );
    console.log('Final DB sales_order_components Row after Extra Issue:\n', JSON.stringify(dbScFinal[0], null, 2));

    const dbAddReq2Final = await dataSource.query(
      `SELECT id, sc_id, status, reason, remarks, updated_at FROM additional_material_requests WHERE id = $1`,
      [extraReq2Id],
    );
    console.log('Final DB additional_material_requests Row (Expect ISSUED):\n', JSON.stringify(dbAddReq2Final[0], null, 2));

    // 2.i PART 2: GET stores pending-grouped and production grouped after step h
    console.log('\n--- STEP 2.i (PART 2, after step h): GET Grouped Lists ---');
    const storesPendingGroupedAfterH = await request(app.getHttpServer())
      .get('/api/sc/stores/pending-grouped')
      .set('Authorization', `Bearer ${storesToken}`);
    console.log('GET /api/sc/stores/pending-grouped HTTP Status:', storesPendingGroupedAfterH.status);
    console.log('Raw JSON (Stores Pending Grouped after Step h):\n', JSON.stringify(storesPendingGroupedAfterH.body, null, 2));

    const prodGroupedAfterH = await request(app.getHttpServer())
      .get('/api/sc/production/grouped')
      .set('Authorization', `Bearer ${prodToken}`);
    console.log('GET /api/sc/production/grouped HTTP Status:', prodGroupedAfterH.status);
    console.log('Raw JSON (Production Grouped after Step h):\n', JSON.stringify(prodGroupedAfterH.body, null, 2));

    // =========================================================================
    // SECTION 3: B3.3 LIVE SCENARIO
    // =========================================================================
    console.log('\n================================================================================');
    console.log('START SECTION 3: B3.3 LIVE SCENARIO');
    console.log('================================================================================\n');

    // 3.a Production calls receipt endpoint
    console.log('--- STEP 3.a: POST /api/production/receipt ---');
    const receiptBody = {
      materialIssueId: initialIssue1Id,
      scId,
      items: [
        {
          rmItemId,
          quantityReceived: 60,
        },
      ],
      remarks: 'Production floor confirmed receipt of first batch',
    };
    console.log('Request Body:\n', JSON.stringify(receiptBody, null, 2));

    const receiptRes = await request(app.getHttpServer())
      .post('/api/production/receipt')
      .set('Authorization', `Bearer ${prodToken}`)
      .send(receiptBody);

    console.log('HTTP Status:', receiptRes.status);
    console.log('Response Body:\n', JSON.stringify(receiptRes.body, null, 2));
    receiptId = receiptRes.body.id;

    const notifsMaterialReceived = await dataSource.query(
      `SELECT id, user_id, title, message, type, target_entity, target_id, is_read, created_at
       FROM notifications WHERE type = 'MATERIAL_RECEIVED' ORDER BY created_at DESC LIMIT 5`,
    );
    console.log('Raw Rows: SELECT * FROM notifications WHERE type=\'MATERIAL_RECEIVED\' ORDER BY created_at DESC LIMIT 5:\n',
      JSON.stringify(notifsMaterialReceived, null, 2));

    // 3.b Production calls return
    console.log('\n--- STEP 3.b: POST /api/production/return ---');
    const returnBody = {
      scId,
      items: [
        {
          rmItemId,
          quantityReturned: 5,
        },
      ],
      remarks: 'Offcut excess returned to stores',
    };
    console.log('Request Body:\n', JSON.stringify(returnBody, null, 2));

    const returnRes = await request(app.getHttpServer())
      .post('/api/production/return')
      .set('Authorization', `Bearer ${prodToken}`)
      .send(returnBody);

    console.log('HTTP Status:', returnRes.status);
    console.log('Response Body:\n', JSON.stringify(returnRes.body, null, 2));
    returnId = returnRes.body.id;

    const notifsMaterialReturned = await dataSource.query(
      `SELECT id, user_id, title, message, type, target_entity, target_id, is_read, created_at
       FROM notifications WHERE type = 'MATERIAL_RETURNED' ORDER BY created_at DESC LIMIT 5`,
    );
    console.log('Raw Rows: SELECT * FROM notifications WHERE type=\'MATERIAL_RETURNED\' ORDER BY created_at DESC LIMIT 5:\n',
      JSON.stringify(notifsMaterialReturned, null, 2));

    // 3.c Stores verifies the return
    console.log('\n--- STEP 3.c: POST /api/production/return/:id/verify ---');
    const verifyReturnBody = {
      destinationBinId: binId,
      remarks: 'Stores physically inspected and accepted return',
    };
    console.log(`Request URL: /api/production/return/${returnId}/verify`);
    console.log('Request Body:\n', JSON.stringify(verifyReturnBody, null, 2));

    const verifyReturnRes = await request(app.getHttpServer())
      .post(`/api/production/return/${returnId}/verify`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(verifyReturnBody);

    console.log('HTTP Status:', verifyReturnRes.status);
    console.log('Response Body:\n', JSON.stringify(verifyReturnRes.body, null, 2));

    const notifsReturnVerified = await dataSource.query(
      `SELECT id, user_id, title, message, type, target_entity, target_id, is_read, created_at
       FROM notifications WHERE type = 'RETURN_VERIFIED' AND target_id = $1`,
      [returnId],
    );
    console.log('Raw Row: SELECT * FROM notifications WHERE type=\'RETURN_VERIFIED\' AND target_id = returnId:\n',
      JSON.stringify(notifsReturnVerified, null, 2));
    console.log('Recipient Verification: User ID in notification is:', notifsReturnVerified[0]?.user_id);
    console.log('Production Return Creator User ID was:', prodUserId);
    console.log('Is specific recipient (not broadcast)?', notifsReturnVerified.length === 1 && notifsReturnVerified[0]?.user_id === prodUserId ? 'YES - Direct notification to production return creator' : 'NO');

    // 3.d Print EXTRA_MATERIAL_APPROVED / REJECTED / ISSUED notification rows
    console.log('\n--- STEP 3.d: Notifications for Extra Material Flow ---');
    const notifsExtraFlow = await dataSource.query(
      `SELECT id, user_id, title, message, type, target_entity, target_id, is_read, created_at
       FROM notifications WHERE target_id IN ($1, $2, $3)
       ORDER BY created_at ASC`,
      [extraReq1Id, extraReq2Id, extraIssueId],
    );
    console.log('Raw Rows for EXTRA_MATERIAL_APPROVED, EXTRA_MATERIAL_REJECTED, EXTRA_MATERIAL_ISSUED:\n',
      JSON.stringify(notifsExtraFlow, null, 2));

    // 3.e POST /api/inventory/:id/stock-in with and without reason
    console.log('\n--- STEP 3.e: Stock In Reason Validation ---');
    console.log('1. Without reason:');
    const stockInNoReasonBody = {
      quantity: 15,
      referenceType: 'INSPECTION_OVERSTOCK',
    };
    console.log(`POST /api/inventory/${invItemId}/stock-in Request Body:\n`, JSON.stringify(stockInNoReasonBody, null, 2));

    const stockInNoReasonRes = await request(app.getHttpServer())
      .post(`/api/inventory/${invItemId}/stock-in`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(stockInNoReasonBody);

    console.log('HTTP Status (Expect 400):', stockInNoReasonRes.status);
    console.log('Response Body / Error:\n', JSON.stringify(stockInNoReasonRes.body, null, 2));

    console.log('2. With reason:');
    const stockInWithReasonBody = {
      quantity: 15,
      referenceType: 'INSPECTION_OVERSTOCK',
      reason: 'Surplus vendor delivery accepted after quality clearance',
      remarks: 'GRN-4491 verification OK',
    };
    console.log(`POST /api/inventory/${invItemId}/stock-in Request Body:\n`, JSON.stringify(stockInWithReasonBody, null, 2));

    const stockInWithReasonRes = await request(app.getHttpServer())
      .post(`/api/inventory/${invItemId}/stock-in`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(stockInWithReasonBody);

    console.log('HTTP Status (Expect 201):', stockInWithReasonRes.status);
    console.log('Response Body:\n', JSON.stringify(stockInWithReasonRes.body, null, 2));

    const stockInTxId = stockInWithReasonRes.body.transaction?.id;
    const dbStockInTx = await dataSource.query(
      `SELECT id, inventory_item_id, transaction_type, quantity, reason, remarks, created_at
       FROM stock_transactions WHERE id = $1`,
      [stockInTxId],
    );
    console.log('Raw stock_transactions Row (Confirm reason column persisted):\n', JSON.stringify(dbStockInTx[0], null, 2));

    // 3.f Confirm email_jobs count did NOT increase
    console.log('\n--- STEP 3.f: Email Jobs Count Verification ---');
    const countEmailAfter = await dataSource.query(`SELECT count(*)::int as cnt FROM email_jobs`);
    const finalEmailJobsCount = countEmailAfter[0].cnt;
    console.log('Initial email_jobs Count:', initialEmailJobsCount);
    console.log('Final email_jobs Count:  ', finalEmailJobsCount);
    console.log('Email Jobs Count Delta:  ', finalEmailJobsCount - initialEmailJobsCount);
    console.log('Did count increase?     ', finalEmailJobsCount > initialEmailJobsCount ? 'YES (UNEXPECTED)' : 'NO (AS EXPECTED - GLOBAL_WORKFLOW_EMAIL_ENABLED=false)');

    // =========================================================================
    // SECTION 4: CLEANUP
    // =========================================================================
    console.log('\n================================================================================');
    console.log('START SECTION 4: CLEANUP');
    console.log('================================================================================\n');

    console.log('Deleting test rows created in this scenario...');

    // 1. Delete notifications created for our targets
    await dataSource.query(
      `DELETE FROM notifications WHERE target_id IN ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) OR title LIKE '%RAW%'`,
      [receiptId, returnId, extraReq1Id, extraReq2Id, extraIssueId, rmRequestId, poId, scId, initialIssue1Id, initialIssue2Id],
    );

    // 2. Delete material receipt items & receipts
    await dataSource.query(
      `DELETE FROM material_receipt_items WHERE material_receipt_id IN (SELECT id FROM material_receipts WHERE material_issue_id IN (SELECT id FROM material_issues WHERE sc_id = $1))`,
      [scId],
    );
    await dataSource.query(
      `DELETE FROM material_receipts WHERE material_issue_id IN (SELECT id FROM material_issues WHERE sc_id = $1)`,
      [scId],
    );

    // 3. Delete material return items & returns
    await dataSource.query(
      `DELETE FROM material_return_items WHERE material_return_id IN (SELECT id FROM material_returns WHERE sc_id = $1)`,
      [scId],
    );
    await dataSource.query(`DELETE FROM material_returns WHERE sc_id = $1`, [scId]);

    // 4. Delete additional request items & requests
    await dataSource.query(
      `DELETE FROM additional_material_request_items WHERE request_id IN (SELECT id FROM additional_material_requests WHERE sc_id = $1)`,
      [scId],
    );
    await dataSource.query(`DELETE FROM additional_material_requests WHERE sc_id = $1`, [scId]);

    // 5. Delete material issue items & issues
    await dataSource.query(
      `DELETE FROM material_issue_items WHERE material_issue_id IN (SELECT id FROM material_issues WHERE sc_id = $1)`,
      [scId],
    );
    await dataSource.query(`DELETE FROM material_issues WHERE sc_id = $1`, [scId]);

    // 6. Delete rm item snapshots
    await dataSource.query(
      `DELETE FROM rm_item_snapshots WHERE rm_item_id IN (SELECT id FROM rm_items WHERE sc_id = $1)`,
      [scId],
    );

    // 7. Delete stock transactions created for our tests
    await dataSource.query(
      `DELETE FROM stock_transactions WHERE source_bin_id = $1 OR destination_bin_id = $1 OR product_id = $2 OR inventory_item_id = $3 OR id = $4`,
      [binId, productId, invItemId, stockInTxId],
    );

    // 8. Delete RM items & RM requests
    await dataSource.query(`DELETE FROM rm_items WHERE sc_id = $1`, [scId]);
    await dataSource.query(`DELETE FROM rm_requests WHERE sc_id = $1`, [scId]);

    // 9. Delete SC & PO
    await dataSource.query(`DELETE FROM sales_order_components WHERE id = $1`, [scId]);
    await dataSource.query(`DELETE FROM purchase_orders WHERE id = $1`, [poId]);

    // 10. Delete inventory item balance & item
    await dataSource.query(`DELETE FROM stock_balances WHERE inventory_item_id = $1`, [invItemId]);
    await dataSource.query(`DELETE FROM inventory_items WHERE id = $1`, [invItemId]);

    // 11. Delete test product balance, bin & product
    await dataSource.query(`DELETE FROM stock_balances WHERE bin_id = $1 AND product_id = $2`, [binId, productId]);
    await dataSource.query(`DELETE FROM bins WHERE id = $1`, [binId]);
    await dataSource.query(`DELETE FROM products WHERE id = $1`, [productId]);

    // 12. Delete test users
    await dataSource.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [designerUserId, storesUserId, prodUserId]);

    console.log('Cleanup completed successfully.');

    // Print final counts to verify baseline
    const countRmFinal = await dataSource.query(`SELECT count(*)::int as cnt FROM rm_requests`);
    const countAddReqFinal = await dataSource.query(`SELECT count(*)::int as cnt FROM additional_material_requests`);
    const countNotifFinal = await dataSource.query(`SELECT count(*)::int as cnt FROM notifications`);

    console.log('Final Baseline Verification Counts:');
    console.log('rm_requests:                  baseline =', initialRmRequestsCount, '| final =', countRmFinal[0].cnt);
    console.log('additional_material_requests: baseline =', initialAddReqCount, '| final =', countAddReqFinal[0].cnt);
    console.log('notifications:                baseline =', initialNotificationsCount, '| final =', countNotifFinal[0].cnt);
  }, 180000);
});
