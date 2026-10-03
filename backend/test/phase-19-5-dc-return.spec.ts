import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { DeliveryChallan, DeliveryChallanStatus, DeliveryChallanType } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../src/inventory/entities/stock-transaction.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';

describe('Phase 19.5 - Delivery Challan Return (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  
  let storesToken: string;
  let adminToken: string;
  let productionToken: string;
  
  let testVendorId: string;
  let testProductId: string;
  let testBinId: string;
  
  // Scenarios
  let dcFullReturnId: string;
  let dcFullReturnItemId: string;
  let dcPartialReturnId: string;
  let dcPartialReturnItemId: string;
  
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

    const userRepo = dataSource.getRepository('User');
    const roleRepo = dataSource.getRepository('Role');
    
    // Seed users/roles
    let storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    if (!storesRole) storesRole = await roleRepo.save({ name: UserRole.STORES });
    
    let adminRole = await roleRepo.findOne({ where: { name: UserRole.ADMIN } });
    if (!adminRole) adminRole = await roleRepo.save({ name: UserRole.ADMIN });

    let prodRole = await roleRepo.findOne({ where: { name: UserRole.PRODUCTION } });
    if (!prodRole) prodRole = await roleRepo.save({ name: UserRole.PRODUCTION });

    const rand = Date.now().toString();

    const storesUser = await userRepo.save({ name: `Stores 19-5 ${rand}`, email: `stores.19.5.${rand}@test.com`, passwordHash: 'hash', roleId: storesRole.id, isActive: true });
    const adminUser = await userRepo.save({ name: `Admin 19-5 ${rand}`, email: `admin.19.5.${rand}@test.com`, passwordHash: 'hash', roleId: adminRole.id, isActive: true });
    const prodUser = await userRepo.save({ name: `Prod 19-5 ${rand}`, email: `prod.19.5.${rand}@test.com`, passwordHash: 'hash', roleId: prodRole.id, isActive: true });

    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    productionToken = jwtService.sign({ sub: prodUser.id, userId: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });

    // Seed master data
    const vendorRepo = dataSource.getRepository('Vendor');
    const vendor = await vendorRepo.save({ code: `VND-19-5-${rand}`, name: 'Return Vendor', isActive: true });
    testVendorId = vendor.id;

    const catRepo = dataSource.getRepository('ProductCategory');
    const famRepo = dataSource.getRepository('ProductFamily');
    const productRepo = dataSource.getRepository('Product');
    const binRepo = dataSource.getRepository('Bin');
    const stockRepo = dataSource.getRepository(StockBalance);

    let cat = await catRepo.findOne({ where: { name: 'Raw Material' } });
    if (!cat) cat = await catRepo.save({ name: 'Raw Material', isActive: true });
    
    let fam = await famRepo.findOne({ where: { name: 'Metal' } });
    if (!fam) fam = await famRepo.save({ categoryId: cat.id, name: 'Metal', isActive: true });

    const product = await productRepo.save({ name: `Test Product Return ${rand}`, type: 'SEMI_FINISHED', categoryId: cat.id, familyId: fam.id, isActive: true, uom: 'kg' });
    testProductId = product.id;

    let bin = await binRepo.findOne({ where: {} });
    if (!bin) throw new Error('No bin found in db. Run seed:db');
    testBinId = bin.id;

    let stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    if (!stock) {
      await stockRepo.save({ productId: testProductId, binId: testBinId, currentQuantity: 500, createdById: storesUser.id });
    } else {
      stock.currentQuantity = 500;
      await stockRepo.save(stock);
    }

    // Seed Delivery Challans for testing
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    
    // DC 1: For Full Return
    const dc1 = await dcRepo.save({
      challanNumber: `DC-FULL-${rand}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      vendorId: testVendorId,
      dispatchDate: new Date(),
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: storesUser.id,
      items: [{
        productId: testProductId,
        binId: testBinId,
        quantityDispatched: 50,
        quantityReturned: 0,
      }],
    });
    dcFullReturnId = dc1.id;
    dcFullReturnItemId = dc1.items[0].id;

    // DC 2: For Partial Return
    const dc2 = await dcRepo.save({
      challanNumber: `DC-PART-${rand}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      vendorId: testVendorId,
      dispatchDate: new Date(),
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: storesUser.id,
      items: [{
        productId: testProductId,
        binId: testBinId,
        quantityDispatched: 100,
        quantityReturned: 0,
      }],
    });
    dcPartialReturnId = dc2.id;
    dcPartialReturnItemId = dc2.items[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('E2E-DC5-001: Should process a partial return successfully and increment stock', async () => {
    // Current stock: 500
    // Return 40 items against DC 2 (which has 100 dispatched)
    const payload = {
      actualReceiptDate: new Date().toISOString(),
      verificationRemarks: 'Received 40 units in good condition',
      items: [
        {
          itemId: dcPartialReturnItemId,
          quantityToReturn: 40,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post(`/api/delivery-challans/${dcPartialReturnId}/return`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload)
      .expect(201);

    expect(res.body.status).toBe(DeliveryChallanStatus.PARTIALLY_RETURNED);
    expect(res.body.verificationRemarks).toBe('Received 40 units in good condition');
    expect(res.body.verifiedById).toBeDefined();

    // Verify item quantityReturned
    const itemRepo = dataSource.getRepository(DeliveryChallanItem);
    const item = await itemRepo.findOne({ where: { id: dcPartialReturnItemId } });
    expect(Number(item!.quantityReturned)).toBe(40);
    expect(Number(item!.quantityDispatched)).toBe(100);

    // Verify Stock Increment (should be 540)
    const stockRepo = dataSource.getRepository(StockBalance);
    const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    expect(Number(stock!.currentQuantity)).toBe(540);

    // Verify Ledger Entry
    const txRepo = dataSource.getRepository(StockTransaction);
    const tx = await txRepo.findOne({ where: { referenceId: dcPartialReturnId, transactionType: TransactionType.RETURN } });
    expect(tx).toBeDefined();
    expect(Number(tx!.quantity)).toBe(40);
  });

  it('E2E-DC5-002: Should reject an over-return (returning more than outstanding)', async () => {
    // DC 2 has 100 dispatched, 40 returned. Outstanding = 60.
    // Try returning 70
    const payload = {
      actualReceiptDate: new Date().toISOString(),
      items: [
        {
          itemId: dcPartialReturnItemId,
          quantityToReturn: 70,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post(`/api/delivery-challans/${dcPartialReturnId}/return`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload)
      .expect(400);

    expect(res.body.message).toContain('Cannot return more than outstanding quantity');
  });

  it('E2E-DC5-003: Should process a full return and transition status to RETURNED', async () => {
    // DC 1 has 50 dispatched, 0 returned.
    const payload = {
      actualReceiptDate: new Date().toISOString(),
      items: [
        {
          itemId: dcFullReturnItemId,
          quantityToReturn: 50,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post(`/api/delivery-challans/${dcFullReturnId}/return`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload)
      .expect(201);

    expect(res.body.status).toBe(DeliveryChallanStatus.RETURNED);

    // Stock should now be 540 + 50 = 590
    const stockRepo = dataSource.getRepository(StockBalance);
    const stock = await stockRepo.findOne({ where: { productId: testProductId, binId: testBinId } });
    expect(Number(stock!.currentQuantity)).toBe(590);
  });

  it('E2E-DC5-004: Should deny access to unauthorized roles (PRODUCTION)', async () => {
    const payload = {
      actualReceiptDate: new Date().toISOString(),
      items: [
        {
          itemId: dcPartialReturnItemId,
          quantityToReturn: 10,
        },
      ],
    };

    await request(app.getHttpServer())
      .post(`/api/delivery-challans/${dcPartialReturnId}/return`)
      .set('Authorization', `Bearer ${productionToken}`)
      .send(payload)
      .expect(403);
  });
  
  it('E2E-DC5-005: Should reject returns on already fully RETURNED challan', async () => {
    const payload = {
      actualReceiptDate: new Date().toISOString(),
      items: [
        {
          itemId: dcFullReturnItemId,
          quantityToReturn: 1, // trying to return more
        },
      ],
    };

    await request(app.getHttpServer())
      .post(`/api/delivery-challans/${dcFullReturnId}/return`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload)
      .expect(400);
  });
});
