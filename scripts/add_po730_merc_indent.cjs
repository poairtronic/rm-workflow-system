const { Client } = require('pg');

const PO_DATA = {
  indentId: 'AGIPL-26-08-10-174',
  indentNumber: 'AGIPL-26-08-10-174',
  poNumber: 'PO 730',
  customerName: 'SPR EMF',
  layoutNumber: null,
  status: 'PENDING',
  mercCurrentState: 'DESIGN_COMPLETED',
  lineItems: [
    // --- RAW MATERIALS (1 - 20) ---
    {
      mercItemId: 'AGIPL-174-01',
      itemType: 'RAW_MATERIAL',
      name: 'BASE PLATE',
      material: 'MS',
      shape: 'RECTANGLE',
      lengthMm: 605,
      widthMm: 255,
      heightMm: 30,
      diameterMm: null,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-02',
      itemType: 'RAW_MATERIAL',
      name: 'HARDENED PLATE',
      material: 'OHNS',
      shape: 'RECTANGLE',
      lengthMm: 305,
      widthMm: 25,
      heightMm: 15,
      diameterMm: null,
      quantityRequired: 8,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-03',
      itemType: 'RAW_MATERIAL',
      name: 'HEAD STOCK',
      material: 'OHNS',
      shape: 'RECTANGLE',
      lengthMm: 125,
      widthMm: 105,
      heightMm: 125,
      diameterMm: null,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-04',
      itemType: 'RAW_MATERIAL',
      name: 'PROBE HOLDER-1',
      material: 'MS',
      shape: 'RECTANGLE',
      lengthMm: 90,
      widthMm: 35,
      heightMm: 20,
      diameterMm: null,
      quantityRequired: 2,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-05',
      itemType: 'RAW_MATERIAL',
      name: 'SLIDING BLOCK-1',
      material: 'MS',
      shape: 'RECTANGLE',
      lengthMm: 125,
      widthMm: 105,
      heightMm: 30,
      diameterMm: null,
      quantityRequired: 2,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-06',
      itemType: 'RAW_MATERIAL',
      name: 'VEE-BLOCK',
      material: 'OHNS',
      shape: 'RECTANGLE',
      lengthMm: 125,
      widthMm: 50,
      heightMm: 80,
      diameterMm: null,
      quantityRequired: 2,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-07',
      itemType: 'RAW_MATERIAL',
      name: 'SLIDING BLOCK-2',
      material: 'OHNS',
      shape: 'RECTANGLE',
      lengthMm: 125,
      widthMm: 45,
      heightMm: 25,
      diameterMm: null,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-08',
      itemType: 'RAW_MATERIAL',
      name: 'PROBE HOLDER-2',
      material: 'OHNS',
      shape: 'RECTANGLE',
      lengthMm: 90,
      widthMm: 35,
      heightMm: 30,
      diameterMm: null,
      quantityRequired: 2,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-09',
      itemType: 'RAW_MATERIAL',
      name: 'PROBE HOLDER-3',
      material: 'OHNS',
      shape: 'RECTANGLE',
      lengthMm: 90,
      widthMm: 35,
      heightMm: 30,
      diameterMm: null,
      quantityRequired: 2,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-10',
      itemType: 'RAW_MATERIAL',
      name: 'TAIL STOCK CENTER',
      material: 'MS',
      shape: 'ROUND',
      lengthMm: 125,
      widthMm: null,
      heightMm: null,
      diameterMm: 35,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-11',
      itemType: 'RAW_MATERIAL',
      name: 'HANDLE',
      material: 'MS',
      shape: 'ROUND',
      lengthMm: 100,
      widthMm: null,
      heightMm: null,
      diameterMm: 12,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-12',
      itemType: 'RAW_MATERIAL',
      name: 'HEAD STOCK CENTER',
      material: 'OHNS',
      shape: 'ROUND',
      lengthMm: 105,
      widthMm: null,
      heightMm: null,
      diameterMm: 55,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-13',
      itemType: 'RAW_MATERIAL',
      name: 'TAIL STOCK',
      material: 'MS',
      shape: 'RECTANGLE',
      lengthMm: 95,
      widthMm: 105,
      heightMm: 85,
      diameterMm: null,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-14',
      itemType: 'RAW_MATERIAL',
      name: 'ROTATING ARM',
      material: 'OHNS',
      shape: 'ROUND',
      lengthMm: 55,
      widthMm: null,
      heightMm: null,
      diameterMm: 30,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-15',
      itemType: 'RAW_MATERIAL',
      name: 'LOCATOR',
      material: 'TEFLON',
      shape: 'RECTANGLE',
      lengthMm: 35,
      widthMm: 25,
      heightMm: 15,
      diameterMm: null,
      quantityRequired: 4,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-16',
      itemType: 'RAW_MATERIAL',
      name: 'BRASS BUSH',
      material: 'BRASS',
      shape: 'ROUND',
      lengthMm: 20,
      widthMm: null,
      heightMm: null,
      diameterMm: 20,
      quantityRequired: 2,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-17',
      itemType: 'RAW_MATERIAL',
      name: 'BRASS BUSH',
      material: 'BRASS',
      shape: 'ROUND',
      lengthMm: 20,
      widthMm: null,
      heightMm: null,
      diameterMm: 15,
      quantityRequired: 8,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-18',
      itemType: 'RAW_MATERIAL',
      name: 'PROBE GUARD',
      material: 'sheet metal',
      shape: 'RECTANGLE',
      lengthMm: 65,
      widthMm: 40,
      heightMm: 30,
      diameterMm: null,
      quantityRequired: 6,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-19',
      itemType: 'RAW_MATERIAL',
      name: 'JIG FEET',
      material: 'MS',
      shape: 'ROUND',
      lengthMm: 80,
      widthMm: null,
      heightMm: null,
      diameterMm: 20,
      quantityRequired: 6,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-20',
      itemType: 'RAW_MATERIAL',
      name: 'MASTER-2',
      material: 'OHNS',
      shape: 'ROUND',
      lengthMm: 255,
      widthMm: null,
      heightMm: null,
      diameterMm: 30,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    },

    // --- BROUGHT OUT MATERIALS (24 - 30) ---
    {
      mercItemId: 'AGIPL-174-21',
      itemType: 'BROUGHT_OUT',
      name: 'Allen Screw',
      material: 'M6*45',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 15,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-22',
      itemType: 'BROUGHT_OUT',
      name: 'Allen Screw',
      material: 'M6*35',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 6,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-23',
      itemType: 'BROUGHT_OUT',
      name: 'Allen Screw',
      material: 'M4*20',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 10,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-24',
      itemType: 'BROUGHT_OUT',
      name: 'Allen Screw',
      material: 'M5*10',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 20,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-25',
      itemType: 'BROUGHT_OUT',
      name: 'CSK',
      material: 'M5*10',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 3,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-26',
      itemType: 'BROUGHT_OUT',
      name: 'Wing nut',
      material: 'M6*15',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 15,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-27',
      itemType: 'BROUGHT_OUT',
      name: 'LM guide&block',
      material: '15*15',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NOS',
      status: 'PENDING'
    },
    {
      mercItemId: 'AGIPL-174-28',
      itemType: 'BROUGHT_OUT',
      name: 'Handle',
      material: 'M6',
      shape: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      diameterMm: null,
      quantityRequired: 1,
      quantityIssued: 0,
      unit: 'NO',
      status: 'PENDING'
    }
  ]
};

