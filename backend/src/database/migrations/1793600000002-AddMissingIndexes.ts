import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingIndexes1793600000002 implements MigrationInterface {
  name = 'AddMissingIndexes1793600000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rm_requests_po_id"
      ON "rm_requests" ("po_id")
      WHERE "po_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rm_requests_sc_id"
      ON "rm_requests" ("sc_id")
      WHERE "sc_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rm_items_rm_form_id"
      ON "rm_items" ("rm_form_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rm_items_sc_id"
      ON "rm_items" ("sc_id")
      WHERE "sc_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_name"
      ON "customers" ("name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rm_requests_po_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rm_requests_sc_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rm_items_rm_form_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rm_items_sc_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_name"`);
  }
}
