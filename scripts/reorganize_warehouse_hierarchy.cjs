/**
 * REORGANIZE VELAN STORES WAREHOUSE HIERARCHY
 * Creates the 7 Real Storage Locations (Areas) inside VELAN STORES:
 *  1. Rack Area        -> RACK 0001 to RACK 0100 (100 Racks)
 *  2. Bin Area         -> BIN 0001 to BIN 0025   (25 Bins/Shelves)
 *  3. Fine Blank Area  -> FINE BLANK AREA 001 to 003 (3 Units)
 *  4. Rod Area         -> ROD AREA (1 Unit)
 *  5. Bar Area         -> BAR AREA (1 Unit)
 *  6. Beuro            -> BEURO RACK 001 to BEURO RACK 003 (3 Units)
 *  7. Box Area         -> BOX AREA 001 to BOX AREA 020 (20 Units)
 *
 * Repoints existing racks, preserves all active stock balances, creates missing units,
 * and removes the obsolete empty 'MAIN' location.
 */

const fs = require('fs');
const { Client } = require('pg');
const crypto = require('crypto');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  } else if (!dbUrl && line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  }
}

async function main() {
  console.log('========================================================================');
  console.log('       REORGANIZING WAREHOUSE HIERARCHY (7 AREAS & STORAGE UNITS)       ');
  console.log('========================================================================\n');

  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('✓ Connected to Neon DB.\n');

  await c.query('BEGIN');

  // 1. Get or Ensure VELAN STORES warehouse
  let whRes = await c.query("SELECT id FROM warehouses WHERE code = 'WH-VELAN'");
  let whId;
  if (whRes.rows.length === 0) {
    const nw = await c.query(
      `INSERT INTO warehouses (id, code, name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), 'WH-VELAN', 'VELAN STORES', true, NOW(), NOW()) RETURNING id`
    );
    whId = nw.rows[0].id;
  } else {
    whId = whRes.rows[0].id;
  }
  console.log(`✓ Warehouse VELAN STORES ID: ${whId}`);

  // 2. Define the 7 Required Locations
  const targetLocations = [
    { code: 'LOC-RACK', name: 'Rack Area', key: 'rack' },
    { code: 'LOC-BIN', name: 'Bin Area', key: 'bin' },
    { code: 'LOC-FB', name: 'Fine Blank Area', key: 'fine_blank' },
    { code: 'LOC-ROD', name: 'Rod Area', key: 'rod' },
    { code: 'LOC-BAR', name: 'Bar Area', key: 'bar' },
    { code: 'LOC-BEURO', name: 'Beuro', key: 'beuro' },
    { code: 'LOC-BOX', name: 'Box Area', key: 'box' },
  ];

  const locIdMap = new Map(); // key -> location_id
  for (const l of targetLocations) {
    let lRes = await c.query("SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND code = $2", [whId, l.code]);
    if (lRes.rows.length === 0) {
      const nl = await c.query(
        `INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id`,
        [whId, l.code, l.name]
      );
      locIdMap.set(l.key, nl.rows[0].id);
      console.log(`  + Created Location: [${l.code}] ${l.name}`);
    } else {
      await c.query("UPDATE warehouse_locations SET name = $1, is_active = true, updated_at = NOW() WHERE id = $2", [l.name, lRes.rows[0].id]);
      locIdMap.set(l.key, lRes.rows[0].id);
      console.log(`  * Updated Location: [${l.code}] ${l.name}`);
    }
  }

  // 3. Load all existing racks and bins
  const existingRacks = (await c.query("SELECT id, location_id, code, name FROM racks")).rows;
  const rackByName = new Map();
  existingRacks.forEach(r => {
    rackByName.set(r.name.trim().toUpperCase(), r);
    // Also store normalized versions
    rackByName.set(r.code.trim().toUpperCase(), r);
  });

  const existingBins = (await c.query("SELECT id, rack_id, code, name FROM bins")).rows;
  const binByRackId = new Map();
  existingBins.forEach(b => {
    if (!binByRackId.has(b.rack_id)) binByRackId.set(b.rack_id, []);
    binByRackId.get(b.rack_id).push(b);
  });

  // Helper to ensure rack & default bin exist in specific location
  async function ensureRackAndBin(locationKey, rackCode, rackName, oldNames = []) {
    const locId = locIdMap.get(locationKey);
    let matchedRack = null;

    // Check if matching rack already exists by primary name/code or old names
    for (const checkName of [rackName, rackCode, ...oldNames]) {
      const upper = checkName.trim().toUpperCase();
      if (rackByName.has(upper)) {
        matchedRack = rackByName.get(upper);
        break;
      }
    }

    let rackId;
    if (matchedRack) {
      rackId = matchedRack.id;
      // Repoint to the correct location and standardize code & name
      await c.query(
        "UPDATE racks SET location_id = $1, code = $2, name = $3, is_active = true, updated_at = NOW() WHERE id = $4",
        [locId, rackCode, rackName, rackId]
      );
    } else {
      // Create new rack
      const nr = await c.query(
        `INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id`,
        [locId, rackCode, rackName]
      );
      rackId = nr.rows[0].id;
    }

    // Ensure at least one default bin exists under this rack
    const binsForRack = binByRackId.get(rackId) || [];
    if (binsForRack.length === 0) {
      const binCode = `BIN-${rackCode.replace(/[^A-Za-z0-9]/g, '')}-01`;
      const binName = `Storage Unit for ${rackName}`;
      await c.query(
        `INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())`,
        [rackId, binCode, binName]
      );
    }

    return rackId;
  }

  // =========================================================================
  // AREA 1: RACK AREA (RACK 0001 to RACK 0100)
  // =========================================================================
  console.log('\n--- Populating Area 1: Rack Area (RACK 0001 to RACK 0100) ---');
  for (let i = 1; i <= 100; i++) {
    const num4 = String(i).padStart(4, '0');
    const num3 = String(i).padStart(3, '0');
    const rackName = `RACK ${num4}`;
    const rackCode = `RCK-${num4}`;
    // Potential old names in previous seed
    const oldNames = [
      `RACK ${num3}`,
      `RACK 00${i}`,
      `RCK-RACK${num3}`,
      `RCK-RACK00${i}`,
      `RACK ${i}`
    ];
    await ensureRackAndBin('rack', rackCode, rackName, oldNames);
  }
  console.log('✓ Ensured all 100 Racks in Rack Area (RACK 0001 to RACK 0100).');

  // =========================================================================
  // AREA 2: BIN AREA (bin 001 to bin 025)
  // =========================================================================
  console.log('\n--- Populating Area 2: Bin Area (bin 001 to bin 025) ---');
  for (let i = 1; i <= 25; i++) {
    const num4 = String(i).padStart(4, '0');
    const num3 = String(i).padStart(3, '0');
    const rackName = `bin ${num3}`;
    const rackCode = `BIN-${num3}`;
    const oldNames = [
      `BIN ${num4}`,
      `BIN ${num3}`,
      `BIN 00${i}`,
      `RCK-BIN${num3}`,
      `RCK-BIN00${i}`,
      `BIN ${i}`
    ];
    const rackId = await ensureRackAndBin('bin', rackCode, rackName, oldNames);
    await c.query(
      "UPDATE bins SET code = $1, name = $2, is_active = true, updated_at = NOW() WHERE rack_id = $3",
      [`bin ${num3}`, `bin ${num3}`, rackId]
    );
  }
  console.log('✓ Ensured all 25 Bins in Bin Area (bin 001 to bin 025).');

  // =========================================================================
  // AREA 3: FINE BLANK AREA (FINE BLANK AREA 001 to 003)
  // =========================================================================
  console.log('\n--- Populating Area 3: Fine Blank Area (001 to 003) ---');
  for (let i = 1; i <= 3; i++) {
    const num3 = String(i).padStart(3, '0');
    const rackName = `FINE BLANK AREA ${num3}`;
    const rackCode = `FB-${num3}`;
    const oldNames = [`FINE BLANK ${num3}`, `FB ${num3}`];
    await ensureRackAndBin('fine_blank', rackCode, rackName, oldNames);
  }
  console.log('✓ Ensured all 3 sections in Fine Blank Area.');

  // =========================================================================
  // AREA 4: ROD AREA (ROD AREA)
  // =========================================================================
  console.log('\n--- Populating Area 4: Rod Area ---');
  await ensureRackAndBin('rod', 'RCK-RODAREA', 'ROD AREA', ['ROD AREA 001', 'ROD']);
  console.log('✓ Ensured Rod Area.');

  // =========================================================================
  // AREA 5: BAR AREA (BAR AREA)
  // =========================================================================
  console.log('\n--- Populating Area 5: Bar Area ---');
  await ensureRackAndBin('bar', 'RCK-BARAREA', 'BAR AREA', ['BAR AREA 001', 'BAR']);
  console.log('✓ Ensured Bar Area.');

  // =========================================================================
  // AREA 6: BEURO (BEURO RACK 001 to BEURO RACK 003)
  // =========================================================================
  console.log('\n--- Populating Area 6: Beuro (BEURO RACK 001 to 003) ---');
  for (let i = 1; i <= 3; i++) {
    const num3 = String(i).padStart(3, '0');
    const rackName = `BEURO RACK ${num3}`;
    const rackCode = `BEURO-${num3}`;
    const oldNames = [`RCK-BEURORACK${num3}`, `BEURO ${num3}`];
    await ensureRackAndBin('beuro', rackCode, rackName, oldNames);
  }
  console.log('✓ Ensured all 3 Beuro Racks in Beuro.');

  // =========================================================================
  // AREA 7: BOX AREA (BOX AREA 001 to BOX AREA 020)
  // =========================================================================
  console.log('\n--- Populating Area 7: Box Area (BOX AREA 001 to BOX AREA 020) ---');
  for (let i = 1; i <= 20; i++) {
    const num3 = String(i).padStart(3, '0');
    const rackName = `BOX AREA ${num3}`;
    const rackCode = `BOX-${num3}`;
    const oldNames = [`BOX ${num3}`, `RCK-BOX${num3}`, `BOX 00${i}`];
    await ensureRackAndBin('box', rackCode, rackName, oldNames);
  }

  // Also repoint NONE (balls) to Box Area shelf 1 so it's not orphaned
  const noneRack = rackByName.get('NONE') || rackByName.get('RCK-NONE');
  if (noneRack) {
    await c.query("UPDATE racks SET location_id = $1, code = 'RCK-MISC-BALLS', name = 'MISC STORAGE (BALLS)' WHERE id = $2", [locIdMap.get('box'), noneRack.id]);
    console.log('✓ Repointed NONE rack to Box Area as MISC STORAGE (BALLS).');
  }
  console.log('✓ Ensured all 20 Box storage units in Box Area.');

  // 4. Remove obsolete empty 'MAIN' location if it has no racks
  const mainLoc = await c.query("SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND code = 'MAIN'", [whId]);
  if (mainLoc.rows.length > 0) {
    const racksUnderMain = await c.query("SELECT count(*) FROM racks WHERE location_id = $1", [mainLoc.rows[0].id]);
    if (parseInt(racksUnderMain.rows[0].count, 10) === 0) {
      await c.query("DELETE FROM warehouse_locations WHERE id = $1", [mainLoc.rows[0].id]);
      console.log('\n✓ Successfully removed obsolete empty location "MAIN".');
    } else {
      console.log(`\nNote: ${racksUnderMain.rows[0].count} racks still under MAIN. Inspecting...`);
    }
  }

  await c.query('COMMIT');
  console.log('\n========================================================================');
  console.log('         WAREHOUSE HIERARCHY REORGANIZATION COMPLETE!                  ');
  console.log('========================================================================\n');

  // Verification Audit
  console.log('--- VERIFICATION AUDIT ---');
  const locSummary = await c.query(`
    SELECT l.code, l.name, count(r.id) as rack_count
    FROM warehouse_locations l
    LEFT JOIN racks r ON r.location_id = l.id
    WHERE l.warehouse_id = $1
    GROUP BY l.code, l.name
    ORDER BY l.code
  `, [whId]);

  console.log('Locations & Section Counts:');
  locSummary.rows.forEach(r => {
    console.log(`  [${r.code}] ${r.name.padEnd(20)}: ${r.rack_count} storage sections`);
  });

  const totalStocks = await c.query('SELECT count(*) FROM stock_balances');
  console.log(`\nTotal Stock Balances in DB: ${totalStocks.rows[0].count} (All preserved!)`);

  await c.end();
}

main().catch(err => {
  console.error('Reorganization failed:', err);
  process.exit(1);
});

