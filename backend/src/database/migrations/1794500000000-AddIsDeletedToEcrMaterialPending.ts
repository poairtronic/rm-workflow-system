import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToEcrMaterialPending1794500000000 implements MigrationInterface {
  name = 'AddIsDeletedToEcrMaterialPending1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ecr_material_pending"
      ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ecr_material_pending_is_deleted"
      ON "ecr_material_pending" ("is_deleted");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_ecr_material_pending_is_deleted";
    `);
    await queryRunner.query(`
      ALTER TABLE "ecr_material_pending"
      DROP COLUMN IF EXISTS "is_deleted";
    `);
  }
}
