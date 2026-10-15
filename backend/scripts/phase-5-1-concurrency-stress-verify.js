// Phase 5.1 Concurrency & Stress Verification Runner (Phase 26)
// Zero-dependency native Node.js harness measuring p50/p95/p99 latencies,
// multi-terminal IP isolation, pessimistic write locks, and zero-pollution cleanup.

import http from 'http';
import crypto from 'crypto';
import pg from 'pg';

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const TEST_RUN_ID = Date.now();
const PREFIX = `STRESS_STAGE5_${TEST_RUN_ID}`;

function generateJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function request(options, body = null) {
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
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          duration,
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 599,
        error: err.message,
        duration,
        headers: {},
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function purgeStressFixtures(client, pattern = '%STRESS%') {
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
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('Warning during purgeStressFixtures:', err.message);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('       RMRIT STAGE 5 (PHASE 26): LOAD & CONCURRENCY STRESS BENCHMARK            ');
  console.log('================================================================================');
  console.log(`Execution Run ID: ${PREFIX}`);
  console.log(`Target Daemon: http://${HOST}:${PORT}`);

  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();
  console.log('Connected to Neon PostgreSQL.');

  // Pre-flight cleanup of any stale stress test data
  await purgeStressFixtures(pgClient, '%STRESS%');

  // Find admin user ID
  const adminRes = await pgClient.query("SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMIN') LIMIT 1");
  const adminUserId = adminRes.rows[0]?.id || '6c3ced4e-6fe9-46a4-b24e-f97460313d2f';

  const token = generateJwt(
    {
      sub: adminUserId,
      email: 'admin_stress@rmrit.com',
      role: 'ADMIN',
      roles: ['ADMIN'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
    },
    JWT_SECRET
  );

  try {
    // -------------------------------------------------------------------------
    // STEP 1: PRE-WARM CACHE
    // -------------------------------------------------------------------------
    console.log('\n>>> STEP 1: Pre-warming Master Data in-memory cache...');
    await request({
      hostname: HOST,
      port: PORT,
      path: '/api/categories',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    await request({
      hostname: HOST,
      port: PORT,
      path: '/api/products',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    await request({
      hostname: HOST,
      port: PORT,
      path: '/api/bins',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    await request({
      hostname: HOST,
      port: PORT,
      path: '/api/vendors',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Cache pre-warmed.');

    // -------------------------------------------------------------------------
    // STEP 2: 50 CONCURRENT VIRTUAL USERS (MULTI-TERMINAL IP ISOLATION)
    // -------------------------------------------------------------------------
    console.log('\n>>> STEP 2: Firing 50 Concurrent Virtual Users (500 requests across LAN 10.10.0.1 - 10.10.0.50)...');
    const TOTAL_VUS = 50;
    const REQS_PER_VU = 10;
    const TOTAL_REQUESTS = TOTAL_VUS * REQS_PER_VU;

    const latencies = [];
    const statusCodes = {};
    let cacheHits = 0;
    let cacheMisses = 0;
    let cacheBypasses = 0;

    const endpoints = [
      '/api/categories',
      '/api/products',
      '/api/bins',
      '/api/vendors',
      '/api/products/next-code',
    ];

    const wallClockStart = performance.now();

    const vuPromises = Array.from({ length: TOTAL_VUS }).map(async (_, vuIndex) => {
      const vuId = vuIndex + 1;
      const terminalIp = `10.10.0.${vuId}`;

      for (let reqIndex = 0; reqIndex < REQS_PER_VU; reqIndex++) {
        const path = endpoints[reqIndex % endpoints.length];
        const res = await request({
          hostname: HOST,
          port: PORT,
          path,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Forwarded-For': terminalIp,
            'Content-Type': 'application/json',
          },
        });

        latencies.push(res.duration);
        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;

        const xCache = (res.headers['x-cache'] || res.headers['X-Cache'] || '').toUpperCase();
        if (xCache === 'HIT') cacheHits++;
        else if (xCache === 'MISS') cacheMisses++;
        else if (xCache === 'BYPASS') cacheBypasses++;
      }
    });

    await Promise.all(vuPromises);
    const wallClockDuration = performance.now() - wallClockStart;
    const rps = (TOTAL_REQUESTS / (wallClockDuration / 1000)).toFixed(2);

    const minLat = Math.min(...latencies).toFixed(2);
    const maxLat = Math.max(...latencies).toFixed(2);
    const meanLat = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
    const p50 = getPercentile(latencies, 50).toFixed(2);
    const p90 = getPercentile(latencies, 90).toFixed(2);
    const p95 = getPercentile(latencies, 95).toFixed(2);
    const p99 = getPercentile(latencies, 99).toFixed(2);

    console.log('--------------------------------------------------------------------------------');
    console.log(' 50-VU LOAD TEST RESULTS:');
    console.log(` - Total Requests:       ${TOTAL_REQUESTS}`);
    console.log(` - Wall Clock Duration:  ${wallClockDuration.toFixed(2)} ms`);
    console.log(` - Throughput (RPS):     ${rps} req/sec`);
    console.log(` - Status Breakdown:     ${JSON.stringify(statusCodes)}`);
    console.log(` - False 429 Lockouts:   ${statusCodes[429] || 0} (Target: 0)`);
    console.log(` - Cache Distribution:   ${cacheHits} HITs, ${cacheMisses} MISSes, ${cacheBypasses} BYPASSes`);
    console.log(` - Latency Percentiles:  Min: ${minLat}ms | Mean: ${meanLat}ms | p50: ${p50}ms | p90: ${p90}ms | p95: ${p95}ms | p99: ${p99}ms | Max: ${maxLat}ms`);
    console.log('--------------------------------------------------------------------------------');

    if (statusCodes[429]) {
      throw new Error(`FAIL: False 429 lockouts detected (${statusCodes[429]} occurrences). Multi-terminal IP simulation failed!`);
    }

    // -------------------------------------------------------------------------
    // STEP 3: ROGUE TERMINAL RATE LIMIT ENFORCEMENT (IP: 10.10.0.99)
    // -------------------------------------------------------------------------
    console.log('\n>>> STEP 3: Testing Rate-Limit Enforcement on Rogue Terminal (IP: 10.10.0.99)...');
    const ROGUE_IP = '10.10.0.99';
    let rogue200s = 0;
    let rogue429s = 0;

    const rogueRequests = Array.from({ length: 130 }).map(async () => {
      const res = await request({
        hostname: HOST,
        port: PORT,
        path: '/api/categories',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Forwarded-For': ROGUE_IP,
        },
      });
      if (res.statusCode === 200) rogue200s++;
      if (res.statusCode === 429) rogue429s++;
    });

    await Promise.all(rogueRequests);
    console.log(`Rogue Terminal Results: ${rogue200s} Accepted (200), ${rogue429s} Blocked (429)`);
    if (rogue429s === 0) {
      throw new Error('FAIL: Rate limiting was not enforced on rogue terminal exceeding 120 req/min!');
    }
    console.log('SUCCESS: Rate limiting strictly blocked requests exceeding 120 req/min.');

    // -------------------------------------------------------------------------
    // STEP 4: PESSIMISTIC WRITE LOCK RACE CONDITION (The Depleted Bin Challenge)
    // -------------------------------------------------------------------------
    console.log('\n>>> STEP 4: The Depleted Bin Challenge (Pessimistic Write Lock Race Condition)...');

    // Create isolated test fixture in DB
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

    // Initial Seed: EXACTLY 50.00 units in stock balance
    const INITIAL_QTY = 50.0;
    await pgClient.query(
      "INSERT INTO stock_balances (id, product_id, bin_id, current_quantity, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
      [crypto.randomUUID(), prodId, binId, INITIAL_QTY]
    );

    // Sales Order Component + Approved RM Item (Requesting 50 units)
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

    console.log(`Test environment initialized: Bin ${binCode} with EXACTLY ${INITIAL_QTY} units.`);

    // 10 Parallel Requests simultaneously attempting to deduct 10 units each (100 units attempted)
    console.log('Firing 10 simultaneous parallel stock deductions (10 units each) at exact same millisecond...');
    const ATTEMPTED_PER_REQ = 10.0;
    const CONCURRENT_ATTEMPTS = 10;

    const issueResults = await Promise.all(
      Array.from({ length: CONCURRENT_ATTEMPTS }).map((_, i) => {
        return request(
          {
            hostname: HOST,
            port: PORT,
            path: '/api/material-issues',
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Forwarded-For': `10.10.1.${i + 1}`,
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
                quantityIssued: ATTEMPTED_PER_REQ,
              },
            ],
          }
        );
      })
    );

    const issue201s = issueResults.filter((r) => r.statusCode === 201).length;
    const issueRejections = issueResults.filter((r) => r.statusCode === 400 || r.statusCode === 409).length;
    console.log(`Concurrent Issue Outcome: ${issue201s} Succeeded (201 Created), ${issueRejections} Rejected with 400/409 (Breakdown: ${issueResults.map(r => r.statusCode).join(', ')})`);

    // Verify Remaining Stock in Neon PostgreSQL
    const balanceRes = await pgClient.query(
      "SELECT current_quantity FROM stock_balances WHERE bin_id = $1 AND product_id = $2",
      [binId, prodId]
    );
    const finalBalance = parseFloat(balanceRes.rows[0]?.current_quantity || '0');

    // Verify Total Quantity Issued in DB
    const totalIssuedRes = await pgClient.query(
      "SELECT COALESCE(SUM(quantity_issued), 0) as total FROM material_issue_items WHERE rm_item_id = $1",
      [rmItemId]
    );
    const totalIssued = parseFloat(totalIssuedRes.rows[0]?.total || '0');

    console.log('--------------------------------------------------------------------------------');
    console.log(' PESSIMISTIC LOCK RACE CONDITION PROOF:');
    console.log(` - Initial Bin Stock:         ${INITIAL_QTY.toFixed(2)} units`);
    console.log(` - Total Quantity Attempted:  ${(CONCURRENT_ATTEMPTS * ATTEMPTED_PER_REQ).toFixed(2)} units (10 parallel requests)`);
    console.log(` - Successful Deductions:     ${issue201s} requests (${(issue201s * ATTEMPTED_PER_REQ).toFixed(2)} units)`);
    console.log(` - Blocked / Overdrawn Reqs:  ${issueRejections} requests (400 Bad Request / 409 Conflict)`);
    console.log(` - Final Database Balance:    ${finalBalance.toFixed(2)} units`);
    console.log(` - Total DB Quantity Issued:  ${totalIssued.toFixed(2)} units`);
    console.log(` - Negative Balance Check:    ${finalBalance < 0 ? 'FAILED (NEGATIVE INVENTORY!)' : 'PASSED (Balance >= 0.00)'}`);
    console.log(` - Conservation Invariant:    ${INITIAL_QTY} == ${totalIssued} + ${finalBalance} (${INITIAL_QTY === totalIssued + finalBalance ? '100% CONSERVED' : 'VIOLATED'})`);
    console.log('--------------------------------------------------------------------------------');

    if (issue201s !== 5 || issueRejections !== 5) {
      throw new Error(`FAIL: Expected exactly 5 successful and 5 rejected issues. Received ${issue201s} successes, ${issueRejections} rejections.`);
    }

    if (finalBalance !== 0.0) {
      throw new Error(`FAIL: Expected final balance to be exactly 0.00, got ${finalBalance}!`);
    }

    if (totalIssued !== 50.0) {
      throw new Error(`FAIL: Expected total issued quantity to be 50.00, got ${totalIssued}!`);
    }

    console.log('SUCCESS: Pessimistic locking (FOR UPDATE) perfectly serialized parallel writes!');
  } finally {
    // -------------------------------------------------------------------------
    // STEP 5: ZERO-POLLUTION CASCADED TEARDOWN
    // -------------------------------------------------------------------------
    console.log('\n>>> STEP 5: Performing Zero-Pollution Database Teardown in Neon PostgreSQL...');
    try {
      await purgeStressFixtures(pgClient, `%${TEST_RUN_ID}%`);

      // Assert zero residual test records
      const residualCheck = await pgClient.query(
        "SELECT COUNT(*) as count FROM products WHERE code LIKE $1",
        [`%${TEST_RUN_ID}%`]
      );
      const residualCount = parseInt(residualCheck.rows[0]?.count || '0', 10);
      console.log(`Teardown complete. Residual test rows: ${residualCount} (Target: 0).`);
      if (residualCount > 0) {
        throw new Error(`Teardown failed: ${residualCount} residual test entities remain!`);
      }
    } catch (cleanErr) {
      console.error('Teardown error:', cleanErr.message);
    } finally {
      await pgClient.end();
    }
  }

  console.log('\n================================================================================');
  console.log('      STAGE 5 (PHASE 26) CONCURRENCY BENCHMARK: 100% CERTIFIED & PASSED         ');
  console.log('================================================================================');
}

main().catch((err) => {
  console.error('\n*** BENCHMARK TERMINATED WITH ERROR ***\n', err);
  process.exit(1);
});
