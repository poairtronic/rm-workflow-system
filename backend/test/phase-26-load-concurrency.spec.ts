import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import http from 'http';
import crypto from 'crypto';

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const TEST_RUN_ID = Date.now();
const PREFIX = `VITEST_STRESS_${TEST_RUN_ID}`;

function generateJwt(payload: any, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function request(options: http.RequestOptions, body: any = null): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; data: any; duration: number }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const duration = performance.now() - start;
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode || 500,
          headers: res.headers,
          data: parsed,
          duration,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 599,
        error: err.message,
        duration: performance.now() - start,
        headers: {},
        data: null,
      } as any);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function purgeStressFixtures(client: pg.Client, pattern = '%STRESS%') {
  try {
    await client.query('ROLLBACK').catch(() => {});
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM material_issue_items WHERE material_issue_id IN (
        SELECT id FROM material_issues WHERE remarks LIKE $1 OR sc_id IN (
          SELECT id FROM sales_order_components WHERE sc_number LIKE $1
        )
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM material_issues WHERE remarks LIKE $1 OR sc_id IN (
        SELECT id FROM sales_order_components WHERE sc_number LIKE $1
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM stock_transactions WHERE source_bin_id IN (
        SELECT id FROM bins WHERE code LIKE $1
      ) OR destination_bin_id IN (
        SELECT id FROM bins WHERE code LIKE $1
      ) OR product_id IN (
        SELECT id FROM products WHERE code LIKE $1
      ) OR remarks LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM stock_balances WHERE bin_id IN (
        SELECT id FROM bins WHERE code LIKE $1
      ) OR product_id IN (
        SELECT id FROM products WHERE code LIKE $1
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM rm_items WHERE sc_id IN (
        SELECT id FROM sales_order_components WHERE sc_number LIKE $1
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM rm_requests WHERE sc_id IN (
        SELECT id FROM sales_order_components WHERE sc_number LIKE $1
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM sales_order_components WHERE sc_number LIKE $1 OR po_id IN (
        SELECT id FROM purchase_orders WHERE po_number LIKE $1 OR customer_id IN (
          SELECT id FROM customers WHERE code LIKE $1 OR name LIKE $1
        )
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM purchase_orders WHERE po_number LIKE $1 OR customer_id IN (
        SELECT id FROM customers WHERE code LIKE $1 OR name LIKE $1
      )`, [pattern]
    );
    await client.query(
      `DELETE FROM customers WHERE code LIKE $1 OR name LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM bins WHERE code LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM racks WHERE code LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM warehouse_locations WHERE code LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM warehouses WHERE code LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM products WHERE code LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM product_families WHERE name LIKE $1`, [pattern]
    );
    await client.query(
      `DELETE FROM product_categories WHERE name LIKE $1`, [pattern]
    );
    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('Warning during purgeStressFixtures:', err.message);
  }
}

describe('Stage 5 (Phase 26): Shop-Floor Load & Concurrency Stress Suite', () => {
  let pgClient: pg.Client;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    pgClient = new pg.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();
    await purgeStressFixtures(pgClient, '%STRESS%');

    const adminRes = await pgClient.query("SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMIN') LIMIT 1");
    adminUserId = adminRes.rows[0]?.id || '6c3ced4e-6fe9-46a4-b24e-f97460313d2f';

    adminToken = generateJwt(
      {
        sub: adminUserId,
        email: 'admin_vitest_stress@rmrit.com',
        role: 'ADMIN',
        roles: ['ADMIN'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200,
      },
      JWT_SECRET
    );
  }, 15000);

  afterAll(async () => {
    // Teardown any test artifacts
    if (pgClient) {
      await purgeStressFixtures(pgClient, `%${TEST_RUN_ID}%`);
      await pgClient.end();
    }
  }, 15000);

  it('1. Multi-Terminal IP Simulation: 50 concurrent VUs avoid false 429 lockouts', async () => {
    const TOTAL_VUS = 50;
    const REQS_PER_VU = 4; // 200 total requests across terminals
    const statusCounts: Record<number, number> = {};

    const vuRequests = Array.from({ length: TOTAL_VUS }).map(async (_, vuIndex) => {
      const vuId = vuIndex + 1;
      const terminalIp = `10.10.0.${vuId}`;

      for (let i = 0; i < REQS_PER_VU; i++) {
        const res = await request({
          hostname: HOST,
          port: PORT,
          path: '/api/categories',
          method: 'GET',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'X-Forwarded-For': terminalIp,
          },
        });
        statusCounts[res.statusCode] = (statusCounts[res.statusCode] || 0) + 1;
      }
    });

    await Promise.all(vuRequests);

    // Assert that every request succeeded (200 OK) and 0 were rejected by 429
    expect(statusCounts[200]).toBe(TOTAL_VUS * REQS_PER_VU);
    expect(statusCounts[429] || 0).toBe(0);
  }, 30000);

  it('2. Rate-Limit Enforcement: Rogue single terminal triggers 429 Too Many Requests', async () => {
    const ROGUE_IP = `10.10.99.${Math.floor(Math.random() * 200) + 1}`;
    let count200 = 0;
    let count429 = 0;

    // Send 130 requests rapidly from the exact same terminal IP
    const rapidRequests = Array.from({ length: 130 }).map(async () => {
      const res = await request({
        hostname: HOST,
        port: PORT,
        path: '/api/categories',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'X-Forwarded-For': ROGUE_IP,
        },
      });
      if (res.statusCode === 200) count200++;
      if (res.statusCode === 429) count429++;
    });

    await Promise.all(rapidRequests);

    expect(count200).toBeGreaterThanOrEqual(100);
    expect(count429).toBeGreaterThan(0);
  }, 20000);

  it('3. The Depleted Bin Challenge: Pessimistic write locking serializes concurrent parallel deductions', async () => {
    // Setup isolated test entities
    const catId = crypto.randomUUID();
    const famId = crypto.randomUUID();
    const prodId = crypto.randomUUID();
    const whId = crypto.randomUUID();
    const locId = crypto.randomUUID();
    const rackId = crypto.randomUUID();
    const binId = crypto.randomUUID();
    const custId = crypto.randomUUID();
    const poId = crypto.randomUUID();
    const scId = crypto.randomUUID();
    const rmReqId = crypto.randomUUID();
    const rmItemId = crypto.randomUUID();

    const binCode = `BIN_STRESS_${TEST_RUN_ID}`;
    const prodCode = `PRD_STRESS_${TEST_RUN_ID}`;
    const scNumber = `SC_STRESS_${TEST_RUN_ID}`;

    await pgClient.query('BEGIN');
    await pgClient.query("INSERT INTO product_categories (id, name, is_active) VALUES ($1, $2, true)", [catId, `CAT_STRESS_${TEST_RUN_ID}`]);
    await pgClient.query("INSERT INTO product_families (id, category_id, name, is_active) VALUES ($1, $2, $3, true)", [famId, catId, `FAM_STRESS_${TEST_RUN_ID}`]);
    await pgClient.query("INSERT INTO products (id, family_id, code, name, is_active) VALUES ($1, $2, $3, $4, true)", [prodId, famId, prodCode, `Product ${PREFIX}`]);
    await pgClient.query("INSERT INTO warehouses (id, code, name, is_active) VALUES ($1, $2, $3, true)", [whId, `WH_${TEST_RUN_ID}`, `Warehouse ${PREFIX}`]);
    await pgClient.query("INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active) VALUES ($1, $2, $3, $4, true)", [locId, whId, `LOC_${TEST_RUN_ID}`, `Loc ${PREFIX}`]);
    await pgClient.query("INSERT INTO racks (id, location_id, code, name, is_active) VALUES ($1, $2, $3, $4, true)", [rackId, locId, `RCK_${TEST_RUN_ID}`, `Rack ${PREFIX}`]);
    await pgClient.query("INSERT INTO bins (id, rack_id, code, name, is_active) VALUES ($1, $2, $3, $4, true)", [binId, rackId, binCode, `Bin ${PREFIX}`]);

    // Initial stock: exactly 50.00 units
    const INITIAL_STOCK = 50.0;
    await pgClient.query(
      "INSERT INTO stock_balances (id, product_id, bin_id, current_quantity, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
      [crypto.randomUUID(), prodId, binId, INITIAL_STOCK]
    );

    // Sales Order Component + Approved RM Item
    await pgClient.query("INSERT INTO customers (id, code, name, is_active) VALUES ($1, $2, $3, true)", [custId, `CUST_${TEST_RUN_ID}`, `Cust ${PREFIX}`]);
    await pgClient.query("INSERT INTO purchase_orders (id, po_number, customer_id) VALUES ($1, $2, $3)", [poId, `PO_${TEST_RUN_ID}`, custId]);
    await pgClient.query(
      "INSERT INTO sales_order_components (id, sc_number, po_id, product_name, status, target_quantity) VALUES ($1, $2, $3, $4, 'SUBMITTED', 100)",
      [scId, scNumber, poId, `Comp ${PREFIX}`]
    );
    await pgClient.query(
      "INSERT INTO rm_requests (id, sc_id, status, form_type, created_by_id) VALUES ($1, $2, 'SUBMITTED', 'SC', $3)",
      [rmReqId, scId, adminUserId]
    );
    await pgClient.query(
      "INSERT INTO rm_items (id, rm_form_id, sc_id, material, quantity, size, grade, mapped_product_id) VALUES ($1, $2, $3, $4, 50.0, '10mm', 'SS304', $5)",
      [rmItemId, rmReqId, scId, 'Cotton Raw 40s', prodId]
    );
    await pgClient.query('COMMIT');

    // Fire 10 simultaneous parallel requests requesting 10.0 units each (100 total attempted against 50 available)
    const ATTEMPTED_QTY = 10.0;
    const CONCURRENT_REQS = 10;

    const issueResponses = await Promise.all(
      Array.from({ length: CONCURRENT_REQS }).map((_, i) => {
        return request(
          {
            hostname: HOST,
            port: PORT,
            path: '/api/material-issues',
            method: 'POST',
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'X-Forwarded-For': `10.10.2.${i + 1}`,
              'Content-Type': 'application/json',
            },
          },
          {
            scId,
            remarks: `${PREFIX}_ISSUE_${i + 1}`,
            items: [
              {
                rmItemId,
                binId,
                quantityIssued: ATTEMPTED_QTY,
              },
            ],
          }
        );
      })
    );

    const count201 = issueResponses.filter((r) => r.statusCode === 201).length;
    const countRejections = issueResponses.filter((r) => r.statusCode === 400 || r.statusCode === 409).length;

    // Assert that exactly 5 succeeded and exactly 5 were rejected due to serialized stock exhaustion
    expect(count201).toBe(5);
    expect(countRejections).toBe(5);

    // Query Neon PostgreSQL directly to verify remaining balance
    const balanceQuery = await pgClient.query(
      "SELECT current_quantity FROM stock_balances WHERE bin_id = $1 AND product_id = $2",
      [binId, prodId]
    );
    const finalBalance = parseFloat(balanceQuery.rows[0]?.current_quantity || '0');

    // Query total quantity issued in DB
    const totalIssuedQuery = await pgClient.query(
      "SELECT COALESCE(SUM(quantity_issued), 0) as total FROM material_issue_items WHERE rm_item_id = $1",
      [rmItemId]
    );
    const totalIssued = parseFloat(totalIssuedQuery.rows[0]?.total || '0');

    // Mathematical quantity conservation: Q_initial (50) = Q_issued (50) + Q_remaining (0)
    expect(finalBalance).toBe(0.0);
    expect(totalIssued).toBe(50.0);
    expect(INITIAL_STOCK).toBe(totalIssued + finalBalance);
    // Hard invariant: balance never negative
    expect(finalBalance).toBeGreaterThanOrEqual(0.0);
  }, 30000);
});
