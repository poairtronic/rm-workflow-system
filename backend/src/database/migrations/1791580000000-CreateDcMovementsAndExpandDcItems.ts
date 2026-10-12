import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDcMovementsAndExpandDcItems1791580000000 implements MigrationInterface {
    name = 'CreateDcMovementsAndExpandDcItems1791580000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Expand delivery_challan_items table with Type 2 stock conversion fields
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            ADD COLUMN IF NOT EXISTS "output_product_id" UUID REFERENCES "products"("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "expected_output_quantity" NUMERIC(12, 3),
            ADD COLUMN IF NOT EXISTS "output_bin_id" UUID REFERENCES "bins"("id") ON DELETE SET NULL;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dci_output_product_id" ON "delivery_challan_items"("output_product_id");
            CREATE INDEX IF NOT EXISTS "IDX_dci_output_bin_id" ON "delivery_challan_items"("output_bin_id");
        `);

        // 2. Create dc_movements ledger table for DC Type 1 internal process movements
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dc_movements" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "challan_id" UUID NOT NULL REFERENCES "delivery_challans"("id") ON DELETE CASCADE,
                "challan_item_id" UUID NOT NULL REFERENCES "delivery_challan_items"("id") ON DELETE CASCADE,
                "sc_id" UUID NOT NULL REFERENCES "sales_order_components"("id") ON DELETE RESTRICT,
                "process_id" UUID REFERENCES "production_processes"("id") ON DELETE SET NULL,
                "dispatched_product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
                "dispatched_qty" NUMERIC(12, 3) NOT NULL,
                "returned_product_id" UUID REFERENCES "products"("id") ON DELETE RESTRICT,
                "returned_qty" NUMERIC(12, 3) DEFAULT 0,
                "status" VARCHAR(50) NOT NULL DEFAULT 'DISPATCHED',
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dc_movements_sc_product" ON "dc_movements"("sc_id", "dispatched_product_id");
            CREATE INDEX IF NOT EXISTS "IDX_dc_movements_challan_id" ON "dc_movements"("challan_id");
            CREATE INDEX IF NOT EXISTS "IDX_dc_movements_challan_item_id" ON "dc_movements"("challan_item_id");
            CREATE INDEX IF NOT EXISTS "IDX_dc_movements_status" ON "dc_movements"("status");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dc_movements";`);
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            DROP COLUMN IF EXISTS "output_product_id",
            DROP COLUMN IF EXISTS "expected_output_quantity",
            DROP COLUMN IF EXISTS "output_bin_id";
        `);
    }
}

