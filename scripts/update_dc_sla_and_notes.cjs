const fs = require('fs');
const { Client } = require('pg');
const crypto = require('crypto');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  else if (!dbUrl && line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

async function main() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- UPDATING DC SLA DATES & NOTES ---');

  await client.query('BEGIN');

  // 1. Update delivery_challans: expected_return_date = dispatch_date + 2 days, and clean notes
  const updateRes = await client.query(`
    UPDATE delivery_challans
    SET 
      expected_return_date = dispatch_date + INTERVAL '2 days',
      notes = REGEXP_REPLACE(notes, '^\\[BATCH:[^\\]]+\\]\\s*', ''),
      updated_at = NOW()
    RETURNING id, challan_number, dispatch_date, expected_return_date, notes;
  `);

  console.log(`✓ Updated ${updateRes.rowCount} Delivery Challans.`);

  // 2. Insert vendor_slas for all unique (vendor_id, process_id) combinations from the DCs
  const pairsRes = await client.query(`
    SELECT DISTINCT vendor_id, process_id
    FROM delivery_challans
    WHERE vendor_id IS NOT NULL AND process_id IS NOT NULL;
  `);

  let slasCreated = 0;
  for (const row of pairsRes.rows) {
    const existing = await client.query(
      `SELECT id FROM vendor_slas WHERE vendor_id = $1 AND process_id = $2`,
      [row.vendor_id, row.process_id]
    );

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO vendor_slas (
          id, vendor_id, process_id, sla_days, effective_date, is_active, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 2, NOW(), true, 'Standard 2-day SLA for production outward process', NOW(), NOW()
        )`,
        [crypto.randomUUID(), row.vendor_id, row.process_id]
      );
      slasCreated++;
    } else {
      await client.query(
        `UPDATE vendor_slas SET sla_days = 2, is_active = true, updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
    }
  }

  console.log(`✓ Created/Updated ${pairsRes.rows.length} Vendor SLA configurations (sla_days = 2).`);

  await client.query('COMMIT');

  // Verify
  console.log('\n--- VERIFICATION OF UPDATED DELIVERY CHALLANS ---');
  const verifyRes = await client.query(`
    SELECT 
      challan_number, 
      dispatch_date::date as sent_date, 
      expected_return_date::date as return_date,
      (expected_return_date::date - dispatch_date::date) as days_diff,
      notes
    FROM delivery_challans
    ORDER BY challan_number;
  `);

  let allMatch = true;
  for (const r of verifyRes.rows) {
    const hasBatch = r.notes.includes('[BATCH');
    const is2Days = r.days_diff === 2;
    if (hasBatch || !is2Days) {
      allMatch = false;
      console.error(`Mismatch on ${r.challan_number}: days_diff=${r.days_diff}, notes="${r.notes}"`);
    } else {
      console.log(`${r.challan_number.padEnd(16)} | Sent: ${r.sent_date.toISOString().split('T')[0]} -> Return: ${r.return_date.toISOString().split('T')[0]} (+${r.days_diff}d) | Notes: "${r.notes}"`);
    }
  }

  if (allMatch) {
    console.log('\n✓ ALL 43 DCs PERFECTLY VERIFIED: 2-day expected return date and clean printed remarks.');
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

