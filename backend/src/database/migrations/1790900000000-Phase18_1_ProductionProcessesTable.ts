import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase181ProductionProcessesTable1790900000000
  implements MigrationInterface
{
  name = 'Phase181ProductionProcessesTable1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "production_processes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "sequence_number" integer NOT NULL,
        "category" character varying(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_production_processes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_production_processes_code" UNIQUE ("code"),
        CONSTRAINT "UQ_production_processes_sequence" UNIQUE ("sequence_number")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_production_processes_code" ON "production_processes" ("code");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_production_processes_sequence" ON "production_processes" ("sequence_number");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_production_processes_sequence"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_production_processes_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "production_processes"`);
  }
}
