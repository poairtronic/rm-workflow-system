import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase1511InAppNotificationsTable1790500000000
  implements MigrationInterface
{
  name = 'Phase1511InAppNotificationsTable1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "message" text NOT NULL,
        "type" character varying(50) NOT NULL DEFAULT 'INFO',
        "target_entity" character varying(50),
        "target_id" character varying(100),
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_id" ON "notifications" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_is_read" ON "notifications" ("is_read")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_notifications_user_id') THEN
          ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_user_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_is_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
