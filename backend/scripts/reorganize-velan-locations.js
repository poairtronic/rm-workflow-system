import pg from 'pg';
import 'dotenv/config';
import crypto from 'crypto';

// Complete list of all 213 warehouse location codes from the 12-page Airtronic Gauges PDF report
const PDF_LOCATIONS = [
  // Page 1
  'BAR AREA',
  'BEURO',
  'BEURO RACK 001',
  'BEURO RACK 002',
  'BEURO RACK 003',
  'BIN 001',
  'BIN 0010',
  'BIN 00100',
  'BIN 0011',
  'BIN 0012',
  'BIN 0013',
  'BIN 0014',
  'BIN 0015',
  'BIN 0016',
  'BIN 0017',
  'BIN 0018',

  // Page 2
  'BIN 0019',
  'BIN 002',
  'BIN 0020',
  'BIN 0021',
  'BIN 0022',
  'BIN 0023',
  'BIN 0024',
  'BIN 0025',
  'BIN 0026',
  'BIN 0027',
  'BIN 0028',
  'BIN 0029',
  'BIN 003',
  'BIN 0030',
  'BIN 0031',
  'BIN 0032',
  'BIN 0033',
  'BIN 0034',
  'BIN 0035',

  // Page 3
  'BIN 0036',
  'BIN 0037',
  'BIN 0038',
  'BIN 0039',
  'BIN 004',
  'BIN 0040',
  'BIN 0041',
  'BIN 0042',
  'BIN 0043',
  'BIN 0044',
  'BIN 0045',
  'BIN 0046',
  'BIN 0047',
  'BIN 0048',
  'BIN 0049',
  'BIN 005',
  'BIN 0050',
  'BIN 0051',
  'BIN 0052',

  // Page 4
  'BIN 0053',
  'BIN 0054',
  'BIN 0055',
  'BIN 0056',
  'BIN 0057',
  'BIN 0058',
  'BIN 0059',
  'BIN 006',
  'BIN 0060',
  'BIN 0061',
  'BIN 0062',
  'BIN 0063',
  'BIN 0064',
  'BIN 0065',
  'BIN 0066',
  'BIN 0067',
  'BIN 0068',
  'BIN 0069',
  'BIN 007',

  // Page 5
  'BIN 0070',
  'BIN 0071',
  'BIN 0072',
  'BIN 0073',
  'BIN 0074',
  'BIN 0075',
  'BIN 0076',
  'BIN 0077',
  'BIN 0078',
  'BIN 0079',
  'BIN 008',
  'BIN 0080',
  'BIN 0081',
  'BIN 0082',
  'BIN 0083',
  'BIN 0084',
  'BIN 0085',
  'BIN 0086',
  'BIN 0087',

  // Page 6
  'BIN 0088',
  'BIN 0089',
  'BIN 009',
  'BIN 0090',
  'BIN 0091',
  'BIN 0092',
  'BIN 0093',
  'BIN 0094',
  'BIN 0095',
  'BIN 0096',
  'BIN 0097',
  'BIN 0098',
  'BIN 0099',
  'BLUE BOX',
  'BOX 001',
  'BOX 002',
  'BOX 003',
  'NONE',
  'RACK 001',

  // Page 7
  'RACK 0010',
  'RACK 00100',
  'RACK 0011',
  'RACK 0012',
  'RACK 0013',
  'RACK 0014',
  'RACK 0015',
  'RACK 0016',
  'RACK 0017',
  'RACK 0018',
  'RACK 0019',
  'RACK 002',
  'RACK 0020',
  'RACK 0021',
  'RACK 0022',
  'RACK 0023',
  'RACK 0024',
  'RACK 0025',
  'RACK 0026',

  // Page 8
  'RACK 0027',
  'RACK 0028',
  'RACK 0029',
  'RACK 003',
  'RACK 0030',
  'RACK 0031',
  'RACK 0032',
  'RACK 0033',
  'RACK 0034',
  'RACK 0035',
  'RACK 0036',
  'RACK 0037',
  'RACK 0038',
  'RACK 0039',
  'RACK 004',
  'RACK 0040',
  'RACK 0041',
  'RACK 0042',
  'RACK 0043',

  // Page 9
  'RACK 0044',
  'RACK 0045',
  'RACK 0046',
  'RACK 0047',
  'RACK 0048',
  'RACK 0049',
  'RACK 005',
  'RACK 0050',
  'RACK 0051',
  'RACK 0052',
  'RACK 0053',
  'RACK 0054',
  'RACK 0055',
  'RACK 0056',
  'RACK 0057',
  'RACK 0058',
  'RACK 0059',
  'RACK 006',
  'RACK 0060',

  // Page 10
  'RACK 0061',
  'RACK 0062',
  'RACK 0063',
  'RACK 0064',
  'RACK 0065',
  'RACK 0066',
  'RACK 0067',
  'RACK 0068',
  'RACK 0069',
  'RACK 007',
  'RACK 0070',
  'RACK 0071',
  'RACK 0072',
  'RACK 0073',
  'RACK 0074',
  'RACK 0075',
  'RACK 0076',
  'RACK 0077',
  'RACK 0078',

  // Page 11
  'RACK 0079',
  'RACK 008',
  'RACK 0080',
  'RACK 0081',
  'RACK 0082',
  'RACK 0083',
  'RACK 0084',
  'RACK 0085',
  'RACK 0086',
  'RACK 0087',
  'RACK 0088',
  'RACK 0089',
  'RACK 009',
  'RACK 0090',
  'RACK 0091',
  'RACK 0092',
  'RACK 0093',
  'RACK 0094',
  'RACK 0095',

  // Page 12
  'RACK 0096',
  'RACK 0097',
  'RACK 0098',
  'RACK 0099',
  'RACK 0100',
  'RACK004',
  'ROD AREA'
];

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database.');

  try {
    await client.query('BEGIN');

    // Pre-check stock balances
    const sbBefore = await client.query('SELECT COUNT(*) as count, SUM(current_quantity) as total_qty FROM stock_balances');
    console.log(`Initial stock balances: ${sbBefore.rows[0].count} records, ${sbBefore.rows[0].total_qty} total quantity.`);

    // 1. Get VELAN STORES warehouse
    const whRes = await client.query("SELECT id FROM warehouses WHERE code = 'VELAN STORES' OR name ILIKE '%Velan%' LIMIT 1");
    if (!whRes.rows.length) {
      throw new Error('Warehouse VELAN STORES not found!');
    }
    const warehouseId = whRes.rows[0].id;
    console.log(`Found VELAN STORES warehouse: ${warehouseId}`);

    // 2. Define the 5 target locations
    const targetLocations = [
      { code: 'ROD-AREA', name: 'Rod Area' },
      { code: 'BAR-AREA', name: 'Bar Area' },
      { code: 'RACK-AREA', name: 'Rack Area' },
      { code: 'BIN-AREA', name: 'Bin Area' },
      { code: 'BEURO', name: 'Beuro Area' },
    ];

    const locationMap = new Map(); // code -> id

    for (const loc of targetLocations) {
      let existing = await client.query(
        'SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND (code = $2 OR name = $3) LIMIT 1',
        [warehouseId, loc.code, loc.name]
      );
      if (existing.rows.length > 0) {
        locationMap.set(loc.code, existing.rows[0].id);
        console.log(`Location ${loc.name} already exists: ${existing.rows[0].id}`);
      } else {
        const newId = crypto.randomUUID();
        await client.query(
          `INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [newId, warehouseId, loc.code, loc.name]
        );
        locationMap.set(loc.code, newId);
        console.log(`Created location ${loc.name}: ${newId}`);
      }
    }

    // 3. Create Shelving Rack for BIN-AREA
    const binLocationId = locationMap.get('BIN-AREA');
    let binShelvingRack = await client.query(
      "SELECT id FROM racks WHERE location_id = $1 AND code = 'BIN-SHELVING' LIMIT 1",
      [binLocationId]
    );
    let binShelvingRackId;
    if (binShelvingRack.rows.length > 0) {
      binShelvingRackId = binShelvingRack.rows[0].id;
    } else {
      binShelvingRackId = crypto.randomUUID();
      await client.query(
        `INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
         VALUES ($1, $2, 'BIN-SHELVING', 'Bins Shelving', true, NOW(), NOW())`,
        [binShelvingRackId, binLocationId]
      );
      console.log(`Created Shelving rack for BIN-AREA: ${binShelvingRackId}`);
    }

    // 4. Fetch all existing racks and bins in the database
    const existingRacksRes = await client.query('SELECT id, location_id, code, name FROM racks');
    const existingRacks = new Map(); // code -> row
    for (const r of existingRacksRes.rows) {
      existingRacks.set(r.code.trim().toUpperCase(), r);
    }

    const existingBinsRes = await client.query('SELECT id, rack_id, code, name FROM bins');
    const existingBins = new Map(); // code -> row
    for (const b of existingBinsRes.rows) {
      existingBins.set(b.code.trim().toUpperCase(), b);
    }

    // Categorization helper
    function getTargetCategory(code) {
      const upper = code.trim().toUpperCase();
      if (upper === 'ROD AREA') return 'ROD-AREA';
      if (upper === 'BAR AREA') return 'BAR-AREA';
      if (upper.startsWith('BEURO')) return 'BEURO';
      if (upper.startsWith('RACK')) return 'RACK-AREA';
      return 'BIN-AREA'; // BIN xxx, BOX xxx, BLUE BOX, NONE
    }

    // 5. Process each of the 213 location items
    const distinctCodes = Array.from(new Set(PDF_LOCATIONS.map(c => c.trim().toUpperCase())));
    console.log(`Processing ${distinctCodes.length} unique storage units...`);

    let updatedCount = 0;
    let createdCount = 0;

    for (const code of distinctCodes) {
      const category = getTargetCategory(code);
      const targetLocId = locationMap.get(category);

      if (category === 'BIN-AREA') {
        // Bin goes under binShelvingRackId
        const existingBin = existingBins.get(code);
        if (existingBin) {
          // Update bin's rack to binShelvingRackId
          await client.query('UPDATE bins SET rack_id = $1 WHERE id = $2', [binShelvingRackId, existingBin.id]);
          updatedCount++;
        } else {
          // Create bin under binShelvingRackId
          const binId = crypto.randomUUID();
          await client.query(
            `INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [binId, binShelvingRackId, code, code]
          );
          existingBins.set(code, { id: binId, rack_id: binShelvingRackId, code, name: code });
          createdCount++;
        }
      } else {
        // Category is ROD-AREA, BAR-AREA, BEURO, or RACK-AREA
        // Each unit is its own rack, with a corresponding bin
        let rack = existingRacks.get(code);
        let rackId;
        if (rack) {
          // Move rack to target location
          await client.query('UPDATE racks SET location_id = $1 WHERE id = $2', [targetLocId, rack.id]);
          rackId = rack.id;
          updatedCount++;
        } else {
          rackId = crypto.randomUUID();
          await client.query(
            `INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [rackId, targetLocId, code, code]
          );
          rack = { id: rackId, location_id: targetLocId, code, name: code };
          existingRacks.set(code, rack);
          createdCount++;
        }

        // Ensure bin exists under this rack
        let bin = existingBins.get(code);
        if (bin) {
          await client.query('UPDATE bins SET rack_id = $1 WHERE id = $2', [rackId, bin.id]);
        } else {
          const binId = crypto.randomUUID();
          await client.query(
            `INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [binId, rackId, code, code]
          );
          existingBins.set(code, { id: binId, rack_id: rackId, code, name: code });
          createdCount++;
        }
      }
    }

    // 6. Delete old VELAN-MAIN location and any orphaned racks
    const oldLocRes = await client.query("SELECT id FROM warehouse_locations WHERE code = 'VELAN-MAIN'");
    if (oldLocRes.rows.length > 0) {
      const oldLocId = oldLocRes.rows[0].id;
      // Check remaining racks
      const remRacks = await client.query('SELECT id FROM racks WHERE location_id = $1', [oldLocId]);
      for (const r of remRacks.rows) {
        // If rack has no bins or only empty bins, clean up
        const remBins = await client.query('SELECT id FROM bins WHERE rack_id = $1', [r.id]);
        if (remBins.rows.length === 0) {
          await client.query('DELETE FROM racks WHERE id = $1', [r.id]);
        }
      }
      const checkEmpty = await client.query('SELECT COUNT(*) FROM racks WHERE location_id = $1', [oldLocId]);
      if (parseInt(checkEmpty.rows[0].count) === 0) {
        await client.query('DELETE FROM warehouse_locations WHERE id = $1', [oldLocId]);
        console.log('✓ Successfully deleted old location "Velan Stores Floor" (VELAN-MAIN).');
      } else {
        console.log(`Notice: VELAN-MAIN still has ${checkEmpty.rows[0].count} racks.`);
      }
    }

    // Post-check stock balances
    const sbAfter = await client.query('SELECT COUNT(*) as count, SUM(current_quantity) as total_qty FROM stock_balances');
    console.log(`Post-migration stock balances: ${sbAfter.rows[0].count} records, ${sbAfter.rows[0].total_qty} total quantity.`);

    if (sbBefore.rows[0].count !== sbAfter.rows[0].count || sbBefore.rows[0].total_qty !== sbAfter.rows[0].total_qty) {
      throw new Error('Stock balance mismatch! Rolling back transaction.');
    }

    await client.query('COMMIT');
    console.log('✅ REORGANIZATION COMMITTED SUCCESSFULLY!');

    // Print summary
    const summary = await client.query(`
      SELECT l.name as location_name, l.code as location_code, COUNT(DISTINCT r.id) as rack_count, COUNT(DISTINCT b.id) as bin_count
      FROM warehouse_locations l
      LEFT JOIN racks r ON r.location_id = l.id
      LEFT JOIN bins b ON b.rack_id = r.id
      WHERE l.warehouse_id = $1
      GROUP BY l.id, l.name, l.code
      ORDER BY l.name
    `, [warehouseId]);

    console.log('\n--- NEW WAREHOUSE STRUCTURE ---');
    console.table(summary.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during reorganization:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
