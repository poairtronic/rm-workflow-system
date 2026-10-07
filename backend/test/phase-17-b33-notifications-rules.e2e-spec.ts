import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';

describe('Phase 17 B3.3 - Notifications and Rules (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let adminToken: string;
  let storesToken: string;
  let prodToken: string;
  let prodUserId: string;

  // Test data IDs
  let productId: string;
  let binId: string;
  let invItemId: string;
  let poId: string;
  let scId: string;
  let rmItemId: string;
  let issueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(Role);
    const adminRole = await roleRepo.findOne({ where: { name: UserRole.ADMIN } });
    const storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    const prodRole = await roleRepo.findOne({ where: { name: UserRole.PRODUCTION } });

    const adminUser = await userRepo.save(userRepo.create({
      email: `admin_b33_${Date.now()}@test.com`,
      name: 'Admin B33',
      passwordHash: 'xx',
      roleId: adminRole!.id,
    }));
    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });

    const storesUser = await userRepo.save(userRepo.create({
      email: `stores_b33_${Date.now()}@test.com`,
      name: 'Stores B33',
      passwordHash: 'xx',
      roleId: storesRole!.id,
    }));
    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });

    const prodUser = await userRepo.save(userRepo.create({
      email: `prod_b33_${Date.now()}@test.com`,
      name: 'Prod B33',
      passwordHash: 'xx',
      roleId: prodRole!.id,
    }));
    prodUserId = prodUser.id;
    prodToken = jwtService.sign({ sub: prodUser.id, userId: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });

    const uniqueStr = Date.now().toString();

    // 1. Create Product & Stock in Bin
    const resProd = await dataSource.query(
      `INSERT INTO products (family_id, name, minimum_inventory, is_active) 
       VALUES ((SELECT id FROM product_families LIMIT 1), 'RM-B33-${uniqueStr}', 0, true) 
       RETURNING id`
    );
    productId = resProd[0].id;

    const resBin = await dataSource.query(
      `INSERT INTO bins (rack_id, code, name, is_active) 
       VALUES ((SELECT id FROM racks LIMIT 1), 'BIN-B33-${uniqueStr}', 'Test Bin B33', true) 
       RETURNING id`
    );
    binId = resBin[0].id;

    await dataSource.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity) 
       VALUES ($1, $2, 1000)`,
      [binId, productId]
    );

    // 2. Create InventoryItem for stock in/out test
    const resInvItem = await dataSource.query(
      `INSERT INTO inventory_items (material, material_type, grade, size, unit, is_active) 
       VALUES ('Steel-B33-${uniqueStr}', 'ROUND_BAR', 'EN31', '60mm', 'KG', true) 
       RETURNING id`
    );
    invItemId = resInvItem[0].id;

    await dataSource.query(
      `INSERT INTO stock_balances (inventory_item_id, current_quantity) 
       VALUES ($1, 200)`,
      [invItemId]
    );

    // 3. Create Draft RM -> Submit -> Review
    const poNumber = `PO-B33-${uniqueStr}`;
    const draftRes = await request(app.getHttpServer())
      .post('/api/rm/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        poNumber,
        scs: [
          {
            scNumber: `SC-B33-${uniqueStr}`,
            productName: `Component B33 ${uniqueStr}`,
            items: [
              {
                productId,
                spec: 'Grade B33',
                quantity: 100,
              },
            ],
          },
        ],
      })
      .expect(201);

    poId = draftRes.body.poId;
    scId = draftRes.body.scs[0].scId;

    await request(app.getHttpServer())
      .post(`/api/rm/po/${poId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const rmReqId = scDetail.body.rmRequest.id;
    rmItemId = scDetail.body.rmRequest.items[0].id;

    await request(app.getHttpServer())
      .post(`/api/rm/${rmReqId}/review`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        itemMappings: [{ rmItemId, productId }],
        remarks: 'Reviewed B33',
      })
      .expect(201);

    // Initial Material Issue of 100
    const issueRes = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        scId,
        items: [{ rmItemId, binId, quantityIssued: 100 }],
        remarks: 'Initial issue 100',
      })
      .expect(201);

    issueId = issueRes.body.id;
  }, 45000);

  afterAll(async () => {
    await app.close();
  });

  describe('Rule: Reasons required on Stock In / Out', () => {
    it('RULE-001: should reject stock-in if reason is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/inventory/${invItemId}/stock-in`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          quantity: 25,
          referenceType: 'MANUAL',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('reason');
    });

    it('RULE-002: should reject stock-out if reason is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/inventory/${invItemId}/stock-out`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          quantity: 10,
          referenceType: 'MANUAL',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('reason');
    });

    it('RULE-003: should accept stock-in with reason and record it in stock_transactions', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/inventory/${invItemId}/stock-in`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          quantity: 30,
          referenceType: 'PURCHASE_RECEIPT',
          reason: 'Supplier shipment arrived at bay 4',
          remarks: 'Checked quality OK',
        })
        .expect(201);

      const txId = res.body.transaction.id;
      const txRows = await dataSource.query(
        `SELECT reason, remarks FROM stock_transactions WHERE id = $1`,
        [txId]
      );
      expect(txRows[0].reason).toBe('Supplier shipment arrived at bay 4');
    });

    it('RULE-004: should accept stock-out with reason and record it in stock_transactions', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/inventory/${invItemId}/stock-out`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          quantity: 15,
          referenceType: 'WORK_ORDER',
          reason: 'Issued for shop floor assembly',
        })
        .expect(201);

      const txId = res.body.transaction.id;
      const txRows = await dataSource.query(
        `SELECT reason FROM stock_transactions WHERE id = $1`,
        [txId]
      );
      expect(txRows[0].reason).toBe('Issued for shop floor assembly');
    });
  });

  describe('Notifications: 6 New Workflow Events', () => {
    let receiptId: string;
    let returnId: string;
    let addReq1Id: string;
    let addReq2Id: string;

    it('EVENT-001: receive material creates MATERIAL_RECEIVED notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/production/receipt')
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          materialIssueId: issueId,
          scId,
          items: [{ rmItemId, quantityReceived: 100 }],
          remarks: 'Received full batch',
        })
        .expect(201);

      receiptId = res.body.id;

      const notifs = await dataSource.query(
        `SELECT * FROM notifications WHERE type = 'MATERIAL_RECEIVED' AND target_id = $1`,
        [receiptId]
      );
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Material Received');
    });

    it('EVENT-002: return material creates MATERIAL_RETURNED notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/production/return')
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          scId,
          items: [{ rmItemId, quantityReturned: 10 }],
          remarks: 'Excess scrap returned',
        })
        .expect(201);

      returnId = res.body.id;

      const notifs = await dataSource.query(
        `SELECT * FROM notifications WHERE type = 'MATERIAL_RETURNED' AND target_id = $1`,
        [returnId]
      );
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Material Return');
    });

    it('EVENT-003: verify return creates RETURN_VERIFIED notification', async () => {
      await request(app.getHttpServer())
        .post(`/api/production/return/${returnId}/verify`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          destinationBinId: binId,
          remarks: 'Inspected and accepted',
        })
        .expect(201);

      const notifs = await dataSource.query(
        `SELECT * FROM notifications WHERE type = 'RETURN_VERIFIED' AND target_id = $1`,
        [returnId]
      );
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Material Return Acknowledged');
      // Verifies notification was sent to production return creator
      expect(notifs.some((n: any) => n.user_id === prodUserId)).toBe(true);
    });

    it('EVENT-004: reject extra material creates EXTRA_MATERIAL_REJECTED notification', async () => {
      const reqRes = await request(app.getHttpServer())
        .post('/api/additional-requests')
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          scId,
          reason: 'DAMAGE',
          items: [{ rmItemId, quantity: 5 }],
          remarks: 'Tool breakage',
        })
        .expect(201);

      addReq1Id = reqRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/additional-requests/${addReq1Id}/reject`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({})
        .expect(201);

      const notifs = await dataSource.query(
        `SELECT * FROM notifications WHERE type = 'EXTRA_MATERIAL_REJECTED' AND target_id = $1`,
        [addReq1Id]
      );
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Additional Material Rejected');
      expect(notifs.some((n: any) => n.user_id === prodUserId)).toBe(true);
    });

    it('EVENT-005: approve extra material creates EXTRA_MATERIAL_APPROVED notification', async () => {
      const reqRes = await request(app.getHttpServer())
        .post('/api/additional-requests')
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          scId,
          reason: 'WASTAGE',
          items: [{ rmItemId, quantity: 8 }],
          remarks: 'Furnace loss',
        })
        .expect(201);

      addReq2Id = reqRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/additional-requests/${addReq2Id}/approve`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({})
        .expect(201);

      const notifs = await dataSource.query(
        `SELECT * FROM notifications WHERE type = 'EXTRA_MATERIAL_APPROVED' AND target_id = $1`,
        [addReq2Id]
      );
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Additional Material Approved');
      expect(notifs.some((n: any) => n.user_id === prodUserId)).toBe(true);
    });

    it('EVENT-006: issue extra material creates EXTRA_MATERIAL_ISSUED notification', async () => {
      const issueRes = await request(app.getHttpServer())
        .post('/api/material-issues')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          scId,
          additionalRequestId: addReq2Id,
          items: [{ rmItemId, binId, quantityIssued: 8 }],
          remarks: 'Issuing replacement stock',
        })
        .expect(201);

      const extraIssueId = issueRes.body.id;

      const notifs = await dataSource.query(
        `SELECT * FROM notifications WHERE type = 'EXTRA_MATERIAL_ISSUED' AND target_id = $1`,
        [extraIssueId]
      );
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Additional Material Issued');
      expect(notifs.some((n: any) => n.user_id === prodUserId)).toBe(true);
    });
  });
});
