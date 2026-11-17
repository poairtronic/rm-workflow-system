import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase162EmailSkipLog1793900000000 implements MigrationInterface {
  name = 'Phase162EmailSkipLog1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_skip_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_code" character varying(100) NOT NULL,
        "recipient_user_id" uuid,
        "recipient_name" character varying(150),
        "recipient_email" character varying(255),
        "reason" character varying(40) NOT NULL,
        "entity_id" character varying(255),
        "mode" character varying(10) NOT NULL,
        "dedupe_key" character varying(400) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_skip_log_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_skip_log_dedupe_key" UNIQUE ("dedupe_key")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_skip_log_created_at" ON "email_skip_log" ("created_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_skip_log_event_code" ON "email_skip_log" ("event_code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_skip_log_recipient_user_id" ON "email_skip_log" ("recipient_user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_skip_log";`);
  }
}
