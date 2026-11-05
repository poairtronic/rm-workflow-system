import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendorAndSourceToMercIndentLineItems1793200000000 implements MigrationInterface {
  name = 'AddVendorAndSourceToMercIndentLineItems1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merc_indent_line_items"
      ADD COLUMN IF NOT EXISTS "vendor_name" VARCHAR(255);
    `);

    await queryRunner.query(`
      ALTER TABLE "merc_indent_line_items"
      ADD COLUMN IF NOT EXISTS "source" VARCHAR(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merc_indent_line_items"
      DROP COLUMN IF EXISTS "vendor_name";
    `);

    await queryRunner.query(`
      ALTER TABLE "merc_indent_line_items"
      DROP COLUMN IF EXISTS "source";
    `);
  }
}
