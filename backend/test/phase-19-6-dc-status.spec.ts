import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { Vendor } from '../src/vendor/entities/vendor.entity.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 19.6 - Delivery Challan Status Lifecycle (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let adminToken: string;
  let productionToken: string;

  const vendorId = uuidv4();
  
  let dc1Id: string;
  let dc2Id: string;
  let dc3Id: string;
  let dc4Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    // Mock Users
    const storesUser = { id: uuidv4(), email: `stores.19.6.${uuidv4()}@test.com` };
    const adminUser = { id: uuidv4(), email: `admin.19.6.${uuidv4()}@test.com` };
    const prodUser = { id: uuidv4(), email: `prod.19.6.${uuidv4()}@test.com` };

    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    productionToken = jwtService.sign({ sub: prodUser.id, userId: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${storesUser.id}', 'Stores User 19-6', '${storesUser.email}', 'hash', (SELECT id FROM "roles" WHERE "name"='STORES'), true),
        ('${adminUser.id}', 'Admin User 19-6', '${adminUser.email}', 'hash', (SELECT id FROM "roles" WHERE "name"='ADMIN'), true),
        ('${prodUser.id}', 'Prod User 19-6', '${prodUser.email}', 'hash', (SELECT id FROM "roles" WHERE "name"='PRODUCTION'), true)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = EXCLUDED."is_active", "email" = EXCLUDED."email"
    `);

    // Setup Master Data
    const vendorRepo = dataSource.getRepository(Vendor);
    await vendorRepo.save(vendorRepo.create({ id: vendorId, name: 'Vendor 19.6', code: `V-19-6-${uuidv4()}` }));

    // Create DC 1 (OPEN)
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    const dcItemRepo = dataSource.getRepository(DeliveryChallanItem);

    const dc1 = dcRepo.create({
      challanNumber: `DC-19-6-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.OPEN,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: new Date(),
      createdById: storesUser.id,
    });
    await dcRepo.save(dc1);
    dc1Id = dc1.id;

    // Create DC 2 (DISPATCHED)
    const dc2 = dcRepo.create({
      challanNumber: `DC-19-6-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.DISPATCHED,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: new Date(),
      createdById: storesUser.id,
    });
    await dcRepo.save(dc2);
    dc2Id = dc2.id;

    // Create DC 3 (PARTIALLY_RETURNED)
    const dc3 = dcRepo.create({
      challanNumber: `DC-19-6-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: new Date(),
      createdById: storesUser.id,
    });
    await dcRepo.save(dc3);
    dc3Id = dc3.id;

    // Create DC 4 (RETURNED)
    const dc4 = dcRepo.create({
      challanNumber: `DC-19-6-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.RETURNED,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: new Date(),
      createdById: storesUser.id,
    });
    await dcRepo.save(dc4);
    dc4Id = dc4.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('E2E-DC6-001: Should deny closure to unauthorized roles (PRODUCTION)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/delivery-challans/${dc2Id}/close`)
      .set('Authorization', `Bearer ${productionToken}`)
      .expect(403);
  });

  it('E2E-DC6-002: Should allow admin to close a DISPATCHED challan', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/delivery-challans/${dc2Id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.status).toBe(DeliveryChallanStatus.CLOSED);
  });

  it('E2E-DC6-003: Should allow stores role to close a PARTIALLY_RETURNED challan', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/delivery-challans/${dc3Id}/close`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    expect(res.body.status).toBe(DeliveryChallanStatus.CLOSED);
  });

  it('E2E-DC6-004: Should allow closing a RETURNED challan', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/delivery-challans/${dc4Id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.status).toBe(DeliveryChallanStatus.CLOSED);
  });

  it('E2E-DC6-005: Should reject closing an already CLOSED challan', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/delivery-challans/${dc2Id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.message).toContain('Challan is already closed');
  });

  it('E2E-DC6-006: Should reject closing an OPEN challan', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/delivery-challans/${dc1Id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.message).toContain('Cannot close an OPEN challan');
  });
});
