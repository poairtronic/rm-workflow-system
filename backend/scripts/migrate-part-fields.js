import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Neon Postgres.');

    console.log('Adding missing columns to rm_items and delivery_challan_items...');

    await client.query(`
      ALTER TABLE rm_items 
      ADD COLUMN IF NOT EXISTS part_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS part_name VARCHAR(255);
    `);
    console.log('rm_items columns checked/added.');

    await client.query(`
      ALTER TABLE delivery_challan_items 
      ADD COLUMN IF NOT EXISTS part_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS part_name VARCHAR(255);
    `);
    console.log('delivery_challan_items columns checked/added.');

    // Verify columns on rm_items
    const rmCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rm_items' AND column_name IN ('part_number', 'part_name');
    `);
    console.log('rm_items verified columns:', rmCols.rows);

    // Verify columns on delivery_challan_items
    const dciCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'delivery_challan_items' AND column_name IN ('part_number', 'part_name');
    `);
    console.log('delivery_challan_items verified columns:', dciCols.rows);

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

