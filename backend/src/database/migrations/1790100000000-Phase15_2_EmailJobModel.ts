import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase152EmailJobModel1790100000000 implements MigrationInterface {
  name = 'Phase152EmailJobModel1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_user_id" uuid,
        "recipient_email" character varying(255) NOT NULL,
        "recipient_name" character varying(150),
        "event_type" character varying(100) NOT NULL,
        "template_key" character varying(100) NOT NULL,
        "subject" character varying(255) NOT NULL,
        "body_text" text NOT NULL,
        "body_html" text NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 3,
        "last_error" text,
        "next_retry_at" TIMESTAMP WITH TIME ZONE,
        "locked_at" TIMESTAMP WITH TIME ZONE,
        "locked_by" character varying(100),
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "provider" character varying(50) NOT NULL DEFAULT 'GMAIL_API',
        "provider_message_id" character varying(255),
        "idempotency_key" character varying(255) NOT NULL,
        "payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_email_jobs_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "CHK_email_jobs_attempts_non_negative" CHECK (attempts >= 0),
        CONSTRAINT "CHK_email_jobs_max_attempts_positive" CHECK (max_attempts > 0),
        CONSTRAINT "PK_email_jobs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_jobs_status_next_retry" ON "email_jobs" ("status", "next_retry_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_jobs_recipient_user_id" ON "email_jobs" ("recipient_user_id")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_email_jobs_recipient_user_id') THEN
          ALTER TABLE "email_jobs" ADD CONSTRAINT "FK_email_jobs_recipient_user_id" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_jobs" DROP CONSTRAINT IF EXISTS "FK_email_jobs_recipient_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_jobs_recipient_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_email_jobs_status_next_retry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_jobs" DROP CONSTRAINT IF EXISTS "CHK_email_jobs_max_attempts_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_jobs" DROP CONSTRAINT IF EXISTS "CHK_email_jobs_attempts_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_jobs" DROP CONSTRAINT IF EXISTS "UQ_email_jobs_idempotency_key"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "email_jobs"`);
  }
}
