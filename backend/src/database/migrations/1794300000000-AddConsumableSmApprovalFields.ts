import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsumableSmApprovalFields1794300000000 implements MigrationInterface {
  name = 'AddConsumableSmApprovalFields1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create approval status enum idempotently
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "consumable_approval_status_enum" AS ENUM (
          'PENDING_SM_APPROVAL',
          'APPROVED',
          'REJECTED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Add 7 additive nullable columns to consumable_request_items
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items"
        ADD COLUMN IF NOT EXISTS "approval_status" "consumable_approval_status_enum" DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "approved_by_id" uuid DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "rejected_by_id" uuid DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "rejection_reason" text DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "approval_batch_id" uuid DEFAULT NULL;
    `);

    // 3. Add Foreign Key constraints matching TypeORM naming conventions
    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
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
    `);

    // 4. Create performance & sweep indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cri_approval_status" 
      ON "consumable_request_items" ("approval_status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cri_approval_batch_id" 
      ON "consumable_request_items" ("approval_batch_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cri_approved_at" 
      ON "consumable_request_items" ("approved_at");
    `);

    // 5. Grandfather Backfill: Set all existing items to APPROVED with approved_at = created_at
    await queryRunner.query(`
      UPDATE "consumable_request_items"
      SET 
        "approval_status" = 'APPROVED',
        "approved_at" = "created_at"
      WHERE "approval_status" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cri_approved_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cri_approval_batch_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cri_approval_status";`);

    // 2. Drop foreign keys
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items" 
        DROP CONSTRAINT IF EXISTS "FK_65232156438c5b94d99fe783558",
        DROP CONSTRAINT IF EXISTS "FK_792d7fb504b7a60bde39d601314",
        DROP CONSTRAINT IF EXISTS "FK_cri_rejected_by",
        DROP CONSTRAINT IF EXISTS "FK_cri_approved_by";
    `);

    // 3. Drop columns
    await queryRunner.query(`
      ALTER TABLE "consumable_request_items"
        DROP COLUMN IF EXISTS "approval_batch_id",
        DROP COLUMN IF EXISTS "rejection_reason",
        DROP COLUMN IF EXISTS "rejected_at",
        DROP COLUMN IF EXISTS "rejected_by_id",
        DROP COLUMN IF EXISTS "approved_at",
        DROP COLUMN IF EXISTS "approved_by_id",
        DROP COLUMN IF EXISTS "approval_status";
    `);

    // 4. Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "consumable_approval_status_enum";`);
  }
}
