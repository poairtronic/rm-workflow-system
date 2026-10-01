import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase184VendorProcessCapabilitiesTable1790900300000
  implements MigrationInterface
{
  name = 'Phase184VendorProcessCapabilitiesTable1790900300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_process_capabilities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vendor_id" uuid NOT NULL,
        "process_id" uuid NOT NULL,
        "is_approved" boolean NOT NULL DEFAULT true,
        "lead_time_days" integer,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_process_capabilities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vendor_process" UNIQUE ("vendor_id", "process_id"),
        CONSTRAINT "FK_vpc_vendor_id" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vpc_process_id" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vpc_vendor_id" ON "vendor_process_capabilities" ("vendor_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vpc_process_id" ON "vendor_process_capabilities" ("process_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vpc_is_approved" ON "vendor_process_capabilities" ("is_approved");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vpc_is_approved"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vpc_process_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vpc_vendor_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_process_capabilities"`);
  }
}

