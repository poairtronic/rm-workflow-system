import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase157EmailAuditLogging1790300000000 implements MigrationInterface {
  name = 'Phase157EmailAuditLogging1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "event_type" character varying(100) NOT NULL,
        "recipient_email" character varying(255) NOT NULL,
        "recipient_user_id" uuid,
        "recipient_name" character varying(150),
        "subject" character varying(255) NOT NULL,
        "provider" character varying(50) NOT NULL DEFAULT 'GMAIL_API',
        "attempt" integer NOT NULL,
        "status" character varying(50) NOT NULL,
        "provider_message_id" character varying(255),
        "error_code" character varying(100),
        "error_message" text,
        "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_logs_job_id" ON "email_logs" ("job_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_logs_created_at" ON "email_logs" ("created_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_logs_provider_message_id" ON "email_logs" ("provider_message_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_logs_status" ON "email_logs" ("status")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_email_logs_job_id') THEN
          ALTER TABLE "email_logs"
          ADD CONSTRAINT "FK_email_logs_job_id"
          FOREIGN KEY ("job_id")
          REFERENCES "email_jobs"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_email_logs_recipient_user_id') THEN
          ALTER TABLE "email_logs"
          ADD CONSTRAINT "FK_email_logs_recipient_user_id"
          FOREIGN KEY ("recipient_user_id")
          REFERENCES "users"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "FK_email_logs_recipient_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "FK_email_logs_job_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_logs_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_logs_provider_message_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_logs_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_logs_job_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "email_logs"`);
  }
}
