import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLineDescriptionToConsumableRequestItems1794700000000 implements MigrationInterface {
  name = 'AddLineDescriptionToConsumableRequestItems1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items"
      ADD COLUMN IF NOT EXISTS "line_description" text DEFAULT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items"
      DROP COLUMN IF EXISTS "line_description";
    `);
  }
}
