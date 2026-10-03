import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import { VendorProcessCapability } from '../src/vendor/entities/vendor-process-capability.entity.js';
import { VendorSla } from '../src/vendor/entities/vendor-sla.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { Bin } from '../src/inventory/entities/bin.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { SalesOrderComponent } from '../src/sc/entities/sc.entity.js';
import { DeliveryChallanType } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 19.2 — DC Type 1: Production Process Outward (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let designerToken: string;
  let testUserId: string;

  let testVendorId: string;
  let unapprovedVendorId: string;
  let testProcessId: string;
  let testProductId: string;
  let testBinId: string;
  let testScId: string;

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

    // Seed required test data
    const vendorRepo = dataSource.getRepository(Vendor);
    const processRepo = dataSource.getRepository(ProductionProcess);
    const capRepo = dataSource.getRepository(VendorProcessCapability);
    const slaRepo = dataSource.getRepository(VendorSla);
    const productRepo = dataSource.getRepository(Product);
    const binRepo = dataSource.getRepository(Bin);
    const stockRepo = dataSource.getRepository(StockBalance);
    const scRepo = dataSource.getRepository(SalesOrderComponent);

    const rand = Date.now().toString();

    const vendor = await vendorRepo.save({ code: `VND-T1-${rand}`, name: 'Test Vendor T1', isActive: true });
    testVendorId = vendor.id;
    const unapprovedVendor = await vendorRepo.save({ code: `VND-T1-UN-${rand}`, name: 'Unapproved Vendor', isActive: true });
    unapprovedVendorId = unapprovedVendor.id;

    const process = await processRepo.save({ code: `HT-01-${rand}`, name: 'Heat Treatment', description: 'HT Process', baseCost: 10, sequenceNumber: Math.floor(Math.random() * 100000) });
    testProcessId = process.id;

    await capRepo.save({ vendorId: testVendorId, processId: testProcessId, isApproved: true });
    await slaRepo.save({ vendorId: testVendorId, processId: testProcessId, slaDays: 5, effectiveDate: new Date(), isActive: true });

    let product = await productRepo.findOne({ where: {} });
    if (!product) {
      const catRepo = dataSource.getRepository('ProductCategory');
      const famRepo = dataSource.getRepository('ProductFamily');
      
      let cat = await catRepo.findOne({ where: { name: 'Raw Material' } });
      if (!cat) cat = await catRepo.save({ name: 'Raw Material', isActive: true });
      
      let fam = await famRepo.findOne({ where: { name: 'Metal' } });
      if (!fam) fam = await famRepo.save({ categoryId: cat.id, name: 'Metal', isActive: true });

      product = await productRepo.save({ code: `PRD-T1-${rand}`, name: 'Test Product T1', type: 'SEMI_FINISHED', categoryId: cat.id, familyId: fam.id, isActive: true, uom: 'kg' });
    }
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

    let sc = await scRepo.findOne({ where: {} });
    if (!sc) throw new Error('No SC found in db. Run seed:db');
    testScId = sc.id;

    const roleRepo = dataSource.getRepository('Role');
    let storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    if (!storesRole) storesRole = await roleRepo.save({ name: UserRole.STORES });

    let designerRole = await roleRepo.findOne({ where: { name: UserRole.DESIGNER } });
    if (!designerRole) designerRole = await roleRepo.save({ name: UserRole.DESIGNER });

    const userRepo = dataSource.getRepository('User');
    let storesUser = await userRepo.findOne({ where: { roleId: storesRole.id } });
    if (!storesUser) storesUser = await userRepo.save({ email: `stores-${rand}@test.com`, passwordHash: 'hash', roleId: storesRole.id, isActive: true, department: 'STORES', name: 'Store User' });
    
    let designerUser = await userRepo.findOne({ where: { roleId: designerRole.id } });
    if (!designerUser) designerUser = await userRepo.save({ email: `designer-${rand}@test.com`, passwordHash: 'hash', roleId: designerRole.id, isActive: true, department: 'DESIGN', name: 'Design User' });

    // Tokens
    storesToken = jwtService.sign({ sub: storesUser.id, role: UserRole.STORES, email: storesUser.email });
    designerToken = jwtService.sign({ sub: designerUser.id, role: UserRole.DESIGNER, email: designerUser.email });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('E2E-DC1-001: Should throw Forbidden when creating DC Type 1 with unauthorized role', async () => {
    const payload = {
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: testVendorId,
      scId: testScId,
      processId: testProcessId,
      dispatchDate: new Date().toISOString(),
      items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 10 }],
    };

    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-1')
      .set('Authorization', `Bearer ${designerToken}`) // Designer not allowed
      .send(payload);

    expect(res.status).toBe(403);
  });

  it('E2E-DC1-002: Should throw BadRequest when vendor is not approved for the production process', async () => {
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
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Vendor is not approved');
  });

  it('E2E-DC1-003: Should throw BadRequest when insufficient stock is available', async () => {
    const payload = {
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: testVendorId,
      scId: testScId,
      processId: testProcessId,
      dispatchDate: new Date().toISOString(),
      items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 9999 }], // More than 100
    };

    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-1')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Insufficient stock');
  });

  it('E2E-DC1-004: Should successfully create DC Type 1, compute SLA date, and deduct stock', async () => {
    const dispatchDate = new Date();
    const payload = {
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      vendorId: testVendorId,
      scId: testScId,
      processId: testProcessId,
      dispatchDate: dispatchDate.toISOString(),
      items: [{ productId: testProductId, binId: testBinId, quantityDispatched: 25 }],
    };

    const res = await request(app.getHttpServer())
      .post('/api/delivery-challans/type-1')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.challanNumber).toContain('DC-');
    expect(res.body.status).toBe('OPEN');

    // Expected return date should be dispatchDate + 5 days (from SLA)
    const expectedReturn = new Date(res.body.expectedReturnDate);
    const expectedExpectedReturn = new Date(dispatchDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    // Tolerate small timing diffs in parsing
    expect(Math.abs(expectedReturn.getTime() - expectedExpectedReturn.getTime())).toBeLessThan(1000);

    // Verify atomic inventory stock deduction
    const stockRepo = dataSource.getRepository(StockBalance);
    const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    expect(stock).toBeDefined();
    expect(Number(stock!.currentQuantity)).toBe(75); // 100 - 25
  });
});
