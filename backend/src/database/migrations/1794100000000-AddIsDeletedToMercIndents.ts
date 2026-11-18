import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToMercIndents1794100000000 implements MigrationInterface {
  name = 'AddIsDeletedToMercIndents1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merc_indent_pending"
      ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "merc_indent_line_items"
      ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_merc_indent_pending_is_deleted"
      ON "merc_indent_pending" ("is_deleted");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_merc_indent_line_items_is_deleted"
      ON "merc_indent_line_items" ("is_deleted");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_merc_indent_line_items_is_deleted";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_merc_indent_pending_is_deleted";
    `);
    await queryRunner.query(`
      ALTER TABLE "merc_indent_line_items"
      DROP COLUMN IF EXISTS "is_deleted";
    `);
    await queryRunner.query(`
      ALTER TABLE "merc_indent_pending"
      DROP COLUMN IF EXISTS "is_deleted";
    `);
  }
}
