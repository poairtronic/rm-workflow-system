import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInventoryGapsColumns1791450560947 implements MigrationInterface {
    name = 'AddInventoryGapsColumns1791450560947'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_transactions" ADD "lot_batch_number" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "stock_transactions" ADD "cost" numeric(12,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_transactions" DROP COLUMN "cost"`);
        await queryRunner.query(`ALTER TABLE "stock_transactions" DROP COLUMN "lot_batch_number"`);
    }

}
