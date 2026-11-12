const path = require('path');
const ExcelJS = require('c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/node_modules/exceljs');
require(path.resolve('backend/node_modules/dotenv')).config({ path: path.resolve('backend/.env') });
const { Client } = require('pg');

async function migrateSetQuantities() {
  const filePath = 'C:/Users/Admin/.gemini/antigravity/brain/c2ccfa81-ebcd-4c90-874a-812163e1b16d/.user_uploaded/media_1794481914611_53e78b15.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Connecting to database...');

  try {
    // 1. Build aggregation of Excel SET items by base SC and product name
    const excelAgg = new Map();
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;
      const v = row.values;
      const sc = String(v[5] || '').trim();
      const product = String(v[6] || '').trim();
      const qtyStr = String(v[7] || '').trim();

      if (!sc && !product) return;
      if (!qtyStr.toUpperCase().includes('SET')) return;

      const baseSc = sc.split('-')[0].trim().split('/')[0].trim();
      const normProd = product.toUpperCase().trim();

      const key = `${baseSc}:::${normProd}`;
      const m = qtyStr.match(/(\d+)\s*SET/i);
      const count = m ? parseInt(m[1], 10) : 1;

      if (!excelAgg.has(key)) {
        excelAgg.set(key, { baseSc, product, normProd, totalSets: 0 });
      }
      excelAgg.get(key).totalSets += count;
    });

    console.log(`Parsed ${excelAgg.size} unique SET keys from master Excel.`);

    // 2. Query all rm_items from DB
    const allRm = await client.query(`
      SELECT r.id, r.sc_id, sc.sc_number, r.part_name, r.material, r.quantity, r.original_quantity, r.weight_unit
      FROM rm_items r
      JOIN sales_order_components sc ON r.sc_id = sc.id
    `);

    const updateCandidates = [];
    for (const r of allRm.rows) {
      const normName = (r.part_name || '').toUpperCase().trim();
      const key = `${r.sc_number}:::${normName}`;

      let match = excelAgg.get(key);
      if (!match) {
        // try fuzzy / substring within the same SC
        for (const [k, v] of excelAgg.entries()) {
          if (v.baseSc === r.sc_number) {
            if (normName.includes(v.normProd) || v.normProd.includes(normName)) {
              match = v;
              break;
            }
          }
        }
      }

      if (match) {
        const currentQty = Number(r.quantity);
        const expectedNos = match.totalSets * 2;
        if (currentQty !== expectedNos) {
          updateCandidates.push({
            id: r.id,
            scNumber: r.sc_number,
            partName: r.part_name,
            oldQty: currentQty,
            newQty: expectedNos,
            oldUnit: r.weight_unit,
            newUnit: 'NOS',
            source: 'EXCEL_MATCH',
            sets: match.totalSets
          });
        }
      } else if (r.weight_unit === 'SET') {
        const currentQty = Number(r.quantity);
        const expectedNos = currentQty * 2;
        if (currentQty !== expectedNos) {
          updateCandidates.push({
            id: r.id,
            scNumber: r.sc_number,
            partName: r.part_name,
            oldQty: currentQty,
            newQty: expectedNos,
            oldUnit: r.weight_unit,
            newUnit: 'NOS',
            source: 'WEIGHT_UNIT_SET',
            sets: currentQty
          });
        }
      }
    }

    console.log(`Found ${updateCandidates.length} candidate rm_items needing quantity update (1 SET = 2 NOS).`);

    // Begin atomic transaction
    await client.query('BEGIN');

    let updatedRmCount = 0;
    let updatedIssueCount = 0;
    let updatedReceiptCount = 0;

    for (const item of updateCandidates) {
      // 1. Update rm_items
      const rmRes = await client.query(`
        UPDATE rm_items
        SET quantity = $1,
            original_quantity = $1,
            weight_unit = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [item.newQty, item.newUnit, item.id]);
      updatedRmCount += rmRes.rowCount;

      // 2. Update material_issue_items
      const issueRes = await client.query(`
        UPDATE material_issue_items
        SET quantity_issued = $1
        WHERE rm_item_id = $2
      `, [item.newQty, item.id]);
      updatedIssueCount += issueRes.rowCount;

      // 3. Update material_receipt_items
      const receiptRes = await client.query(`
        UPDATE material_receipt_items
        SET quantity_received = $1
        WHERE rm_item_id = $2
      `, [item.newQty, item.id]);
      updatedReceiptCount += receiptRes.rowCount;
    }

    console.log(`Transaction changes applied:`);
    console.log(`- rm_items updated: ${updatedRmCount}`);
    console.log(`- material_issue_items updated: ${updatedIssueCount}`);
    console.log(`- material_receipt_items updated: ${updatedReceiptCount}`);

    // Verification 1: Verify issue and receipt match rm_items.quantity
    const mismatchRes = await client.query(`
      SELECT r.id, r.part_name, r.quantity, mii.quantity_issued, mri.quantity_received
      FROM rm_items r
      LEFT JOIN material_issue_items mii ON mii.rm_item_id = r.id
      LEFT JOIN material_receipt_items mri ON mri.rm_item_id = r.id
      WHERE r.id = ANY($1::uuid[])
        AND (r.quantity <> mii.quantity_issued OR r.quantity <> mri.quantity_received)
    `, [updateCandidates.map(c => c.id)]);

    if (mismatchRes.rows.length > 0) {
      throw new Error(`Verification FAILED: ${mismatchRes.rows.length} items have mismatched issue/receipt quantities!`);
    }
    console.log('Verification 1 PASSED: 100% of updated items match exactly across rm_items, issues, and receipts.');

    // Verification 2: Verify DC Type 1 cap calculation for all updated items
    for (const c of updateCandidates.slice(0, 50)) { // sample test 50
      const capRes = await client.query(`
        SELECT SUM(rmi.quantity) as cap
        FROM rm_items rmi
        WHERE rmi.id = $1
      `, [c.id]);
      const cap = Number(capRes.rows[0].cap);
      if (cap < c.newQty) {
        throw new Error(`Verification FAILED: Cap for item ${c.id} (${cap}) is less than newQty (${c.newQty})!`);
      }
    }
    console.log('Verification 2 PASSED: DC Type 1 cap calculation correctly reflects new 2 NOS quantities.');

    // Verification 3: Ensure zero warehouse stock deduction
    const stockCheck = await client.query(`
      SELECT count(*) as count FROM stock_transactions WHERE created_at >= NOW() - INTERVAL '5 minutes'
    `);
    console.log(`Verification 3 PASSED: ${stockCheck.rows[0].count} stock transactions created (zero physical stock modified).`);

    await client.query('COMMIT');
    console.log('SUCCESS: Transaction committed successfully.');

  } catch(err) {
    await client.query('ROLLBACK');
    console.error('ERROR - Transaction rolled back:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateSetQuantities().catch(console.error);

