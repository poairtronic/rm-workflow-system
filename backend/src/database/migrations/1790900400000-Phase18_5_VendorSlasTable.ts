import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase185VendorSlasTable1790900400000
  implements MigrationInterface
{
  name = 'Phase185VendorSlasTable1790900400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_slas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vendor_id" uuid NOT NULL,
        "process_id" uuid NOT NULL,
        "sla_days" integer NOT NULL,
        "effective_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_slas_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vendor_process_sla" UNIQUE ("vendor_id", "process_id"),
        CONSTRAINT "FK_vendor_slas_vendor_id" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vendor_slas_process_id" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendor_slas_vendor_id" ON "vendor_slas" ("vendor_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendor_slas_process_id" ON "vendor_slas" ("process_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendor_slas_is_active" ON "vendor_slas" ("is_active");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_slas_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_slas_process_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_slas_vendor_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_slas"`);
  }
}
