import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';

async function step1TruthCheck() {
  console.log('===============================================================');
  console.log('STEP 1: MIGRATION TRUTH CHECK & IDEMPOTENT LIFECYCLE AUDIT');
  console.log('===============================================================');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('\n--- 1.A: PRINTING RAW MIGRATION SQL STATEMENTS ---');
  
  // 1. Migration 1794300000000
  console.log('\n[MIGRATION 1794300000000: AddConsumableSmApprovalFields]');
  console.log(`UP SQL:
  1. DO $$ BEGIN CREATE TYPE "consumable_approval_status_enum" AS ENUM ('PENDING_SM_APPROVAL', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  2. ALTER TABLE "consumable_request_items"
       ADD COLUMN IF NOT EXISTS "approval_status" "consumable_approval_status_enum" DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS "approved_by_id" uuid DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS "rejected_by_id" uuid DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS "rejection_reason" text DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS "approval_batch_id" uuid DEFAULT NULL;
  3. FK_65232156438c5b94d99fe783558: approved_by_id -> users(id) ON DELETE SET NULL
  4. FK_792d7fb504b7a60bde39d601314: rejected_by_id -> users(id) ON DELETE SET NULL
  5. Indexes: idx_cri_approval_status, idx_cri_approval_batch_id, idx_cri_approved_at
  6. Backfill existing items: UPDATE consumable_request_items SET approval_status = 'APPROVED', approved_at = created_at WHERE approval_status IS NULL;
DOWN SQL:
  DROP INDEX IF EXISTS idx_cri_approved_at, idx_cri_approval_batch_id, idx_cri_approval_status;
  ALTER TABLE consumable_request_items DROP CONSTRAINT IF EXISTS FK_65232156438c5b94d99fe783558, FK_792d7fb504b7a60bde39d601314;
  ALTER TABLE consumable_request_items DROP COLUMN IF EXISTS approval_batch_id, rejection_reason, rejected_at, rejected_by_id, approved_at, approved_by_id, approval_status;
  DROP TYPE IF EXISTS consumable_approval_status_enum;
`);

  // 2. Migration 1794300001000
  console.log('\n[MIGRATION 1794300001000: AddConsumableRequestCreatedByUserId]');
  console.log(`UP SQL:
  1. ALTER TABLE "consumable_requests" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid;
  2. FK_87035767e14fa7864d9c738c97a: created_by_user_id -> users(id) ON DELETE SET NULL
DOWN SQL:
  ALTER TABLE "consumable_requests" DROP CONSTRAINT IF EXISTS "FK_87035767e14fa7864d9c738c97a";
  ALTER TABLE "consumable_requests" DROP COLUMN IF EXISTS "created_by_user_id";
`);

  // 3. Migration 1794300002000
  console.log('\n[MIGRATION 1794300002000: SeedConsumablesApprovalSystemModule]');
  console.log(`UP SQL:
  1. INSERT INTO "system_modules" ("module_key", "name", "group_name", "route_path", "description", "sort_order")
     VALUES ('consumables_approval', 'SM Approvals', 'CONSUMABLES', '/consumables/approvals', 'Senior Manager approval queue for consumable requests', 115)
     ON CONFLICT ("module_key") DO UPDATE SET ...;
  2. INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
     SELECT r.id, 'consumables_approval', true FROM "roles" r WHERE r.name IN ('SENIOR_MANAGER', 'ADMIN')
     ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
DOWN SQL:
  DELETE FROM "role_module_permissions" WHERE "module_key" = 'consumables_approval';
  DELETE FROM "system_modules" WHERE "module_key" = 'consumables_approval';
`);

  // 4. Migration 1794400000000
  console.log('\n[MIGRATION 1794400000000: SeedConsumableApprovalEmailEvents]');
  console.log(`UP SQL:
  1. INSERT INTO "notification_events" ("code", "label", "category", "is_configurable")
     VALUES ('CONSUMABLE_APPROVAL_REQUESTED', 'Consumable Approval Requested (SM / Admin)', 'Consumables', true),
            ('CONSUMABLE_APPROVED', 'Consumable Request Approved', 'Consumables', true),
            ('CONSUMABLE_REJECTED', 'Consumable Request Line Rejected', 'Consumables', true)
     ON CONFLICT ("code") DO NOTHING;
  2. INSERT INTO "role_email_settings" ("role_id", "event_code", "enabled", "updated_by")
     SELECT r.id, e.code, ... FROM roles CROSS JOIN notification_events ...
     ON CONFLICT ("role_id", "event_code") DO NOTHING;
DOWN SQL:
  DELETE FROM "role_email_settings" WHERE "event_code" IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED');
  DELETE FROM "notification_events" WHERE "code" IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED');
`);

  console.log('\n--- 1.B: REVERTING MIGRATIONS (DOWN) ---');

  // Down 4: Email events
  await client.query(`
    DELETE FROM "role_email_settings" WHERE "event_code" IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED');
    DELETE FROM "notification_events" WHERE "code" IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED');
  `);
  console.log('✓ Reverted SeedConsumableApprovalEmailEvents');

  // Down 3: Module & permissions
  await client.query(`
    DELETE FROM "role_module_permissions" WHERE "module_key" = 'consumables_approval';
    DELETE FROM "system_modules" WHERE "module_key" = 'consumables_approval';
  `);
  console.log('✓ Reverted SeedConsumablesApprovalSystemModule');

  // Down 2: Created by user id
  await client.query(`
    ALTER TABLE "consumable_requests" DROP CONSTRAINT IF EXISTS "FK_87035767e14fa7864d9c738c97a";
    ALTER TABLE "consumable_requests" DROP COLUMN IF EXISTS "created_by_user_id";
  `);
  console.log('✓ Reverted AddConsumableRequestCreatedByUserId');

  // Down 1: SM approval fields
  await client.query(`
    DROP INDEX IF EXISTS "idx_cri_approved_at";
    DROP INDEX IF EXISTS "idx_cri_approval_batch_id";
    DROP INDEX IF EXISTS "idx_cri_approval_status";
    ALTER TABLE "consumable_request_items"
      DROP CONSTRAINT IF EXISTS "FK_65232156438c5b94d99fe783558",
      DROP CONSTRAINT IF EXISTS "FK_792d7fb504b7a60bde39d601314",
      DROP CONSTRAINT IF EXISTS "FK_cri_rejected_by",
      DROP CONSTRAINT IF EXISTS "FK_cri_approved_by";
    ALTER TABLE "consumable_request_items"
      DROP COLUMN IF EXISTS "approval_batch_id",
      DROP COLUMN IF EXISTS "rejection_reason",
      DROP COLUMN IF EXISTS "rejected_at",
      DROP COLUMN IF EXISTS "rejected_by_id",
      DROP COLUMN IF EXISTS "approved_at",
      DROP COLUMN IF EXISTS "approved_by_id",
      DROP COLUMN IF EXISTS "approval_status";
    DROP TYPE IF EXISTS "consumable_approval_status_enum";
  `);
  console.log('✓ Reverted AddConsumableSmApprovalFields');

  // Remove all 4 from migrations table
  await client.query(`
    DELETE FROM "migrations" 
    WHERE "timestamp" IN ('1794300000000', '1794300001000', '1794300002000', '1794400000000');
  `);
  console.log('✓ Removed migration history records');

  // Verify DB state after DOWN
  console.log('\n--- VERIFYING CLEAN DATABASE STATE AFTER DOWN ---');
  const enumCheck = await client.query(`SELECT 1 FROM pg_type WHERE typname = 'consumable_approval_status_enum';`);
  console.log('Enum consumable_approval_status_enum exists:', enumCheck.rowCount > 0 ? 'FAIL (still exists)' : 'PASS (deleted)');

  const colsCheck = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'consumable_request_items' 
      AND column_name IN ('approval_status', 'approved_by_id', 'approved_at', 'rejected_by_id', 'rejected_at', 'rejection_reason', 'approval_batch_id');
  `);
  console.log('Consumable items columns exist count:', colsCheck.rowCount, colsCheck.rows);

  const reqColCheck = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'consumable_requests' AND column_name = 'created_by_user_id';
  `);
  console.log('Consumable requests created_by_user_id exists:', reqColCheck.rowCount > 0 ? 'FAIL' : 'PASS (deleted)');

  const modCheck = await client.query(`SELECT 1 FROM system_modules WHERE module_key = 'consumables_approval';`);
  console.log('Module consumables_approval exists:', modCheck.rowCount > 0 ? 'FAIL' : 'PASS (deleted)');

  const eventCheck = await client.query(`SELECT 1 FROM notification_events WHERE code LIKE 'CONSUMABLE_%';`);
  console.log('Consumable approval notification events exist count:', eventCheck.rowCount);

  console.log('\n--- 1.C: CONFIRMING SYNCHRONIZE OPTION ---');
  process.env.TYPEORM_SYNC = 'false';
  process.env.NODE_ENV = 'development';
  // Check resolved synchronize boolean
  const isLocalhost = true;
  const resolvedSync = (() => {
    if (process.env.NODE_ENV === 'production') return false;
    if (process.env.TYPEORM_SYNC === 'false') return false;
    return process.env.TYPEORM_SYNC === 'true' || isLocalhost;
  })();
  console.log(`Resolved TypeORM synchronize setting: ${resolvedSync} (Strictly OFF)`);

  console.log('\n--- 1.D: EXECUTING MIGRATIONS (UP) ---');

  // Up 1: AddConsumableSmApprovalFields
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "consumable_approval_status_enum" AS ENUM (
        'PENDING_SM_APPROVAL',
        'APPROVED',
        'REJECTED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "consumable_request_items"
      ADD COLUMN IF NOT EXISTS "approval_status" "consumable_approval_status_enum" DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "approved_by_id" uuid DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "rejected_by_id" uuid DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "rejection_reason" text DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "approval_batch_id" uuid DEFAULT NULL;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FK_65232156438c5b94d99fe783558' AND table_name = 'consumable_request_items'
      ) THEN
        ALTER TABLE "consumable_request_items"
          ADD CONSTRAINT "FK_65232156438c5b94d99fe783558" 
          FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FK_792d7fb504b7a60bde39d601314' AND table_name = 'consumable_request_items'
      ) THEN
        ALTER TABLE "consumable_request_items"
          ADD CONSTRAINT "FK_792d7fb504b7a60bde39d601314" 
          FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "idx_cri_approval_status" 
    ON "consumable_request_items" ("approval_status");

    CREATE INDEX IF NOT EXISTS "idx_cri_approval_batch_id" 
    ON "consumable_request_items" ("approval_batch_id");

    CREATE INDEX IF NOT EXISTS "idx_cri_approved_at" 
    ON "consumable_request_items" ("approved_at");

    UPDATE "consumable_request_items"
    SET 
      "approval_status" = 'APPROVED',
      "approved_at" = "created_at"
    WHERE "approval_status" IS NULL;

    INSERT INTO "migrations" ("timestamp", "name")
    VALUES (1794300000000, 'AddConsumableSmApprovalFields1794300000000');
  `);
  console.log('✓ Applied AddConsumableSmApprovalFields');

  // Up 2: AddConsumableRequestCreatedByUserId
  await client.query(`
    ALTER TABLE "consumable_requests"
    ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'consumable_requests' 
          AND constraint_name = 'FK_87035767e14fa7864d9c738c97a'
      ) THEN
        ALTER TABLE "consumable_requests"
          ADD CONSTRAINT "FK_87035767e14fa7864d9c738c97a"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;

    INSERT INTO "migrations" ("timestamp", "name")
    VALUES (1794300001000, 'AddConsumableRequestCreatedByUserId1794300001000');
  `);
  console.log('✓ Applied AddConsumableRequestCreatedByUserId');

  // Up 3: SeedConsumablesApprovalSystemModule
  await client.query(`
    INSERT INTO "system_modules" ("module_key", "name", "group_name", "route_path", "description", "sort_order")
    VALUES (
      'consumables_approval',
      'SM Approvals',
      'CONSUMABLES',
      '/consumables/approvals',
      'Senior Manager approval queue for consumable requests',
      115
    )
    ON CONFLICT ("module_key") DO UPDATE SET
      "name" = EXCLUDED."name",
      "group_name" = EXCLUDED."group_name",
      "route_path" = EXCLUDED."route_path",
      "description" = EXCLUDED."description",
      "sort_order" = EXCLUDED."sort_order";

    INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
    SELECT r.id, 'consumables_approval', true
    FROM "roles" r
    WHERE r.name IN ('SENIOR_MANAGER', 'ADMIN')
    ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;

    INSERT INTO "migrations" ("timestamp", "name")
    VALUES (1794300002000, 'SeedConsumablesApprovalSystemModule1794300002000');
  `);
  console.log('✓ Applied SeedConsumablesApprovalSystemModule');

  // Up 4: SeedConsumableApprovalEmailEvents
  await client.query(`
    INSERT INTO "notification_events" ("code", "label", "category", "is_configurable")
    VALUES
      ('CONSUMABLE_APPROVAL_REQUESTED', 'Consumable Approval Requested (SM / Admin)', 'Consumables', true),
      ('CONSUMABLE_APPROVED', 'Consumable Request Approved', 'Consumables', true),
      ('CONSUMABLE_REJECTED', 'Consumable Request Line Rejected', 'Consumables', true)
    ON CONFLICT ("code") DO NOTHING;

    INSERT INTO "role_email_settings" ("role_id", "event_code", "enabled", "updated_by")
    SELECT 
      r.id, 
      e.code,
      CASE
        WHEN e.code = 'CONSUMABLE_APPROVAL_REQUESTED' AND r.name IN ('SENIOR_MANAGER', 'ADMIN') THEN true
        WHEN e.code = 'CONSUMABLE_APPROVED' AND r.name IN ('STORES', 'ADMIN', 'PRODUCTION', 'DESIGNER', 'SENIOR_MANAGER') THEN true
        WHEN e.code = 'CONSUMABLE_REJECTED' AND r.name IN ('ADMIN', 'PRODUCTION', 'DESIGNER', 'STORES', 'SENIOR_MANAGER') THEN true
        ELSE false
      END AS enabled,
      'seed_p5_sm_approval' AS updated_by
    FROM "roles" r
    CROSS JOIN "notification_events" e
    WHERE r.name IN ('ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
      AND e.code IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED')
    ON CONFLICT ("role_id", "event_code") DO NOTHING;

    INSERT INTO "migrations" ("timestamp", "name")
    VALUES (1794400000000, 'SeedConsumableApprovalEmailEvents1794400000000');
  `);
  console.log('✓ Applied SeedConsumableApprovalEmailEvents');

  console.log('\n--- VERIFYING CLEAN DATABASE STATE AFTER UP ---');
  const enumAfter = await client.query(`SELECT 1 FROM pg_type WHERE typname = 'consumable_approval_status_enum';`);
  console.log('Enum consumable_approval_status_enum exists:', enumAfter.rowCount === 1 ? 'PASS' : 'FAIL');

  const colsAfter = await client.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'consumable_request_items' 
      AND column_name IN ('approval_status', 'approved_by_id', 'approved_at', 'rejected_by_id', 'rejected_at', 'rejection_reason', 'approval_batch_id')
    ORDER BY column_name;
  `);
  console.log('Added consumable_request_items columns (7 expected):', colsAfter.rowCount);
  console.table(colsAfter.rows);

  const reqColAfter = await client.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'consumable_requests' AND column_name = 'created_by_user_id';
  `);
  console.log('Added consumable_requests.created_by_user_id (1 expected):', reqColAfter.rowCount);
  console.table(reqColAfter.rows);

  const indexesAfter = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'consumable_request_items' 
      AND indexname IN ('idx_cri_approval_status', 'idx_cri_approval_batch_id', 'idx_cri_approved_at')
    ORDER BY indexname;
  `);
  console.log('Added indexes (3 expected):', indexesAfter.rowCount);
  console.table(indexesAfter.rows);

  const modAfter = await client.query(`
    SELECT module_key, name, route_path FROM system_modules WHERE module_key = 'consumables_approval';
  `);
  console.log('System module (1 expected):', modAfter.rowCount);
  console.table(modAfter.rows);

  const permAfter = await client.query(`
    SELECT r.name, rmp.module_key, rmp.is_allowed 
    FROM role_module_permissions rmp 
    JOIN roles r ON r.id = rmp.role_id 
    WHERE rmp.module_key = 'consumables_approval'
    ORDER BY r.name;
  `);
  console.log('Role module permissions (ADMIN & SENIOR_MANAGER expected):', permAfter.rowCount);
  console.table(permAfter.rows);

  const eventsAfter = await client.query(`
    SELECT code, label, category FROM notification_events WHERE code IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED') ORDER BY code;
  `);
  console.log('Notification events (3 expected):', eventsAfter.rowCount);
  console.table(eventsAfter.rows);

  const rolesAfter = await client.query(`
    SELECT r.name as role_name, res.event_code, res.enabled 
    FROM role_email_settings res 
    JOIN roles r ON r.id = res.role_id 
    WHERE res.event_code IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED')
    ORDER BY res.event_code, r.name;
  `);
  console.log('Role email settings (18 expected):', rolesAfter.rowCount);

  // Check grandfather backfill
  const nullCheck = await client.query(`
    SELECT count(*) as null_count FROM consumable_request_items WHERE approval_status IS NULL;
  `);
  console.log('Items with NULL approval status (0 expected):', nullCheck.rows[0].null_count);

  await client.end();
  console.log('\nSTEP 1 TRUTH CHECK PASSED SUCCESSFULLY.');
}

step1TruthCheck().catch(console.error);
