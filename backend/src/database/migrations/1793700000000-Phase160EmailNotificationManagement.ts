import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Authoritative Phase 1 Seed Matrix: Role Name -> Enabled Event Codes.
 * Exported so unit, parity, and integration tests import the exact migration seed
 * without hand-built duplicates.
 */
export const PHASE_1_ROLE_EMAIL_SETTINGS_SEED: Record<string, string[]> = {
  STORES: [
    'RM_SUBMITTED',
    'ADDITIONAL_REQUEST',
    'MATERIAL_RETURNED',
    'MSL_LOW_STOCK',
    'MSL_CRITICAL',
    'MSL_OUT_OF_STOCK',
    'DC_APPROACHING_SLA',
    'DC_OVERDUE',
    'CONSUMABLE_RECEIPT_OVERDUE',
    'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
    'MATERIAL_ISSUE_OVERDUE_24H',
    'DC_PENDING_2_DAYS',
    'DC_QC_PENDING_24H',
    'CONSUMABLE_PENDING_2_DAYS',
  ],
  PRODUCTION: [
    'MATERIAL_ISSUED',
    'EXTRA_MATERIAL_ISSUED',
    'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
  ],
  ADMIN: [
    'CONSUMABLE_RECEIPT_OVERDUE',
    'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
    'CONSUMABLE_PENDING_2_DAYS',
  ],
  SENIOR_MANAGER: [
    'DC_PENDING_2_DAYS',
    'DC_QC_PENDING_24H',
  ],
  GENERAL_MANAGER: [
    'MATERIAL_ISSUE_OVERDUE_24H',
  ],
  DESIGNER: [],
};

/**
 * Authoritative Event -> Allowed Roles Map derived directly from PHASE_1_ROLE_EMAIL_SETTINGS_SEED.
 */
export const PHASE_1_EVENT_TO_ROLES_MAP: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [role, events] of Object.entries(PHASE_1_ROLE_EMAIL_SETTINGS_SEED)) {
    for (const event of events) {
      if (!map[event]) {
        map[event] = [];
      }
      map[event].push(role);
    }
  }
  return map;
})();

