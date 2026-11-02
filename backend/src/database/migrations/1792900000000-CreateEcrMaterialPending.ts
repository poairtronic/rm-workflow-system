import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEcrMaterialPending1792900000000 implements MigrationInterface {
  name = 'CreateEcrMaterialPending1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ecr_material_pending" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "ecr_id" VARCHAR NOT NULL,
        "report_number" VARCHAR NOT NULL,
        "type" VARCHAR NOT NULL,
        "sc_number" VARCHAR NOT NULL,
        "po_number" VARCHAR NOT NULL,
        "component" VARCHAR NOT NULL,
        "quantity_affected" INTEGER NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'PENDING',
        "issued_at" TIMESTAMP,
        "issued_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "stock_transaction_id" UUID,
        "approved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'ECR_REWORK_ISSUE';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ecr_material_pending";`);

    // Note: PostgreSQL does not support removing enum values from an existing enum type without recreating the enum type.
  }
}

