import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../src/config/data-source.js';
import { GeneralIssueService } from '../src/general-issue/general-issue.service.js';
import { GeneralIssue, GeneralIssueStatus } from '../src/general-issue/entities/general-issue.entity.js';
import { GeneralIssueItem } from '../src/general-issue/entities/general-issue-item.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../src/inventory/entities/stock-transaction.entity.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Phase 17.2 — General Issue Business Rules Integration Test (Neon/Postgres)', () => {
  let dataSource: DataSource;
  let service: GeneralIssueService;
  let pgClient: pg.Client;

  // Test fixture IDs
  const TEST_PREFIX = `p17_2_${Date.now()}`;
  let testUserId: string;
  let testWarehouseId: string;
  let testLocationId: string;
  let testRackId: string;
  let testBinId: string;
  let testCategoryId: string;
  let testFamilyId: string;
  let testProductId: string;
  let testCustomerId: string;
  let testPoId: string;
  let testScId: string;
  let testPoId2: string;

  beforeAll(async () => {
    pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();

    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ALL_ENTITIES,
      synchronize: false,
      ssl: { rejectUnauthorized: false },
    });
    await dataSource.initialize();

    const issueRepo = dataSource.getRepository(GeneralIssue);
    const itemRepo = dataSource.getRepository(GeneralIssueItem);
    service = new GeneralIssueService(issueRepo, itemRepo, dataSource);

    // 1. Fetch STORES or ADMIN role
    const roleRes = await pgClient.query(
      `SELECT id FROM roles WHERE name IN ('STORES', 'ADMIN') LIMIT 1`,
    );
    const roleId = roleRes.rows[0].id;

    // 2. Insert test user
    const userRes = await pgClient.query(
      `INSERT INTO users (name, email, password_hash, role_id, is_active)
       VALUES ($1, $2, 'hash', $3, true)
       RETURNING id`,
      [`Test Stores ${TEST_PREFIX}`, `${TEST_PREFIX}@example.com`, roleId],
    );
    testUserId = userRes.rows[0].id;

    // 3. Insert test Warehouse -> Location -> Rack -> Bin
    const whRes = await pgClient.query(
      `INSERT INTO warehouses (name, code, is_active)
       VALUES ($1, $2, true) RETURNING id`,
      [`WH-${TEST_PREFIX}`, `W-${TEST_PREFIX.substring(0, 10)}`],
    );
    testWarehouseId = whRes.rows[0].id;

    const locRes = await pgClient.query(
      `INSERT INTO warehouse_locations (warehouse_id, code, name, is_active)
       VALUES ($1, $2, 'Loc 1', true) RETURNING id`,
      [testWarehouseId, `L-${TEST_PREFIX.substring(0, 10)}`],
    );
    testLocationId = locRes.rows[0].id;

    const rackRes = await pgClient.query(
      `INSERT INTO racks (location_id, code, name, is_active)
       VALUES ($1, $2, 'Rack 1', true) RETURNING id`,
      [testLocationId, `R-${TEST_PREFIX.substring(0, 10)}`],
    );
    testRackId = rackRes.rows[0].id;

    const binRes = await pgClient.query(
      `INSERT INTO bins (rack_id, code, name, is_active)
       VALUES ($1, $2, 'Bin 1', true) RETURNING id`,
      [testRackId, `B-${TEST_PREFIX.substring(0, 10)}`],
    );
    testBinId = binRes.rows[0].id;

    // 4. Insert test Category -> Product Family -> Product
    const catRes = await pgClient.query(
      `INSERT INTO product_categories (name, is_active)
       VALUES ($1, true) RETURNING id`,
      [`Cat-${TEST_PREFIX}`],
    );
    testCategoryId = catRes.rows[0].id;

    const famRes = await pgClient.query(
      `INSERT INTO product_families (category_id, name, is_active)
       VALUES ($1, $2, true) RETURNING id`,
      [testCategoryId, `Fam-${TEST_PREFIX}`],
    );
    testFamilyId = famRes.rows[0].id;

    const prodRes = await pgClient.query(
      `INSERT INTO products (family_id, name, minimum_inventory, is_active)
       VALUES ($1, $2, 5.000, true) RETURNING id`,
      [testFamilyId, `Prod-${TEST_PREFIX}`],
    );
    testProductId = prodRes.rows[0].id;

    // 5. Insert initial stock balance: 50.000 units in testBinId
    await pgClient.query(
      `INSERT INTO stock_balances (bin_id, product_id, current_quantity, opening_balance)
       VALUES ($1, $2, 50.000, 50.000)`,
      [testBinId, testProductId],
    );

    // 6. Insert test Customer, Purchase Order, and SC (Sales Order Component)
    const custRes = await pgClient.query(
      `INSERT INTO customers (name, code, email)
       VALUES ($1, $2, $3) RETURNING id`,
      [`Cust-${TEST_PREFIX}`, `C-${TEST_PREFIX.substring(0, 10)}`, `${TEST_PREFIX}-c@example.com`],
    );
    testCustomerId = custRes.rows[0].id;

    const poRes = await pgClient.query(
      `INSERT INTO purchase_orders (po_number, customer_id)
       VALUES ($1, $2) RETURNING id`,
      [`PO-${TEST_PREFIX}`, testCustomerId],
    );
    testPoId = poRes.rows[0].id;

    const poRes2 = await pgClient.query(
      `INSERT INTO purchase_orders (po_number, customer_id)
       VALUES ($1, $2) RETURNING id`,
      [`PO2-${TEST_PREFIX}`, testCustomerId],
    );
    testPoId2 = poRes2.rows[0].id;

    const scRes = await pgClient.query(
      `INSERT INTO sales_order_components (sc_number, po_id, product_name)
       VALUES ($1, $2, 'Component Alpha') RETURNING id`,
      [`SC-${TEST_PREFIX}`, testPoId],
    );
    testScId = scRes.rows[0].id;
  }, 30000);

  afterAll(async () => {
    try {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
      if (pgClient) {
        await pgClient.query(`DELETE FROM general_issue_items WHERE general_issue_id IN (SELECT id FROM general_issues WHERE department = $1)`, [TEST_PREFIX]);
        await pgClient.query(`DELETE FROM general_issues WHERE department = $1`, [TEST_PREFIX]);
        await pgClient.query(`DELETE FROM stock_transactions WHERE product_id = $1`, [testProductId]);
        await pgClient.query(`DELETE FROM stock_balances WHERE product_id = $1`, [testProductId]);
        await pgClient.query(`DELETE FROM sales_order_components WHERE id = $1`, [testScId]);
        await pgClient.query(`DELETE FROM purchase_orders WHERE id IN ($1, $2)`, [testPoId, testPoId2]);
        await pgClient.query(`DELETE FROM customers WHERE id = $1`, [testCustomerId]);
        await pgClient.query(`DELETE FROM products WHERE id = $1`, [testProductId]);
        await pgClient.query(`DELETE FROM product_families WHERE id = $1`, [testFamilyId]);
        await pgClient.query(`DELETE FROM product_categories WHERE id = $1`, [testCategoryId]);
        await pgClient.query(`DELETE FROM bins WHERE id = $1`, [testBinId]);
        await pgClient.query(`DELETE FROM racks WHERE id = $1`, [testRackId]);
        await pgClient.query(`DELETE FROM warehouse_locations WHERE id = $1`, [testLocationId]);
        await pgClient.query(`DELETE FROM warehouses WHERE id = $1`, [testWarehouseId]);
        await pgClient.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
        await pgClient.end();
      }
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Rule: SC/PO optional', () => {
    it('creates a general issue with neither SC nor PO (Pure General Issue)', async () => {
      const issue = await service.createIssue(
        {
          department: TEST_PREFIX,
          requester: 'Machine Shop A',
          reason: 'Tool maintenance and calibration',
          items: [
            {
              productId: testProductId,
              binId: testBinId,
              quantityIssued: 10.000,
              remarks: 'Initial maintenance issue',
            },
          ],
        },
        testUserId,
      );

      expect(issue).toBeDefined();
      expect(issue.scId).toBeNull();
      expect(issue.poId).toBeNull();
      expect(issue.status).toBe(GeneralIssueStatus.ISSUED);
      expect(issue.items.length).toBe(1);
      expect(Number(issue.items[0].quantityIssued)).toBe(10.000);

      // Verify stock was decremented from 50 to 40
      const balRes = await pgClient.query(
        `SELECT current_quantity, last_transaction_id FROM stock_balances WHERE bin_id = $1 AND product_id = $2`,
        [testBinId, testProductId],
      );
      expect(Number(balRes.rows[0].current_quantity)).toBe(40.000);

      // Verify immutable stock transaction created
      const txRes = await pgClient.query(
        `SELECT * FROM stock_transactions WHERE reference_id = $1 AND "referenceType" = 'GENERAL_ISSUE'`,
        [issue.id],
      );
      expect(txRes.rows.length).toBe(1);
      expect(txRes.rows[0].transaction_type).toBe(TransactionType.STOCK_OUT);
      expect(Number(txRes.rows[0].quantity)).toBe(10.000);
      expect(balRes.rows[0].last_transaction_id).toBe(txRes.rows[0].id);
    });

    it('creates a general issue linking optional SC and matching PO', async () => {
      const issue = await service.createIssue(
        {
          scId: testScId,
          poId: testPoId,
          department: TEST_PREFIX,
          reason: 'Rework on component Alpha',
          items: [
            {
              productId: testProductId,
              binId: testBinId,
              quantityIssued: 5.000,
            },
          ],
        },
        testUserId,
      );

      expect(issue).toBeDefined();
      expect(issue.scId).toBe(testScId);
      expect(issue.poId).toBe(testPoId);
      expect(issue.status).toBe(GeneralIssueStatus.ISSUED);

      // Verify stock was decremented from 40 to 35
      const balRes = await pgClient.query(
        `SELECT current_quantity FROM stock_balances WHERE bin_id = $1 AND product_id = $2`,
        [testBinId, testProductId],
      );
      expect(Number(balRes.rows[0].current_quantity)).toBe(35.000);
    });

    it('rejects general issue when SC does not belong to specified PO', async () => {
      // testScId belongs to testPoId, NOT testPoId2
      await expect(
        service.createIssue(
          {
            scId: testScId,
            poId: testPoId2,
            department: TEST_PREFIX,
            reason: 'Mismatch test',
            items: [
              {
                productId: testProductId,
                binId: testBinId,
                quantityIssued: 1.000,
              },
            ],
          },
          testUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Rule: Inventory quantity availability & No negative stock', () => {
    it('rejects general issue when requested quantity exceeds available stock', async () => {
      // Current available is 35.000
      await expect(
        service.createIssue(
          {
            department: TEST_PREFIX,
            reason: 'Excess quantity request',
            items: [
              {
                productId: testProductId,
                binId: testBinId,
                quantityIssued: 100.000, // Exceeds 35
              },
            ],
          },
          testUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify stock is untouched
      const balRes = await pgClient.query(
        `SELECT current_quantity FROM stock_balances WHERE bin_id = $1 AND product_id = $2`,
        [testBinId, testProductId],
      );
      expect(Number(balRes.rows[0].current_quantity)).toBe(35.000);
    });

    it('rejects general issue with zero or negative quantity', async () => {
      await expect(
        service.createIssue(
          {
            department: TEST_PREFIX,
            reason: 'Zero quantity test',
            items: [
              {
                productId: testProductId,
                binId: testBinId,
                quantityIssued: 0,
              },
            ],
          },
          testUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createIssue(
          {
            department: TEST_PREFIX,
            reason: 'Negative quantity test',
            items: [
              {
                productId: testProductId,
                binId: testBinId,
                quantityIssued: -5,
              },
            ],
          },
          testUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Rule: Reversal / Cancellation and Stock Effect', () => {
    it('cancels general issue, flips status to CANCELLED, and restores stock with RETURN transaction', async () => {
      // 1. Create an issue for 8.000 units (balance drops from 35 to 27)
      const issue = await service.createIssue(
        {
          department: TEST_PREFIX,
          reason: 'Test to be cancelled',
          items: [
            {
              productId: testProductId,
              binId: testBinId,
              quantityIssued: 8.000,
            },
          ],
        },
        testUserId,
      );

      const balAfterIssue = await pgClient.query(
        `SELECT current_quantity FROM stock_balances WHERE bin_id = $1 AND product_id = $2`,
        [testBinId, testProductId],
      );
      expect(Number(balAfterIssue.rows[0].current_quantity)).toBe(27.000);

      // 2. Cancel the issue
      const cancelled = await service.cancelIssue(
        issue.id,
        testUserId,
        'Project postponed by client',
      );

      expect(cancelled.status).toBe(GeneralIssueStatus.CANCELLED);
      expect(cancelled.remarks).toContain('Project postponed by client');

      // 3. Verify stock was refunded back to 35.000
      const balAfterCancel = await pgClient.query(
        `SELECT current_quantity, last_transaction_id FROM stock_balances WHERE bin_id = $1 AND product_id = $2`,
        [testBinId, testProductId],
      );
      expect(Number(balAfterCancel.rows[0].current_quantity)).toBe(35.000);

      // 4. Verify immutable RETURN transaction was logged in the ledger
      const refundTxRes = await pgClient.query(
        `SELECT * FROM stock_transactions WHERE reference_id = $1 AND "referenceType" = 'GENERAL_ISSUE_CANCEL'`,
        [issue.id],
      );
      expect(refundTxRes.rows.length).toBe(1);
      expect(refundTxRes.rows[0].transaction_type).toBe(TransactionType.RETURN);
      expect(Number(refundTxRes.rows[0].quantity)).toBe(8.000);
      expect(balAfterCancel.rows[0].last_transaction_id).toBe(refundTxRes.rows[0].id);

      // 5. Verify attempting to cancel again throws BadRequestException
      await expect(
        service.cancelIssue(issue.id, testUserId, 'Repeat cancel'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
