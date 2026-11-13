const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');

async function main() {
  console.log('Connecting to Neon DB to finalize Delivery Challans and Vendor SLAs...');
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const adminRes = await c.query("SELECT id FROM users WHERE email = 'ramu76486@gmail.com' LIMIT 1");
  const adminId = adminRes.rows[0]?.id;

  const vendorList = (await c.query("SELECT id, code, name FROM vendors")).rows;
  function findVendorId(opCode) {
    if (!opCode) return vendorList[0]?.id;
    const clean = opCode.toUpperCase().trim();
    for (const v of vendorList) {
      if (clean.includes(v.code) || v.name.toUpperCase().includes(clean)) return v.id;
    }
    const idx = Math.abs(clean.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % vendorList.length;
    return vendorList[idx]?.id;
  }

  const defaultProcId = (await c.query("SELECT id FROM production_processes LIMIT 1")).rows[0]?.id;
  const prodMap = new Map();
  (await c.query("SELECT id, name FROM products")).rows.forEach(r => prodMap.set(r.name, r.id));
  const fallbackProdId = Array.from(prodMap.values())[0];

  const scRows = (await c.query("SELECT id, sc_number FROM sales_order_components")).rows;
  const scMap = new Map();
  scRows.forEach(r => scMap.set(r.sc_number, r.id));
  const fallbackScId = scRows[0]?.id;

  // Load parsed rows to get vendor ops
  const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));
  const allVendorOps = [];

  let currentPo = '';
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].data;
    if (!d || Object.keys(d).length === 0) continue;
    if (d.C && d.C.trim()) currentPo = d.C.trim();
    const sc = d.E ? d.E.trim() : '';
    const prod = d.F ? d.F.trim() : '';
    const qtyStr = d.G ? d.G.trim() : '';
    const inhouseVendor = d.J ? d.J.trim() : '';
    const op = d.K ? d.K.trim() : '';
    const status = d.I || d.H || '';

    const isVendor = inhouseVendor.toUpperCase().includes('VENDOR') || (op && (op.includes('-V') || op.includes('V-') || op.includes('PUNE') || op.includes('SABARI') || op.includes('MECHTOOLS')));
    if (isVendor && sc && prod) {
      let qty = 1;
      const m = qtyStr.match(/(\d+)/);
      if (m) qty = parseInt(m[1], 10);
      if (qtyStr.toUpperCase().includes('SET')) qty *= 2;
      allVendorOps.push({ po: currentPo, sc, prod, qty, op, status });
    }
  }

  console.log(`Found ${allVendorOps.length} vendor dispatch operations.`);

  // Generate 65 DCs
  const existingDcs = new Set();
  (await c.query("SELECT challan_number FROM delivery_challans")).rows.forEach(r => existingDcs.add(r.challan_number));

  const DC_BATCH_SIZE = 12;
  const numDcs = Math.min(65, Math.ceil(allVendorOps.length / DC_BATCH_SIZE));
  let dcCount = 0;
  let movementCount = 0;

  for (let i = 0; i < numDcs; i++) {
    const dcNumber = `DC-2026-${String(i + 1).padStart(3, '0')}`;
    if (!existingDcs.has(dcNumber)) {
      const slice = allVendorOps.slice(i * DC_BATCH_SIZE, (i + 1) * DC_BATCH_SIZE);
      if (slice.length === 0) break;

      const firstOp = slice[0];
      const vendorId = findVendorId(firstOp.op);
      const targetScId = scMap.get(firstOp.sc) || fallbackScId;

      let dcStatus = 'DISPATCHED';
      if (i % 3 === 1) dcStatus = 'PARTIALLY_RETURNED';
      if (i % 3 === 2) dcStatus = 'RETURNED';

      const procName = firstOp.status || 'HEAT TREATMENT / MACHINING';
      const ndc = await c.query(
        `INSERT INTO delivery_challans (
          id, challan_number, type, vendor_id, sc_id, status, dispatch_date, expected_return_date,
          process_name, notes, created_by_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, 'PRODUCTION_PROCESS_OUTWARD', $2, $3, $4, NOW() - INTERVAL '${(i + 1) * 2} days', NOW() + INTERVAL '5 days',
          $5, 'Standard production dispatch batch', $6, NOW() - INTERVAL '${(i + 1) * 2} days', NOW()
        ) RETURNING id`,
        [dcNumber, vendorId, targetScId, dcStatus, procName, adminId]
      );
      const dcId = ndc.rows[0].id;
      dcCount++;

      for (const opItem of slice) {
        const itemScId = scMap.get(opItem.sc) || fallbackScId;
        const prodIdVal = prodMap.get(opItem.prod) || fallbackProdId;
        const retQty = dcStatus === 'RETURNED' ? opItem.qty : (dcStatus === 'PARTIALLY_RETURNED' ? Math.floor(opItem.qty / 2) : 0);

        const nItem = await c.query(
          `INSERT INTO delivery_challan_items (
            id, challan_id, sc_id, product_id, part_number, part_name, description, quantity_dispatched,
            expected_output_quantity, quantity_returned, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $7, $8, NOW() - INTERVAL '2 days', NOW()
          ) RETURNING id`,
          [dcId, itemScId, prodIdVal, opItem.sc, opItem.prod, `Vendor Op: ${opItem.op}`, opItem.qty, retQty]
        );
        const itemId = nItem.rows[0].id;

        await c.query(
          `INSERT INTO dc_movements (
            id, challan_id, challan_item_id, sc_id, process_id, dispatched_product_id, dispatched_qty, returned_qty, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '2 days', NOW()
          )`,
          [dcId, itemId, itemScId, defaultProcId, prodIdVal, opItem.qty, retQty, dcStatus === 'RETURNED' ? 'RETURNED' : 'DISPATCHED']
        );
        movementCount++;

        if (retQty > 0) {
          await c.query(
            `INSERT INTO dc_qc_inspections (
              id, challan_id, challan_item_id, batch_received_qty, passed_qty, rejected_qty, actual_inward_qty, remarks, inspected_by_id, inspected_at, created_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $3, 0, $3, 'Batch inspected & accepted', $4, NOW(), NOW()
            )`,
            [dcId, itemId, retQty, adminId]
          );
        }
      }
    }
  }

  console.log(`✓ Seeded ${dcCount} new Delivery Challans and ${movementCount} Movements/QC returns.`);

  // Vendor Capabilities & SLAs
  console.log('Populating Vendor Capabilities & SLAs...');
  const procList = (await c.query("SELECT id FROM production_processes")).rows;
  for (const v of vendorList) {
    for (const p of procList) {
      await c.query(
        `INSERT INTO vendor_process_capabilities (id, vendor_id, process_id, is_approved, lead_time_days, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, true, 5, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [v.id, p.id]
      );
      await c.query(
        `INSERT INTO vendor_slas (id, vendor_id, process_id, sla_days, effective_date, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 5, NOW(), true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [v.id, p.id]
      );
    }
  }
  console.log('✓ Vendor Capabilities and SLAs complete.');

  // Audit
  const finalDcCount = (await c.query("SELECT count(*) FROM delivery_challans")).rows[0].count;
  const finalMoveCount = (await c.query("SELECT count(*) FROM dc_movements")).rows[0].count;
  const finalSlaCount = (await c.query("SELECT count(*) FROM vendor_slas")).rows[0].count;
  console.log(`Final Delivery Challans: ${finalDcCount}`);
  console.log(`Final DC Movements:     ${finalMoveCount}`);
  console.log(`Final Vendor SLAs:      ${finalSlaCount}`);

  await c.end();
}

main().catch(console.error);

