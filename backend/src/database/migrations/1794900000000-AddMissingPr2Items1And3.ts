import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingPr2Items1And3179490000000 implements MigrationInterface {
  name = 'AddMissingPr2Items1And3179490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure WIN WIN DIAMOND PRDUCTS vendor exists if missing
    await queryRunner.query(`
      INSERT INTO "vendors" ("id", "code", "name", "phone", "address", "is_active", "created_at", "updated_at")
      SELECT 
        '080b0e93-fbf0-4aba-a6f0-03cb6f4e6599',
        'VND-199',
        'WIN WIN DIAMOND PRDUCTS',
        '8056224669',
        'PLOT NO 5, SANTHOSH NAGAR, HARIVARDHAN STREET,, KANDANCHAVADI, OMR',
        true,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "vendors" WHERE LOWER(name) LIKE '%win win diamond%'
      );
    `);

    // 2. Ensure product for CENTER POINT DRESSER 12MM exists
    await queryRunner.query(`
      INSERT INTO "products" ("id", "family_id", "code", "barcode", "name", "minimum_inventory", "is_active", "uom", "created_at", "updated_at")
      SELECT 
        gen_random_uuid(),
        (SELECT id FROM product_families WHERE LOWER(name) LIKE '%consumable%' LIMIT 1),
        'CENTER POINT DRESSER 12MM',
        'PRD-CENTER POINT DRESSER 12MM',
        'CENTER POINT DRESSER 12MM',
        0,
        true,
        'NOS',
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "products" WHERE LOWER(name) = LOWER('CENTER POINT DRESSER 12MM')
      );
    `);

    // 3. Ensure product for DIAMOND WHEEL 150X12TX6xX31.75 exists
    await queryRunner.query(`
      INSERT INTO "products" ("id", "family_id", "code", "barcode", "name", "minimum_inventory", "is_active", "uom", "created_at", "updated_at")
      SELECT 
        gen_random_uuid(),
        (SELECT id FROM product_families WHERE LOWER(name) LIKE '%consumable%' LIMIT 1),
        'DIAMOND WHEEL 150X12TX6xX31.75',
        'PRD-DIAMOND WHEEL 150X12TX6xX31.75',
        'DIAMOND WHEEL 150X12TX6xX31.75',
        0,
        true,
        'NOS',
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "products" WHERE LOWER(name) = LOWER('DIAMOND WHEEL 150X12TX6xX31.75')
      );
    `);

    // 4. Insert Line Item 1 into consumable_request_items under CR-2026-0002 / PR 2
    await queryRunner.query(`
      INSERT INTO "consumable_request_items" (
        "id", "request_id", "pr_number", "product_id", "product_code", "description",
        "uom", "is_new_product", "item_category_track", "stock_available_at_request",
        "requested_qty", "purchase_qty", "real_received_qty", "issued_qty",
        "vendor_id", "vendor_name", "end_user_in_velan", "requested_by",
        "status", "approval_status", "printed_at", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(),
        req.id,
        '2',
        p.id,
        p.code,
        'CENTER POINT DRESSER 12MM',
        'NOS',
        true,
        'NON_STOCK_OR_NEW',
        0,
        2.000,
        2.000,
        0.000,
        0.000,
        NULL,
        'Open Market / Stores Choice',
        'SIDHARTH',
        'SHANGAVI',
        'PURCHASE_REQUESTED',
        'APPROVED',
        NOW(),
        NOW(),
        NOW()
      FROM (SELECT id FROM consumable_requests WHERE request_code IN ('CR-2026-0002', 'CR-2026-002') ORDER BY created_at DESC LIMIT 1) req
      CROSS JOIN (SELECT id, code FROM products WHERE LOWER(name) = LOWER('CENTER POINT DRESSER 12MM') LIMIT 1) p
      WHERE NOT EXISTS (
        SELECT 1 FROM consumable_request_items 
        WHERE request_id = req.id AND LOWER(description) = LOWER('CENTER POINT DRESSER 12MM')
      );
    `);

    // 5. Insert Line Item 3 into consumable_request_items under CR-2026-0002 / PR 2
    await queryRunner.query(`
      INSERT INTO "consumable_request_items" (
        "id", "request_id", "pr_number", "product_id", "product_code", "description",
        "uom", "is_new_product", "item_category_track", "stock_available_at_request",
        "requested_qty", "purchase_qty", "real_received_qty", "issued_qty",
        "vendor_id", "vendor_name", "end_user_in_velan", "requested_by",
        "status", "approval_status", "printed_at", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(),
        req.id,
        '2',
        p.id,
        p.code,
        'DIAMOND WHEEL 150X12TX6xX31.75',
        'NOS',
        true,
        'NON_STOCK_OR_NEW',
        0,
        1.000,
        1.000,
        0.000,
        0.000,
        v.id,
        'WIN WIN DIAMOND PRDUCTS',
        'SIDHARTH',
        'SHANGAVI',
        'PURCHASE_REQUESTED',
        'APPROVED',
        NOW(),
        NOW(),
        NOW()
      FROM (SELECT id FROM consumable_requests WHERE request_code IN ('CR-2026-0002', 'CR-2026-002') ORDER BY created_at DESC LIMIT 1) req
      CROSS JOIN (SELECT id, code FROM products WHERE LOWER(name) = LOWER('DIAMOND WHEEL 150X12TX6xX31.75') LIMIT 1) p
      LEFT JOIN (SELECT id FROM vendors WHERE LOWER(name) LIKE '%win win diamond%' LIMIT 1) v ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM consumable_request_items 
        WHERE request_id = req.id AND LOWER(description) = LOWER('DIAMOND WHEEL 150X12TX6xX31.75')
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op rollback
  }
}
