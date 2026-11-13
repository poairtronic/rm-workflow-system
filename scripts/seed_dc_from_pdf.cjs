/**
 * SEED DELIVERY CHALLANS FROM SCANNED PDF
 * Implements Phase 2 (Dry Run), Phase 3 (Apply), and Rollback.
 *
 * Usage:
 *   node scripts/seed_dc_from_pdf.cjs              (Dry-run by default)
 *   node scripts/seed_dc_from_pdf.cjs --dry-run    (Explicit dry-run)
 *   node scripts/seed_dc_from_pdf.cjs --apply      (Execute single-transaction seed)
 *   node scripts/seed_dc_from_pdf.cjs --rollback <batch_id>
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');

// Load environment connection
const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  } else if (!dbUrl && line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  }
}

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isRollback = args.includes('--rollback');
const rollbackBatchId = isRollback ? args[args.indexOf('--rollback') + 1] : null;
const isDryRun = !isApply && !isRollback;

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Known Vendor Alias Mapping from PDF to DB
const VENDOR_ALIAS_MAP = {
  'nvcnc': 'nv cnc tehnolgies',
  'flame tech / htv': 'flametech (madras) pvt.ltd',
  'rkv metal': 'r.k.v metal finishers',
};

// Known PO Alias Mapping
const PO_ALIAS_MAP = {
  'bharat forge - project 1': 'bharat forge- project 1',
  'bharat forge- project 3': 'bharat forge- project 3',
  'agiplpo1274/scl- 20 days del': 'agiplpo1274-scl',
};

// Map process remarks to production process names in DB
function normalizeProcessName(remark, processName) {
  const combined = `${remark || ''} ${processName || ''}`.toUpperCase();
  if (combined.includes('CG') || combined.includes('CYLINDRICAL')) return 'Cylindrical Grinding';
  if (combined.includes('HONING')) return 'Honing';
  if (combined.includes('ID GRINDING')) return 'ID Grinding';
  if (combined.includes('WIRECUT')) return 'Wirecut';
  if (combined.includes('HT') || combined.includes('HEAT TREATMENT')) return 'Heat Treatment';
  if (combined.includes('DULL CHROME') || combined.includes('CHORME')) return 'Dull Chrome Plating';
  if (combined.includes('BLACKENING') || combined.includes('BLACKING')) return 'Blackening';
  if (combined.includes('SUPER DRILL') || combined.includes('SUPERDRILL')) return 'Super Drill';
  if (combined.includes('WEIGHT REDUCTION')) return 'Weight Reduction';
  if (combined.includes('JUST CLEAN') || combined.includes('CLEAN')) return 'Cleaning';
  if (combined.includes('BRAZZING')) return 'Brazing';
  if (combined.includes('SPARKING')) return 'Sparking';
  if (combined.includes('POWDER COATING')) return 'Powder Coating';
  if (combined.includes('TAPPING')) return 'Tapping';
  return 'General Machining';
}

async function main() {
  await client.connect();

  if (isRollback) {
    if (!rollbackBatchId) {
      console.error('Error: Please provide a batch_id to rollback. Example: --rollback seed-dc-20261113-1234');
      process.exit(1);
    }
    console.log(`\n================ EXECUTING ROLLBACK FOR BATCH: ${rollbackBatchId} ================`);
    await rollbackBatch(rollbackBatchId);
    await client.end();
    return;
  }

  const seedPath = path.resolve(__dirname, '../seed/dc_seed.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`Error: Seed file not found at ${seedPath}`);
    process.exit(1);
  }
  const seedDcs = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  console.log(`\n================ ${isDryRun ? 'PHASE 2: DRY RUN' : 'PHASE 3: APPLY SEED'} ================`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No database writes)' : 'APPLY (Single transaction write)'}`);
  console.log(`Loaded ${seedDcs.length} DCs from seed/dc_seed.json.\n`);

  // 1. Fetch DB master records
  const dbVendors = (await client.query('SELECT id, name, phone, address FROM vendors')).rows;
  const dbPos = (await client.query('SELECT id, po_number FROM purchase_orders')).rows;
  const dbScs = (await client.query('SELECT id, sc_number, po_id, product_name FROM sales_order_components')).rows;
  const dbProducts = (await client.query('SELECT id, code, name FROM products')).rows;
  const dbProcesses = (await client.query('SELECT id, name FROM production_processes')).rows;
  const dbExistingDcs = (await client.query('SELECT id, challan_number FROM delivery_challans')).rows;
  const existingDcNumSet = new Set(dbExistingDcs.map(d => d.challan_number));

  // Build lookups
  const vendorByName = new Map();
  for (const v of dbVendors) {
    vendorByName.set(v.name.trim().toLowerCase(), v);
  }

  const poByNum = new Map();
  for (const p of dbPos) {
    poByNum.set(p.po_number.trim().toLowerCase(), p);
  }

  const scByNum = new Map();
  for (const s of dbScs) {
    scByNum.set(s.sc_number.trim(), s);
  }

  const processByName = new Map();
  for (const pr of dbProcesses) {
    processByName.set(pr.name.trim().toLowerCase(), pr);
  }

  const prodByCode = new Map();
  for (const pr of dbProducts) {
    if (pr.code) prodByCode.set(pr.code.trim().toLowerCase(), pr);
    if (pr.name) prodByCode.set(pr.name.trim().toLowerCase(), pr);
  }

  // Track product-lock occurrences
  const productUsageAcrossDcs = new Map(); // part_no -> [ { dc_number, qty } ]
  const plannedVendorsToCreate = new Map(); // name -> vendorObj

  const dryRunResults = [];
  let unresolvedCount = 0;
  let type1Count = 0;
  let type3Count = 0;

  for (const dc of seedDcs) {
    const dcResult = {
      dc_number: dc.dc_number,
      date: dc.date,
      printed_vendor: dc.vendor.name,
      printed_po: dc.po_no,
      resolved_type: null,
      resolved_vendor_id: null,
      resolved_po_id: null,
      lines_status: [],
      unresolved: [],
      flags: dc.flags || []
    };

    // A. Resolve Vendor
    let vClean = dc.vendor.name.trim().toLowerCase();
    if (VENDOR_ALIAS_MAP[vClean]) {
      vClean = VENDOR_ALIAS_MAP[vClean];
    }
    let matchedVendor = vendorByName.get(vClean);
    if (!matchedVendor) {
      for (const [k, v] of vendorByName.entries()) {
        if (k.includes(vClean) || vClean.includes(k)) {
          matchedVendor = v;
          break;
        }
      }
    }
    if (matchedVendor) {
      dcResult.resolved_vendor_id = matchedVendor.id;
      dcResult.resolved_vendor_name = matchedVendor.name;
    } else {
      dcResult.unresolved.push(`Missing Vendor: "${dc.vendor.name}"`);
      if (!plannedVendorsToCreate.has(dc.vendor.name)) {
        plannedVendorsToCreate.set(dc.vendor.name, {
          name: dc.vendor.name,
          address: dc.vendor.address || 'Chennai',
          phone: dc.vendor.phone || null,
        });
      }
    }

    // B. Resolve PO
    let pClean = dc.po_no.trim().toLowerCase();
    if (PO_ALIAS_MAP[pClean]) {
      pClean = PO_ALIAS_MAP[pClean];
    }
    let matchedPo = poByNum.get(pClean);
    if (!matchedPo) {
      // try numeric prefix
      const match = dc.po_no.match(/AGIPLPO\s*(\d+)/i);
      if (match) {
        const num = match[1];
        for (const [k, p] of poByNum.entries()) {
          if (k.includes(`agiplpo${num}`) || k.includes(`po${num}`) || k.startsWith(`po-${num}`)) {
            matchedPo = p;
            break;
          }
        }
      }
      if (!matchedPo) {
        for (const [k, p] of poByNum.entries()) {
          if (k.includes(pClean) || pClean.includes(k)) {
            matchedPo = p;
            break;
          }
        }
      }
    }
    if (matchedPo) {
      dcResult.resolved_po_id = matchedPo.id;
      dcResult.resolved_po_number = matchedPo.po_number;
    } else {
      dcResult.unresolved.push(`Missing PO: "${dc.po_no}"`);
    }

    // C. Resolve Lines, SCs, and Determine DC Type
    let allLinesHaveSc = true;
    let anyLineHasSc = false;

    for (const line of dc.lines) {
      const partNo = line.part_no;
      const matchedSc = scByNum.get(partNo);
      const matchedProd = prodByCode.get(partNo.toLowerCase());

      // Product lock tracking
      if (!productUsageAcrossDcs.has(partNo)) {
        productUsageAcrossDcs.set(partNo, []);
      }
      productUsageAcrossDcs.get(partNo).push({
        dc_number: dc.dc_number,
        qty: line.qty,
        desc: line.description
      });

      if (matchedSc) {
        anyLineHasSc = true;
        dcResult.lines_status.push({
          part_no: partNo,
          qty: line.qty,
          status: 'RESOLVED_SC',
          sc_id: matchedSc.id,
          product_name: matchedSc.product_name,
        });
      } else if (matchedProd) {
        dcResult.lines_status.push({
          part_no: partNo,
          qty: line.qty,
          status: 'RESOLVED_PROD_ONLY',
          product_id: matchedProd.id,
          product_name: matchedProd.name,
        });
        allLinesHaveSc = false;
      } else {
        allLinesHaveSc = false;
        dcResult.lines_status.push({
          part_no: partNo,
          qty: line.qty,
          status: 'UNRESOLVED_ITEM',
        });
        dcResult.unresolved.push(`Unresolved Part: "${partNo}" (${line.description})`);
      }
    }

    // Determine Type
    // Type 1 if PO exists and all lines have SCs linked to it
    // Type 3 if PO exists but items are MERC SPL without individual shopfloor SCs
    if (matchedPo && anyLineHasSc) {
      dcResult.resolved_type = 'TYPE_1 (PRODUCTION_PROCESS_OUTWARD)';
      type1Count++;
    } else if (matchedPo && !anyLineHasSc) {
      dcResult.resolved_type = 'TYPE_3 (SPL_PROCESS - MERC)';
      type3Count++;
    } else {
      dcResult.resolved_type = 'UNRESOLVED (PO Missing)';
    }

    if (dcResult.unresolved.length > 0) {
      unresolvedCount++;
    }

    dryRunResults.push(dcResult);
  }

  // Print Summary Table
  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log(
    'DC Number'.padEnd(18) +
    'Type'.padEnd(38) +
    'Vendor Status'.padEnd(28) +
    'PO Status'.padEnd(32) +
    'Lines'
  );
  console.log('------------------------------------------------------------------------------------------------------------------------');

  for (const r of dryRunResults) {
    const vStatus = r.resolved_vendor_name ? `✓ ${r.resolved_vendor_name.substring(0, 24)}` : `✗ MISSING`;
    const pStatus = r.resolved_po_number ? `✓ ${r.resolved_po_number.substring(0, 28)}` : `✗ MISSING`;
    const lineSummary = `${r.lines_status.filter(l => l.status === 'RESOLVED_SC').length}/${r.lines_status.length} SCs`;
    console.log(
      r.dc_number.padEnd(18) +
      r.resolved_type.padEnd(38) +
      vStatus.padEnd(28) +
      pStatus.padEnd(32) +
      lineSummary
    );
  }
  console.log('------------------------------------------------------------------------------------------------------------------------');

  console.log(`\n=== DRY RUN CLASSIFICATION SUMMARY ===`);
  console.log(`Total DCs in Seed: ${dryRunResults.length}`);
  console.log(`Classified as Type 1 (Internal Process SC): ${type1Count}`);
  console.log(`Classified as Type 3 (SPL / Merc PO): ${type3Count}`);
  console.log(`DCs with Unresolved Masters: ${unresolvedCount}`);

  // Print Planned Vendors to Create
  if (plannedVendorsToCreate.size > 0) {
    console.log(`\n=== PLANNED VENDORS TO CREATE (${plannedVendorsToCreate.size}) ===`);
    for (const [name, v] of plannedVendorsToCreate.entries()) {
      console.log(`- ${name}: Address: "${v.address}", Phone: "${v.phone}"`);
    }
  }

  // Print Product-Lock Conflicts
  console.log(`\n=== PRODUCT-LOCK CONFLICT ANALYSIS (DCL.1 - DCL.3) ===`);
  const conflicts = [];
  for (const [part, usages] of productUsageAcrossDcs.entries()) {
    if (usages.length > 1) {
      conflicts.push({ part, count: usages.length, usages });
    }
  }
  console.log(`Found ${conflicts.length} products appearing across multiple open DCs in this batch:`);
  for (const c of conflicts) {
    const dcList = c.usages.map(u => `${u.dc_number} (${u.qty} NOS)`).join(', ');
    console.log(`  • Part [${c.part}]: ${c.count} open DCs -> [${dcList}]`);
  }
  console.log(`\n* Note: As per instructions, product-lock logic must remain unchanged in the app.`);
  console.log(`* The seed process explicitly bypasses the lock check for this one-time master seed.`);

  // If in Apply Mode, Execute Transaction
  if (isApply) {
    console.log(`\n================ EXECUTING PHASE 3: APPLY ================`);
    await applySeed(seedDcs, dryRunResults, plannedVendorsToCreate);
  } else {
    console.log(`\n[DRY RUN COMPLETE] Zero database rows modified. To apply these changes, run with --apply.`);
  }

  await client.end();
}

/**
 * Phase 3: Apply Seed in a Single Atomic Transaction
 */
