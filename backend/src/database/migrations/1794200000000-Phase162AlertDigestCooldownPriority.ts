import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase162AlertDigestCooldownPriority1794200000000 implements MigrationInterface {
  name = 'Phase162AlertDigestCooldownPriority1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add alert_notification_state table for re-alert cooldown tracking
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_notification_state" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_code" varchar(64) NOT NULL,
        "entity_type" varchar(64) NOT NULL,
        "entity_id" varchar(128) NOT NULL,
        "recipient_user_id" uuid NOT NULL,
        "last_alerted_at" timestamptz NOT NULL,
        "alert_count" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_alert_notification_state" UNIQUE ("event_code", "entity_type", "entity_id", "recipient_user_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_alert_state_lookup" 
      ON "alert_notification_state" ("event_code", "recipient_user_id", "entity_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_alert_state_last_alerted" 
      ON "alert_notification_state" ("last_alerted_at");
    `);

    // 2. Add digest_shadow_log table for SHADOW mode auditing
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "digest_shadow_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_code" varchar(64) NOT NULL,
        "recipient_user_id" uuid NOT NULL,
        "recipient_email" varchar(255) NOT NULL,
        "item_count" integer NOT NULL,
        "item_ids" jsonb NOT NULL,
        "subject" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_digest_shadow_log_event_created" 
      ON "digest_shadow_log" ("event_code", "created_at");
    `);

    // 3. Ensure priority column on email_jobs is SMALLINT with default 5 (additive)
    // 1 = workflow/transactional, 5 = default existing, 9 = sweep/digest alerts
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'email_jobs' AND column_name = 'priority'
        ) THEN 
          ALTER TABLE "email_jobs" ADD COLUMN "priority" smallint DEFAULT 5;
        ELSE
          ALTER TABLE "email_jobs" ALTER COLUMN "priority" DROP NOT NULL;
          ALTER TABLE "email_jobs" ALTER COLUMN "priority" SET DEFAULT 5;
        END IF;
      END $$;
    `);

    // Backfill existing rows from default 100 to standard 5
    await queryRunner.query(`
      UPDATE "email_jobs" 
      SET "priority" = 5 
      WHERE "priority" = 100 OR "priority" IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_jobs_priority_claim" 
      ON "email_jobs" (COALESCE("priority", 5) ASC, "created_at" ASC, "id" ASC)
      WHERE "status" IN ('PENDING', 'RETRYING');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_jobs_priority_claim";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_digest_shadow_log_event_created";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "digest_shadow_log";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_state_last_alerted";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_state_lookup";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_notification_state";`);
  }
}
