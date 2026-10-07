import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase17B33NotificationsAndStockReasons1791353000000 implements MigrationInterface {
    name = 'Phase17B33NotificationsAndStockReasons1791353000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_transactions" DROP COLUMN IF EXISTS "reason"`);
    }
}
