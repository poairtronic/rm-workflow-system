import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMercIndentPending1793000000000 implements MigrationInterface {
  name = 'CreateMercIndentPending1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merc_indent_pending" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "indent_id" VARCHAR NOT NULL,
        "indent_number" VARCHAR NOT NULL,
        "po_number" VARCHAR,
        "customer_name" VARCHAR,
        "layout_number" VARCHAR,
        "status" VARCHAR NOT NULL DEFAULT 'PENDING',
        "merc_current_state" VARCHAR NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merc_indent_line_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "merc_indent_pending_id" UUID NOT NULL REFERENCES "merc_indent_pending"("id") ON DELETE CASCADE,
        "merc_item_id" VARCHAR NOT NULL,
        "item_type" VARCHAR NOT NULL,
        "name" VARCHAR NOT NULL,
        "material" VARCHAR,
        "shape" VARCHAR,
        "length_mm" DECIMAL,
        "width_mm" DECIMAL,
        "height_mm" DECIMAL,
        "diameter_mm" DECIMAL,
        "quantity_required" DECIMAL NOT NULL,
        "quantity_issued" DECIMAL NOT NULL DEFAULT 0,
        "unit" VARCHAR,
        "status" VARCHAR NOT NULL DEFAULT 'PENDING',
        "rm_product_id" UUID,
        "rm_bin_id" UUID,
        "issued_at" TIMESTAMP,
        "issued_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_merc_indent_pending_indent_id" ON "merc_indent_pending" ("indent_id");
      CREATE INDEX IF NOT EXISTS "idx_merc_indent_pending_indent_number" ON "merc_indent_pending" ("indent_number");
      CREATE INDEX IF NOT EXISTS "idx_merc_indent_line_items_pending_id" ON "merc_indent_line_items" ("merc_indent_pending_id");
      CREATE INDEX IF NOT EXISTS "idx_merc_indent_line_items_merc_item_id" ON "merc_indent_line_items" ("merc_item_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "merc_indent_line_items";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merc_indent_pending";`);
  }
}

