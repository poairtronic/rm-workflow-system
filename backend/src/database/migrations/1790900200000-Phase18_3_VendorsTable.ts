import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase183VendorsTable1790900200000 implements MigrationInterface {
  name = 'Phase183VendorsTable1790900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "category" character varying(50),
        "contact_person" character varying(100),
        "email" character varying(150),
        "phone" character varying(50),
        "address" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendors_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vendors_code" UNIQUE ("code")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendors_code" ON "vendors" ("code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendors_name" ON "vendors" ("name");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendors_is_active" ON "vendors" ("is_active");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendors_category" ON "vendors" ("category");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendors_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendors_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendors_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendors_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendors"`);
  }
}
