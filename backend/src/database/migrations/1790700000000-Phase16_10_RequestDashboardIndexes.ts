import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase1610RequestDashboardIndexes1790700000000
  implements MigrationInterface
{
  name = 'Phase1610RequestDashboardIndexes1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_additional_material_requests_status_created_at"
      ON "additional_material_requests" ("status", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_additional_material_request_items_request_created_at"
      ON "additional_material_request_items" ("request_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rm_requests_status_created_at"
      ON "rm_requests" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_rm_requests_status_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_additional_material_request_items_request_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_additional_material_requests_status_created_at"`,
    );
  }
}
