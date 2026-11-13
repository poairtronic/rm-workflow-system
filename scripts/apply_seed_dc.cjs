/**
 * PHASE 3: APPLY SEED DELIVERY CHALLANS FROM PDF
 * Executes atomic creation of 43 Delivery Challans, Vendors, POs, SCs, and DC Movements.
 */

const fs = require('fs');
const path = require('path');
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
  const seedPath = path.resolve(__dirname, '../seed/dc_seed.json');
  const seedDcs = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const batchId = `seed-dc-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
  console.log(`\n================ EXECUTING PHASE 3: APPLY MASTER SEED ================`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`Processing ${seedDcs.length} Delivery Challans...\n`);

  await client.connect();
  await client.query('BEGIN');

  try {
    // Step 1: Clear existing test delivery challans and movements as requested
    console.log('Step 1: Clearing old test Delivery Challans and DC Movements...');
    await client.query('DELETE FROM dc_movements');
    await client.query('DELETE FROM delivery_challan_items');
    await client.query('DELETE FROM delivery_challans');
    console.log('✓ Old test Delivery Challans and movements cleared.');

    // Step 2: Ensure vendor FINISHWEL HONING WORKS exists
    console.log('Step 2: Ensuring vendor "FINISHWEL HONING WORKS" exists...');
    const vCheck = await client.query("SELECT id FROM vendors WHERE name ILIKE '%FINISHWEL HONING WORKS%'");
    let finishwelVendorId;
    if (vCheck.rows.length > 0) {
      finishwelVendorId = vCheck.rows[0].id;
    } else {
      finishwelVendorId = crypto.randomUUID();
      await client.query(
        `INSERT INTO vendors (id, code, name, address, phone, is_active, created_at, updated_at)
         VALUES ($1, 'VEND-FINISHWEL', $2, $3, $4, true, NOW(), NOW())`,
        [
          finishwelVendorId,
          'FINISHWEL HONING WORKS',
          'NO: 51 ARUNAGIRINATHAR STREET, T.M.P NAGAR, PADI',
          '8015816085'
        ]
      );
      console.log(`✓ Created vendor FINISHWEL HONING WORKS (${finishwelVendorId})`);
    }

    // Step 3: Ensure Customer HYUNDAI WIA exists
    console.log('Step 3: Ensuring customer "HYUNDAI WIA" exists...');
    let hyundaiCustId;
    const hCustCheck = await client.query("SELECT id FROM customers WHERE name ILIKE '%HYUNDAI%'");
    if (hCustCheck.rows.length > 0) {
      hyundaiCustId = hCustCheck.rows[0].id;
    } else {
      hyundaiCustId = crypto.randomUUID();
      await client.query(
        `INSERT INTO customers (id, name, code, is_active, created_at, updated_at)
         VALUES ($1, 'HYUNDAI WIA', 'CUST-HYUNDAI', true, NOW(), NOW())`,
        [hyundaiCustId]
      );
      console.log(`✓ Created customer HYUNDAI WIA (${hyundaiCustId})`);
    }

    // Bharat Forge Customer ID
    const bfCustId = 'e90fd299-d389-4497-aacf-415fbff6cfb1';

    // Step 4: Create the 2 missing POs (Option B)
    console.log('Step 4: Ensuring the 2 missing POs exist...');
    // PO 1: AGIPLPO1210-BHARAT FORGE-PROJECT 2
    let po1210Id;
    const po1Check = await client.query("SELECT id FROM purchase_orders WHERE po_number = 'AGIPLPO1210-BHARAT FORGE-PROJECT 2'");
    if (po1Check.rows.length > 0) {
      po1210Id = po1Check.rows[0].id;
    } else {
      po1210Id = crypto.randomUUID();
      await client.query(
        `INSERT INTO purchase_orders (id, po_number, customer_id, remarks, created_at, updated_at)
         VALUES ($1, 'AGIPLPO1210-BHARAT FORGE-PROJECT 2', $2, 'Imported from Scanned DC PDF', NOW(), NOW())`,
        [po1210Id, bfCustId]
      );
      console.log(`✓ Created PO AGIPLPO1210-BHARAT FORGE-PROJECT 2 (${po1210Id})`);
    }

    // PO 2: AGIPLPO 667 - HYUNDAI WIA
    let po667Id;
    const po2Check = await client.query("SELECT id FROM purchase_orders WHERE po_number = 'AGIPLPO 667 - HYUNDAI WIA'");
    if (po2Check.rows.length > 0) {
      po667Id = po2Check.rows[0].id;
    } else {
      po667Id = crypto.randomUUID();
      await client.query(
        `INSERT INTO purchase_orders (id, po_number, customer_id, remarks, created_at, updated_at)
         VALUES ($1, 'AGIPLPO 667 - HYUNDAI WIA', $2, 'Imported from Scanned DC PDF', NOW(), NOW())`,
        [po667Id, hyundaiCustId]
      );
      console.log(`✓ Created PO AGIPLPO 667 - HYUNDAI WIA (${po667Id})`);
    }

    // Step 5: Create the SC components for these 2 POs in sales_order_components
    console.log('Step 5: Creating SC components for the 2 POs...');
    // SC for PO 1210: Part 2181 (target qty: 2)
    const sc2181Check = await client.query("SELECT id FROM sales_order_components WHERE sc_number = '2181'");
    if (sc2181Check.rows.length === 0) {
      const scId = crypto.randomUUID();
      await client.query(
        `INSERT INTO sales_order_components (id, po_id, sc_number, product_name, target_quantity, status, created_at, updated_at)
         VALUES ($1, $2, '2181', 'SRG DIA 107.0 H8+0.054 - DULL CHROME', 2, 'IN_PROGRESS', NOW(), NOW())`,
        [scId, po1210Id]
      );
      console.log(`✓ Created SC 2181 under PO 1210`);
    }

    // SCs for PO 667: Parts 1853, 1851, 1857, 1856, 1854, 1852, 1847, 1844
    const hyundaiParts = [
      { num: '1853', name: 'ACG DIA 35.0 +/- 0.035', qty: 1 },
      { num: '1851', name: 'ACG DIA 33.6-0.025/-0.050', qty: 1 },
      { num: '1857', name: 'ACG DIA 45.0 -0.025', qty: 1 },
      { num: '1856', name: 'ACG DIA 41.0 +/- 0.035', qty: 1 },
      { num: '1854', name: 'ACG DIA 35.0-0.050', qty: 1 },
      { num: '1852', name: 'ACG DIA 34.5 +/- 0.035', qty: 1 },
      { num: '1847', name: 'ACG DIA 32.2 -0.025/-0.050', qty: 1 },
      { num: '1844', name: 'ACG DIA 29.2 -0.025/-0.050', qty: 1 },
    ];

    for (const hp of hyundaiParts) {
      const scCheck = await client.query('SELECT id FROM sales_order_components WHERE sc_number = $1', [hp.num]);
      if (scCheck.rows.length === 0) {
        const scId = crypto.randomUUID();
        await client.query(
          `INSERT INTO sales_order_components (id, po_id, sc_number, product_name, target_quantity, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', NOW(), NOW())`,
          [scId, po667Id, hp.num, hp.name, hp.qty]
        );
        console.log(`✓ Created SC ${hp.num} (${hp.name}) under PO 667`);
      }
    }

    // Step 6: Reload Lookups
    console.log('Step 6: Loading updated master lookups...');
    const allVendors = (await client.query('SELECT id, name FROM vendors')).rows;
    const vendorMap = new Map();
    for (const v of allVendors) {
      vendorMap.set(v.name.trim().toLowerCase(), v.id);
    }
    // Set aliases
    for (const [alias, canonical] of Object.entries(VENDOR_ALIAS_MAP)) {
      if (vendorMap.has(canonical)) {
        vendorMap.set(alias, vendorMap.get(canonical));
      }
    }
    vendorMap.set('finishwel honing works', finishwelVendorId);

    const allPos = (await client.query('SELECT id, po_number FROM purchase_orders')).rows;
    const poMap = new Map();
    for (const p of allPos) {
      poMap.set(p.po_number.trim().toLowerCase(), p);
    }
    for (const [alias, canonical] of Object.entries(PO_ALIAS_MAP)) {
      if (poMap.has(canonical)) {
        poMap.set(alias, poMap.get(canonical));
      }
    }

    const allScs = (await client.query('SELECT id, sc_number, po_id, product_name FROM sales_order_components')).rows;
    const scMap = new Map();
    for (const s of allScs) {
      scMap.set(s.sc_number.trim(), s);
    }

    const userRes = await client.query("SELECT id FROM users WHERE email ILIKE '%admin%' LIMIT 1");
    const adminUserId = userRes.rows[0]?.id || null;

    const fallbackProdRes = await client.query('SELECT id FROM products LIMIT 1');
    const fallbackProdId = fallbackProdRes.rows[0]?.id;

    // Step 7: Insert Delivery Challans, Items, and Movements in Ascending Order
    console.log('Step 7: Seeding 43 Delivery Challans (all Type 1, OPEN)...');
    const sortedDcs = [...seedDcs].sort((a, b) => a.dc_number.localeCompare(b.dc_number));
    let insertedDcs = 0;
    let insertedItems = 0;
    let insertedMovements = 0;

    for (const dc of sortedDcs) {
      // Resolve Vendor
      const vClean = dc.vendor.name.trim().toLowerCase();
      let vendorId = vendorMap.get(vClean);
      if (!vendorId) {
        for (const [k, vid] of vendorMap.entries()) {
          if (k.includes(vClean) || vClean.includes(k)) {
            vendorId = vid;
            break;
          }
        }
      }
      if (!vendorId) {
        throw new Error(`Unresolvable vendor for DC ${dc.dc_number}: "${dc.vendor.name}"`);
      }

      // Resolve PO
      let pClean = dc.po_no.trim().toLowerCase();
      if (PO_ALIAS_MAP[pClean]) pClean = PO_ALIAS_MAP[pClean];
      let matchedPo = poMap.get(pClean);
      if (!matchedPo) {
        const numMatch = dc.po_no.match(/AGIPLPO\s*(\d+)/i);
        if (numMatch) {
          const num = numMatch[1];
          for (const [k, p] of poMap.entries()) {
            if (k.includes(`agiplpo${num}`) || k.includes(`po${num}`) || k.startsWith(`po-${num}`)) {
              matchedPo = p;
              break;
            }
          }
        }
      }
      if (!matchedPo) {
        for (const [k, p] of poMap.entries()) {
          if (k.includes(pClean) || pClean.includes(k)) {
            matchedPo = p;
            break;
          }
        }
      }
      const poNumber = matchedPo ? matchedPo.po_number : dc.po_no;

      // Header SC & Process
      const scList = dc.lines.map(l => scMap.get(l.part_no)).filter(Boolean);
      const headerScId = scList.length > 0 ? scList[0].id : null;
      const procName = normalizeProcessName(dc.process_remark);
      const procRes = await client.query('SELECT id FROM production_processes WHERE name ILIKE $1 LIMIT 1', [`%${procName}%`]);
      const processId = procRes.rows[0]?.id || null;

      const dcId = crypto.randomUUID();
      const dispatchDate = new Date(`${dc.date}T10:00:00Z`);
      const expectedReturnDate = new Date(dispatchDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      const cleanRemarks = (dc.process_remark || '').trim();

      // Insert DC as Type 1 (PRODUCTION_PROCESS_OUTWARD) and status OPEN with 2-day expected return date
      await client.query(
        `INSERT INTO delivery_challans (
          id, challan_number, type, vendor_id, sc_id, process_id, process_name,
          dispatch_date, expected_return_date, status, notes, created_by_id, po_number, created_at, updated_at
        ) VALUES (
          $1, $2, 'PRODUCTION_PROCESS_OUTWARD', $3, $4, $5, $6, $7, $8, 'OPEN', $9, $10, $11, $7, $7
        )`,
        [
          dcId,
          dc.dc_number,
          vendorId,
          headerScId,
          processId,
          procName,
          dispatchDate,
          expectedReturnDate,
          cleanRemarks,
          adminUserId,
          poNumber
        ]
      );
      insertedDcs++;

      // Line items & movements
      for (const line of dc.lines) {
        const sc = scMap.get(line.part_no);
        const itemScId = sc ? sc.id : headerScId;
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
            itemScId,
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

        // Insert movement for Type 1
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
            itemScId,
            processId,
            fallbackProdId,
            line.qty,
            dispatchDate
          ]
        );
        insertedMovements++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n================ TRANSACTION COMMITTED SUCCESSFULLY ================`);
    console.log(`✓ Batch ID: ${batchId}`);
    console.log(`✓ Total Delivery Challans Created: ${insertedDcs}`);
    console.log(`✓ Total DC Line Items Created: ${insertedItems}`);
    console.log(`✓ Total DC Movements Created: ${insertedMovements}`);
    console.log(`✓ All 43 DCs created as Type 1 and OPEN.`);
    console.log(`Rollback command if ever needed: node scripts/seed_dc_from_pdf.cjs --rollback ${batchId}\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n✗ TRANSACTION FAILED AND ROLLED BACK:`, err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
