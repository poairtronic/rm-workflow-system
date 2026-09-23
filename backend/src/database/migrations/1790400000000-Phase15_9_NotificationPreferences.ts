import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase159NotificationPreferences1790400000000
  implements MigrationInterface
{
  name = 'Phase159NotificationPreferences1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(100) NOT NULL,
        "value" character varying(255) NOT NULL,
        "updated_by" character varying(100),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_settings_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value")
      VALUES ('GLOBAL_WORKFLOW_EMAIL_ENABLED', 'true')
      ON CONFLICT ("key") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "workflow_email_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notification_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_notification_preferences_user_id" UNIQUE ("user_id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_notification_preferences_user_id') THEN
          ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "FK_user_notification_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" DROP CONSTRAINT IF EXISTS "FK_user_notification_preferences_user_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_notification_preferences"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "system_settings"`);
  }
}
