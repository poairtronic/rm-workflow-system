import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 17 B3.1: RM Drafts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let designerToken1: string;
  let designerToken2: string;
  let storesToken: string;
  let productId: string;
  let productId2: string;
  let testUserId1: string;
  let testUserId2: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(Role);
    const designerRole = await roleRepo.findOne({ where: { name: UserRole.DESIGNER } });
    const storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });

    const u1 = await userRepo.save(userRepo.create({
      email: `d1_${Date.now()}@test.com`,
      name: 'D1 T',
      passwordHash: 'xx',
      roleId: designerRole!.id,
    }));
    testUserId1 = u1.id;
    designerToken1 = jwtService.sign({ sub: u1.id, userId: u1.id, email: u1.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });

    const u2 = await userRepo.save(userRepo.create({
      email: `d2_${Date.now()}@test.com`,
      name: 'D2 T',
      passwordHash: 'xx',
      roleId: designerRole!.id,
    }));
    testUserId2 = u2.id;
    designerToken2 = jwtService.sign({ sub: u2.id, userId: u2.id, email: u2.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });

    const s1 = await userRepo.save(userRepo.create({
      email: `s1_${Date.now()}@test.com`,
      name: 'S1 T',
      passwordHash: 'xx',
      roleId: storesRole!.id,
    }));
    storesToken = jwtService.sign({ sub: s1.id, userId: s1.id, email: s1.email, role: UserRole.STORES, roles: [UserRole.STORES] });

    // Create a product
    const resProd = await dataSource.query(`INSERT INTO products (family_id, name, minimum_inventory, is_active) VALUES ((SELECT id FROM product_families LIMIT 1), 'DraftTestProd_${Date.now()}', 10, true) RETURNING id`);
    productId = resProd[0].id;

    const resProd2 = await dataSource.query(`INSERT INTO products (family_id, name, minimum_inventory, is_active) VALUES ((SELECT id FROM product_families LIMIT 1), 'DraftTestProd2_${Date.now()}', 10, true) RETURNING id`);
    productId2 = resProd2[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  const poNumber = `PO-DRAFT-${Date.now()}`;

  it('should create draft RMs for two SCs under one PO and then edit via PUT', async () => {
    // CREATE
    console.log('1. CREATE');
    let res = await request(app.getHttpServer())
      .post('/api/rm/draft')
      .set('Authorization', `Bearer ${designerToken1}`)
      .send({
        poNumber,
        scs: [
          {
            scNumber: `${poNumber}-1`,
            productName: 'Test Widget 1',
            items: [{ productId, spec: 'EN31', quantity: 10 }]
          },
          {
            scNumber: `${poNumber}-2`,
            productName: 'Test Widget 2',
            items: [{ productId: productId2, spec: 'EN8', quantity: 20 }]
          }
        ]
      });

    console.log('1. CREATE done');
    expect(res.status).toBe(201);
    const poId = res.body.poId;
    expect(poId).toBeDefined();

    console.log('2. GET as STORES');
    // STORES CANNOT SEE DRAFT
    const storesRes = await request(app.getHttpServer())
      .get(`/api/rm/po/${poId}/draft`)
      .set('Authorization', `Bearer ${storesToken}`);
    expect(storesRes.status).toBe(403);
    console.log('2. GET as STORES done');

    console.log('3. PUT as DESIGNER 2');
    // SECOND DESIGNER CANNOT EDIT FIRST DESIGNER'S DRAFT
    const des2Res = await request(app.getHttpServer())
      .put(`/api/rm/po/${poId}/draft`)
      .set('Authorization', `Bearer ${designerToken2}`)
      .send({
        poNumber,
        scs: [
           { scNumber: `${poNumber}-1`, productName: 'Test Widget 1', items: [{ productId, spec: 'EN31', quantity: 10 }] }
        ]
      });
    expect(des2Res.status).toBe(409); // ConflictException or 404
    console.log('3. PUT as DESIGNER 2 done');

    console.log('4. PUT as DESIGNER 1');
    // EDIT VIA PUT (remove SC2, add SC3, change SC1 quantity)
    res = await request(app.getHttpServer())
      .put(`/api/rm/po/${poId}/draft`)
      .set('Authorization', `Bearer ${designerToken1}`)
      .send({
        poNumber,
        scs: [
          {
            scNumber: `${poNumber}-1`,
            productName: 'Test Widget 1',
            items: [{ productId, spec: 'EN31', quantity: 15 }] // qty changed
          },
          {
            scNumber: `${poNumber}-3`,
            productName: 'Test Widget 3',
            items: [{ productId, spec: 'EN31', quantity: 30 }] // new
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.scs).toHaveLength(2);
    const scs = res.body.scs;
    expect(scs.find(s => s.scNumber === `${poNumber}-1`).items[0].quantity).toBe('15.000');
    expect(scs.find(s => s.scNumber === `${poNumber}-3`)).toBeDefined();
    console.log('4. PUT as DESIGNER 1 done');

    console.log('5. SUBMIT');
    // SUBMIT
    const submitRes = await request(app.getHttpServer())
      .post(`/api/rm/po/${poId}/submit`)
      .set('Authorization', `Bearer ${designerToken1}`);
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.submittedScs).toHaveLength(2);
    console.log('5. SUBMIT done');

    console.log('6. PUT AFTER SUBMIT');
    // PUT AFTER SUBMIT MUST NOT ALTER SUBMITTED SCs
    const afterSubmitRes = await request(app.getHttpServer())
      .put(`/api/rm/po/${poId}/draft`)
      .set('Authorization', `Bearer ${designerToken1}`)
      .send({
        poNumber,
        scs: [
          {
            scNumber: `${poNumber}-1`,
            productName: 'Test Widget 1',
            items: [{ productId, spec: 'EN31', quantity: 999 }]
          }
        ]
      });
    expect(afterSubmitRes.status).toBe(409); // ConflictException: already has non-DRAFT
    console.log('6. PUT AFTER SUBMIT done');
  }, 60000);
});
