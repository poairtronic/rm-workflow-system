import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseQtyToConsumableRequestItems1792700000000 implements MigrationInterface {
  name = 'AddPurchaseQtyToConsumableRequestItems1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items"
      ADD COLUMN IF NOT EXISTS "purchase_qty" numeric(12,3) DEFAULT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items"
      DROP COLUMN IF EXISTS "purchase_qty";
    `);
  }
}
