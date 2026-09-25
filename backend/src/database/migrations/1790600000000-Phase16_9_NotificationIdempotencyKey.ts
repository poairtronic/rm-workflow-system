import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase169NotificationIdempotencyKey1790600000000
  implements MigrationInterface {
  name = 'Phase169NotificationIdempotencyKey1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(255)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_idempotency_key" ON "notifications" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notifications_idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "idempotency_key"`);
  }
}
