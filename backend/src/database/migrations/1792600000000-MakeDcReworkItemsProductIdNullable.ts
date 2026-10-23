import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeDcReworkItemsProductIdNullable1792600000000 implements MigrationInterface {
    name = 'MakeDcReworkItemsProductIdNullable1792600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dc_rework_items"
            ALTER COLUMN "product_id" DROP NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dc_rework_items"
            ALTER COLUMN "product_id" SET NOT NULL;
        `);
    }
}
