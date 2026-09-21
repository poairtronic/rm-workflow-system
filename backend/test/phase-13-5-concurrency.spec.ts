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
import { MaterialReturn, ReturnStatus } from '../src/production/entities/material-return.entity.js';
import { MaterialReturnItem } from '../src/production/entities/material-return-item.entity.js';

describe('Phase 13.5 Concurrency Hardening (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let storesToken: string;
  let baseProduct1: Product;
  let baseProduct2: Product;
  let baseBin1: Bin;
  let baseBin2: Bin;
  let baseUser: User;

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

  beforeEach(async () => {
    const baseData = await setupBaseData();
    baseProduct1 = baseData.product1;
    baseProduct2 = baseData.product2;
    baseBin1 = baseData.bin1;
    baseBin2 = baseData.bin2;
    const user = await dataSource.manager.findOne(User, { where: { email: 'conc_user@example.com' } });
    baseUser = user!;
    storesToken = jwtService.sign({ sub: user!.id, role: UserRole.STORES });
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  afterEach(async () => {
    // Tests are isolated by setupBaseData's truncate.
  });

  const setupBaseData = async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    // Ensure all tables are truncated before each test
    await queryRunner.manager.query(
      'TRUNCATE TABLE stock_transactions, material_issue_items, material_issues, stock_balances, material_return_items, material_returns, material_consumptions, material_receipt_items, material_receipts, additional_material_requests, rm_items, rm_requests, sales_order_components, purchase_orders, products, product_families, product_categories, bins, racks, warehouse_locations, warehouses, customers, users, roles CASCADE',
    );
    let product1: Product, product2: Product, bin1: Bin, bin2: Bin, family: ProductFamily, category: ProductCategory, rack: Rack, loc: WarehouseLocation, wh: Warehouse;
    try {
      category = await queryRunner.manager.save(ProductCategory, queryRunner.manager.create(ProductCategory, {
        name: 'ConcCategory',
      }));

      family = await queryRunner.manager.save(ProductFamily, queryRunner.manager.create(ProductFamily, {
        name: 'ConcFamily',
        categoryId: category.id,
      }));

      product1 = await queryRunner.manager.save(Product, queryRunner.manager.create(Product, {
        name: 'ConcProduct1',
        familyId: family.id,
      }));
      product2 = await queryRunner.manager.save(Product, queryRunner.manager.create(Product, {
        name: 'ConcProduct2',
        familyId: family.id,
      }));

      wh = await queryRunner.manager.save(Warehouse, queryRunner.manager.create(Warehouse, {
        code: 'WH-CONC',
        name: 'ConcWarehouse',
      }));

      loc = await queryRunner.manager.save(WarehouseLocation, queryRunner.manager.create(WarehouseLocation, {
        code: 'ConcLoc',
        name: 'ConcLocation',
        warehouseId: wh.id,
      }));

      rack = await queryRunner.manager.save(Rack, queryRunner.manager.create(Rack, {
        code: 'ConcRack',
        name: 'ConcRack',
        locationId: loc.id,
      }));

      const cust = await queryRunner.manager.save(Customer, queryRunner.manager.create(Customer, {
        code: 'CUST-CONC',
        name: 'ConcCustomer',
        email: 'test@example.com',
      }));

      const po = await queryRunner.manager.save(PurchaseOrder, queryRunner.manager.create(PurchaseOrder, {
        poNumber: 'PO-CONC',
        customerId: cust.id,
      }));

      const role = await queryRunner.manager.save(Role, queryRunner.manager.create(Role, {
        name: 'ConcRole',
        description: 'Test Role',
      }));

      const user = await queryRunner.manager.save(User, queryRunner.manager.create(User, {
        name: 'Conc User',
        username: 'conc_user',
        email: 'conc_user@example.com',
        roleId: role.id,
        passwordHash: 'dummy',
      }));

      bin1 = await queryRunner.manager.save(Bin, queryRunner.manager.create(Bin, { code: 'B-CONC-01', name: 'Bin1', isActive: true, rackId: rack.id }));
      bin2 = await queryRunner.manager.save(Bin, queryRunner.manager.create(Bin, { code: 'B-CONC-02', name: 'Bin2', isActive: true, rackId: rack.id }));

      // Give Bin 1 exactly 100 qty of Product 1
      await queryRunner.manager.save(StockBalance, queryRunner.manager.create(StockBalance, {
        productId: product1.id,
        binId: bin1.id,
        currentQuantity: 100,
        openingBalance: 100,
      }));
    } finally {
      await queryRunner.release();
    }
    return { product1, product2, bin1, bin2 };
  };

  const createScAndRm = async (scNumber: string, productId: string) => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    let sc: SalesOrderComponent, rmRequest: RmRequest, rmItem: RmItem;
    try {
      const po = await queryRunner.manager.findOneBy(PurchaseOrder, { poNumber: 'PO-CONC' });
      sc = await queryRunner.manager.save(SalesOrderComponent, queryRunner.manager.create(SalesOrderComponent, {
        scNumber,
        poId: po!.id,
        status: ScStatus.STORES_PENDING,
        productName: 'ProdName',
        description: 'Test SC',
        revision: '0',
        designerId: 'designer-1',
      }));

      rmRequest = await queryRunner.manager.save(RmRequest, queryRunner.manager.create(RmRequest, {
        scId: sc.id,
        status: RmRequestStatus.REVIEWED,
        createdById: (await queryRunner.manager.findOne(User, { where: { email: 'conc_user@example.com' } }))!.id,
        requestNumber: `RM-${scNumber}`,
        requestedById: 'designer-1',
      }));

      rmItem = await queryRunner.manager.save(RmItem, queryRunner.manager.create(RmItem, {
        rmFormId: rmRequest.id,
        scId: sc.id,
        material: 'Mat',
        type: 'Type',
        grade: 'Grade',
        size: 'Size',
        quantity: 10,
        unit: 'KGS',
        mappedProductId: productId, // Important for stock resolution
      }));
    } finally {
      await queryRunner.release();
    }
    return { sc, rmRequest, rmItem };
  };

  it('C_001: Concurrent StockOuts on the same Product+Bin', async () => {
    const product1 = baseProduct1;
    const bin1 = baseBin1;

    // We have 100 stock. Let's fire 5 concurrent requests of 30 each (150 total).
    // The first 3 should succeed (90), the last 2 should fail (Insufficient stock).
    // Or 4 succeed (120) - no, only 3 fits.
    // They share the same Product + Bin via the inventoryItemId fallback or modern endpoints.
    // Wait, the API for stockOut requires an inventoryItemId. We don't have one, we have Product + Bin.
    // Let's create an InventoryItem just so we can call the legacy API endpoint if it's required.
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    let invItemId = '';
    try {
      // Create a balance without inventoryItem, we can't call `POST /api/inventory/:id/stock-out` without an ID.
      const invItem = await queryRunner.manager.query(`INSERT INTO inventory_items (material, material_type, grade, size, unit) VALUES ($1, 'b', 'c', 'd', 'e') RETURNING id`, [`mat-${Date.now()}-${Math.random()}`]);
      invItemId = invItem[0].id;
      // Link it to the existing balance
      await queryRunner.manager.query(`UPDATE stock_balances SET inventory_item_id = $1 WHERE product_id = $2 AND bin_id = $3`, [invItemId, product1.id, bin1.id]);
    } finally {
      await queryRunner.release();
    }

    const fireRequest = () => request(app.getHttpServer())
      .post(`/api/inventory/${invItemId}/stock-out`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({ quantity: 30, referenceType: 'TEST', referenceId: 'REF' });

    const results = await Promise.all([fireRequest(), fireRequest(), fireRequest(), fireRequest(), fireRequest()]);

    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status === 400);

    expect(successes.length).toBe(3); // 30 * 3 = 90
    expect(failures.length).toBe(2);

    const checkRunner = dataSource.createQueryRunner();
    await checkRunner.connect();
    const balance = await checkRunner.manager.query(`SELECT current_quantity FROM stock_balances WHERE inventory_item_id = $1`, [invItemId]);
    await checkRunner.release();

    expect(Number(balance[0].current_quantity)).toBe(10); // 100 - 90
  });

  it('C_002: Concurrent Material Issues (Lock Ordering Deadlock Prevention)', async () => {
    // Two different SCs, but both request items from Bin 1 & Bin 2 in different orders
    const product1 = baseProduct1;
    const product2 = baseProduct2;
    const bin1 = baseBin1;
    const bin2 = baseBin2;

    const scData1 = await createScAndRm('SC-CONC-1', product1.id);
    const scData2 = await createScAndRm('SC-CONC-2', product1.id);

    // Let's add product2 to both SCs as well so they both require Product1 and Product2.
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    let rmItem2_1, rmItem2_2;
    try {
      rmItem2_1 = await queryRunner.manager.save(RmItem, queryRunner.manager.create(RmItem, {
        rmFormId: scData1.rmRequest.id,
        scId: scData1.sc.id,
        material: 'M', type: 'T', grade: 'G', size: 'S', quantity: 10, unit: 'KGS',
        mappedProductId: product2.id,
      }));
      rmItem2_2 = await queryRunner.manager.save(RmItem, queryRunner.manager.create(RmItem, {
        rmFormId: scData2.rmRequest.id,
        scId: scData2.sc.id,
        material: 'M', type: 'T', grade: 'G', size: 'S', quantity: 10, unit: 'KGS',
        mappedProductId: product2.id,
      }));
      
      // Add stock for product2 in bin2
      await queryRunner.manager.save(StockBalance, queryRunner.manager.create(StockBalance, {
        productId: product2.id,
        binId: bin2.id,
        currentQuantity: 100,
        openingBalance: 100,
      }));
    } finally {
      await queryRunner.release();
    }

    const payload1 = {
      scId: scData1.sc.id,
      items: [
        { rmItemId: scData1.rmItem.id, binId: bin1.id, quantityIssued: 10 },
        { rmItemId: rmItem2_1.id, binId: bin2.id, quantityIssued: 10 }
      ]
    };

    const payload2 = {
      scId: scData2.sc.id,
      items: [
        { rmItemId: rmItem2_2.id, binId: bin2.id, quantityIssued: 10 },
        { rmItemId: scData2.rmItem.id, binId: bin1.id, quantityIssued: 10 }
      ]
    };

    // Before fixing the code, this would sometimes deadlock postgres. With the sort fix, it should succeed smoothly.
    const res = await Promise.all([
      request(app.getHttpServer()).post('/api/material-issues').set('Authorization', `Bearer ${storesToken}`).send(payload1),
      request(app.getHttpServer()).post('/api/material-issues').set('Authorization', `Bearer ${storesToken}`).send(payload2)
    ]);

    expect(res[0].status).toBe(201);
    expect(res[1].status).toBe(201);

    const checkRunner = dataSource.createQueryRunner();
    await checkRunner.connect();
    const bal1 = await checkRunner.manager.query(`SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`, [product1.id, bin1.id]);
    const bal2 = await checkRunner.manager.query(`SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`, [product2.id, bin2.id]);
    await checkRunner.release();

    expect(Number(bal1[0].current_quantity)).toBe(80); // 100 - 10 - 10
    expect(Number(bal2[0].current_quantity)).toBe(80);
  });

  it('C_003: Concurrent Return Verifications (Lock Ordering Deadlock Prevention)', async () => {
    const product1 = baseProduct1;
    const product2 = baseProduct2;
    const bin1 = baseBin1;
    const bin2 = baseBin2;
    // Two returns returning identical products to the same bin
    const scData1 = await createScAndRm('SC-RET-1', product1.id);
    const scData2 = await createScAndRm('SC-RET-2', product1.id);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    let ret1: MaterialReturn, ret2: MaterialReturn;
    try {
      const rmItem2_1 = await queryRunner.manager.save(RmItem, queryRunner.manager.create(RmItem, {
        rmFormId: scData1.rmRequest.id, scId: scData1.sc.id, material: 'M', type: 'T', grade: 'G', size: 'S', quantity: 10, unit: 'KGS', mappedProductId: product2.id,
      }));
      const rmItem2_2 = await queryRunner.manager.save(RmItem, queryRunner.manager.create(RmItem, {
        rmFormId: scData2.rmRequest.id, scId: scData2.sc.id, material: 'M', type: 'T', grade: 'G', size: 'S', quantity: 10, unit: 'KGS', mappedProductId: product2.id,
      }));

      ret1 = await queryRunner.manager.save(MaterialReturn, queryRunner.manager.create(MaterialReturn, {
        scId: scData1.sc.id, returnNumber: 'RET-1', status: ReturnStatus.PENDING_STORE_ACK, returnedById: baseUser.id
      }));
      ret2 = await queryRunner.manager.save(MaterialReturn, queryRunner.manager.create(MaterialReturn, {
        scId: scData2.sc.id, returnNumber: 'RET-2', status: ReturnStatus.PENDING_STORE_ACK, returnedById: baseUser.id
      }));

      // Order of items is intentionally swapped to simulate lock-ordering deadlock
      await queryRunner.manager.save(MaterialReturnItem, queryRunner.manager.create(MaterialReturnItem, {
        materialReturnId: ret1.id, rmItemId: scData1.rmItem.id, quantityReturned: 5
      }));
      await queryRunner.manager.save(MaterialReturnItem, queryRunner.manager.create(MaterialReturnItem, {
        materialReturnId: ret1.id, rmItemId: rmItem2_1.id, quantityReturned: 5
      }));

      await queryRunner.manager.save(MaterialReturnItem, queryRunner.manager.create(MaterialReturnItem, {
        materialReturnId: ret2.id, rmItemId: rmItem2_2.id, quantityReturned: 5
      }));
      await queryRunner.manager.save(MaterialReturnItem, queryRunner.manager.create(MaterialReturnItem, {
        materialReturnId: ret2.id, rmItemId: scData2.rmItem.id, quantityReturned: 5
      }));
    } finally {
      await queryRunner.release();
    }

    const payload1 = { destinationBinId: bin1.id };
    const payload2 = { destinationBinId: bin1.id };

    const res = await Promise.all([
      request(app.getHttpServer()).post(`/api/production/return/${ret1.id}/verify`).set('Authorization', `Bearer ${storesToken}`).send(payload1),
      request(app.getHttpServer()).post(`/api/production/return/${ret2.id}/verify`).set('Authorization', `Bearer ${storesToken}`).send(payload2)
    ]);

    expect(res[0].status).toBe(201);
    expect(res[1].status).toBe(201);

    const checkRunner = dataSource.createQueryRunner();
    await checkRunner.connect();
    const bal1 = await checkRunner.manager.query(`SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`, [product1.id, bin1.id]);
    const bal2 = await checkRunner.manager.query(`SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`, [product2.id, bin1.id]);
    await checkRunner.release();

    expect(Number(bal1[0].current_quantity)).toBe(110); // 100 + 5 + 5
    expect(Number(bal2[0].current_quantity)).toBe(10);  // 0 + 5 + 5 (ON CONFLICT DO UPDATE handles new rows)
  });
});
