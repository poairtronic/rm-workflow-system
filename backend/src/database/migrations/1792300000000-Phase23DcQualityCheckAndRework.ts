import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 23.1 Migration: Non-destructive addition of QC gate, split accounting, and rework tracking.
 * 
 * STRICT DATA SAFETY:
 * - Uses only ADD COLUMN IF NOT EXISTS and CREATE TABLE IF NOT EXISTS.
 * - Does not alter, delete, drop, or truncate any existing live production tables or rows.
 * - Non-destructively backfills qc_passed_qty = quantity_returned for historical returned records
 *   so existing closed/returned challans preserve mathematical consistency.
 */
export class Phase23DcQualityCheckAndRework1792300000000 implements MigrationInterface {
    name = 'Phase23DcQualityCheckAndRework1792300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add split accounting columns to delivery_challan_items safely
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            ADD COLUMN IF NOT EXISTS "qc_pending_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "qc_passed_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "qc_rejected_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "expected_return_qty" NUMERIC(12, 3),
            ADD COLUMN IF NOT EXISTS "actual_received_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "return_target_bin_id" UUID REFERENCES "bins"("id") ON DELETE SET NULL;
        `);

        // Index for return target bin lookup
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dci_return_target_bin_id" ON "delivery_challan_items"("return_target_bin_id");
        `);

        // 2. Safe non-destructive backfill for historic records:
        // Set qc_passed_qty = quantity_returned for rows where material was already returned before this feature
        await queryRunner.query(`
            UPDATE "delivery_challan_items"
            SET "qc_passed_qty" = "quantity_returned"
            WHERE "quantity_returned" > 0 AND "qc_passed_qty" = 0;
        `);

        // 3. Create dc_qc_inspections table for audit logs of QC inspections
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dc_qc_inspections" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "challan_id" UUID NOT NULL REFERENCES "delivery_challans"("id") ON DELETE CASCADE,
                "challan_item_id" UUID NOT NULL REFERENCES "delivery_challan_items"("id") ON DELETE CASCADE,
                "batch_received_qty" NUMERIC(12, 3) NOT NULL,
                "passed_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
                "rejected_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
                "actual_inward_qty" NUMERIC(12, 3),
                "remarks" TEXT,
                "inspected_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
                "inspected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dc_qc_inspections_challan_id" ON "dc_qc_inspections"("challan_id");
            CREATE INDEX IF NOT EXISTS "IDX_dc_qc_inspections_item_id" ON "dc_qc_inspections"("challan_item_id");
        `);

        // 4. Create dc_rework_items table for managing QC rejections and re-dispatches
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dc_rework_items" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "source_dc_id" UUID NOT NULL REFERENCES "delivery_challans"("id") ON DELETE CASCADE,
                "source_dc_number" VARCHAR(50) NOT NULL,
                "dc_type" VARCHAR(40) NOT NULL,
                "sc_id" UUID REFERENCES "sales_order_components"("id") ON DELETE SET NULL,
                "sc_number" VARCHAR(50),
                "po_id" UUID REFERENCES "purchase_orders"("id") ON DELETE SET NULL,
                "po_number" VARCHAR(50),
                "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
                "product_name" VARCHAR(255) NOT NULL,
                "part_number" VARCHAR(100),
                "uom" VARCHAR(20) NOT NULL DEFAULT 'PCS',
                "original_vendor_id" UUID NOT NULL REFERENCES "vendors"("id") ON DELETE RESTRICT,
                "original_vendor_name" VARCHAR(255) NOT NULL,
                "rejected_qty" NUMERIC(12, 3) NOT NULL,
                "qc_remarks" TEXT,
                "rework_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_ACK',
                "rework_dc_id" UUID REFERENCES "delivery_challans"("id") ON DELETE SET NULL,
                "rework_dc_number" VARCHAR(50),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_source_dc" ON "dc_rework_items"("source_dc_id");
            CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_sc_id" ON "dc_rework_items"("sc_id");
            CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_status" ON "dc_rework_items"("rework_status");
            CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_vendor" ON "dc_rework_items"("original_vendor_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dc_rework_items";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dc_qc_inspections";`);
        await queryRunner.query(`
            ALTER TABLE "delivery_challan_items"
            DROP COLUMN IF EXISTS "return_target_bin_id",
            DROP COLUMN IF EXISTS "actual_received_qty",
            DROP COLUMN IF EXISTS "expected_return_qty",
            DROP COLUMN IF EXISTS "qc_rejected_qty",
            DROP COLUMN IF EXISTS "qc_passed_qty",
            DROP COLUMN IF EXISTS "qc_pending_qty";
        `);
    }
}
