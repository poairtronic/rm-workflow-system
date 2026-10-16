import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const vendorsJsonPath = path.resolve('scripts/extracted-vendors.json');

async function run() {
  const vendors = JSON.parse(fs.readFileSync(vendorsJsonPath, 'utf8'));
  console.log(`Loaded ${vendors.length} vendors from ${vendorsJsonPath}`);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('🚀 Connected to database.');

  await client.query('BEGIN');

  try {
    console.log('🧹 Clearing old vendors and dependent vendor tables...');
    await client.query('DELETE FROM vendor_process_capabilities');
    console.log('  - Cleared vendor_process_capabilities');
    await client.query('DELETE FROM vendor_slas');
    console.log('  - Cleared vendor_slas');
    await client.query('DELETE FROM vendors');
    console.log('  - Cleared vendors');

    console.log(`🏢 Inserting ${vendors.length} new vendors...`);

    for (const v of vendors) {
      const id = crypto.randomUUID();
      const code = `VND-${String(v.num).padStart(3, '0')}`;
      const name = v.name.trim().slice(0, 150);
      const phone = v.phone ? v.phone.trim().slice(0, 50) : null;
      const address = v.address ? v.address.trim() : null;

      await client.query(
        `INSERT INTO vendors (
          id, code, name, phone, address, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [id, code, name, phone, address]
      );
    }

    await client.query('COMMIT');
    console.log('✅ COMMIT SUCCESSFUL!');

    const countRes = await client.query('SELECT count(*) FROM vendors');
    console.log(`Current vendors in database: ${countRes.rows[0].count}`);

    const sample = await client.query('SELECT code, name, phone, SUBSTRING(address, 1, 40) as addr_preview FROM vendors ORDER BY code ASC LIMIT 10');
    console.log('Sample newly created vendors:');
    console.table(sample.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during vendor import, rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
