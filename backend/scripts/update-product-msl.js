import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Complete map of non-zero Minimum Stock Levels (MSL) extracted directly from the official 32-page product catalog
export const PRODUCT_MSL_MAP = {
  // Page 1 / 17
  'ARG ID 6 TO 15 OD 55- FB': 40,

  // Page 4 / 20
  'EN31 DIA 105 FINE BLANK': 50,
  'EN31 DIA 31 FINE BLANK': 25,
  'EN31 DIA 39 FINE BLANK': 25,
  'EN31 DIA 43 FINE BLANK': 25,
  'EN31 DIA 43 SEMI FINISHED': 25,
  'EN31 DIA 48 FINE BLANK': 25,
  'EN31 DIA 55 FINE BLANK': 50,
  'EN31 DIA 60 FINE BLANK': 50,
  'EN31 DIA 64 FINE BLANK': 25,
  'EN31 DIA 65 FINE BLANK': 50,
  'EN31 DIA 68 FINE BLANK': 25,
  'EN31 DIA 70 FINE BLANK': 50,
  'EN31 DIA 74 FINE BLANK': 25,
  'EN31 DIA 75 FINE BLANK': 50,
  'EN31 DIA 77 FINE BLANK': 25,
  'EN31 DIA 80 FINE BLANK': 50,
  'EN31 DIA 89 FINE BLANK': 25,
  'EN31 DIA 9 FINE BLANK': 25,
  'EN31 DIA 90 FINE BLANK': 50,
  'END CONNECTOR': 20,

  // Page 5 / 21
  'EXTENSTION DIA 10 TO 15 (L=25)': 100,
  'EXTENSTION DIA 10 TO 15 (L=50)': 50,
  'EXTENSTION DIA 15 TO 20 (L=25)': 100,
  'EXTENSTION DIA 15 TO 20 (L=50)': 50,
  'EXTENSTION DIA 20 TO 35 (L=25)': 100,
  'EXTENSTION DIA 20 TO 35 (L=50)': 50,
  'EXTENSTION DIA 35 TO 60 (L=25)': 100,
  'EXTENSTION DIA 35 TO 60 (L=50)': 50,
  'I.S NO:2': 50,
  'I.S NO:3': 50,
  'I.S NO:4 DOUBLE SIDE': 50,
  'I.S NO:5 DOUBLE SIDE': 50,
  'I.S NO:6 DOUBLE SIDE': 50,
  'I.S NO:8 DOUBLE SIDE': 50,
  'I.S NO:8 SINGLE SIDE': 50,
  'I.S NO:9 SINGLE SIDE': 50,
  'I.S NYLON HANDLE': 50,
  'KD 100 FINE BLANK': 100,
  'KD 112 FINE BLANK': 100,
  'KD 125 FINE BLANK': 100,
  'KD 22 WITH HOLE': 50,
  'KD 32 FINE BLANK': 100,
  'KD 38 FINE BLANK': 100,

  // Page 6 / 22
  'KD 45 FINE BLANK': 100,
  'KD 53 CUT PIECE': 50,
  'KD 53 FINE BLANK': 100,
  'KD 63 FINE BLANK': 100,
  'KD 71 FINE BLANK': 100,
  'LONG BAR EN31 DIA 100': 1000,
  'LONG BAR EN31 DIA 105': 1000,
  'LONG BAR EN31 DIA 110': 2000,
  'LONG BAR EN31 DIA 20': 1000,
  'LONG BAR EN31 DIA 30': 1000,
  'LONG BAR EN31 DIA 55': 1000,
  'LONG BAR EN31 DIA 60': 2000,
  'LONG BAR EN31 DIA 65': 1000,
  'LONG BAR EN31 DIA 70': 2000,
  'LONG BAR EN31 DIA 80': 1000,
  'LONG BAR EN31 DIA 85': 2000,
  'LONG BAR OHNS DIA 120': 1000,
  'LONG BAR OHNS DIA 125': 1000,
  'LONG BAR OHNS DIA 130': 1000,

  // Page 7 / 23
  'LONG BAR OHNS DIA 40': 1000,
  'LONG BAR OHNS DIA 65': 1000,
  'LONG BAR OHNS DIA 75': 1000,
  'LONG BAR OHNS DIA 90': 1000,
  'M12 MALE -CJET': 20,
  'M12 MALE 1A': 100,
  'M12 MALE 2A': 50,
  'M14 MALE -CJET': 20,
  'M14 MALE 1A': 100,
  'M14 MALE 2A': 50,
  'M20 MALE -CJET': 20,
  'M20 MALE 1A': 100,
  'M20 MALE 2A': 50,
  'M6 BRASS NIPPLE': 200,
  'M6 FEMALE -CJET': 20,
  'M6 FEMALE 2A': 50,
  'M6 MALE -CJET': 20,
  'M6 MALE 1A': 100,
  'M6 MALE 2A': 50,
  'M6 TAP AND DRILL -CJET': 20,
  'M6 TAP AND DRILL 1A': 100,
  'M8 MALE -CJET': 20,
  'M8 MALE 1A': 100,
  'M8 MALE 2A': 50
};

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_URL_DIRECT must be defined.');
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✓ Connected to PostgreSQL database.');

  try {
    await client.query('BEGIN');

    // 1. Fetch all products
    const res = await client.query('SELECT id, name, minimum_inventory FROM products');
    const products = res.rows;
    console.log(`Found ${products.length} products in the database.`);

    let updatedCount = 0;
    let nonZeroCount = 0;

    for (const prod of products) {
      const prodNameUpper = prod.name.trim().toUpperCase();
      const targetMsl = PRODUCT_MSL_MAP[prodNameUpper] !== undefined ? PRODUCT_MSL_MAP[prodNameUpper] : 0;

      if (targetMsl > 0) {
        nonZeroCount++;
      }

      await client.query(
        `UPDATE products
         SET minimum_inventory = $1, updated_at = NOW()
         WHERE id = $2`,
        [targetMsl, prod.id]
      );
      updatedCount++;
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully updated ${updatedCount} products:`);
    console.log(`   - ${nonZeroCount} products configured with active Minimum Stock Levels (MSL > 0)`);
    console.log(`   - ${updatedCount - nonZeroCount} products configured with unmonitored baseline (MSL = 0)`);

    // Verify
    const verifyRes = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE minimum_inventory > 0) as monitored,
        COUNT(*) FILTER (WHERE minimum_inventory = 0) as unmonitored
      FROM products
    `);
    console.log('Verification stats:', verifyRes.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to update product MSL:', err);
    throw err;
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
