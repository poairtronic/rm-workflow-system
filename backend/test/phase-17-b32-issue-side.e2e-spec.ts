import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';

describe('Phase 17 B3.2 - Issue Side (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let adminToken: string;
  let storesToken: string;
  let prodToken: string;

  // Test data IDs
  let customerId: string;
  let productId: string;
  let binId: string;
  let poId: string;
  let scId: string;
  let rmItemId: string;
  let additionalRequestId: string;

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
      email: `admin_${Date.now()}@test.com`,
      name: 'Admin Test',
      passwordHash: 'xx',
      roleId: adminRole!.id,
    }));
    adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });

    const storesUser = await userRepo.save(userRepo.create({
      email: `stores_${Date.now()}@test.com`,
      name: 'Stores Test',
      passwordHash: 'xx',
      roleId: storesRole!.id,
    }));
    storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });

    const prodUser = await userRepo.save(userRepo.create({
      email: `prod_${Date.now()}@test.com`,
      name: 'Prod Test',
      passwordHash: 'xx',
      roleId: prodRole!.id,
    }));
    prodToken = jwtService.sign({ sub: prodUser.id, userId: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });

    const uniqueStr = Date.now().toString();
    
    // Create Product (RM)
    const resProd = await dataSource.query(
      `INSERT INTO products (family_id, name, minimum_inventory, is_active) 
       VALUES ((SELECT id FROM product_families LIMIT 1), 'RM-B32-${uniqueStr}', 0, true) 
       RETURNING id`
    );
    productId = resProd[0].id;

    // Add stock (Bin & Balance)
    const resBin = await dataSource.query(
      `INSERT INTO bins (rack_id, code, name, is_active) 
       VALUES ((SELECT id FROM racks LIMIT 1), 'BIN-B32-${uniqueStr}', 'Test Bin', true) 
       RETURNING id`
    );
    binId = resBin[0].id;

    await dataSource.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity) 
       VALUES ($1, $2, 1000)`,
      [binId, productId]
    );

    // Create Draft RM -> submit
    const poNumber = `PO-${uniqueStr}`;
    const draftRes = await request(app.getHttpServer())
      .post('/api/rm/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        poNumber,
        scs: [
          {
            scNumber: `SC-${uniqueStr}`,
            productName: `Component ${uniqueStr}`,
            items: [
              {
                productId,
                spec: 'Grade A',
                quantity: 100,
              },
            ],
          },
        ],
      })
      .expect(201);
    
    poId = draftRes.body.poId;
    scId = draftRes.body.scs[0].scId; // SC

    // Submit RM
    await request(app.getHttpServer())
      .post(`/api/rm/po/${poId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    // Review RM to map product
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
        itemMappings: [
          {
            rmItemId,
            productId,
          },
        ],
        remarks: 'Reviewed',
      })
      .expect(201);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('should have SC in STORES_PENDING and appear in Stores Pending Grouped list', async () => {
    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(scDetail.body.status).toBe('STORES_PENDING');

    const groupedRes = await request(app.getHttpServer())
      .get('/api/sc/stores/pending-grouped')
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);
    
    const poGroup = groupedRes.body.find((g: any) => g.poId === poId);
    expect(poGroup).toBeDefined();
    expect(poGroup.scs.find((s: any) => s.id === scId)).toBeDefined();
  }, 30000);

  it('should allow Stores to issue 60% of the requested RM quantity', async () => {
    await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        scId,
        items: [
          {
            rmItemId,
            binId,
            quantityIssued: 60,
          },
        ],
        remarks: 'Partial issue 1',
      })
      .expect(201);

    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(scDetail.body.status).toBe('PARTIALLY_ISSUED');
  }, 30000);

  it('should allow Stores to issue the remaining 40%', async () => {
    await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        scId,
        items: [
          {
            rmItemId,
            binId,
            quantityIssued: 40,
          },
        ],
        remarks: 'Partial issue 2',
      })
      .expect(201);

    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(scDetail.body.status).toBe('ISSUED');
  }, 30000);

  it('should appear in Production Grouped list when ISSUED', async () => {
    const groupedRes = await request(app.getHttpServer())
      .get('/api/sc/production/grouped')
      .set('Authorization', `Bearer ${prodToken}`)
      .expect(200);
    
    const poGroup = groupedRes.body.find((g: any) => g.poId === poId);
    expect(poGroup).toBeDefined();
    expect(poGroup.scs.find((s: any) => s.id === scId)).toBeDefined();
  }, 30000);

  it('should allow Production to request extra material', async () => {
    const reqRes = await request(app.getHttpServer())
      .post('/api/additional-requests')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        scId,
        reason: 'WASTAGE',
        items: [
          {
            rmItemId,
            quantity: 10,
            remarks: 'Spilled',
          },
        ],
      })
      .expect(201);

    additionalRequestId = reqRes.body.id;

    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(scDetail.body.status).toBe('ADDITIONAL_REQUEST');
  }, 30000);

  it('should allow Stores to reject the extra material request and revert SC status', async () => {
    await request(app.getHttpServer())
      .post(`/api/additional-requests/${additionalRequestId}/reject`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({})
      .expect(201);

    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    // Status reverted to IN_PRODUCTION (as implemented in rejectRequest logic for already-started)
    expect(scDetail.body.status).toBe('IN_PRODUCTION');
  }, 30000);

  it('should allow Production to request again, and Stores to approve and issue', async () => {
    // Request again
    const reqRes = await request(app.getHttpServer())
      .post('/api/additional-requests')
      .set('Authorization', `Bearer ${prodToken}`)
      .send({
        scId,
        reason: 'DAMAGE',
        items: [
          {
            rmItemId,
            quantity: 5,
          },
        ],
      })
      .expect(201);

    const newReqId = reqRes.body.id;

    // Approve
    await request(app.getHttpServer())
      .post(`/api/additional-requests/${newReqId}/approve`)
      .set('Authorization', `Bearer ${storesToken}`)
      .send({})
      .expect(201);

    // Issue
    await request(app.getHttpServer())
      .post('/api/material-issues')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        scId,
        additionalRequestId: newReqId,
        items: [
          {
            rmItemId,
            binId,
            quantityIssued: 5,
          },
        ],
      })
      .expect(201);

    const scDetail = await request(app.getHttpServer())
      .get(`/api/sc/${scId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    expect(scDetail.body.status).toBe('IN_PRODUCTION');

    // Check request status
    const reqDetail = await request(app.getHttpServer())
      .get(`/api/additional-requests/${newReqId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reqDetail.body.status).toBe('ISSUED');
  }, 30000);
});
