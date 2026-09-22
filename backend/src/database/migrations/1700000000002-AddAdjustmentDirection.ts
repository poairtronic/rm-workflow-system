import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdjustmentDirection1700000000002 implements MigrationInterface {
  name = 'AddAdjustmentDirection1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transactions_adjustment_direction_enum') THEN
          CREATE TYPE "public"."stock_transactions_adjustment_direction_enum" AS ENUM('INCREASE', 'DECREASE');
        END IF;
      END $$;`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "adjustment_direction" "public"."stock_transactions_adjustment_direction_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP COLUMN IF EXISTS "adjustment_direction"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."stock_transactions_adjustment_direction_enum"`,
    );
  }
}
