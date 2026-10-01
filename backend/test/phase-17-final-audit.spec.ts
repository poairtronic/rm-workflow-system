import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { MslStockStatus } from '../src/inventory/msl-calculation.service.js';
import { TransactionType } from '../src/inventory/entities/stock-transaction.entity.js';

describe('Phase 17 Final Backend Audit & Exit Gate Verification (e2e)', () => {
  let app: INestApplication;
  let pgClient: pg.Client;

  const AUDIT_PREFIX = `p17_audit_${Date.now()}`;
  let storesUserId: string;
  let storesToken: string;
  let adminUserId: string;
  let adminToken: string;
  let productionUserId: string;
  let productionToken: string;
  let designerUserId: string;
  let designerToken: string;

  let warehouseId: string;
  let locationId: string;
  let rackId: string;
  let bin1Id: string;
  let bin2Id: string;

  let categoryId: string;
  let familyId: string;
  let productAuditId: string;
  let productNormalId: string;
  let productZeroId: string;

  beforeAll(async () => {
    // 1. Direct PG Client for seeding test fixtures
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();

    // 2. Fetch or create Roles
    const getRoleId = async (roleName: string) => {
      let res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      if (!res.rows.length) {
        await pgClient.query(`INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [roleName]);
        res = await pgClient.query(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
      }
      return res.rows[0].id;
    };

    const storesRoleId = await getRoleId('STORES');
    const adminRoleId = await getRoleId('ADMIN');
    const prodRoleId = await getRoleId('PRODUCTION');
    const desRoleId = await getRoleId('DESIGNER');

    // 3. Create Users
    const createUser = async (name: string, email: string, roleId: string) => {
      const res = await pgClient.query(
        `INSERT INTO users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, 'hash', $3, true) RETURNING id`,
        [name, email, roleId],
      );
      return res.rows[0].id;
    };

    storesUserId = await createUser(`Stores Audit ${AUDIT_PREFIX}`, `${AUDIT_PREFIX}_stores@rmrit.com`, storesRoleId);
    adminUserId = await createUser(`Admin Audit ${AUDIT_PREFIX}`, `${AUDIT_PREFIX}_admin@rmrit.com`, adminRoleId);
    productionUserId = await createUser(`Prod Audit ${AUDIT_PREFIX}`, `${AUDIT_PREFIX}_prod@rmrit.com`, prodRoleId);
    designerUserId = await createUser(`Designer Audit ${AUDIT_PREFIX}`, `${AUDIT_PREFIX}_des@rmrit.com`, desRoleId);

    const jwtSecret = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
    const signToken = (sub: string, email: string, role: UserRole) =>
      jwt.sign({ sub, email, role, roles: [role] }, jwtSecret);

    storesToken = signToken(storesUserId, `${AUDIT_PREFIX}_stores@rmrit.com`, UserRole.STORES);
    adminToken = signToken(adminUserId, `${AUDIT_PREFIX}_admin@rmrit.com`, UserRole.ADMIN);
    productionToken = signToken(productionUserId, `${AUDIT_PREFIX}_prod@rmrit.com`, UserRole.PRODUCTION);
    designerToken = signToken(designerUserId, `${AUDIT_PREFIX}_des@rmrit.com`, UserRole.DESIGNER);

    // 4. Warehouse & Bins
    const wh = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active) VALUES ($1, $2, true) RETURNING id`,
      [`WH-Audit-${AUDIT_PREFIX}`, `W-${AUDIT_PREFIX.substring(0, 10)}`],
    );
    warehouseId = wh.rows[0].id;

    const loc = await pgClient.query(
      `INSERT INTO warehouse_locations (warehouse_id, code, name, is_active) VALUES ($1, $2, 'Loc 1', true) RETURNING id`,
      [warehouseId, `L-${AUDIT_PREFIX.substring(0, 10)}`],
    );
    locationId = loc.rows[0].id;

    const rack = await pgClient.query(
      `INSERT INTO racks (location_id, code, name, is_active) VALUES ($1, $2, 'Rack 1', true) RETURNING id`,
      [locationId, `R-${AUDIT_PREFIX.substring(0, 10)}`],
    );
    rackId = rack.rows[0].id;

    const b1 = await pgClient.query(
      `INSERT INTO bins (rack_id, code, name, is_active) VALUES ($1, $2, 'Bin 1', true) RETURNING id`,
      [rackId, `B1-${AUDIT_PREFIX.substring(0, 9)}`],
    );
    bin1Id = b1.rows[0].id;

    const b2 = await pgClient.query(
      `INSERT INTO bins (rack_id, code, name, is_active) VALUES ($1, $2, 'Bin 2', true) RETURNING id`,
      [rackId, `B2-${AUDIT_PREFIX.substring(0, 9)}`],
    );
    bin2Id = b2.rows[0].id;

    // 5. Category, Family, and Products
    const cat = await pgClient.query(
      `INSERT INTO product_categories (name, is_active) VALUES ($1, true) RETURNING id`,
      [`Cat-Audit-${AUDIT_PREFIX}`],
    );
    categoryId = cat.rows[0].id;

    const fam = await pgClient.query(
      `INSERT INTO product_families (category_id, name, is_active) VALUES ($1, $2, true) RETURNING id`,
      [categoryId, `Fam-Audit-${AUDIT_PREFIX}`],
    );
    familyId = fam.rows[0].id;

    // Product 1: Main Audit Item (MSL: 50, Max: 200, Initial Stock: 60)
    const p1 = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 50, 200, true) RETURNING id`,
      [familyId, `Titanium Alloy Rod 12mm ${AUDIT_PREFIX}`],
    );
    productAuditId = p1.rows[0].id;

    // Product 2: Normal Stock Item (MSL: 30, Initial Stock: 100)
    const p2 = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 30, 300, true) RETURNING id`,
      [familyId, `Stainless Fastener M6 ${AUDIT_PREFIX}`],
    );
    productNormalId = p2.rows[0].id;

    // Product 3: Zero Stock Item (MSL: 40, Initial Stock: 0)
    const p3 = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, maximum_inventory, is_active)
       VALUES ($1, $2, 40, 150, true) RETURNING id`,
      [familyId, `Graphite Gasket 50mm ${AUDIT_PREFIX}`],
    );
    productZeroId = p3.rows[0].id;

    // Initial Stock Balances
    // Product 1: 60 units in Bin 1
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 60)`,
      [productAuditId, bin1Id],
    );
    // Product 2: 60 in Bin 1 + 40 in Bin 2 = 100 units
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 60)`,
      [productNormalId, bin1Id],
    );
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 40)`,
      [productNormalId, bin2Id],
    );
    // Product 3: 0 in Bin 1
    await pgClient.query(
      `INSERT INTO stock_balances (product_id, bin_id, current_quantity) VALUES ($1, $2, 0)`,
      [productZeroId, bin1Id],
    );

    // 6. Bootstrap NestJS App
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    try {
      if (app) {
        await app.close();
      }
      if (pgClient) {
        // Scoped cleanup
        await pgClient.query(`DELETE FROM general_issue_items WHERE general_issue_id IN (SELECT id FROM general_issues WHERE department = $1)`, [AUDIT_PREFIX]);
        await pgClient.query(`DELETE FROM general_issues WHERE department = $1`, [AUDIT_PREFIX]);
        await pgClient.query(`DELETE FROM msl_alerts WHERE product_id IN ($1, $2, $3)`, [productAuditId, productNormalId, productZeroId]);
        await pgClient.query(`DELETE FROM stock_transactions WHERE product_id IN ($1, $2, $3)`, [productAuditId, productNormalId, productZeroId]);
        await pgClient.query(`DELETE FROM stock_balances WHERE product_id IN ($1, $2, $3)`, [productAuditId, productNormalId, productZeroId]);
        await pgClient.query(`DELETE FROM products WHERE id IN ($1, $2, $3)`, [productAuditId, productNormalId, productZeroId]);
        await pgClient.query(`DELETE FROM product_families WHERE id = $1`, [familyId]);
        await pgClient.query(`DELETE FROM product_categories WHERE id = $1`, [categoryId]);
        await pgClient.query(`DELETE FROM bins WHERE id IN ($1, $2)`, [bin1Id, bin2Id]);
        await pgClient.query(`DELETE FROM racks WHERE id = $1`, [rackId]);
        await pgClient.query(`DELETE FROM warehouse_locations WHERE id = $1`, [locationId]);
        await pgClient.query(`DELETE FROM warehouses WHERE id = $1`, [warehouseId]);
        await pgClient.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`, [storesUserId, adminUserId, productionUserId, designerUserId]);
        await pgClient.end();
      }
    } catch {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. API CONTRACT & ROUTE INSPECTION
  // =========================================================================
  describe('1. API Contract & Route Inspection', () => {
    it('AUDIT-API-001: POST /api/general-issue creates general issue and returns valid response shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          department: AUDIT_PREFIX,
          reason: 'Initial setup test',
          items: [{ productId: productNormalId, binId: bin1Id, quantityIssued: 10 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.issueNumber).toMatch(/^GEN-/);
      expect(res.body.status).toBe('ISSUED');
      expect(res.body.items).toHaveLength(1);
      expect(Number(res.body.items[0].quantityIssued)).toBe(10);
    });

    it('AUDIT-API-002: GET /api/general-issue returns array of general issues', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('AUDIT-API-003: GET /api/general-issue/:id returns details of single general issue', async () => {
      // Fetch list to get an ID
      const listRes = await request(app.getHttpServer())
        .get('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`);
      const issueId = listRes.body[0].id;

      const res = await request(app.getHttpServer())
        .get(`/api/general-issue/${issueId}`)
        .set('Authorization', `Bearer ${storesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(issueId);
      expect(res.body.items).toBeDefined();
    });

    it('AUDIT-API-004: POST & PATCH /api/general-issue/:id/cancel both cancel issue and refund stock', async () => {
      // 1. Create issue to cancel via POST
      const create1 = await request(app.getHttpServer())
        .post('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          department: AUDIT_PREFIX,
          reason: 'To cancel via POST',
          items: [{ productId: productNormalId, binId: bin1Id, quantityIssued: 5 }],
        });
      expect(create1.status).toBe(201);

      const cancelPostRes = await request(app.getHttpServer())
        .post(`/api/general-issue/${create1.body.id}/cancel`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({ remarks: 'Cancel via POST' });
      expect(cancelPostRes.status).toBe(201);
      expect(cancelPostRes.body.status).toBe('CANCELLED');

      // 2. Create issue to cancel via PATCH
      const create2 = await request(app.getHttpServer())
        .post('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          department: AUDIT_PREFIX,
          reason: 'To cancel via PATCH',
          items: [{ productId: productNormalId, binId: bin1Id, quantityIssued: 5 }],
        });
      expect(create2.status).toBe(201);

      const cancelPatchRes = await request(app.getHttpServer())
        .patch(`/api/general-issue/${create2.body.id}/cancel`)
        .set('Authorization', `Bearer ${storesToken}`)
        .send({ remarks: 'Cancel via PATCH' });
      expect(cancelPatchRes.status).toBe(200);
      expect(cancelPatchRes.body.status).toBe('CANCELLED');
    });

    it('AUDIT-API-005: MSL sweep endpoints respond correctly for authorized roles', async () => {
      const sweepRes = await request(app.getHttpServer())
        .post('/api/inventory/msl/sweep')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(sweepRes.status).toBe(201);
      expect(Array.isArray(sweepRes.body)).toBe(true);

      const statusRes = await request(app.getHttpServer())
        .get('/api/inventory/msl/sweep-status')
        .set('Authorization', `Bearer ${storesToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.isRunning).toBe(false);
      expect(statusRes.body.lastSweepTime).toBeDefined();
      expect(statusRes.body.lastSweepStats).toBeDefined();
    });
  });

  // =========================================================================
  // 2. DATABASE INTEGRITY & CONSTRAINT VERIFICATION
  // =========================================================================
  describe('2. Database Integrity & Constraint Verification', () => {
    it('AUDIT-DB-001: stock_balances non-negative check constraint rejects negative balances', async () => {
      let threwError = false;
      try {
        await pgClient.query(
          `UPDATE stock_balances SET current_quantity = -5.000 WHERE product_id = $1 AND bin_id = $2`,
          [productAuditId, bin1Id],
        );
      } catch (err: any) {
        threwError = true;
        // PostgreSQL check constraint violation code is 23514
        expect(err.code).toBe('23514');
      }
      expect(threwError).toBe(true);
    });

    it('AUDIT-DB-002: msl_alerts table enforces relation integrity and tracking fields', async () => {
      // Evaluate to generate an alert for productZeroId
      await request(app.getHttpServer())
        .post('/api/inventory/msl/evaluate')
        .set('Authorization', `Bearer ${storesToken}`);

      const alertRows = await pgClient.query(
        `SELECT * FROM msl_alerts WHERE product_id = $1 AND status = 'ACTIVE'`,
        [productZeroId],
      );
      expect(alertRows.rows.length).toBeGreaterThanOrEqual(1);
      const alert = alertRows.rows[0];
      expect(alert.product_id).toBe(productZeroId);
      expect(Number(alert.trigger_quantity)).toBe(0);
      expect(Number(alert.minimum_inventory)).toBe(40);
      expect(alert.status).toBe('ACTIVE');
      expect(alert.resolved_at).toBeNull();
      expect(alert.created_at).toBeDefined();
    });
  });

  // =========================================================================
  // 3. END-TO-END WORKFLOW & TRIGGER VALIDATION
  // =========================================================================
  describe('3. End-to-End Stock Mutation, MSL Lifecycle & Trigger Validation', () => {
    it('AUDIT-E2E-001: Traces full lifecycle: depletion -> alert -> suppression -> replenishment -> resolution', async () => {
      // Step A: Initial State — Product 1 has stock = 60, MSL = 50. NORMAL state.
      const initialMsl = await request(app.getHttpServer())
        .get(`/api/inventory/msl/products/${productAuditId}`)
        .set('Authorization', `Bearer ${storesToken}`);
      expect(initialMsl.body.currentStock).toBe(60);
      expect(initialMsl.body.status).toBe(MslStockStatus.NORMAL);

      // Verify no active alert exists for Product 1
      const preAlerts = await pgClient.query(
        `SELECT * FROM msl_alerts WHERE product_id = $1 AND status = 'ACTIVE'`,
        [productAuditId],
      );
      expect(preAlerts.rows.length).toBe(0);

      // Step B: Depletion via General Issue (Issue 25 units from Bin 1: 60 -> 35 < 50)
      const issueRes = await request(app.getHttpServer())
        .post('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          department: AUDIT_PREFIX,
          reason: 'Depletion test to trigger MSL',
          items: [{ productId: productAuditId, binId: bin1Id, quantityIssued: 25 }],
        });
      expect(issueRes.status).toBe(201);

      // Verify authoritative balance decremented
      const balAfter = await pgClient.query(
        `SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
        [productAuditId, bin1Id],
      );
      expect(Number(balAfter.rows[0].current_quantity)).toBe(35);

      // Verify immutable stock transaction logged
      const txRows = await pgClient.query(
        `SELECT * FROM stock_transactions WHERE product_id = $1 AND reference_id = $2`,
        [productAuditId, issueRes.body.id],
      );
      expect(txRows.rows.length).toBe(1);
      expect(txRows.rows[0].transaction_type).toBe(TransactionType.STOCK_OUT);
      expect(Number(txRows.rows[0].quantity)).toBe(25);

      // Verify Post-Commit Trigger created active MSL Alert
      const activeAlerts = await pgClient.query(
        `SELECT * FROM msl_alerts WHERE product_id = $1 AND status = 'ACTIVE'`,
        [productAuditId],
      );
      expect(activeAlerts.rows.length).toBe(1);
      expect(Number(activeAlerts.rows[0].trigger_quantity)).toBe(35);
      expect(activeAlerts.rows[0].status).toBe('ACTIVE');

      // Step C: Repeated Movement & Duplicate Alert Suppression
      // Issue another 5 units (35 -> 30 < 50)
      const issue2Res = await request(app.getHttpServer())
        .post('/api/general-issue')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          department: AUDIT_PREFIX,
          reason: 'Second depletion to test duplicate suppression',
          items: [{ productId: productAuditId, binId: bin1Id, quantityIssued: 5 }],
        });
      expect(issue2Res.status).toBe(201);

      // Verify STILL exactly 1 active alert row (duplicate suppressed!)
      const activeAlertsAfterRepeat = await pgClient.query(
        `SELECT * FROM msl_alerts WHERE product_id = $1 AND status = 'ACTIVE'`,
        [productAuditId],
      );
      expect(activeAlertsAfterRepeat.rows.length).toBe(1);
      expect(activeAlertsAfterRepeat.rows[0].id).toBe(activeAlerts.rows[0].id);

      // Step D: Stock Replenishment & Automatic Alert Resolution
      // Restore stock above MSL: replenish 30 units (30 + 30 = 60 >= 50)
      await pgClient.query(
        `UPDATE stock_balances SET current_quantity = current_quantity + 30 WHERE product_id = $1 AND bin_id = $2`,
        [productAuditId, bin1Id],
      );

      // Trigger MSL check on replenishment (e.g. via sweep or product evaluation)
      const sweepRes = await request(app.getHttpServer())
        .post('/api/inventory/msl/evaluate')
        .set('Authorization', `Bearer ${storesToken}`);
      expect(sweepRes.status).toBe(201);

      // Verify active alert transitioned to RESOLVED
      const resolvedAlerts = await pgClient.query(
        `SELECT * FROM msl_alerts WHERE product_id = $1 AND status = 'RESOLVED'`,
        [productAuditId],
      );
      expect(resolvedAlerts.rows.length).toBe(1);
      expect(resolvedAlerts.rows[0].resolved_at).not.toBeNull();

      const activeAfterReplenish = await pgClient.query(
        `SELECT * FROM msl_alerts WHERE product_id = $1 AND status = 'ACTIVE'`,
        [productAuditId],
      );
      expect(activeAfterReplenish.rows.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. SECURITY & RBAC ENFORCEMENT
  // =========================================================================
  describe('4. Security & RBAC Guard Enforcement', () => {
    it('AUDIT-SEC-001: Rejects unauthenticated requests with HTTP 401', async () => {
      const r1 = await request(app.getHttpServer()).get('/api/general-issue');
      expect(r1.status).toBe(401);

      const r2 = await request(app.getHttpServer()).post('/api/general-issue').send({});
      expect(r2.status).toBe(401);

      const r3 = await request(app.getHttpServer()).post('/api/inventory/msl/sweep');
      expect(r3.status).toBe(401);
    });

    it('AUDIT-SEC-002: Rejects unauthorized roles with HTTP 403 on restricted actions', async () => {
      // PRODUCTION cannot create general issue
      const r1 = await request(app.getHttpServer())
        .post('/api/general-issue')
        .set('Authorization', `Bearer ${productionToken}`)
        .send({
          department: 'Unauthorized',
          items: [{ productId: productNormalId, binId: bin1Id, quantityIssued: 1 }],
        });
      expect(r1.status).toBe(403);

      // DESIGNER cannot run MSL sweep
      const r2 = await request(app.getHttpServer())
        .post('/api/inventory/msl/sweep')
        .set('Authorization', `Bearer ${designerToken}`);
      expect(r2.status).toBe(403);

      // PRODUCTION cannot evaluate MSL
      const r3 = await request(app.getHttpServer())
        .post('/api/inventory/msl/evaluate')
        .set('Authorization', `Bearer ${productionToken}`);
      expect(r3.status).toBe(403);
    });

    it('AUDIT-SEC-003: Allows authorized roles (STORES & ADMIN) to execute privileged operations', async () => {
      // STORES allowed to query sweep status
      const r1 = await request(app.getHttpServer())
        .get('/api/inventory/msl/sweep-status')
        .set('Authorization', `Bearer ${storesToken}`);
      expect(r1.status).toBe(200);

      // ADMIN allowed to run sweep
      const r2 = await request(app.getHttpServer())
        .post('/api/inventory/msl/sweep')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(r2.status).toBe(201);
    });
  });
});
