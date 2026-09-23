import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase153AddPriorityToEmailJobs1790200000000 implements MigrationInterface {
  name = 'Phase153AddPriorityToEmailJobs1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_jobs"
      ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 100
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_jobs_queue_claim"
      ON "email_jobs" ("status", "next_retry_at", "priority" DESC, "created_at" ASC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_jobs_queue_claim"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_jobs" DROP COLUMN IF EXISTS "priority"`,
    );
  }
}
