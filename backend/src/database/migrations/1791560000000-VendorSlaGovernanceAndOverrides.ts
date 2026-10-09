import { MigrationInterface, QueryRunner } from "typeorm";

export class VendorSlaGovernanceAndOverrides1791560000000 implements MigrationInterface {
    name = 'VendorSlaGovernanceAndOverrides1791560000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Extend vendor_slas table with governance and alert parameters
        await queryRunner.query(`
            ALTER TABLE "vendor_slas"
            ADD COLUMN IF NOT EXISTS "lead_time_multiplier" NUMERIC(4, 2) DEFAULT 1.00,
            ADD COLUMN IF NOT EXISTS "tolerance_buffer_days" INT DEFAULT 1,
            ADD COLUMN IF NOT EXISTS "alert_72h" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "alert_48h" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "alert_24h" BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS "email_alerts_enabled" BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS "sms_alerts_enabled" BOOLEAN DEFAULT false;
        `);

        // 2. Create vendor_sla_overrides audit table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "vendor_sla_overrides" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "sla_id" UUID NOT NULL REFERENCES "vendor_slas"("id") ON DELETE CASCADE,
                "dc_id" UUID REFERENCES "delivery_challans"("id") ON DELETE SET NULL,
                "authorized_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
                "original_target_date" TIMESTAMPTZ,
                "new_target_date" TIMESTAMPTZ NOT NULL,
                "justification_code" VARCHAR(50) NOT NULL,
                "justification_notes" TEXT NOT NULL,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_vendor_sla_overrides_sla_id" ON "vendor_sla_overrides"("sla_id");
            CREATE INDEX IF NOT EXISTS "idx_vendor_sla_overrides_authorized_by" ON "vendor_sla_overrides"("authorized_by_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_sla_overrides";`);
        await queryRunner.query(`
            ALTER TABLE "vendor_slas"
            DROP COLUMN IF EXISTS "lead_time_multiplier",
            DROP COLUMN IF EXISTS "tolerance_buffer_days",
            DROP COLUMN IF EXISTS "alert_72h",
            DROP COLUMN IF EXISTS "alert_48h",
            DROP COLUMN IF EXISTS "alert_24h",
            DROP COLUMN IF EXISTS "email_alerts_enabled",
            DROP COLUMN IF EXISTS "sms_alerts_enabled";
        `);
    }
}
