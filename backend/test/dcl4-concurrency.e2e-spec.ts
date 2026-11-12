import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../src/config/data-source.js';
import { DeliveryChallanService } from '../src/delivery-challan/delivery-challan.service.js';
import { DeliveryChallanType, DeliveryChallanStatus } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { ConflictException } from '@nestjs/common';
import crypto from 'crypto';

describe('DCL.4 Real Concurrency Integration Test on PostgreSQL', () => {
  let testDataSource: DataSource;
  let service: DeliveryChallanService;
  const testScId = crypto.randomUUID();
  const testScNumber = `SC-CONC-${Date.now().toString().slice(-6)}`;
  const testProduct = `CONC-PIN-${Date.now().toString().slice(-4)}`;
  const testPoNumber = `PO-CONC-${Date.now().toString().slice(-6)}`;
  const testMercItemId = `merc-${Date.now().toString().slice(-6)}`;
  let testVendorId: string;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
    const isSsl = dbUrl?.includes('sslmode=require') || process.env.NODE_ENV === 'production';

    testDataSource = new DataSource({
      type: 'postgres',
      url: dbUrl,
      entities: ALL_ENTITIES,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
    });

    await testDataSource.initialize();

    service = new DeliveryChallanService(
      testDataSource.getRepository('DeliveryChallan'),
      testDataSource.getRepository('DeliveryChallanItem'),
      testDataSource.getRepository('DcMovement'),
      testDataSource.getRepository('DcQcInspection'),
      testDataSource.getRepository('DcReworkItem'),
      testDataSource.getRepository('MercIndentPending'),
      testDataSource.getRepository('MercIndentLineItem'),
      testDataSource,
    );

    // Get an existing vendor or create a test one
    const vendorRes = await testDataSource.query(`SELECT id FROM vendors LIMIT 1;`);
    if (vendorRes && vendorRes.length > 0) {
      testVendorId = vendorRes[0].id;
    } else {
      const vId = crypto.randomUUID();
      await testDataSource.query(`
        INSERT INTO vendors (id, name, code, is_active, created_at, updated_at)
        VALUES ($1, 'Test Concurrency Vendor', 'V-CONC-TEST', true, NOW(), NOW());
      `, [vId]);
      testVendorId = vId;
    }

    // Seed Type 1 test SC and rm_items with cap = 5
    const poRes = await testDataSource.query(`SELECT id FROM purchase_orders LIMIT 1;`);
    const poId = poRes?.[0]?.id;

    await testDataSource.query(`
      INSERT INTO sales_order_components (id, po_id, sc_number, product_name, target_quantity, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 5, NOW(), NOW());
    `, [testScId, poId, testScNumber, testProduct]);

    const formRes = await testDataSource.query(`SELECT rm_form_id FROM rm_items WHERE rm_form_id IS NOT NULL LIMIT 1;`);
    const rmFormId = formRes?.[0]?.rm_form_id;

    await testDataSource.query(`
      INSERT INTO rm_items (id, sc_id, rm_form_id, material, material_type, grade, size, weight_unit, part_name, quantity, created_at, updated_at)
      VALUES ($1, $2, $3, 'STEEL', 'BAR', 'EN31', '10MM', 'KG', $4, 5, NOW(), NOW());
    `, [crypto.randomUUID(), testScId, rmFormId, testProduct]);

    // Seed Type 3 test PO and merc_indent_line_items with cap = 5
    const indentId = crypto.randomUUID();
    await testDataSource.query(`
      INSERT INTO merc_indent_pending (id, indent_id, po_number, indent_number, status, merc_current_state, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'PENDING', 'APPROVED', NOW(), NOW());
    `, [indentId, `IND-${testPoNumber}`, testPoNumber, `IND-${testPoNumber}`]);

    await testDataSource.query(`
      INSERT INTO merc_indent_line_items (id, merc_indent_pending_id, merc_item_id, item_type, name, quantity_required, quantity_issued, status, created_at)
      VALUES ($1, $2, $3, 'RAW_MATERIAL', $4, 5, 5, 'ISSUED', NOW());
    `, [crypto.randomUUID(), indentId, testMercItemId, testProduct]);
  }, 60000);

  afterAll(async () => {
    // Clean up test data
    try {
      await testDataSource.query(`
        DELETE FROM delivery_challan_items WHERE part_name = $1;
      `, [testProduct]);
      await testDataSource.query(`
        DELETE FROM delivery_challans WHERE challan_number LIKE 'SDC/CONC-%';
      `);
      await testDataSource.query(`
        DELETE FROM rm_items WHERE sc_id = $1;
      `, [testScId]);
      await testDataSource.query(`
        DELETE FROM sales_order_components WHERE id = $1;
      `, [testScId]);
      await testDataSource.query(`
        DELETE FROM merc_indent_line_items WHERE merc_item_id = $1;
      `, [testMercItemId]);
      await testDataSource.query(`
        DELETE FROM merc_indent_pending WHERE po_number = $1;
      `, [testPoNumber]);
      await testDataSource.destroy();
    } catch {
      // ignore
    }
  }, 60000);

  it('Type 1 Real PostgreSQL Concurrency: 20 parallel creates against available = 5 with qty 1 each -> exactly 5 succeed, 15 get 409, total dispatched = 5', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, async (_, i) => {
        return await testDataSource.transaction(async (manager) => {
          // Run product lock validation
          await service.validateProductLock(
            DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
            [{
              scId: testScId,
              partName: testProduct,
              requestedQty: 1,
            }],
            manager,
          );

          // If allowed, create the DC and DC item
          const dcId = crypto.randomUUID();
          const dcNumber = `SDC/CONC-T1-${Date.now()}-${i}`;
          await manager.query(`
            INSERT INTO delivery_challans (id, challan_number, type, vendor_id, status, dispatch_date, created_at, updated_at)
            VALUES ($1, $2, 'PRODUCTION_PROCESS_OUTWARD', $3, 'OPEN', NOW(), NOW(), NOW());
          `, [dcId, dcNumber, testVendorId]);

          await manager.query(`
            INSERT INTO delivery_challan_items (
              id, challan_id, sc_id, part_name, quantity_dispatched, quantity_returned, 
              qc_pending_qty, qc_passed_qty, qc_rejected_qty, actual_received_qty, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, 1, 0, 0, 0, 0, 0, NOW(), NOW());
          `, [crypto.randomUUID(), dcId, testScId, testProduct]);

          return { success: true, i };
        });
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    if (succeeded.length !== 5) {
      console.error('FAILED REASONS (sample):', failed.slice(0, 3).map((f: any) => f.reason));
    }

    expect(succeeded.length).toBe(5);
    expect(failed.length).toBe(15);

    // Verify all 15 failures were 409 ConflictException with DC_PRODUCT_LOCKED
    failed.forEach((f: any) => {
      const err = f.reason;
      expect(err).toBeInstanceOf(ConflictException);
      const resp = err.getResponse();
      expect(resp.code).toBe('DC_PRODUCT_LOCKED');
    });

    // Verify database totals directly with SQL
    const countRes = await testDataSource.query(`
      SELECT COUNT(*) as count, SUM(quantity_dispatched) as total_dispatched
      FROM delivery_challan_items
      WHERE sc_id = $1 AND part_name = $2;
    `, [testScId, testProduct]);

    expect(Number(countRes[0].count)).toBe(5);
    expect(Number(countRes[0].total_dispatched)).toBe(5);
  }, 90000);

  it('Type 3 Real PostgreSQL Concurrency: 20 parallel creates against available = 5 with qty 1 each -> exactly 5 succeed, 15 get 409, total dispatched = 5', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, async (_, i) => {
        return await testDataSource.transaction(async (manager) => {
          // Run product lock validation
          await service.validateProductLock(
            DeliveryChallanType.SPL_PROCESS,
            [{
              poNumber: testPoNumber,
              mercItemId: testMercItemId,
              poPartLabel: `${testPoNumber} - ${testProduct}`,
              requestedQty: 1,
            }],
            manager,
          );

          // If allowed, create the DC and DC item
          const dcId = crypto.randomUUID();
          const dcNumber = `SDC/CONC-T3-${Date.now()}-${i}`;
          await manager.query(`
            INSERT INTO delivery_challans (id, challan_number, type, po_number, vendor_id, status, dispatch_date, created_at, updated_at)
            VALUES ($1, $2, 'SPL_PROCESS', $3, $4, 'OPEN', NOW(), NOW(), NOW());
          `, [dcId, dcNumber, testPoNumber, testVendorId]);

          await manager.query(`
            INSERT INTO delivery_challan_items (
              id, challan_id, merc_item_id, part_name, quantity_dispatched, quantity_returned, 
              qc_pending_qty, qc_passed_qty, qc_rejected_qty, actual_received_qty, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, 1, 0, 0, 0, 0, 0, NOW(), NOW());
          `, [crypto.randomUUID(), dcId, testMercItemId, testProduct]);

          return { success: true, i };
        });
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    if (succeeded.length !== 5) {
      console.error('FAILED REASONS (sample):', failed.slice(0, 3).map((f: any) => f.reason));
    }

    expect(succeeded.length).toBe(5);
    expect(failed.length).toBe(15);

    // Verify all 15 failures were 409 ConflictException with DC_PRODUCT_LOCKED
    failed.forEach((f: any) => {
      const err = f.reason;
      expect(err).toBeInstanceOf(ConflictException);
      const resp = err.getResponse();
      expect(resp.code).toBe('DC_PRODUCT_LOCKED');
    });

    // Verify database totals directly with SQL
    const countRes = await testDataSource.query(`
      SELECT COUNT(*) as count, SUM(quantity_dispatched) as total_dispatched
      FROM delivery_challan_items
      WHERE merc_item_id = $1 AND part_name = $2;
    `, [testMercItemId, testProduct]);

    expect(Number(countRes[0].count)).toBe(5);
    expect(Number(countRes[0].total_dispatched)).toBe(5);
  }, 90000);
});