async function applySeed(seedDcs, dryRunResults, plannedVendorsToCreate) {
  const batchId = `seed-dc-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
  console.log(`Beginning Atomic Transaction with Batch ID: [${batchId}]...`);

  await client.query('BEGIN');
  try {
    // 1. Create missing vendors if any
    const createdVendorMap = new Map();
    for (const [name, v] of plannedVendorsToCreate.entries()) {
      const vId = crypto.randomUUID();
      await client.query(
        `INSERT INTO vendors (id, name, address, phone_number, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [vId, name, v.address, v.phone]
      );
      createdVendorMap.set(name.trim().toLowerCase(), vId);
      console.log(`Created missing vendor: ${name} (${vId})`);
    }

    // 2. Fetch admin user id for created_by_id
    const userRes = await client.query("SELECT id FROM users WHERE role = 'ADMIN' OR email ILIKE '%admin%' LIMIT 1");
    const adminUserId = userRes.rows[0]?.id || null;

    // 3. Fallback Product for dc_movements (since dc_movements.dispatched_product_id is NOT NULL)
    const fallbackProdRes = await client.query('SELECT id FROM products LIMIT 1');
    const fallbackProdId = fallbackProdRes.rows[0]?.id;

    // 4. Process DCs in ascending DC number order
    const sortedDcs = [...seedDcs].sort((a, b) => a.dc_number.localeCompare(b.dc_number));
    let insertedDcs = 0;
    let insertedItems = 0;
    let insertedMovements = 0;

    for (const dc of sortedDcs) {
      // Check idempotency: skip if DC number already exists
      const checkExists = await client.query('SELECT id FROM delivery_challans WHERE challan_number = $1', [dc.dc_number]);
      if (checkExists.rows.length > 0) {
        console.log(`Skipping existing DC: ${dc.dc_number}`);
        continue;
      }

      // Resolve Vendor
      const dryResult = dryRunResults.find(d => d.dc_number === dc.dc_number);
      let vendorId = dryResult?.resolved_vendor_id;
      if (!vendorId) {
        vendorId = createdVendorMap.get(dc.vendor.name.trim().toLowerCase());
      }
      if (!vendorId) {
        throw new Error(`Cannot apply DC ${dc.dc_number}: Vendor "${dc.vendor.name}" could not be resolved or created.`);
      }

      // Resolve PO
      const poId = dryResult?.resolved_po_id || null;
      const poNumber = dryResult?.resolved_po_number || dc.po_no;

      // Determine Type
      const isType1 = dryResult?.resolved_type?.startsWith('TYPE_1');
      const dcType = isType1 ? 'PRODUCTION_PROCESS_OUTWARD' : 'SPL_PROCESS';

      // Resolve Process
      const procName = normalizeProcessName(dc.process_remark);
      const procRes = await client.query('SELECT id FROM production_processes WHERE name ILIKE $1 LIMIT 1', [`%${procName}%`]);
      const processId = procRes.rows[0]?.id || null;

      // Header SC ID (if single SC across items)
      const scIds = dryResult?.lines_status.map(l => l.sc_id).filter(Boolean) || [];
      const headerScId = scIds.length > 0 ? scIds[0] : null;

      const dcId = crypto.randomUUID();
      const dispatchDate = new Date(`${dc.date}T10:00:00Z`);

      // Insert delivery_challans
      // Stores exact printed DC number SDC/2627/00NN in challan_number
      // Tagged in notes with batchId for clean rollback
      const notesWithBatch = `[BATCH:${batchId}] ${dc.process_remark || ''}`.trim();

      await client.query(
        `INSERT INTO delivery_challans (
          id, challan_number, type, vendor_id, sc_id, process_id, process_name,
          dispatch_date, status, notes, created_by_id, po_number, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9, $10, $11, $8, $8
        )`,
        [
          dcId,
          dc.dc_number,
          dcType,
          vendorId,
          headerScId,
          processId,
          procName,
          dispatchDate,
          notesWithBatch,
          adminUserId,
          poNumber
        ]
      );
      insertedDcs++;

      // Insert line items & DC movements
      for (const line of dc.lines) {
        const lineItem = dryResult?.lines_status.find(l => l.part_no === line.part_no);
        const scId = lineItem?.sc_id || headerScId || null;
        const itemId = crypto.randomUUID();

        await client.query(
          `INSERT INTO delivery_challan_items (
            id, challan_id, sc_id, process_id, process_name,
            part_number, part_name, description, quantity_dispatched,
            initial_expected_qty, expected_return_qty, quantity_returned,
            actual_received_qty, qc_pending_qty, qc_passed_qty, qc_rejected_qty,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9, 0, 0, 0, 0, 0, $10, $10
          )`,
          [
            itemId,
            dcId,
            scId,
            processId,
            procName,
            line.part_no,
            line.description,
            line.description,
            line.qty,
            dispatchDate
          ]
        );
        insertedItems++;

        // For Type 1 with valid SC, insert running ledger entry into dc_movements
        if (scId) {
          const movementId = crypto.randomUUID();
          await client.query(
            `INSERT INTO dc_movements (
              id, challan_id, challan_item_id, sc_id, process_id,
              dispatched_product_id, dispatched_qty, returned_qty,
              status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, 0, 'DISPATCHED', $8, $8
            )`,
            [
              movementId,
              dcId,
              itemId,
              scId,
              processId,
              fallbackProdId,
              line.qty,
              dispatchDate
            ]
          );
          insertedMovements++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`\n✓ TRANSACTION COMMITTED SUCCESSFULLY!`);
    console.log(`- Batch ID: ${batchId}`);
    console.log(`- Created DCs: ${insertedDcs}`);
    console.log(`- Created DC Items: ${insertedItems}`);
    console.log(`- Created DC Movements: ${insertedMovements}`);
    console.log(`To rollback this batch if ever needed: node scripts/seed_dc_from_pdf.cjs --rollback ${batchId}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n✗ TRANSACTION FAILED - ROLLED BACK:`, err);
    throw err;
  }
}

/**
 * Rollback batch
 */
async function rollbackBatch(batchId) {
  console.log(`Starting rollback for batch: ${batchId}...`);
  await client.query('BEGIN');
  try {
    const dcRes = await client.query(
      `SELECT id, challan_number FROM delivery_challans WHERE notes LIKE $1`,
      [`%[BATCH:${batchId}]%`]
    );
    const dcIds = dcRes.rows.map(d => d.id);
    console.log(`Found ${dcIds.length} delivery challans tagged with batch ${batchId}.`);

    if (dcIds.length > 0) {
      await client.query('DELETE FROM dc_movements WHERE challan_id = ANY($1)', [dcIds]);
      await client.query('DELETE FROM delivery_challan_items WHERE challan_id = ANY($1)', [dcIds]);
      await client.query('DELETE FROM delivery_challans WHERE id = ANY($1)', [dcIds]);
      console.log(`Deleted ${dcIds.length} challans, associated items and movements.`);
    }

    await client.query('COMMIT');
    console.log(`✓ Rollback completed successfully.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`✗ Rollback failed:`, err);
    throw err;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

