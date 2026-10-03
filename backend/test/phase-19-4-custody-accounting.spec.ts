import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { ProductCategory } from '../src/inventory/entities/product-category.entity.js';
import { ProductFamily } from '../src/inventory/entities/product-family.entity.js';
import { DeliveryChallanType } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';

describe('Phase 19.4 — DC Stock/Custody Accounting (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;

  let testVendorId: string;
  let testProductId: string;
  let testBinId: string;
  let dcItemId: string;

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

    const vendorRepo = dataSource.getRepository(Vendor);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);
    const stockRepo = dataSource.getRepository(StockBalance);
    const catRepo = dataSource.getRepository(ProductCategory);
    const famRepo = dataSource.getRepository(ProductFamily);

    const rand = Math.floor(Math.random() * 1000000);

    // Setup Test Data
    const vendor = await vendorRepo.save({
      code: `V-CUST-${rand}`,
      name: `Custody Vendor ${rand}`,
      isActive: true,
    });
    testVendorId = vendor.id;

    let cat = await catRepo.findOne({ where: { name: 'Raw Material' } });
    if (!cat) cat = await catRepo.save({ name: 'Raw Material', isActive: true });
    
    let fam = await famRepo.findOne({ where: { name: 'Metal' } });
    if (!fam) fam = await famRepo.save({ categoryId: cat.id, name: 'Metal', isActive: true });

    const product = await productRepo.save({ 
      code: `PRD-CUST-${rand}`, 
      name: `Custody Product ${rand}`, 
      type: 'SEMI_FINISHED', 
      categoryId: cat.id, 
      familyId: fam.id, 
      isActive: true, 
      uom: 'kg' 
    });
    testProductId = product.id;

    let bin = await binRepo.findOne({ where: {} });
    if (!bin) throw new Error('No bin found in db. Run seed:db');
    testBinId = bin.id;

    let stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    if (!stock) {
      await stockRepo.save({
        productId: testProductId,
        binId: testBinId,
        currentQuantity: 500,
        minStockLevel: 0,
        maxStockLevel: 1000,
      });
    } else {
      stock.currentQuantity = 500;
      await stockRepo.save(stock);
    }

    // Auth
    const roleRepo = dataSource.getRepository('Role');
    let storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    if (!storesRole) storesRole = await roleRepo.save({ name: UserRole.STORES });

    const userRepo = dataSource.getRepository('User');
    let storesUser = await userRepo.findOne({ where: { roleId: storesRole.id } });
    if (!storesUser) storesUser = await userRepo.save({ email: `stores-cust-${rand}@test.com`, passwordHash: 'hash', roleId: storesRole.id, isActive: true, department: 'STORES', name: 'Store Custody User' });

    storesToken = jwtService.sign({ sub: storesUser.id, role: UserRole.STORES, email: storesUser.email });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('E2E-DC4-001: Should create a DC and verify initial custody aggregates', async () => {
    // 1. Create a DC Type 2
    const payload = {
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      vendorId: testVendorId,
      dispatchDate: new Date().toISOString(),
      items: [
        {
          productId: testProductId,
          binId: testBinId,
          quantityDispatched: 50,
        },
      ],
    };

    const dcRes = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-2')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(dcRes.status).toBe(201);
    
    // We need the dcItemId to mock a partial return later
    const dcId = dcRes.body.id;
    const itemRepo = dataSource.getRepository(DeliveryChallanItem);
    const dcItem = await itemRepo.findOne({ where: { challanId: dcId } });
    expect(dcItem).toBeDefined();
    dcItemId = dcItem!.id;

    // 2. Query Vendor Custody Summary
    const vendorRes = await request(app.getHttpServer())
      .get(`/api/delivery-challans/custody/vendor/${testVendorId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(vendorRes.status).toBe(200);
    expect(Array.isArray(vendorRes.body)).toBe(true);
    
    const vendorItem = vendorRes.body.find((item: any) => item.productId === testProductId);
    expect(vendorItem).toBeDefined();
    expect(vendorItem.quantityDispatched).toBe(50);
    expect(vendorItem.quantityReturned).toBe(0);
    expect(vendorItem.outstandingQuantity).toBe(50);

    // 3. Query Product Custody Total
    const prodRes = await request(app.getHttpServer())
      .get(`/api/delivery-challans/custody/product/${testProductId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(prodRes.status).toBe(200);
    expect(prodRes.body.productId).toBe(testProductId);
    expect(prodRes.body.totalOutstanding).toBe(50);
  });

  it('E2E-DC4-002: Should accurately calculate custody after a simulated partial return', async () => {
    // 1. Manually update the DC item to simulate a partial return
    const itemRepo = dataSource.getRepository(DeliveryChallanItem);
    await itemRepo.update(dcItemId, { quantityReturned: 20 }); // Returned 20, Outstanding 30

    // 2. Query Vendor Custody Summary
    const vendorRes = await request(app.getHttpServer())
      .get(`/api/delivery-challans/custody/vendor/${testVendorId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(vendorRes.status).toBe(200);
    const vendorItem = vendorRes.body.find((item: any) => item.productId === testProductId);
    expect(vendorItem).toBeDefined();
    expect(vendorItem.quantityDispatched).toBe(50);
    expect(vendorItem.quantityReturned).toBe(20);
    expect(vendorItem.outstandingQuantity).toBe(30);

    // 3. Query Product Custody Total
    const prodRes = await request(app.getHttpServer())
      .get(`/api/delivery-challans/custody/product/${testProductId}`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(prodRes.status).toBe(200);
    expect(prodRes.body.totalOutstanding).toBe(30);
  });
});
