import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessNameToDeliveryChallans1791620000000 implements MigrationInterface {
    name = 'AddProcessNameToDeliveryChallans1791620000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "delivery_challans"
            ADD COLUMN IF NOT EXISTS "process_name" VARCHAR(255);
        `);

        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            ADD COLUMN IF NOT EXISTS "process_name" VARCHAR(255);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            DROP COLUMN IF EXISTS "process_name";
        `);

        await queryRunner.query(`
            ALTER TABLE "delivery_challans"
            DROP COLUMN IF EXISTS "process_name";
        `);
    }
}