export class Phase160EmailNotificationManagement1793700000000
  implements MigrationInterface
{
  name = 'Phase160EmailNotificationManagement1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. notification_events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_events" (
        "code" character varying(100) NOT NULL,
        "label" character varying(150) NOT NULL,
        "category" character varying(50) NOT NULL,
        "is_configurable" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_events_code" PRIMARY KEY ("code")
      );
    `);

    // 2. role_email_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_email_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "role_id" uuid NOT NULL,
        "event_code" character varying(100) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "updated_by" character varying(100),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_email_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_email_settings_role_event" UNIQUE ("role_id", "event_code")
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_role_email_settings_role_id') THEN
          ALTER TABLE "role_email_settings"
            ADD CONSTRAINT "FK_role_email_settings_role_id"
            FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_role_email_settings_event_code') THEN
          ALTER TABLE "role_email_settings"
            ADD CONSTRAINT "FK_role_email_settings_event_code"
            FOREIGN KEY ("event_code") REFERENCES "notification_events"("code") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_role_email_settings_role_id" ON "role_email_settings" ("role_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_role_email_settings_event_code" ON "role_email_settings" ("event_code");
    `);

    // 3. user_email_overrides table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_email_overrides" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "event_code" character varying(100) NOT NULL,
        "state" character varying(10) NOT NULL,
        "updated_by" character varying(100),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_email_overrides_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_email_overrides_user_event" UNIQUE ("user_id", "event_code"),
        CONSTRAINT "CHK_user_email_overrides_state" CHECK ("state" IN ('ON', 'OFF'))
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_email_overrides_user_id') THEN
          ALTER TABLE "user_email_overrides"
            ADD CONSTRAINT "FK_user_email_overrides_user_id"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_email_overrides_event_code') THEN
          ALTER TABLE "user_email_overrides"
            ADD CONSTRAINT "FK_user_email_overrides_event_code"
            FOREIGN KEY ("event_code") REFERENCES "notification_events"("code") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_email_overrides_user_id" ON "user_email_overrides" ("user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_email_overrides_event_code" ON "user_email_overrides" ("event_code");
    `);

    // 4. email_setting_audit table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_setting_audit" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "changed_by" character varying(100) NOT NULL,
        "scope" character varying(10) NOT NULL,
        "target_id" uuid NOT NULL,
        "event_code" character varying(100) NOT NULL,
        "old_value" character varying(10),
        "new_value" character varying(10) NOT NULL,
        "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_setting_audit_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_email_setting_audit_scope" CHECK ("scope" IN ('ROLE', 'USER'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_setting_audit_target_id" ON "email_setting_audit" ("target_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_setting_audit_changed_at" ON "email_setting_audit" ("changed_at");
    `);

    // 5. Seed 16 configurable events
    await queryRunner.query(`
      INSERT INTO "notification_events" ("code", "label", "category", "is_configurable")
      VALUES
        ('RM_SUBMITTED', 'RM Requisition Submitted', 'Raw Material', true),
        ('ADDITIONAL_REQUEST', 'Additional Material Requested', 'Raw Material', true),
        ('MATERIAL_RETURNED', 'Material Return Submitted', 'Raw Material', true),
        ('MATERIAL_ISSUED', 'Material Issued to Production', 'Material Issue', true),
        ('EXTRA_MATERIAL_ISSUED', 'Additional Material Issued', 'Material Issue', true),
        ('MATERIAL_ISSUE_OVERDUE_24H', 'Material Issue Overdue (>24h)', 'Material Issue', true),
        ('MSL_LOW_STOCK', 'Low Stock Warning (Below MSL)', 'Inventory', true),
        ('MSL_CRITICAL', 'Critical Stock Alert (Near Zero)', 'Inventory', true),
        ('MSL_OUT_OF_STOCK', 'Out of Stock Alert (Zero Inventory)', 'Inventory', true),
        ('DC_APPROACHING_SLA', 'Delivery Challan Approaching Deadline (24h)', 'Delivery Challan', true),
        ('DC_OVERDUE', 'Delivery Challan Overdue Return', 'Delivery Challan', true),
        ('DC_PENDING_2_DAYS', 'Delivery Challan Pending Dispatch (>2 Days)', 'Delivery Challan', true),
        ('DC_QC_PENDING_24H', 'Delivery Challan QC Inspection Pending (>24h)', 'Delivery Challan', true),
        ('CONSUMABLE_RECEIPT_OVERDUE', 'Consumable Pending Receipt (>24h SLA)', 'Consumables', true),
        ('CONSUMABLE_PARTIALLY_ISSUED_OVERDUE', 'Consumable Partially Issued Balance Alert', 'Consumables', true),
        ('CONSUMABLE_PENDING_2_DAYS', 'Consumable Pending Issue (>2 Days)', 'Consumables', true)
      ON CONFLICT ("code") DO NOTHING;
    `);

    // 6. Seed role_email_settings for all 6 roles x 16 events (96 rows, 23 enabled)
    await queryRunner.query(`
      INSERT INTO "role_email_settings" ("role_id", "event_code", "enabled", "updated_by")
      SELECT 
        r.id, 
        e.code,
        CASE
          -- STORES (14 enabled)
          WHEN r.name = 'STORES' AND e.code IN (
            'RM_SUBMITTED', 'ADDITIONAL_REQUEST', 'MATERIAL_RETURNED',
            'MSL_LOW_STOCK', 'MSL_CRITICAL', 'MSL_OUT_OF_STOCK',
            'DC_APPROACHING_SLA', 'DC_OVERDUE', 'CONSUMABLE_RECEIPT_OVERDUE',
            'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE', 'MATERIAL_ISSUE_OVERDUE_24H',
            'DC_PENDING_2_DAYS', 'DC_QC_PENDING_24H', 'CONSUMABLE_PENDING_2_DAYS'
          ) THEN true

          -- PRODUCTION (3 enabled)
          WHEN r.name = 'PRODUCTION' AND e.code IN (
            'MATERIAL_ISSUED', 'EXTRA_MATERIAL_ISSUED',
            'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE'
          ) THEN true

          -- ADMIN (3 enabled)
          WHEN r.name = 'ADMIN' AND e.code IN (
            'CONSUMABLE_RECEIPT_OVERDUE',
            'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
            'CONSUMABLE_PENDING_2_DAYS'
          ) THEN true

          -- SENIOR_MANAGER (2 enabled)
          WHEN r.name = 'SENIOR_MANAGER' AND e.code IN (
            'DC_PENDING_2_DAYS', 'DC_QC_PENDING_24H'
          ) THEN true

          -- GENERAL_MANAGER (1 enabled)
          WHEN r.name = 'GENERAL_MANAGER' AND e.code IN (
            'MATERIAL_ISSUE_OVERDUE_24H'
          ) THEN true

          -- DESIGNER (0 enabled) and all other combinations
          ELSE false
        END AS enabled,
        'system_seed' AS updated_by
      FROM "roles" r
      CROSS JOIN "notification_events" e
      WHERE r.name IN ('ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
        AND e.is_configurable = true
      ON CONFLICT ("role_id", "event_code") DO NOTHING;
    `);

    // 7. Copy user_notification_preferences (workflow_email_enabled = false) into user_email_overrides
    await queryRunner.query(`
      INSERT INTO "user_email_overrides" ("user_id", "event_code", "state", "updated_by")
      SELECT 
        p.user_id,
        e.code,
        'OFF',
        'preference_migration'
      FROM "user_notification_preferences" p
      CROSS JOIN "notification_events" e
      WHERE p.workflow_email_enabled = false
        AND e.is_configurable = true
      ON CONFLICT ("user_id", "event_code") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_setting_audit";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_email_overrides";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_email_settings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_events";`);
  }
}