async function syncToDatabase(dbName, connectionString, isSsl) {
  console.log(`\n================ Syncing to ${dbName} ================`);
  const client = new Client({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log(`✓ Connected to ${dbName}`);

    // Check if indent header exists
    let pRes = await client.query(
      'SELECT id, indent_number, po_number, status, is_deleted FROM merc_indent_pending WHERE indent_number = $1 OR indent_id = $2',
      [PO_DATA.indentNumber, PO_DATA.indentId]
    );

    let pendingId;
    if (pRes.rows.length === 0) {
      const np = await client.query(
        `INSERT INTO merc_indent_pending (
          id, indent_id, indent_number, po_number, customer_name, layout_number,
          status, merc_current_state, is_deleted, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW()
        ) RETURNING id`,
        [
          PO_DATA.indentId,
          PO_DATA.indentNumber,
          PO_DATA.poNumber,
          PO_DATA.customerName,
          PO_DATA.layoutNumber,
          PO_DATA.status,
          PO_DATA.mercCurrentState
        ]
      );
      pendingId = np.rows[0].id;
      console.log(`✓ Created new indent header: ${PO_DATA.indentNumber} (ID: ${pendingId})`);
    } else {
      pendingId = pRes.rows[0].id;
      await client.query(
        `UPDATE merc_indent_pending 
         SET po_number = $1, customer_name = $2, status = $3, merc_current_state = $4, is_deleted = false, updated_at = NOW()
         WHERE id = $5`,
        [PO_DATA.poNumber, PO_DATA.customerName, PO_DATA.status, PO_DATA.mercCurrentState, pendingId]
      );
      console.log(`✓ Updated existing indent header: ${PO_DATA.indentNumber} (ID: ${pendingId})`);
    }

    // Insert or update all 28 line items
    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of PO_DATA.lineItems) {
      let itemRes = await client.query(
        'SELECT id FROM merc_indent_line_items WHERE merc_indent_pending_id = $1 AND merc_item_id = $2',
        [pendingId, item.mercItemId]
      );

      if (itemRes.rows.length === 0) {
        await client.query(
          `INSERT INTO merc_indent_line_items (
            id, merc_indent_pending_id, merc_item_id, item_type, name, material, shape,
            length_mm, width_mm, height_mm, diameter_mm, quantity_required, quantity_issued,
            unit, source, status, is_deleted, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'In-house', $14, false, NOW()
          )`,
          [
            pendingId,
            item.mercItemId,
            item.itemType,
            item.name,
            item.material,
            item.shape,
            item.lengthMm,
            item.widthMm,
            item.heightMm,
            item.diameterMm,
            item.quantityRequired,
            item.quantityIssued,
            item.unit,
            item.status
          ]
        );
        insertedCount++;
      } else {
        await client.query(
          `UPDATE merc_indent_line_items SET
            item_type = $1, name = $2, material = $3, shape = $4,
            length_mm = $5, width_mm = $6, height_mm = $7, diameter_mm = $8,
            quantity_required = $9, unit = $10, is_deleted = false
           WHERE id = $11`,
          [
            item.itemType,
            item.name,
            item.material,
            item.shape,
            item.lengthMm,
            item.widthMm,
            item.heightMm,
            item.diameterMm,
            item.quantityRequired,
            item.unit,
            itemRes.rows[0].id
          ]
        );
        updatedCount++;
      }
    }

    console.log(`✓ Line items processed: ${insertedCount} inserted, ${updatedCount} updated.`);

    // Verify
    const verifyHeader = await client.query(
      'SELECT id, indent_number, po_number, customer_name, status, is_deleted FROM merc_indent_pending WHERE id = $1',
      [pendingId]
    );
    const verifyItems = await client.query(
      'SELECT count(*) as total, count(*) filter (where status = \'ISSUED\') as issued, count(*) filter (where status = \'PENDING\') as pending FROM merc_indent_line_items WHERE merc_indent_pending_id = $1 AND is_deleted = false',
      [pendingId]
    );

    console.log('✓ Header Status:', verifyHeader.rows[0]);
    console.log('✓ Items Count:', verifyItems.rows[0]);

    await client.end();
    return true;
  } catch (err) {
    console.error(`✗ Error syncing to ${dbName}:`, err.message);
    try { await client.end(); } catch (e) {}
    return false;
  }
}

async function main() {
  const neonUrl = 'postgresql://neondb_owner:npg_p03ZRTFexBzX@ep-weathered-bird-bdraean9.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const localUrl = 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';

  console.log('Starting sync of PO 730 / AGIPL-26-08-10-174 (28 Line items)...');
  await syncToDatabase('Neon Production Cloud DB (Render)', neonUrl, true);
  await syncToDatabase('Local PostgreSQL Database', localUrl, false);
  console.log('\nAll sync tasks finished.');
}

main().catch(console.error);
