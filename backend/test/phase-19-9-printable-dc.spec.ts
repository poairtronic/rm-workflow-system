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

describe('Phase 19.9 - Printable DC Data Contract (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let designerToken: string;

  const vendorId = uuidv4();
  const storesUserId = uuidv4();
  const designerUserId = uuidv4();

  let dcId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const storesEmail = `stores.19.9.${uuidv4()}@test.com`;
    const designerEmail = `designer.19.9.${uuidv4()}@test.com`;

    storesToken = jwtService.sign({ sub: storesUserId, userId: storesUserId, email: storesEmail, role: UserRole.STORES, roles: [UserRole.STORES] });
    designerToken = jwtService.sign({ sub: designerUserId, userId: designerUserId, email: designerEmail, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });

    await dataSource.query(`
      INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "is_active")
      VALUES
        ('${storesUserId}', 'Stores 19-9', '${storesEmail}', 'hash', (SELECT id FROM "roles" WHERE "name"='STORES'), true),
        ('${designerUserId}', 'Designer 19-9', '${designerEmail}', 'hash', (SELECT id FROM "roles" WHERE "name"='DESIGNER'), true)
      ON CONFLICT ("id") DO UPDATE SET "is_active" = EXCLUDED."is_active", "email" = EXCLUDED."email"
    `);

    // Vendor
    const vendorRepo = dataSource.getRepository(Vendor);
    await vendorRepo.save(vendorRepo.create({
      id: vendorId,
      name: 'Print Test Vendor',
      code: `V-19-9-${uuidv4()}`,
      address: '123, Industrial Zone, Test City',
      contactPerson: 'Vendor Contact',
      phone: '+91-9876543210',
      email: 'vendor@print-test.com',
      category: 'MACHINING',
    }));

    // DC (Type 2 — no SC/process references)
    const dcRepo = dataSource.getRepository(DeliveryChallan);
    const dc = dcRepo.create({
      challanNumber: `DC-19-9-${uuidv4()}`,
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.DISPATCHED,
      vendorId,
      dispatchDate: new Date('2026-10-01T09:00:00Z'),
      expectedReturnDate: new Date('2026-10-08T09:00:00Z'),
      notes: 'Sent for surface treatment',
      createdById: storesUserId,
    });
    await dcRepo.save(dc);
    dcId = dc.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Happy Path ────────────────────────────────────────────────────────────

  it('E2E-DC9-001: GET /api/delivery-challans/:id/printable returns 200 for STORES role', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('E2E-DC9-002: Response contains top-level keys: company, challan, vendor, references, lineItems, audit, generatedAt', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const body = res.body;
    expect(body).toHaveProperty('company');
    expect(body).toHaveProperty('challan');
    expect(body).toHaveProperty('vendor');
    expect(body).toHaveProperty('references');
    expect(body).toHaveProperty('lineItems');
    expect(body).toHaveProperty('audit');
    expect(body).toHaveProperty('generatedAt');
  });

  it('E2E-DC9-003: challan section contains all mandatory fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const c = res.body.challan;
    expect(c).toHaveProperty('id', dcId);
    expect(c).toHaveProperty('challanNumber');
    expect(typeof c.challanNumber).toBe('string');
    expect(c.challanNumber.length).toBeGreaterThan(0);
    expect(c).toHaveProperty('type');
    expect(c).toHaveProperty('status');
    expect(c).toHaveProperty('dispatchDate');
    expect(c).toHaveProperty('expectedReturnDate');
    expect(c).toHaveProperty('actualReturnDate'); // nullable — can be null
    expect(c).toHaveProperty('notes', 'Sent for surface treatment');
  });

  it('E2E-DC9-004: vendor section contains code, name, address, contactPerson, phone, email', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const v = res.body.vendor;
    expect(v).toHaveProperty('id', vendorId);
    expect(v).toHaveProperty('code');
    expect(v).toHaveProperty('name', 'Print Test Vendor');
    expect(v).toHaveProperty('address', '123, Industrial Zone, Test City');
    expect(v).toHaveProperty('contactPerson', 'Vendor Contact');
    expect(v).toHaveProperty('phone', '+91-9876543210');
    expect(v).toHaveProperty('email', 'vendor@print-test.com');
    expect(v).toHaveProperty('category', 'MACHINING');
  });

  it('E2E-DC9-005: Type 2 challan has null SC, PO, and process references', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const refs = res.body.references;
    expect(refs.sc).toBeNull();
    expect(refs.po).toBeNull();
    expect(refs.process).toBeNull();
  });

  it('E2E-DC9-006: lineItems is an array (may be empty since no items were dispatched in this seed)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    expect(Array.isArray(res.body.lineItems)).toBe(true);
  });

  it('E2E-DC9-007: audit section contains required sign-off and T&C fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const audit = res.body.audit;
    expect(audit).toHaveProperty('createdById', storesUserId);
    expect(audit).toHaveProperty('createdAt');
    expect(audit).toHaveProperty('authorizedSignatory');
    expect(audit).toHaveProperty('termsAndConditions');
    expect(typeof audit.termsAndConditions).toBe('string');
    expect(audit.termsAndConditions.length).toBeGreaterThan(0);
  });

  it('E2E-DC9-008: company section has at least name and address', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    const co = res.body.company;
    expect(co).toHaveProperty('name');
    expect(typeof co.name).toBe('string');
    expect(co.name.length).toBeGreaterThan(0);
    expect(co).toHaveProperty('address');
  });

  it('E2E-DC9-009: generatedAt is a valid ISO 8601 string', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(200);

    expect(typeof res.body.generatedAt).toBe('string');
    expect(new Date(res.body.generatedAt).toISOString()).toBe(res.body.generatedAt);
  });

  // ─── RBAC Guard ───────────────────────────────────────────────────────────

  it('E2E-DC9-010: DESIGNER role is rejected (403) from the printable endpoint', async () => {
    await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .set('Authorization', `Bearer ${designerToken}`)
      .expect(403);
  });

  it('E2E-DC9-011: Unauthenticated request is rejected (401)', async () => {
    await request(app.getHttpServer())
      .get(`/api/delivery-challans/${dcId}/printable`)
      .expect(401);
  });

  // ─── 404 Handling ─────────────────────────────────────────────────────────

  it('E2E-DC9-012: Non-existent challan ID returns 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/delivery-challans/${uuidv4()}/printable`)
      .set('Authorization', `Bearer ${storesToken}`)
      .expect(404);
  });
});
