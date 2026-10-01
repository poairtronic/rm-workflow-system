import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { MslStockStatus } from '../src/inventory/msl-calculation.service.js';

describe('Phase 17.3 & 17.4 — MSL HTTP API Verification (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const TEST_PREFIX = `msl_e2e_${Date.now()}`;
  let storesUserId: string;
  let storesToken: string;
  let productionUserId: string;
  let productionToken: string;

  let warehouseId: string;
  let locationId: string;
  let rackId: string;
  let bin1Id: string;
  let bin2Id: string;

  let categoryId: string;
  let familyId: string;
  let productLowId: string;
  let productOutId: string;
  let productNormalId: string;
  let productExcessId: string;

  beforeAll(async () => {
    // 1. Direct PG Client for seeding test fixtures
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();

    // 2. Fetch or create Roles
    let storesRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'STORES' LIMIT 1`);
    if (!storesRoleRes.rows.length) {
      await pgClient.query(`INSERT INTO roles (name) VALUES ('STORES') ON CONFLICT (name) DO NOTHING`);
      storesRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'STORES' LIMIT 1`);
    }
    const storesRoleId = storesRoleRes.rows[0].id;

    let prodRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'PRODUCTION' LIMIT 1`);
    if (!prodRoleRes.rows.length) {
      await pgClient.query(`INSERT INTO roles (name) VALUES ('PRODUCTION') ON CONFLICT (name) DO NOTHING`);
      prodRoleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'PRODUCTION' LIMIT 1`);
    }
    const prodRoleId = prodRoleRes.rows[0].id;

    // 3. Create Users
    const u1 = await pgClient.query(
      `INSERT INTO users (name, email, password_hash, role_id, is_active)
       VALUES ($1, $2, 'hash', $3, true) RETURNING id`,
      [`Stores MSL ${TEST_PREFIX}`, `${TEST_PREFIX}_stores@example.com`, storesRoleId],
    );
    storesUserId = u1.rows[0].id;

    const u2 = await pgClient.query(
      `INSERT INTO users (name, email, password_hash, role_id, is_active)
       VALUES ($1, $2, 'hash', $3, true) RETURNING id`,
      [`Prod MSL ${TEST_PREFIX}`, `${TEST_PREFIX}_prod@example.com`, prodRoleId],
    );
    productionUserId = u2.rows[0].id;

    const jwtSecret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    storesToken = jwt.sign(
      { sub: storesUserId, email: `${TEST_PREFIX}_stores@example.com`, role: UserRole.STORES, roles: [UserRole.STORES] },
      jwtSecret,
    );
    productionToken = jwt.sign(
      { sub: productionUserId, email: `${TEST_PREFIX}_prod@example.com`, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] },
      jwtSecret,
    );

    // 4. Warehouse & Bins
    const wh = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active) VALUES ($1, $2, true) RETURNING id`,
      [`WH-MSL-${TEST_PREFIX}`, `W-${TEST_PREFIX.substring(0, 10)}`],
    );
    warehouseId = wh.rows[0].id;

    const loc = await pgClient.query(
      `INSERT INTO warehouse_locations (warehouse_id, code, name, is_active) VALUES ($1, $2, 'Loc 1', true) RETURNING id`,
      [warehouseId, `L-${TEST_PREFIX.substring(0, 10)}`],
    );
    locationId = loc.rows[0].id;

    const rack = await pgClient.query(
      `INSERT INTO racks (location_id, code, name, is_active) VALUES ($1, $2, 'Rack 1', true) RETURNING id`,
      [locationId, `R-${TEST_PREFIX.substring(0, 10)}`],
    );
    rackId = rack.rows[0].id;

    const b1 = await pgClient.query(
      `INSERT INTO bins (rack_id, code, name, is_active) VALUES ($1, $2, 'Bin 1', true) RETURNING id`,
      [rackId, `B1-${TEST_PREFIX.substring(0, 9)}`],
    );
    bin1Id = b1.rows[0].id;

    const b2 = await pgClient.query(
      `INSERT INTO bins (rack_id, code, name, is_active) VALUES ($1, $2, 'Bin 2', true) RETURNING id`,
      [rackId, `B2-${TEST_PREFIX.substring(0, 9)}`],
    );
    bin2Id = b2.rows[0].id;

    // 5. Product Category & Family
    const cat = await pgClient.query(
      `INSERT INTO product_categories (name, is_active) VALUES ($1, true) RETURNING id`,
      [`Cat-${TEST_PREFIX}`],
    );
    categoryId = cat.rows[0].id;

    const fam = await pgClient.query(
      `INSERT INTO product_families (category_id, name, is_active) VALUES ($1, $2, true) RETURNING id`,
      [categoryId, `Fam-${TEST_PREFIX}`],
    );
    familyId = fam.rows[0].id;

    // 6. Create 4 Products representing each MSL condition:
    // P1: LOW_STOCK: MSL 100, Max 500. Total stock = 40 (Bin1: 25, Bin2: 15)
    const pLow = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 100.000, 500.000, true) RETURNING id`,
      [familyId, `Prod-Low-${TEST_PREFIX}`],
    );
    productLowId = pLow.rows[0].id;
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 25.000, 25.000)`,
      [bin1Id, productLowId],
    );
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 15.000, 15.000)`,
      [bin2Id, productLowId],
    );

    // P2: OUT_OF_STOCK: MSL 50, Max 200. Total stock = 0
    const pOut = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 50.000, 200.000, true) RETURNING id`,
      [familyId, `Prod-Out-${TEST_PREFIX}`],
    );
    productOutId = pOut.rows[0].id;
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 0.000, 0.000)`,
      [bin1Id, productOutId],
    );

    // P3: NORMAL: MSL 50, Max 300. Total stock = 120 (Bin1: 60, Bin2: 60)
    const pNorm = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 50.000, 300.000, true) RETURNING id`,
      [familyId, `Prod-Norm-${TEST_PREFIX}`],
    );
    productNormalId = pNorm.rows[0].id;
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 60.000, 60.000)`,
      [bin1Id, productNormalId],
    );
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 60.000, 60.000)`,
      [bin2Id, productNormalId],
    );

    // P4: EXCESS: MSL 20, Max 80. Total stock = 100 (Bin1: 50, Bin2: 50)
    const pExc = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 20.000, 80.000, true) RETURNING id`,
      [familyId, `Prod-Exc-${TEST_PREFIX}`],
    );
    productExcessId = pExc.rows[0].id;
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 50.000, 50.000)`,
      [bin1Id, productExcessId],
    );
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance) VALUES ($1, $2, 50.000, 50.000)`,
      [bin2Id, productExcessId],
    );

    // 7. Boot NestJS AppModule
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 45000);

  afterAll(async () => {
    try {
      if (app) {
        await app.close();
      }
      if (pgClient) {
        await pgClient.query(`DELETE FROM msl_alerts WHERE product_id IN ($1, $2, $3, $4)`, [
          productLowId,
          productOutId,
          productNormalId,
          productExcessId,
        ]);
        await pgClient.query(`DELETE FROM stock_balances WHERE product_id IN ($1, $2, $3, $4)`, [
          productLowId,
          productOutId,
          productNormalId,
          productExcessId,
        ]);
        await pgClient.query(`DELETE FROM products WHERE id IN ($1, $2, $3, $4)`, [
          productLowId,
          productOutId,
          productNormalId,
          productExcessId,
        ]);
        await pgClient.query(`DELETE FROM product_families WHERE id = $1`, [familyId]);
        await pgClient.query(`DELETE FROM product_categories WHERE id = $1`, [categoryId]);
        await pgClient.query(`DELETE FROM bins WHERE id IN ($1, $2)`, [bin1Id, bin2Id]);
        await pgClient.query(`DELETE FROM racks WHERE id = $1`, [rackId]);
        await pgClient.query(`DELETE FROM warehouse_locations WHERE id = $1`, [locationId]);
        await pgClient.query(`DELETE FROM warehouses WHERE id = $1`, [warehouseId]);
        await pgClient.query(`DELETE FROM users WHERE id IN ($1, $2)`, [storesUserId, productionUserId]);
        await pgClient.end();
      }
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. Authentication & RBAC Guard Testing on MSL Endpoints', () => {
    it('MSL_HTTP_01: GET /api/inventory/msl rejects unauthenticated requests with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/inventory/msl');
      expect(res.status).toBe(401);
    });

    it('MSL_HTTP_02: GET /api/inventory/msl allows PRODUCTION role to query MSL status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl')
        .set('Authorization', `Bearer ${productionToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('MSL_HTTP_03: POST /api/inventory/msl/evaluate rejects PRODUCTION role with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/msl/evaluate')
        .set('Authorization', `Bearer ${productionToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Backend MSL API Calculation & Multi-Bin Aggregation Verification', () => {
    it('MSL_HTTP_04: GET /api/inventory/msl returns accurate stock aggregation and status for all test products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Verify Low Stock Product (25 + 15 = 40, MSL 100)
      const low = res.body.find((p: any) => p.productId === productLowId);
      expect(low).toBeDefined();
      expect(low.currentStock).toBe(40);
      expect(low.minimumInventory).toBe(100);
      expect(low.status).toBe(MslStockStatus.LOW_STOCK);
      expect(low.isBreached).toBe(true);
      expect(low.deficit).toBe(60);

      // Verify Out of Stock Product (0 stock, MSL 50)
      const out = res.body.find((p: any) => p.productId === productOutId);
      expect(out).toBeDefined();
      expect(out.currentStock).toBe(0);
      expect(out.minimumInventory).toBe(50);
      expect(out.status).toBe(MslStockStatus.OUT_OF_STOCK);
      expect(out.isBreached).toBe(true);
      expect(out.deficit).toBe(50);

      // Verify Normal Product (60 + 60 = 120, MSL 50, Max 300)
      const norm = res.body.find((p: any) => p.productId === productNormalId);
      expect(norm).toBeDefined();
      expect(norm.currentStock).toBe(120);
      expect(norm.minimumInventory).toBe(50);
      expect(norm.status).toBe(MslStockStatus.NORMAL);
      expect(norm.isBreached).toBe(false);

      // Verify Excess Product (50 + 50 = 100, Max 80)
      const exc = res.body.find((p: any) => p.productId === productExcessId);
      expect(exc).toBeDefined();
      expect(exc.currentStock).toBe(100);
      expect(exc.maximumInventory).toBe(80);
      expect(exc.status).toBe(MslStockStatus.EXCESS);
      expect(exc.isBreached).toBe(true);
      expect(exc.excess).toBe(20);
    });

    it('MSL_HTTP_05: GET /api/inventory/msl/breached returns only breached products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl/breached')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const breachedIds = res.body.map((p: any) => p.productId);
      expect(breachedIds).toContain(productLowId);
      expect(breachedIds).toContain(productOutId);
      expect(breachedIds).toContain(productExcessId);
      expect(breachedIds).not.toContain(productNormalId);
    });

    it('MSL_HTTP_06: GET /api/inventory/msl/products/:id returns single product calculation', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/inventory/msl/products/${productLowId}`)
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.productId).toBe(productLowId);
      expect(res.body.currentStock).toBe(40);
      expect(res.body.status).toBe(MslStockStatus.LOW_STOCK);
    });

    it('MSL_HTTP_07: GET /api/inventory/msl/products/:id returns 404 for non-existent product', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('3. On-Demand Evaluation & Alert Dispatch via API', () => {
    it('MSL_HTTP_08: POST /api/inventory/msl/evaluate triggers batch evaluation and creates active alerts', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/msl/evaluate')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);

      const lowEval = res.body.find((e: any) => e.productId === productLowId);
      expect(lowEval).toBeDefined();
      expect(lowEval.action).toBe('CREATED');
      expect(lowEval.alert).toBeDefined();
      expect(lowEval.alert.status).toBe('ACTIVE');

      const outEval = res.body.find((e: any) => e.productId === productOutId);
      expect(outEval).toBeDefined();
      expect(outEval.action).toBe('CREATED');
      expect(outEval.alert.status).toBe('ACTIVE');
    });

    it('MSL_HTTP_09: GET /api/inventory/msl/alerts retrieves the newly created active alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/msl/alerts')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const activeProductIds = res.body.map((a: any) => a.productId);
      expect(activeProductIds).toContain(productLowId);
      expect(activeProductIds).toContain(productOutId);
    });

    it('MSL_HTTP_10: POST /api/inventory/msl/evaluate on second run suppresses duplicate alerts (Idempotency)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/msl/evaluate')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(201);

      const lowEval = res.body.find((e: any) => e.productId === productLowId);
      expect(lowEval).toBeDefined();
      expect(lowEval.action).toBe('SUPPRESSED');

      const outEval = res.body.find((e: any) => e.productId === productOutId);
      expect(outEval).toBeDefined();
      expect(outEval.action).toBe('SUPPRESSED');
    });

    it('MSL_HTTP_11: GET /api/inventory/msl/products/:id/history retrieves full audit history for product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/inventory/msl/products/${productLowId}/history`)
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].productId).toBe(productLowId);
    });
  });
});
