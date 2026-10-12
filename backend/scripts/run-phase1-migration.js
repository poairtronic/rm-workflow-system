import pg from 'pg';
import 'dotenv/config';

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to PostgreSQL database.');

  try {
    console.log('1. Expanding delivery_challan_items...');
    await client.query(`
      ALTER TABLE "delivery_challan_items"
      ADD COLUMN IF NOT EXISTS "output_product_id" UUID REFERENCES "products"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "expected_output_quantity" NUMERIC(12, 3),
      ADD COLUMN IF NOT EXISTS "output_bin_id" UUID REFERENCES "bins"("id") ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dci_output_product_id" ON "delivery_challan_items"("output_product_id");
      CREATE INDEX IF NOT EXISTS "IDX_dci_output_bin_id" ON "delivery_challan_items"("output_bin_id");
    `);
    console.log('✓ delivery_challan_items successfully expanded.');

    console.log('2. Creating dc_movements table...');
    await client.query(`
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dc_movements_sc_product" ON "dc_movements"("sc_id", "dispatched_product_id");
      CREATE INDEX IF NOT EXISTS "IDX_dc_movements_challan_id" ON "dc_movements"("challan_id");
      CREATE INDEX IF NOT EXISTS "IDX_dc_movements_challan_item_id" ON "dc_movements"("challan_item_id");
      CREATE INDEX IF NOT EXISTS "IDX_dc_movements_status" ON "dc_movements"("status");
    `);
    console.log('✓ dc_movements table & indexes created.');

    // Verification
    const dciCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'delivery_challan_items'
        AND column_name IN ('output_product_id', 'expected_output_quantity', 'output_bin_id');
    `);
    console.log('Expanded delivery_challan_items columns:', dciCols.rows);

    const dcmCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'dc_movements'
      ORDER BY ordinal_position;
    `);
    console.log('dc_movements table columns:', dcmCols.rows);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

