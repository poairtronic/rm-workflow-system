import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSplDcSupport1793300000000 implements MigrationInterface {
  name = 'AddSplDcSupport1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. dc_type / type in delivery_challans and dc_type in dc_rework_items are VARCHAR(40), not Postgres enums.
    // No change needed for enum type; 'SPL_PROCESS' will be stored as VARCHAR.

    // 2. Add SPL-specific columns to delivery_challans
    await queryRunner.query(`
      ALTER TABLE "delivery_challans"
        ADD COLUMN IF NOT EXISTS "po_number" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "layout_number" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "merc_indent_id" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "merc_indent_number" VARCHAR(100);
    `);

    // 3. Add SPL-specific columns to delivery_challan_items
    await queryRunner.query(`
      ALTER TABLE "delivery_challan_items"
        ADD COLUMN IF NOT EXISTS "po_part_label" VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "is_extra_item" BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "merc_item_id" VARCHAR(255);
    `);

    // 4. Index for PO-based lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_delivery_challans_po_number"
        ON "delivery_challans"("po_number")
        WHERE "po_number" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_delivery_challans_po_number";
    `);

    await queryRunner.query(`
      ALTER TABLE "delivery_challan_items"
        DROP COLUMN IF EXISTS "merc_item_id",
        DROP COLUMN IF EXISTS "is_extra_item",
        DROP COLUMN IF EXISTS "po_part_label";
    `);

    await queryRunner.query(`
      ALTER TABLE "delivery_challans"
        DROP COLUMN IF EXISTS "merc_indent_number",
        DROP COLUMN IF EXISTS "merc_indent_id",
        DROP COLUMN IF EXISTS "layout_number",
        DROP COLUMN IF EXISTS "po_number";
    `);
  }
}

