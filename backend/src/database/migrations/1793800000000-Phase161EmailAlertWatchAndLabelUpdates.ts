import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase161EmailAlertWatchAndLabelUpdates1793800000000
  implements MigrationInterface
{
  name = 'Phase161EmailAlertWatchAndLabelUpdates1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_alert_watch" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "alert_code" character varying(100) NOT NULL,
        "entity_type" character varying(50) NOT NULL,
        "entity_id" character varying(100) NOT NULL,
        "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_alert_watch_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_alert_watch_alert_entity" UNIQUE ("alert_code", "entity_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_alert_watch_alert_code" ON "email_alert_watch" ("alert_code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_alert_watch_entity_id" ON "email_alert_watch" ("entity_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_alert_watch_first_seen_at" ON "email_alert_watch" ("first_seen_at");
    `);

    await queryRunner.query(`
      UPDATE "notification_events"
      SET "label" = 'Delivery Challan Not Returned (>2 Days)'
      WHERE "code" = 'DC_PENDING_2_DAYS';
    `);

    await queryRunner.query(`
      UPDATE "notification_events"
      SET "label" = 'Consumable Request Open (>2 Days)'
      WHERE "code" = 'CONSUMABLE_PENDING_2_DAYS';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "notification_events"
      SET "label" = 'Delivery Challan Pending Dispatch (>2 Days)'
      WHERE "code" = 'DC_PENDING_2_DAYS';
    `);

    await queryRunner.query(`
      UPDATE "notification_events"
      SET "label" = 'Consumable Pending Issue (>2 Days)'
      WHERE "code" = 'CONSUMABLE_PENDING_2_DAYS';
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "email_alert_watch";`);
  }
}
