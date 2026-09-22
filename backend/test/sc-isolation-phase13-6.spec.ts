import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { SalesOrderComponent, ScStatus } from '../src/sc/entities/sc.entity.js';
import { RmItem } from '../src/rm/entities/rm-item.entity.js';
import { RmRequest, RmRequestStatus } from '../src/rm/entities/rm-request.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { ProductFamily } from '../src/inventory/entities/product-family.entity.js';
import { ProductCategory } from '../src/inventory/entities/product-category.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { Rack } from '../src/inventory/entities/rack.entity.js';
import { WarehouseLocation } from '../src/inventory/entities/warehouse-location.entity.js';
import { Warehouse } from '../src/inventory/entities/warehouse.entity.js';
import { PurchaseOrder } from '../src/po/entities/po.entity.js';
import { Customer } from '../src/customers/entities/customer.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { JwtService } from '@nestjs/jwt';
import { MaterialIssue } from '../src/material-issue/entities/material-issue.entity.js';
import { MaterialReceipt } from '../src/production/entities/production-receipt.entity.js';

describe('Phase 13.6 SC Isolation Hardening (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let adminToken: string;
  let storesToken: string;
  let productionToken: string;

  let baseProduct1: Product;
  let baseProduct2: Product;
  let baseBin1: Bin;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const generateToken = (userId: string, email: string, roles: string[]) => {
    return jwtService.sign({ sub: userId, email, roles });
  };

  let basePo: PurchaseOrder;

  const setupBaseData = async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      let adminRole = await queryRunner.manager.findOneBy(Role, { name: UserRole.ADMIN });
      if (!adminRole) {
        adminRole = await queryRunner.manager.save(Role, queryRunner.manager.create(Role, { name: UserRole.ADMIN, description: 'Admin' }));
      }
      let storesRole = await queryRunner.manager.findOneBy(Role, { name: UserRole.STORES });
      if (!storesRole) {
        storesRole = await queryRunner.manager.save(Role, queryRunner.manager.create(Role, { name: UserRole.STORES, description: 'Stores' }));
      }
      let productionRole = await queryRunner.manager.findOneBy(Role, { name: UserRole.PRODUCTION });
      if (!productionRole) {
        productionRole = await queryRunner.manager.save(Role, queryRunner.manager.create(Role, { name: UserRole.PRODUCTION, description: 'Production' }));
      }

      let adminUser = await queryRunner.manager.findOneBy(User, { email: 'admin_iso@example.com' });
      if (!adminUser) {
        adminUser = await queryRunner.manager.save(User, queryRunner.manager.create(User, {
          email: 'admin_iso@example.com',
          name: 'Admin User',
          passwordHash: 'hash',
          roleId: adminRole.id,
        }));
      }
      let storesUser = await queryRunner.manager.findOneBy(User, { email: 'stores_iso@example.com' });
      if (!storesUser) {
        storesUser = await queryRunner.manager.save(User, queryRunner.manager.create(User, {
          email: 'stores_iso@example.com',
          name: 'Stores User',
          passwordHash: 'hash',
          roleId: storesRole.id,
        }));
      }
      let productionUser = await queryRunner.manager.findOneBy(User, { email: 'production_iso@example.com' });
      if (!productionUser) {
        productionUser = await queryRunner.manager.save(User, queryRunner.manager.create(User, {
          email: 'production_iso@example.com',
          name: 'Production User',
          passwordHash: 'hash',
          roleId: productionRole.id,
        }));
      }

      adminToken = generateToken(adminUser.id, adminUser.email, [UserRole.ADMIN]);
      storesToken = generateToken(storesUser.id, storesUser.email, [UserRole.STORES]);
      productionToken = generateToken(productionUser.id, productionUser.email, [UserRole.PRODUCTION]);

      const ts = Date.now();
      const customer = await queryRunner.manager.save(Customer, queryRunner.manager.create(Customer, {
        name: 'Iso Customer ' + ts,
        code: 'ISO_' + ts,
      }));

      basePo = await queryRunner.manager.save(PurchaseOrder, queryRunner.manager.create(PurchaseOrder, {
        poNumber: 'PO-ISO-' + ts,
        customerId: customer.id,
        status: 'DRAFT',
      }));

      const category = await queryRunner.manager.save(ProductCategory, queryRunner.manager.create(ProductCategory, {
        name: 'Cat Iso ' + ts,
        code: 'C-ISO-' + ts,
      }));
      const family = await queryRunner.manager.save(ProductFamily, queryRunner.manager.create(ProductFamily, {
        name: 'Fam Iso ' + ts,
        code: 'F-ISO-' + ts,
        categoryId: category.id,
      }));
      baseProduct1 = await queryRunner.manager.save(Product, queryRunner.manager.create(Product, {
        name: 'Product 1 ' + ts,
        partNumber: 'P1_' + ts,
        familyId: family.id,
      }));
      baseProduct2 = await queryRunner.manager.save(Product, queryRunner.manager.create(Product, {
        name: 'Product 2 ' + ts,
        partNumber: 'P2_' + ts,
        familyId: family.id,
      }));

      const warehouse = await queryRunner.manager.save(Warehouse, queryRunner.manager.create(Warehouse, {
        name: 'WH Iso ' + ts,
        code: 'W-ISO-' + ts,
      }));
      const location = await queryRunner.manager.save(WarehouseLocation, queryRunner.manager.create(WarehouseLocation, {
        name: 'Loc Iso ' + ts,
        code: 'L-ISO-' + ts,
        warehouseId: warehouse.id,
      }));
      const rack = await queryRunner.manager.save(Rack, queryRunner.manager.create(Rack, {
        name: 'Rack Iso ' + ts,
        code: 'R-ISO-' + ts,
        locationId: location.id,
      }));
      baseBin1 = await queryRunner.manager.save(Bin, queryRunner.manager.create(Bin, {
        name: 'Bin 1 ' + ts,
        code: 'B-ISO-' + ts,
        rackId: rack.id,
      }));

      await queryRunner.manager.save(StockBalance, queryRunner.manager.create(StockBalance, {
        productId: baseProduct1.id,
        binId: baseBin1.id,
        currentQuantity: 1000,
      }));
      await queryRunner.manager.save(StockBalance, queryRunner.manager.create(StockBalance, {
        productId: baseProduct2.id,
        binId: baseBin1.id,
        currentQuantity: 1000,
      }));

    } finally {
      await queryRunner.release();
    }
  };

  const createScAndRm = async (scPrefix: string, productId: string) => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    let sc: SalesOrderComponent, rmRequest: RmRequest, rmItem: RmItem;
    const uniqueScNumber = `${scPrefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    try {
      const user = await queryRunner.manager.findOneBy(User, { email: 'admin_iso@example.com' });

      sc = await queryRunner.manager.save(SalesOrderComponent, queryRunner.manager.create(SalesOrderComponent, {
        scNumber: uniqueScNumber,
        poId: basePo.id,
        status: ScStatus.STORES_PENDING,
        productName: 'ProdName',
        description: 'Test SC',
        revision: '0',
        designerId: user!.id,
      }));

      rmRequest = await queryRunner.manager.save(RmRequest, queryRunner.manager.create(RmRequest, {
        scId: sc.id,
        status: RmRequestStatus.REVIEWED,
        createdById: user!.id,
        requestNumber: `RM-${uniqueScNumber}`,
        requestedById: user!.id,
      }));

      rmItem = await queryRunner.manager.save(RmItem, queryRunner.manager.create(RmItem, {
        rmFormId: rmRequest.id,
        scId: sc.id,
        material: 'Mat',
        type: 'Type',
        grade: 'Grade',
        size: 'Size',
        quantity: 100,
        unit: 'KGS',
        mappedProductId: productId,
      }));
    } finally {
      await queryRunner.release();
    }
    return { sc, rmRequest, rmItem };
  };

  beforeEach(async () => {
    await setupBaseData();
  });

  it('SCISO_001_002: SC001 context with SC002 RmItem in Material Issue -> REJECT', async () => {
    const { sc: sc1 } = await createScAndRm('SC001', baseProduct1.id);
    const { rmItem: rmItem2 } = await createScAndRm('SC002', baseProduct1.id);

    const res = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        scId: sc1.id,
        items: [{ rmItemId: rmItem2.id, binId: baseBin1.id, quantityIssued: 10 }],
        remarks: 'Test',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('does not belong to SC');
  });

  it('SCISO_003_004: SC001 context with SC002 Material Issue in Receipt -> REJECT', async () => {
    const { sc: sc1, rmItem: rm1 } = await createScAndRm('SC001', baseProduct1.id);
    const { sc: sc2, rmItem: rm2 } = await createScAndRm('SC002', baseProduct1.id);

    const issue2Res = await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        scId: sc2.id,
        items: [{ rmItemId: rm2.id, binId: baseBin1.id, quantityIssued: 20 }],
        remarks: 'Issue2',
      });
    expect(issue2Res.status).toBe(201);
    const issue2Id = issue2Res.body.id;

    const receiptRes = await request(app.getHttpServer())
      .post('/api/production/receipt')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        materialIssueId: issue2Id,
        scId: sc1.id, // Providing sc1 ID but issue belongs to SC2
        items: [{ rmItemId: rm2.id, quantityReceived: 10 }],
      });

    expect(receiptRes.status).toBe(400);
    expect(receiptRes.body.message).toContain('does not belong to SC');
  });

  it('SCISO_005: SC001 context with SC002 RmItem in Consumption -> REJECT', async () => {
    const { sc: sc1 } = await createScAndRm('SC001', baseProduct1.id);
    const { sc: sc2, rmItem: rm2 } = await createScAndRm('SC002', baseProduct1.id);

    const consumeRes = await request(app.getHttpServer())
      .post('/api/production/consume')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        scId: sc1.id,
        rmItemId: rm2.id,
        quantityConsumed: 10,
      });

    expect(consumeRes.status).toBe(400);
    expect(consumeRes.body.message).toContain('does not belong to SC');
  });

  it('SCISO_006: SC001 context with SC002 RmItem in Return -> REJECT', async () => {
    const { sc: sc1 } = await createScAndRm('SC001', baseProduct1.id);
    const { sc: sc2, rmItem: rm2 } = await createScAndRm('SC002', baseProduct1.id);

    const returnRes = await request(app.getHttpServer())
      .post('/api/production/return')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        scId: sc1.id,
        items: [{ rmItemId: rm2.id, quantityReturned: 10 }],
      });

    expect(returnRes.status).toBe(400);
    expect(returnRes.body.message).toContain('does not belong to SC');
  });

  it('SCISO_008: SC001 context with SC002 RmItem in Additional Request -> REJECT', async () => {
    const { sc: sc1 } = await createScAndRm('SC001', baseProduct1.id);
    const { rmItem: rm2 } = await createScAndRm('SC002', baseProduct1.id);

    const addReq = await request(app.getHttpServer())
      .post('/api/additional-requests')
      .set('Authorization', `Bearer ${productionToken}`)
      .send({
        scId: sc1.id,
        items: [{ rmItemId: rm2.id, quantity: 5 }],
      });

    expect(addReq.status).toBe(400);
    expect(addReq.body.message).toContain('not found or does not belong to SC');
  });

  it('SCISO_009_010: SC001 Complete does not affect SC002', async () => {
    const { sc: sc1 } = await createScAndRm('SC001', baseProduct1.id);
    const { sc: sc2 } = await createScAndRm('SC002', baseProduct1.id);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    // Simulate sc1 and sc2 in IN_PRODUCTION
    await queryRunner.manager.update(SalesOrderComponent, sc1.id, { status: ScStatus.IN_PRODUCTION });
    await queryRunner.manager.update(SalesOrderComponent, sc2.id, { status: ScStatus.IN_PRODUCTION });
    await queryRunner.release();

    const completeRes = await request(app.getHttpServer())
      .post(`/api/sc/${sc1.id}/complete`)
      .set('Authorization', `Bearer ${productionToken}`)
      .send({ remarks: 'Done' });

    expect(completeRes.status).toBe(201);

    const qr2 = dataSource.createQueryRunner();
    await qr2.connect();
    const finalSc1 = await qr2.manager.findOneBy(SalesOrderComponent, { id: sc1.id });
    const finalSc2 = await qr2.manager.findOneBy(SalesOrderComponent, { id: sc2.id });
    await qr2.release();

    expect(finalSc1?.status).toBe(ScStatus.COMPLETED);
    expect(finalSc2?.status).toBe(ScStatus.IN_PRODUCTION);
  });
});
