import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Safe non-destructive addition of initial_expected_qty to delivery_challan_items.
 * Enables tracking initial expected items vs revised expected on receiving vs variation vs actual received.
 */
export class AddInitialExpectedQtyToDcItems1792500000000 implements MigrationInterface {
    name = 'AddInitialExpectedQtyToDcItems1792500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            ADD COLUMN IF NOT EXISTS "initial_expected_qty" NUMERIC(12, 3);
        `);

        // Safe backfill for historical items
        await queryRunner.query(`
            UPDATE "delivery_challan_items"
            SET "initial_expected_qty" = COALESCE("expected_output_quantity", "quantity_dispatched")
            WHERE "initial_expected_qty" IS NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            DROP COLUMN IF EXISTS "initial_expected_qty";
        `);
    }
}
