import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemarksToDeliveryChallans1794000000000 implements MigrationInterface {
  name = 'AddRemarksToDeliveryChallans1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_challans"
      ADD COLUMN IF NOT EXISTS "remarks" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_challans"
      DROP COLUMN IF EXISTS "remarks"
    `);
  }
}
