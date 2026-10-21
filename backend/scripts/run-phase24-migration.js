import pg from 'pg';
import 'dotenv/config';

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[Phase 24 Migration] Connected to PostgreSQL database.');

  try {
    console.log('1. Creating enums for Consumables...');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "consumable_requests_payment_mode_enum" AS ENUM('CASH', 'CREDIT');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "consumable_request_items_item_category_track_enum" AS ENUM('STOCK_ITEM', 'NON_STOCK_OR_NEW');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "consumable_request_items_status_enum" AS ENUM(
          'READY_FOR_ISSUE',
          'OPEN',
          'PURCHASE_REQUESTED',
          'PURCHASE_RECEIVED',
          'ISSUED_TO_PRODUCTION',
          'RECEIVED_BY_PRODUCTION'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✓ Enums created or verified.');

    console.log('2. Creating table consumable_requests...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "consumable_requests" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "request_code" VARCHAR(100) UNIQUE NOT NULL,
        "payment_mode" "consumable_requests_payment_mode_enum" NOT NULL DEFAULT 'CASH',
        "end_user_in_velan" VARCHAR(255),
        "requested_by" VARCHAR(150) NOT NULL,
        "prepared_by" VARCHAR(150),
        "verified_by" VARCHAR(150),
        "approved_by" VARCHAR(150),
        "request_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "remarks" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consumable_requests_code" ON "consumable_requests"("request_code");
    `);
    console.log('✓ consumable_requests table & index verified.');

    console.log('3. Creating table consumable_request_items...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "consumable_request_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "request_id" UUID NOT NULL REFERENCES "consumable_requests"("id") ON DELETE CASCADE,
        "pr_number" VARCHAR(50),
        "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
        "product_code" VARCHAR(100),
        "description" TEXT NOT NULL,
        "uom" VARCHAR(50) NOT NULL DEFAULT 'NOS',
        "is_new_product" BOOLEAN NOT NULL DEFAULT FALSE,
        "item_category_track" "consumable_request_items_item_category_track_enum" NOT NULL DEFAULT 'STOCK_ITEM',
        "stock_available_at_request" NUMERIC(12, 3) NOT NULL DEFAULT 0,
        "requested_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
        "real_received_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
        "issued_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
        "vendor_id" UUID REFERENCES "vendors"("id") ON DELETE SET NULL,
        "vendor_name" VARCHAR(255),
        "unit_price" NUMERIC(12, 2),
        "is_new_vendor" BOOLEAN NOT NULL DEFAULT FALSE,
        "new_vendor_name" VARCHAR(255),
        "new_vendor_address" TEXT,
        "new_vendor_mobile" VARCHAR(50),
        "new_vendor_price" NUMERIC(12, 2),
        "end_user_in_velan" VARCHAR(255),
        "requested_by" VARCHAR(150),
        "bin_id" UUID REFERENCES "bins"("id") ON DELETE SET NULL,
        "status" "consumable_request_items_status_enum" NOT NULL DEFAULT 'OPEN',
        "printed_at" TIMESTAMPTZ,
        "purchase_received_at" TIMESTAMPTZ,
        "issued_at" TIMESTAMPTZ,
        "production_received_at" TIMESTAMPTZ,
        "production_received_by_id" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cri_request_id" ON "consumable_request_items"("request_id");
      CREATE INDEX IF NOT EXISTS "IDX_cri_pr_number" ON "consumable_request_items"("pr_number");
      CREATE INDEX IF NOT EXISTS "IDX_cri_product_id" ON "consumable_request_items"("product_id");
      CREATE INDEX IF NOT EXISTS "IDX_cri_vendor_id" ON "consumable_request_items"("vendor_id");
      CREATE INDEX IF NOT EXISTS "IDX_cri_bin_id" ON "consumable_request_items"("bin_id");
      CREATE INDEX IF NOT EXISTS "IDX_cri_status" ON "consumable_request_items"("status");
      CREATE INDEX IF NOT EXISTS "IDX_cri_track" ON "consumable_request_items"("item_category_track");
    `);
    console.log('✓ consumable_request_items table & indexes verified.');

    console.log('\n[Phase 24 Migration] All Consumable tables and schemas successfully synchronized!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch(console.error);
