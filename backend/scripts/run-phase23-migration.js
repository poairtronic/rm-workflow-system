import pg from 'pg';
import 'dotenv/config';

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to PostgreSQL database:', connectionString.split('@')[1] || 'db');

  try {
    console.log('1. Adding QC columns to delivery_challan_items...');
    await client.query(`
      ALTER TABLE "delivery_challan_items"
      ADD COLUMN IF NOT EXISTS "qc_pending_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "qc_passed_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "qc_rejected_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "expected_return_qty" NUMERIC(12, 3),
      ADD COLUMN IF NOT EXISTS "actual_received_qty" NUMERIC(12, 3) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "return_target_bin_id" UUID REFERENCES "bins"("id") ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dci_return_target_bin_id" ON "delivery_challan_items"("return_target_bin_id");
    `);
    console.log('✓ delivery_challan_items successfully expanded.');

    console.log('2. Executing safe non-destructive backfill for historical returned items...');
    const backfillResult = await client.query(`
      UPDATE "delivery_challan_items"
      SET "qc_passed_qty" = "quantity_returned"
      WHERE "quantity_returned" > 0 AND "qc_passed_qty" = 0;
    `);
    console.log(`✓ Backfilled ${backfillResult.rowCount || 0} historic returned line items.`);

    console.log('3. Creating dc_qc_inspections table...');
    await client.query(`
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dc_qc_inspections_challan_id" ON "dc_qc_inspections"("challan_id");
      CREATE INDEX IF NOT EXISTS "IDX_dc_qc_inspections_item_id" ON "dc_qc_inspections"("challan_item_id");
    `);
    console.log('✓ dc_qc_inspections table & indexes created.');

    console.log('4. Creating dc_rework_items table...');
    await client.query(`
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_source_dc" ON "dc_rework_items"("source_dc_id");
      CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_sc_id" ON "dc_rework_items"("sc_id");
      CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_status" ON "dc_rework_items"("rework_status");
      CREATE INDEX IF NOT EXISTS "IDX_dc_rework_items_vendor" ON "dc_rework_items"("original_vendor_id");
    `);
    console.log('✓ dc_rework_items table & indexes created.');

    console.log('5. Recording migration in migrations table...');
    const checkMig = await client.query(
      `SELECT * FROM "migrations" WHERE "name" = 'Phase23DcQualityCheckAndRework1792300000000'`
    );
    if (checkMig.rows.length === 0) {
      await client.query(`
        INSERT INTO "migrations"("timestamp", "name")
        VALUES (1792300000000, 'Phase23DcQualityCheckAndRework1792300000000');
      `);
      console.log('✓ Migration recorded in migrations table.');
    } else {
      console.log('✓ Migration record already present in migrations table.');
    }

    // 6. Verify schema changes
    const cols = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'delivery_challan_items'
        AND column_name IN ('qc_pending_qty', 'qc_passed_qty', 'qc_rejected_qty', 'actual_received_qty', 'return_target_bin_id');
    `);
    console.log('Verified delivery_challan_items columns:', cols.rows);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('dc_qc_inspections', 'dc_rework_items');
    `);
    console.log('Verified tables:', tables.rows);

    console.log('\n🎉 ALL PHASE 23 MIGRATIONS APPLIED SUCCESSFULLY WITHOUT DATA LOSS!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
