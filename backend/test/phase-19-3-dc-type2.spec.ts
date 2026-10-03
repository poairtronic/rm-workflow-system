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

describe('Phase 19.3 — DC Type 2: General Inventory Outward (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let designerToken: string;

  let testVendorId: string;
  let inactiveVendorId: string;
  let testProductId: string;
  let testBinId: string;

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

    // Active Vendor
    const vendor = await vendorRepo.save({
      code: `V-T2-${rand}`,
      name: 'Test Type 2 Vendor',
      isActive: true,
    });
    testVendorId = vendor.id;

    // Inactive Vendor
    const inactiveVendor = await vendorRepo.save({
      code: `V-T2-INACT-${rand}`,
      name: 'Inactive Type 2 Vendor',
      isActive: false,
    });
    inactiveVendorId = inactiveVendor.id;

    // Product & Bin
    let cat = await catRepo.findOne({ where: { name: 'Raw Material' } });
    if (!cat) cat = await catRepo.save({ name: 'Raw Material', isActive: true });
    
    let fam = await famRepo.findOne({ where: { name: 'Metal' } });
    if (!fam) fam = await famRepo.save({ categoryId: cat.id, name: 'Metal', isActive: true });

    const product = await productRepo.save({ 
      code: `PRD-T2-${rand}`, 
      name: `Test Product T2 ${rand}`, 
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
        currentQuantity: 100,
        minStockLevel: 0,
        maxStockLevel: 1000,
      });
    } else {
      stock.currentQuantity = 100;
      await stockRepo.save(stock);
    }

    // Auth
    const roleRepo = dataSource.getRepository('Role');
    let storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    if (!storesRole) storesRole = await roleRepo.save({ name: UserRole.STORES });

    let designerRole = await roleRepo.findOne({ where: { name: UserRole.DESIGNER } });
    if (!designerRole) designerRole = await roleRepo.save({ name: UserRole.DESIGNER });

    const userRepo = dataSource.getRepository('User');
    let storesUser = await userRepo.findOne({ where: { roleId: storesRole.id } });
    if (!storesUser) storesUser = await userRepo.save({ email: `stores-t2-${rand}@test.com`, passwordHash: 'hash', roleId: storesRole.id, isActive: true, department: 'STORES', name: 'Store User T2' });
    
    let designerUser = await userRepo.findOne({ where: { roleId: designerRole.id } });
    if (!designerUser) designerUser = await userRepo.save({ email: `designer-t2-${rand}@test.com`, passwordHash: 'hash', roleId: designerRole.id, isActive: true, department: 'DESIGN', name: 'Design User T2' });

    storesToken = jwtService.sign({ sub: storesUser.id, role: UserRole.STORES, email: storesUser.email });
    designerToken = jwtService.sign({ sub: designerUser.id, role: UserRole.DESIGNER, email: designerUser.email });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('E2E-DC2-001: Should throw Forbidden when creating DC Type 2 with unauthorized role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-2')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: testVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 10 }],
      });

    expect(res.status).toBe(403);
  });

  it('E2E-DC2-002: Should throw BadRequest when vendor is inactive', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-2')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: inactiveVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Vendor not found or inactive');
  });

  it('E2E-DC2-003: Should throw BadRequest when insufficient stock is available', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-2')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: testVendorId,
        dispatchDate: new Date().toISOString(),
        items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 200 }], // Only 100 available
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Insufficient stock');
  });

  it('E2E-DC2-004: Should successfully create DC Type 2 and deduct stock', async () => {
    const payload = {
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      vendorId: testVendorId,
      dispatchDate: new Date().toISOString(),
      notes: 'General outward testing',
      items: [
        {
          productId: testProductId,
          binId: testBinId,
          quantityDispatched: 30, // 100 - 30 = 70 remaining
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-2')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.challanNumber).toContain('DC-');
    expect(res.body.type).toBe(DeliveryChallanType.GENERAL_INVENTORY_OUTWARD);
    expect(res.body.scId).toBeNull(); // Optional field check
    expect(res.body.processId).toBeNull(); // Optional field check

    // Verify atomic inventory stock deduction
    const stockRepo = dataSource.getRepository(StockBalance);
    const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    expect(stock).toBeDefined();
    expect(Number(stock!.currentQuantity)).toBe(70); // 100 - 30
  });
});
