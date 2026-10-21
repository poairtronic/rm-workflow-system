import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL configured');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to database.');

  const slaCountRes = await client.query('SELECT count(*) FROM vendor_slas');
  const count = parseInt(slaCountRes.rows[0].count, 10);
  console.log('Current vendor_slas count:', count);

  if (count === 0) {
    console.log('No SLAs exist. Querying active vendors and processes to seed baseline SLAs...');
    const vendorsRes = await client.query('SELECT id, name FROM vendors WHERE is_active = true ORDER BY name ASC LIMIT 5');
    const processesRes = await client.query('SELECT id, name FROM production_processes WHERE is_active = true ORDER BY sequence_number ASC LIMIT 1');

    if (vendorsRes.rows.length > 0 && processesRes.rows.length > 0) {
      for (const vendor of vendorsRes.rows) {
        for (const process of processesRes.rows) {
          const slaDays = 5;
          const leadTimeMultiplier = 1.0;
          const toleranceBufferDays = 1;
          await client.query(`
            INSERT INTO vendor_slas (
              id, vendor_id, process_id, sla_days, effective_date, is_active,
              notes, lead_time_multiplier, tolerance_buffer_days, alert_24h,
              alert_48h, alert_72h, email_alerts_enabled, sms_alerts_enabled,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, NOW(), true,
              $4, $5, $6, true,
              false, false, true, false,
              NOW(), NOW()
            ) ON CONFLICT (vendor_id, process_id) DO NOTHING
          `, [
            vendor.id,
            process.id,
            slaDays,
            `Standard benchmark SLA for ${vendor.name} - ${process.name}`,
            leadTimeMultiplier,
            toleranceBufferDays
          ]);
        }
      }
      console.log(`Seeded baseline SLAs for ${vendorsRes.rows.length} vendors and ${processesRes.rows.length} processes.`);
    } else {
      console.log('Could not find vendors or processes to seed.');
    }
  } else {
    console.log('Vendor SLAs already exist. Count:', count);
  }

  await client.end();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
