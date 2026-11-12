/**
 * DC Product-Lock Existing-Data Report (READ-ONLY)
 * Phase DCL.4 Deliverable: Cap fix and re-evaluation of conflict records
 *
 * Scans the database using true Cap (SC rm_items / sales_order_components for Type 1,
 * and MERC indent line items for Type 3) and outputs reports/dc-lock-conflicts.csv.
 * Strictly read-only: does not modify any database records.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { buildProductKey, normalizeText } from '../backend/src/delivery-challan/utils/product-key.util.js';

// Load backend environment variables
const envPath = path.resolve(process.cwd(), 'backend/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { Client } = pg;

interface DcItemRecord {
  item_id: string;
  challan_id: string;
  challan_number: string;
  dc_type: string;
  dc_status: string;
  dispatch_date: string | Date | null;
  dc_created_at: string | Date;
  item_created_at: string | Date;
  sc_id: string | null;
  sc_number: string | null;
  po_number: string | null;
  product_id: string | null;
  part_name: string | null;
  part_number: string | null;
  merc_item_id: string | null;
  po_part_label: string | null;
  is_extra_item: boolean | null;
  quantity_dispatched: number | string;
  actual_received_qty: number | string;
  pending_qty: number | string;
  vendor_name: string | null;
}

interface ConflictRow {
  type: string;
  scOrPo: string;
  product: string;
  scQty: number | string;
  cap: number;
  baseline: number;
  outstanding: number;
  available: number;
  dcNumbers: string;
  vendor: string;
  dispatchDate: string;
  ageDays: number;
  verdict: 'OVER_DISPATCHED' | 'VALID_PARTIAL';
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function generateReport() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in backend/.env');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('Connected to database (READ-ONLY mode).');

  const now = new Date();
  const reportRows: ConflictRow[] = [];

  // ==========================================
  // 1. Process Type 1 (PRODUCTION_PROCESS_OUTWARD)
  // ==========================================
  const type1Query = `
    SELECT 
      dci.id as item_id,
      dci.challan_id,
      dc.challan_number,
      dc.type as dc_type,
      dc.status as dc_status,
      dc.dispatch_date,
      dc.created_at as dc_created_at,
      dci.created_at as item_created_at,
      dci.sc_id,
      sc.sc_number,
      dci.product_id,
      dci.part_name,
      dci.part_number,
      dci.quantity_dispatched,
      COALESCE(dci.actual_received_qty, 0) as actual_received_qty,
      GREATEST(dci.quantity_dispatched - COALESCE(dci.actual_received_qty, 0), 0) as pending_qty,
      v.name as vendor_name
    FROM delivery_challan_items dci
    JOIN delivery_challans dc ON dci.challan_id = dc.id
    LEFT JOIN sales_order_components sc ON dci.sc_id = sc.id
    LEFT JOIN vendors v ON dc.vendor_id = v.id
    WHERE dc.type = 'PRODUCTION_PROCESS_OUTWARD'
    ORDER BY dci.created_at ASC, dci.id ASC;
  `;

  const type1Res = await client.query<DcItemRecord>(type1Query);
  console.log(`Fetched ${type1Res.rows.length} total Type 1 items.`);

  // Group Type 1 items by (sc_id, product_key)
  const type1Groups = new Map<string, {
    scId: string;
    scNumber: string;
    productId: string | null;
    partName: string | null;
    productKey: string;
    productLabel: string;
    items: DcItemRecord[];
  }>();

  for (const r of type1Res.rows) {
    if (!r.sc_id) continue;
    const prodKey = buildProductKey({ productId: r.product_id, partName: r.part_name });
    if (!prodKey) continue;
    const groupKey = `${r.sc_id}|${prodKey}`;
    if (!type1Groups.has(groupKey)) {
      type1Groups.set(groupKey, {
        scId: r.sc_id,
        scNumber: r.sc_number || r.part_number || 'N/A',
        productId: r.product_id,
        partName: r.part_name,
        productKey: prodKey,
        productLabel: r.part_name || prodKey,
        items: [],
      });
    }
    type1Groups.get(groupKey)!.items.push(r);
  }

  for (const [, g] of type1Groups) {
    g.items.sort((a, b) => new Date(a.item_created_at).getTime() - new Date(b.item_created_at).getTime());
    const baseline = Number(g.items[0].quantity_dispatched);

    // Resolve true cap for this Type 1 item
    let cap: number | null = null;
    let scQtyDisplay: number | string = 'N/A';

    const normPartName = normalizeText(g.partName);
    const prodId = g.productId && String(g.productId).trim() ? String(g.productId).trim() : null;

    // Check child rm_items
    const rmRes = await client.query(`
      SELECT SUM(rmi.quantity) as cap
      FROM rm_items rmi
      WHERE rmi.sc_id = $1::uuid
        AND (
          ($2::uuid IS NOT NULL AND rmi.mapped_product_id = $2::uuid)
          OR ($3 <> '' AND (
            UPPER(REGEXP_REPLACE(TRIM(COALESCE(rmi.part_name, '')), '\\s+', ' ', 'g')) = $3
            OR UPPER(REGEXP_REPLACE(TRIM(COALESCE(rmi.material, '')), '\\s+', ' ', 'g')) = $3
          ))
        );
    `, [g.scId, prodId, normPartName]);

    if (rmRes.rows && rmRes.rows.length > 0 && rmRes.rows[0].cap != null && Number(rmRes.rows[0].cap) > 0) {
      cap = Number(rmRes.rows[0].cap);
      scQtyDisplay = cap;
    } else {
      // Fallback to sales_order_components.target_quantity
      const scRes = await client.query(`
        SELECT target_quantity
        FROM sales_order_components
        WHERE id = $1::uuid;
      `, [g.scId]);

      if (scRes.rows && scRes.rows.length > 0 && scRes.rows[0].target_quantity != null && Number(scRes.rows[0].target_quantity) > 0) {
        cap = Number(scRes.rows[0].target_quantity);
        scQtyDisplay = cap;
      }
    }

    if (cap == null || cap <= 0) {
      cap = baseline;
      scQtyDisplay = `(Baseline: ${baseline})`;
    }

    // Filter open items
    const openItems = g.items.filter((it) => !['CLOSED', 'RETURNED'].includes(it.dc_status));
    const outstanding = openItems.reduce((sum, it) => sum + Number(it.pending_qty), 0);
    const available = Math.max(0, cap - outstanding);
    const distinctOpenDcs = Array.from(new Set(openItems.map((it) => it.challan_number)));

    // A conflict or chain exists when multiple DCs are open or outstanding exceeds cap
    if (distinctOpenDcs.length > 1 || outstanding > cap) {
      const isOver = outstanding > cap;
      const vendors = Array.from(new Set(openItems.map((it) => it.vendor_name).filter(Boolean))).join('; ') || 'N/A';
      
      const earliestDispatch = openItems
        .map((it) => (it.dispatch_date ? new Date(it.dispatch_date) : new Date(it.dc_created_at)))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      
      const dispatchDateStr = earliestDispatch ? earliestDispatch.toISOString().split('T')[0] : 'N/A';
      const ageDays = earliestDispatch
        ? Math.max(0, Math.floor((now.getTime() - earliestDispatch.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      reportRows.push({
        type: 'Type 1',
        scOrPo: g.scNumber,
        product: g.productLabel,
        scQty: scQtyDisplay,
        cap,
        baseline,
        outstanding,
        available,
        dcNumbers: distinctOpenDcs.join(', '),
        vendor: vendors,
        dispatchDate: dispatchDateStr,
        ageDays,
        verdict: isOver ? 'OVER_DISPATCHED' : 'VALID_PARTIAL',
      });
    }
  }

  // ==========================================
  // 2. Process Type 3 (SPL_PROCESS)
  // ==========================================
  const type3Query = `
    SELECT 
      dci.id as item_id,
      dci.challan_id,
      dc.challan_number,
      dc.type as dc_type,
      dc.status as dc_status,
      dc.dispatch_date,
      dc.created_at as dc_created_at,
      dci.created_at as item_created_at,
      dc.po_number,
      dci.merc_item_id,
      dci.po_part_label,
      dci.part_name,
      dci.part_number,
      dci.is_extra_item,
      dci.quantity_dispatched,
      COALESCE(dci.actual_received_qty, 0) as actual_received_qty,
      GREATEST(dci.quantity_dispatched - COALESCE(dci.actual_received_qty, 0), 0) as pending_qty,
      v.name as vendor_name
    FROM delivery_challan_items dci
    JOIN delivery_challans dc ON dci.challan_id = dc.id
    LEFT JOIN vendors v ON dc.vendor_id = v.id
    WHERE dc.type = 'SPL_PROCESS'
      AND (dci.is_extra_item IS NOT TRUE)
      AND dci.merc_item_id IS NOT NULL
    ORDER BY dci.created_at ASC, dci.id ASC;
  `;

  const type3Res = await client.query<DcItemRecord>(type3Query);
  console.log(`Fetched ${type3Res.rows.length} total Type 3 items.`);

  const type3Groups = new Map<string, {
    poNumber: string;
    mercItemId: string;
    productLabel: string;
    items: DcItemRecord[];
  }>();

  for (const r of type3Res.rows) {
    const normPo = normalizeText(r.po_number);
    const mercItemId = String(r.merc_item_id || '').trim();
    if (!normPo || !mercItemId) continue;
    const groupKey = `${normPo}|${mercItemId}`;
    if (!type3Groups.has(groupKey)) {
      type3Groups.set(groupKey, {
        poNumber: normPo,
        mercItemId,
        productLabel: r.po_part_label || r.part_name || mercItemId,
        items: [],
      });
    }
    type3Groups.get(groupKey)!.items.push(r);
  }

  for (const [, g] of type3Groups) {
    g.items.sort((a, b) => new Date(a.item_created_at).getTime() - new Date(b.item_created_at).getTime());
    const baseline = Number(g.items[0].quantity_dispatched);

    // Resolve true cap for this Type 3 item
    let cap: number | null = null;
    let mercQtyDisplay: number | string = 'N/A';

    const mercRes = await client.query(`
      SELECT 
        GREATEST(
          COALESCE(mili.quantity_required, 0),
          COALESCE(mili.quantity_issued, 0)
        ) as cap,
        mili.quantity_required,
        mili.quantity_issued
      FROM merc_indent_line_items mili
      JOIN merc_indent_pending mip ON mili.merc_indent_pending_id = mip.id
      WHERE UPPER(REGEXP_REPLACE(TRIM(COALESCE(mip.po_number, '')), '\\s+', ' ', 'g')) = $1
        AND mili.merc_item_id = $2
      LIMIT 1;
    `, [g.poNumber, g.mercItemId]);

    if (mercRes.rows && mercRes.rows.length > 0 && mercRes.rows[0].cap != null && Number(mercRes.rows[0].cap) > 0) {
      cap = Number(mercRes.rows[0].cap);
      mercQtyDisplay = `Req: ${mercRes.rows[0].quantity_required}, Iss: ${mercRes.rows[0].quantity_issued}`;
    } else {
      cap = baseline;
      mercQtyDisplay = `(Baseline: ${baseline})`;
    }

    const openItems = g.items.filter((it) => !['CLOSED', 'RETURNED'].includes(it.dc_status));
    const outstanding = openItems.reduce((sum, it) => sum + Number(it.pending_qty), 0);
    const available = Math.max(0, cap - outstanding);
    const distinctOpenDcs = Array.from(new Set(openItems.map((it) => it.challan_number)));

    if (distinctOpenDcs.length > 1 || outstanding > cap) {
      const isOver = outstanding > cap;
      const vendors = Array.from(new Set(openItems.map((it) => it.vendor_name).filter(Boolean))).join('; ') || 'N/A';
      
      const earliestDispatch = openItems
        .map((it) => (it.dispatch_date ? new Date(it.dispatch_date) : new Date(it.dc_created_at)))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      
      const dispatchDateStr = earliestDispatch ? earliestDispatch.toISOString().split('T')[0] : 'N/A';
      const ageDays = earliestDispatch
        ? Math.max(0, Math.floor((now.getTime() - earliestDispatch.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      reportRows.push({
        type: 'Type 3',
        scOrPo: g.poNumber,
        product: g.productLabel,
        scQty: mercQtyDisplay,
        cap,
        baseline,
        outstanding,
        available,
        dcNumbers: distinctOpenDcs.join(', '),
        vendor: vendors,
        dispatchDate: dispatchDateStr,
        ageDays,
        verdict: isOver ? 'OVER_DISPATCHED' : 'VALID_PARTIAL',
      });
    }
  }

  await client.end();

  // ==========================================
  // 3. Write CSV Output
  // ==========================================
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const csvPath = path.join(reportsDir, 'dc-lock-conflicts.csv');
  const headers = [
    'type',
    'SC/PO',
    'product',
    'SC/MERC qty',
    'cap',
    'baseline',
    'outstanding',
    'available',
    'DC numbers',
    'vendor',
    'dispatch date',
    'age days',
    'verdict',
  ];

  const csvLines = [
    headers.join(','),
    ...reportRows.map((r) =>
      [
        escapeCsv(r.type),
        escapeCsv(r.scOrPo),
        escapeCsv(r.product),
        escapeCsv(r.scQty),
        escapeCsv(r.cap),
        escapeCsv(r.baseline),
        escapeCsv(r.outstanding),
        escapeCsv(r.available),
        escapeCsv(r.dcNumbers),
        escapeCsv(r.vendor),
        escapeCsv(r.dispatchDate),
        escapeCsv(r.ageDays),
        escapeCsv(r.verdict),
      ].join(',')
    ),
  ];

  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`\nSuccessfully written ${reportRows.length} conflict records to: ${csvPath}`);

  // Summary
  const overCount = reportRows.filter((r) => r.verdict === 'OVER_DISPATCHED').length;
  const partialCount = reportRows.filter((r) => r.verdict === 'VALID_PARTIAL').length;
  console.log(`\n--- SUMMARY ---`);
  console.log(`Total conflict/chain records: ${reportRows.length}`);
  console.log(`  - OVER_DISPATCHED: ${overCount}`);
  console.log(`  - VALID_PARTIAL:   ${partialCount}`);

  console.log('\n--- DETAILED BREAKDOWN OF THE 14 CONFLICT ITEMS ---');
  reportRows.forEach((r, idx) => {
    console.log(
      `[${idx + 1}] ${r.type} | SC/PO: ${r.scOrPo} | Product: ${r.product} | SC Qty: ${r.scQty} | Cap: ${r.cap} | Outstanding: ${r.outstanding} | Available: ${r.available} | DCs: ${r.dcNumbers} | Verdict: ${r.verdict}`
    );
  });

  return { reportRows, csvPath, overCount, partialCount };
}

generateReport().catch((err) => {
  console.error('Error generating DC lock conflicts report:', err);
  process.exit(1);
});
