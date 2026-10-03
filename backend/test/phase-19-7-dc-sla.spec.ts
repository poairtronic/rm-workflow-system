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
import { v4 as uuidv4 } from 'uuid';

describe('Phase 19.7 - DC SLA Engine (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let adminToken: string;

  const vendorId = uuidv4();
  
  let dcOverdueId: string;
  let dcNotOverdueId: string;
  let dcClosedId: string;

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
    const storesUser = { id: uuidv4(), email: `stores.19.7.${uuidv4()}@test.com` };
    const adminUser = { id: uuidv4(), email: `admin.19.7.${uuidv4()}@test.com` };

    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES 
        ('${storesUser.id}', 'Stores User 19-7', '${storesUser.email}', 'hash', (SELECT id FROM "roles" WHERE "name"='STORES'), true),
        ('${adminUser.id}', 'Admin User 19-7', '${adminUser.email}', 'hash', (SELECT id FROM "roles" WHERE "name"='ADMIN'), true)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = EXCLUDED."is_active", "email" = EXCLUDED."email"
    `);

    // Setup Master Data
    const vendorRepo = dataSource.getRepository(Vendor);
    await vendorRepo.save(vendorRepo.create({ id: vendorId, name: 'Vendor 19.7', code: `V-19-7-${uuidv4()}` }));

    const dcRepo = dataSource.getRepository(DeliveryChallan);

    // 1. Overdue Challan (DISPATCHED, expected return in the past)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const dcOverdue = dcRepo.create({
      challanNumber: `DC-19-7-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.DISPATCHED,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: yesterday,
      createdById: storesUser.id,
    });
    await dcRepo.save(dcOverdue);
    dcOverdueId = dcOverdue.id;

    // 2. Not Overdue Challan (DISPATCHED, expected return in the future)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dcNotOverdue = dcRepo.create({
      challanNumber: `DC-19-7-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.DISPATCHED,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: tomorrow,
      createdById: storesUser.id,
    });
    await dcRepo.save(dcNotOverdue);
    dcNotOverdueId = dcNotOverdue.id;

    // 3. Overdue but CLOSED Challan (should not show up in overdue list)
    const dcClosed = dcRepo.create({
      challanNumber: `DC-19-7-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.CLOSED,
      vendorId: vendorId,
      dispatchDate: new Date(),
      expectedReturnDate: yesterday,
      createdById: storesUser.id,
    });
    await dcRepo.save(dcClosed);
    dcClosedId = dcClosed.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('E2E-DC7-001: Should list only open overdue challans at /api/delivery-challans/overdue', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/delivery-challans/overdue')
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const overdueIds = res.body.map((dc: any) => dc.id);

    // Overdue open should be included
    expect(overdueIds).toContain(dcOverdueId);

    // Not overdue open should NOT be included
    expect(overdueIds).not.toContain(dcNotOverdueId);

    // Overdue closed should NOT be included
    expect(overdueIds).not.toContain(dcClosedId);
  });

  it('E2E-DC7-002: Should list only open overdue challans at /api/delivery-challans?isOverdue=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/delivery-challans?isOverdue=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const overdueIds = res.body.map((dc: any) => dc.id);

    expect(overdueIds).toContain(dcOverdueId);
    expect(overdueIds).not.toContain(dcNotOverdueId);
    expect(overdueIds).not.toContain(dcClosedId);
  });
});
