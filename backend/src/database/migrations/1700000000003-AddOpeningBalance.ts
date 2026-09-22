import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpeningBalance1700000000003 implements MigrationInterface {
  name = 'AddOpeningBalance1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_balances" ADD COLUMN IF NOT EXISTS "opening_balance" numeric(12,3)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP COLUMN IF EXISTS "opening_balance"`,
    );
  }
}
