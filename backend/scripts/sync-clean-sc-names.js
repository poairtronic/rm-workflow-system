import fs from 'fs';
import { createRequire } from 'module';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/.env' });

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const isExecute = process.argv.includes('--execute');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function parsePoString(rawPo) {
  const cleaned = rawPo.replace(/\s+/g, ' ').trim();
  let poNumber = cleaned;
  let customerName = 'GENERAL CUSTOMER';

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    poNumber = parts[0].trim();
    customerName = parts.slice(1).join('-').trim();
  } else if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    poNumber = parts[0].trim();
    customerName = parts.slice(1).join('/').trim();
  }
  return { poNumber, customerName };
}

function cleanMaterialAndSize(raw) {
  let text = raw.replace(/\s+/g, ' ').trim();

  let material = 'MS';
  if (/EN31/i.test(text)) material = 'EN31';
  else if (/OHNS/i.test(text)) material = 'OHNS';
  else if (/ALUMINIUM|ALUMINUM/i.test(text)) material = 'ALUMINIUM';
  else if (/CARBIDE/i.test(text)) material = 'CARBIDE';
  else if (/HSS/i.test(text)) material = 'HSS';
  else if (/NYLON|TEFLON/i.test(text)) material = 'NYLON';
  else if (/MS/i.test(text)) material = 'MS';

  let size = text
    .replace(/\(\s*RACK\s+NO\s*\d+\s*(?:OR|-)?\s*/gi, '')
    .replace(/RACK\s+NO\s*\d+\s*(?:OR|-)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!size || size === '()' || size === '-' || size === ')') {
    size = material;
  }

  return { material: material.slice(0, 100), size: size.slice(0, 100) };
}

async function extractOrdersFromPdf() {
  const dataBuffer = fs.readFileSync('c:/Users/Admin/Downloads/SAMPLE.pdf');
  const parser = new PDFParse(new Uint8Array(dataBuffer));
  await parser.load();
  const res = await parser.getText();

  let currentPo = 'AGIPLPO 1175';
  let currentCustomer = 'SFL PONDY';
  let currentSc = '2373';

  const rows = [];

  for (let p = 0; p < res.pages.length; p++) {
    let pageText = res.pages[p].text;

    // Fix unclosed rack parentheses before SC numbers
    pageText = pageText.replace(/(\(\s*RACK\s+NO[^\)\n\r]*(?:\r?\n[^\)\n\r]*?)?)(?=\s*\b2\d{3}(?:-\d+)?\b)/gi, '$1 ) ');

    // Mask embedded quantity annotations strictly without crossing newlines
    const maskedText = pageText.replace(/\([^)\n\r]{1,60}?\d+\s*(?:NOS?|NO|SETS?|SET)[^)\n\r]{0,60}?\)/gi, (m) => {
      return m.replace(/NO/gi, '##').replace(/SET/gi, '@@');
    });

    const qtyRegex = /(\d+(?:\.\d+)?)\s*(NOS?|NO|SETS?|SET)\b/g;
    let lastEnd = 0;
    const headerIdx = maskedText.indexOf('RAW MATERIALPO SC PRODUCT QTY');
    if (headerIdx !== -1) {
      lastEnd = headerIdx + 'RAW MATERIALPO SC PRODUCT QTY'.length;
    }

    const matches = [...maskedText.matchAll(qtyRegex)];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const matchEnd = m.index + m[0].length;
      let segment = maskedText.substring(lastEnd, matchEnd).trim();
      lastEnd = matchEnd;
      segment = segment.replace(/##/g, 'NO').replace(/@@/g, 'SET');

      const poPattern = /(AGIPLPO\s*[\d\/\s\w\-]+?)(?=\s*\b2\d{3}\b|\s*$)|(PO-[\d\w\-]+)/i;
      const poMatch = segment.match(poPattern);
      if (poMatch) {
        const rawPo = poMatch[0];
        const parsed = parsePoString(rawPo);
        currentPo = parsed.poNumber;
        currentCustomer = parsed.customerName;
        segment = segment.replace(rawPo, ' ').trim();
      }

      const scMatch = segment.match(/\b(2\d{3}(?:-\d+)?)\b/);
      let scNumber = currentSc;
      let scIdx = -1;

      if (scMatch) {
        scNumber = scMatch[1];
        currentSc = scNumber;
        scIdx = segment.indexOf(scNumber);
      }

      let rawMaterial = '';
      let product = '';
      const qtyStr = m[0];
      const qtyNum = parseFloat(m[1]) || 1;
      const uom = m[2].toUpperCase().startsWith('SET') ? 'SET' : 'NOS';

      if (scIdx !== -1) {
        rawMaterial = segment.substring(0, scIdx).replace(/\s+/g, ' ').trim();
        let afterSc = segment.substring(scIdx + scNumber.length).replace(/\s+/g, ' ').trim();
        product = afterSc;
        if (product.endsWith(qtyStr)) {
          product = product.substring(0, product.length - qtyStr.length).trim();
        }
      } else {
        let withoutQty = segment;
        if (withoutQty.endsWith(qtyStr)) {
          withoutQty = withoutQty.substring(0, withoutQty.length - qtyStr.length).trim();
        }
        const words = withoutQty.split(/\s+/);
        product = words[words.length - 1];
        rawMaterial = words.slice(0, words.length - 1).join(' ').trim();
      }

      // Clean up whitespace
      product = product.replace(/\s+/g, ' ').trim();

      // If product name is empty or just says COMPONENT, inherit from previous sibling SC (e.g. 2405-2 inherits from 2405-1)
      if (!product && rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const currentPrefix = scNumber.split('-')[0];
        const lastPrefix = lastRow.scNumber.split('-')[0];
        if (currentPrefix === lastPrefix && lastRow.product) {
          product = lastRow.product;
        }
      }

      rows.push({
        poNumber: currentPo.slice(0, 100),
        customerName: currentCustomer.slice(0, 150),
        scNumber: scNumber.slice(0, 100),
        rawMaterial,
        product: (product || `COMPONENT-${scNumber}`).slice(0, 150),
        quantity: qtyNum,
        uom,
      });
    }
  }

  return rows;
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`=== SYNC CLEAN SC PRODUCT NAMES & INSERT MISSING SCS ===`);
  console.log(`=== MODE: ${isExecute ? 'LIVE EXECUTION' : 'DRY-RUN (SIMULATION)'} ===`);
  console.log(`======================================================\n`);

  await client.connect();

  const designerUserId = '80c10dd5-bdaa-4065-8bf7-5ba03ea716a2';
  const storesUserId = 'ec99638e-16ba-41b8-b99e-77eea7bf41a0';
  const prodUserId = 'b8a272ae-fe37-45e8-b768-988766c72715';

  const rows = await extractOrdersFromPdf();
  console.log(`Extracted ${rows.length} total rows from PDF.`);

  // Group by SC Number
  const scMap = new Map();
  for (const r of rows) {
    if (!scMap.has(r.scNumber)) {
      scMap.set(r.scNumber, {
        scNumber: r.scNumber,
        poNumber: r.poNumber,
        customerName: r.customerName,
        primaryProduct: r.product,
        targetQuantity: r.quantity,
        items: [],
      });
    }
    const sc = scMap.get(r.scNumber);
    const { material, size } = cleanMaterialAndSize(r.rawMaterial);
    sc.items.push({
      id: crypto.randomUUID(),
      material,
      size,
      rawMaterialText: r.rawMaterial,
      productName: r.product.slice(0, 255),
      quantity: r.quantity,
      uom: r.uom,
    });
  }

  console.log(`Parsed into ${scMap.size} unique SCs.`);

  await client.query('BEGIN');

  try {
    // 1. Fetch existing SCs from database
    const existingScRes = await client.query('SELECT id, sc_number, po_id, product_name FROM sales_order_components');
    const existingScMap = new Map();
    for (const row of existingScRes.rows) {
      existingScMap.set(row.sc_number, row);
    }
    console.log(`Found ${existingScMap.size} existing SCs in database.`);

    // 2. Resolve PO map (for any missing SCs)
    const poRes = await client.query('SELECT id, po_number FROM purchase_orders');
    const poMap = new Map();
    for (const po of poRes.rows) {
      poMap.set(po.po_number, po.id);
    }

    // 3. Update existing SCs that have corrupted names
    let updatedScCount = 0;
    for (const [scNum, parsedSc] of scMap.entries()) {
      const existing = existingScMap.get(scNum);
      if (existing) {
        if (existing.product_name !== parsedSc.primaryProduct) {
          console.log(`[UPDATE SC ${scNum}]: "${existing.product_name}" -> "${parsedSc.primaryProduct}"`);
          await client.query(
            'UPDATE sales_order_components SET product_name = $1 WHERE id = $2',
            [parsedSc.primaryProduct, existing.id]
          );
          // Also update rm_items.part_name if it had the corrupted product name
          await client.query(
            'UPDATE rm_items SET part_name = $1 WHERE sc_id = $2 AND part_name = $3',
            [parsedSc.primaryProduct, existing.id, existing.product_name]
          );
          updatedScCount++;
        }
      }
    }
    console.log(`Updated ${updatedScCount} existing SCs with clean product names.`);

    // 4. Identify missing SCs
    const missingScs = [];
    for (const [scNum, parsedSc] of scMap.entries()) {
      if (!existingScMap.has(scNum)) {
        parsedSc.id = crypto.randomUUID();
        parsedSc.poId = poMap.get(parsedSc.poNumber);
        if (!parsedSc.poId) {
          console.warn(`Warning: PO ${parsedSc.poNumber} not found for missing SC ${scNum}`);
        } else {
          missingScs.push(parsedSc);
        }
      }
    }
    console.log(`Found ${missingScs.length} missing SCs to insert.`);

    if (missingScs.length > 0) {
      // Insert missing SCs
      const scVals = [];
      const scParams = [];
      let pIdx = 1;
      for (const sc of missingScs) {
        scVals.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 1, 'IN_PRODUCTION', NOW())`);
        scParams.push(sc.id, sc.scNumber, sc.poId, sc.primaryProduct);
      }
      await client.query(
        `INSERT INTO sales_order_components (id, sc_number, po_id, product_name, target_quantity, status, created_at)
         VALUES ${scVals.join(', ')}`,
        scParams
      );
      console.log(`Batch inserted ${missingScs.length} missing Sales Order Components.`);

      // Insert RM Requests
      const reqVals = [];
      const reqParams = [];
      pIdx = 1;
      for (const sc of missingScs) {
        sc.rmRequestId = crypto.randomUUID();
        reqVals.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, 'SC', 'COMPLETED', $${pIdx++}, NOW(), NOW())`);
        reqParams.push(sc.rmRequestId, sc.poId, sc.id, designerUserId);
      }
      await client.query(
        `INSERT INTO rm_requests (id, po_id, sc_id, form_type, status, created_by_id, created_at, updated_at)
         VALUES ${reqVals.join(', ')}`,
        reqParams
      );
      console.log(`Batch inserted ${missingScs.length} RM Requests for missing SCs.`);

      // Insert RM Items
      const allItems = [];
      for (const sc of missingScs) {
        for (const it of sc.items) {
          it.scId = sc.id;
          it.rmFormId = sc.rmRequestId;
          it.scNumber = sc.scNumber;
          allItems.push(it);
        }
      }
      const itemChunks = chunkArray(allItems, 100);
      for (const chunk of itemChunks) {
        const itemValues = [];
        const itemParams = [];
        pIdx = 1;
        for (const it of chunk) {
          itemValues.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'ROUND_BAR', $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, NOW(), NOW())`);
          itemParams.push(
            it.id,
            it.rmFormId,
            it.scId,
            it.material.slice(0, 100),
            it.material.slice(0, 100),
            it.size.slice(0, 100),
            it.quantity,
            it.productName.slice(0, 255),
            it.scNumber.slice(0, 100),
            `Historical Cutover from PDF. Raw: ${it.rawMaterialText}`.slice(0, 255)
          );
        }
        await client.query(
          `INSERT INTO rm_items (id, rm_form_id, sc_id, material, material_type, grade, size, quantity, part_name, part_number, remarks, created_at, updated_at)
           VALUES ${itemValues.join(', ')}`,
          itemParams
        );
      }
      console.log(`Batch inserted ${allItems.length} RM Items for missing SCs.`);

      // Insert Material Issues
      const issueValues = [];
      const issueParams = [];
      pIdx = 1;
      for (const sc of missingScs) {
        sc.issueId = crypto.randomUUID();
        issueValues.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, 'INITIAL_ISSUE', $${pIdx++}, 'Historical Cutover - RM issued prior to Go-Live', NOW())`);
        issueParams.push(sc.issueId, sc.id, `ISS-HIST-${sc.scNumber}`.slice(0, 100), storesUserId);
      }
      await client.query(
        `INSERT INTO material_issues (id, sc_id, issue_number, issue_type, issued_by_id, remarks, created_at)
         VALUES ${issueValues.join(', ')}`,
        issueParams
      );
      console.log(`Batch inserted ${missingScs.length} Material Issues for missing SCs.`);

      // Insert Material Issue Items
      const allIssueItems = [];
      for (const sc of missingScs) {
        for (const it of sc.items) {
          allIssueItems.push({ id: crypto.randomUUID(), issueId: sc.issueId, rmItemId: it.id, qty: it.quantity });
        }
      }
      const issueItemChunks = chunkArray(allIssueItems, 100);
      for (const chunk of issueItemChunks) {
        const vals = [];
        const params = [];
        pIdx = 1;
        for (const it of chunk) {
          vals.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, NOW())`);
          params.push(it.id, it.issueId, it.rmItemId, it.qty);
        }
        await client.query(
          `INSERT INTO material_issue_items (id, material_issue_id, rm_item_id, quantity_issued, created_at)
           VALUES ${vals.join(', ')}`,
          params
        );
      }
      console.log(`Batch inserted ${allIssueItems.length} Material Issue Items for missing SCs.`);

      // Insert Material Receipts
      const receiptValues = [];
      const receiptParams = [];
      pIdx = 1;
      for (const sc of missingScs) {
        sc.receiptId = crypto.randomUUID();
        receiptValues.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, 'RECEIVED', 'Historical Cutover - Floor receipt confirmed', NOW())`);
        receiptParams.push(sc.receiptId, sc.issueId, prodUserId);
      }
      await client.query(
        `INSERT INTO material_receipts (id, material_issue_id, received_by_id, status, remarks, created_at)
         VALUES ${receiptValues.join(', ')}`,
        receiptParams
      );
      console.log(`Batch inserted ${missingScs.length} Material Receipts for missing SCs.`);

      // Insert Material Receipt Items
      const allReceiptItems = [];
      for (const sc of missingScs) {
        for (const it of sc.items) {
          allReceiptItems.push({ id: crypto.randomUUID(), receiptId: sc.receiptId, rmItemId: it.id, qty: it.quantity });
        }
      }
      const receiptItemChunks = chunkArray(allReceiptItems, 100);
      for (const chunk of receiptItemChunks) {
        const vals = [];
        const params = [];
        pIdx = 1;
        for (const it of chunk) {
          vals.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, NOW())`);
          params.push(it.id, it.receiptId, it.rmItemId, it.qty);
        }
        await client.query(
          `INSERT INTO material_receipt_items (id, material_receipt_id, rm_item_id, quantity_received, created_at)
           VALUES ${vals.join(', ')}`,
          params
        );
      }
      console.log(`Batch inserted ${allReceiptItems.length} Material Receipt Items for missing SCs.`);
    }

    if (!isExecute) {
      await client.query('ROLLBACK');
      console.log(`\n======================================================`);
      console.log(`[DRY RUN SUCCESS] All ${updatedScCount} SCs updated and ${missingScs.length} missing SCs validated cleanly!`);
      console.log(`Database transaction ROLLED BACK safely. Zero data modified.`);
      console.log(`======================================================\n`);
    } else {
      await client.query('COMMIT');
      console.log(`\n======================================================`);
      console.log(`[SUCCESS] All ${updatedScCount} SCs updated and ${missingScs.length} missing SCs committed to production DB!`);
      console.log(`======================================================\n`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n[ERROR] Sync failed:`, err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
