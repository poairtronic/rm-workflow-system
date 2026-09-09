import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdjustmentDirection1700000000002 implements MigrationInterface {
  name = 'AddAdjustmentDirection1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."stock_transactions_adjustment_direction_enum" AS ENUM('INCREASE', 'DECREASE')`
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" ADD "adjustment_direction" "public"."stock_transactions_adjustment_direction_enum"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP COLUMN "adjustment_direction"`
    );
    await queryRunner.query(
      `DROP TYPE "public"."stock_transactions_adjustment_direction_enum"`
    );
  }
}
