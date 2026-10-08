import pg from 'pg';
import 'dotenv/config';
import { REAL_INVENTORY_ITEMS } from './seed-real-inventory.js';

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[Import] Connected to database.');

  try {
    await client.query('BEGIN');

    // 1. Fetch Admin User for created_by_id in stock_transactions
    const adminUserRes = await client.query(`SELECT id FROM users WHERE email = 'admin@airtronic.com' LIMIT 1`);
    let adminUserId = adminUserRes.rows[0]?.id;
    if (!adminUserId) {
      const anyUserRes = await client.query(`SELECT id FROM users LIMIT 1`);
      adminUserId = anyUserRes.rows[0]?.id;
    }
    console.log('[Import] Using adminUserId:', adminUserId);

    // 2. Wipe test transactional data and inventory
    console.log('[Import] Wiping test transactional data and test inventory...');

    const tablesToWipe = [
      'delivery_challan_items',
      'delivery_challans',
      'general_issue_items',
      'general_issues',
      'material_receipt_items',
      'material_receipts',
      'material_return_items',
      'material_returns',
      'material_issue_items',
      'material_issues',
      'material_consumptions',
      'additional_material_request_items',
      'additional_material_requests',
      'rm_item_snapshots',
      'rm_items',
      'rm_form_scs',
      'rm_requests',
      'sales_order_components',
      'purchase_orders',
      'stock_transactions',
      'stock_balances',
      'msl_alerts',
      'inventory_items',
      'bins',
      'racks',
      'warehouse_locations',
      'warehouses',
      'products',
      'product_families',
      'product_categories',
    ];

    const truncateSql = `TRUNCATE TABLE ${tablesToWipe.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`;
    await client.query(truncateSql);
    console.log('[Import] ✓ Test inventory and transactional data successfully cleared.');

    // 3. Create Warehouse: VELAN STORES
    const whRes = await client.query(`
      INSERT INTO warehouses (id, code, name, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), 'WH-VELAN', 'VELAN STORES', true, NOW(), NOW())
      RETURNING id
    `);
    const warehouseId = whRes.rows[0].id;
    console.log('[Import] ✓ Warehouse created: VELAN STORES (WH-VELAN)');

    // 4. Create Locations
    const locationConfigs = [
      { code: 'LOC-RACKS', name: 'Rack Storage Area' },
      { code: 'LOC-BEURO', name: 'Beuro Racks Area' },
      { code: 'LOC-BINS', name: 'Bins Storage Area' },
      { code: 'LOC-BOXES', name: 'Boxes Storage Area' },
      { code: 'LOC-ROD-BAR', name: 'Rod & Bar Heavy Area' },
      { code: 'LOC-GENERAL', name: 'General Stores Area' },
    ];
    const locationMap = new Map();
    for (const loc of locationConfigs) {
      const res = await client.query(`
        INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
        RETURNING id
      `, [warehouseId, loc.code, loc.name]);
      locationMap.set(loc.code, res.rows[0].id);
    }
    console.log('[Import] ✓ Created 6 warehouse location sections.');

    // 5. Build Racks and Bins dynamically from user data
    // Helper to determine location section and rack code/name
    function resolveStorageHierarchy(locStr) {
      const trimmed = locStr.trim().toUpperCase();
      if (trimmed.startsWith('RACK')) {
        // e.g. 'RACK 0039' or 'RACK004'
        const num = trimmed.replace('RACK', '').trim();
        const code = `RACK-${num}`;
        const name = `Rack ${num}`;
        return {
          locationCode: 'LOC-RACKS',
          rackCode: code,
          rackName: name,
          binCode: `BIN-${num}`,
          binName: `Bin ${num}`,
        };
      }
      if (trimmed.startsWith('BEURO RACK')) {
        const num = trimmed.replace('BEURO RACK', '').trim();
        return {
          locationCode: 'LOC-BEURO',
          rackCode: `BEURO-${num}`,
          rackName: `Beuro Rack ${num}`,
          binCode: `B-BEURO-${num}`,
          binName: `Beuro Bin ${num}`,
        };
      }
      if (trimmed.startsWith('BIN')) {
        const num = trimmed.replace('BIN', '').trim();
        return {
          locationCode: 'LOC-BINS',
          rackCode: 'RACK-BINS',
          rackName: 'Bins Shelving',
          binCode: `BIN-${num}`,
          binName: `Bin ${num}`,
        };
      }
      if (trimmed.startsWith('BOX')) {
        const num = trimmed.replace('BOX', '').trim();
        return {
          locationCode: 'LOC-BOXES',
          rackCode: 'RACK-BOXES',
          rackName: 'Boxes Shelving',
          binCode: `BOX-${num}`,
          binName: `Box ${num}`,
        };
      }
      if (trimmed === 'ROD AREA') {
        return {
          locationCode: 'LOC-ROD-BAR',
          rackCode: 'RACK-ROD-AREA',
          rackName: 'Rod Storage Area',
          binCode: 'BIN-ROD-AREA',
          binName: 'Rod Storage Bin',
        };
      }
      if (trimmed === 'BAR AREA') {
        return {
          locationCode: 'LOC-ROD-BAR',
          rackCode: 'RACK-BAR-AREA',
          rackName: 'Bar Storage Area',
          binCode: 'BIN-BAR-AREA',
          binName: 'Bar Storage Bin',
        };
      }
      // NONE or unknown
      return {
        locationCode: 'LOC-GENERAL',
        rackCode: 'RACK-GENERAL',
        rackName: 'General Storage',
        binCode: 'BIN-GENERAL',
        binName: 'General Floor / Unassigned',
      };
    }

    const rackCache = new Map(); // rackCode -> rackId
    const binCache = new Map(); // binCode -> binId

    for (const item of REAL_INVENTORY_ITEMS) {
      const hierarchy = resolveStorageHierarchy(item.location);
      const locId = locationMap.get(hierarchy.locationCode);

      let rackId = rackCache.get(hierarchy.rackCode);
      if (!rackId) {
        const rackRes = await client.query(`
          INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
          RETURNING id
        `, [locId, hierarchy.rackCode, hierarchy.rackName]);
        rackId = rackRes.rows[0].id;
        rackCache.set(hierarchy.rackCode, rackId);
      }

      let binId = binCache.get(hierarchy.binCode);
      if (!binId) {
        const binRes = await client.query(`
          INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
          RETURNING id
        `, [rackId, hierarchy.binCode, hierarchy.binName]);
        binId = binRes.rows[0].id;
        binCache.set(hierarchy.binCode, binId);
      }
    }
    console.log(`[Import] ✓ Created ${rackCache.size} racks and ${binCache.size} bins.`);

    // 6. Create Product Categories and Families
    const catConfigs = [
      {
        name: 'Raw Material',
        families: [
          'Metals & Raw Stock',
          'Polymers & Plastics',
        ],
      },
      {
        name: 'Tooling & Components',
        families: [
          'Cutting Tools & Bits',
          'Carbide Parts',
          'Hardware & Fittings',
        ],
      },
      {
        name: 'Consumables & PPE',
        families: [
          'Safety & Shop Supplies',
        ],
      },
    ];

    const familyMap = new Map();
    for (const cat of catConfigs) {
      const catRes = await client.query(`
        INSERT INTO product_categories (id, name, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
        RETURNING id
      `, [cat.name]);
      const catId = catRes.rows[0].id;

      for (const famName of cat.families) {
        const famRes = await client.query(`
          INSERT INTO product_families (id, category_id, name, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
          RETURNING id
        `, [catId, famName]);
        familyMap.set(famName, famRes.rows[0].id);
      }
    }
    console.log('[Import] ✓ Created categories and families.');

    // Helper to determine product family
    function resolveProductFamily(productName) {
      const p = productName.toUpperCase();
      if (p.includes('NYLON') || p.includes('TEFFLON') || p.includes('TEFLON')) {
        return familyMap.get('Polymers & Plastics');
      }
      if (p.includes('GLOVES') || p.includes('EAR PLUGS') || p.includes('SAFETY EYE') || p.includes('CLEANING BRUSH') || p.includes('BUFFING WHEELS')) {
        return familyMap.get('Safety & Shop Supplies');
      }
      if (p.includes('CARBIDE')) {
        return familyMap.get('Carbide Parts');
      }
      if (p.includes('HSS BIT') || p.includes('TAP') || p.includes('CUTTING') || p.includes('DRESSING TOOL') || p.includes('ENGRAVING MACHINE')) {
        return familyMap.get('Cutting Tools & Bits');
      }
      if (p.includes('CONNECTOR') || p.includes('CJET') || p.includes('NIPPLE') || p.includes('MALE') || p.includes('FEMALE') || p.includes('O RING') || p.includes('JIG') || p.includes('ALLEN KEY') || p.includes('BUSH') || p.includes('EXTENSTION')) {
        return familyMap.get('Hardware & Fittings');
      }
      return familyMap.get('Metals & Raw Stock');
    }

    // 7. Insert Products, Balances, and Stock Transactions
    const productCache = new Map(); // productName -> productId
    // Aggregation for balances per (productId, binId)
    const balanceAggregator = new Map(); // `${productId}:${binId}` -> { qty: number, firstItem: item, binId, productId }

    let skuCounter = 1;

    for (const item of REAL_INVENTORY_ITEMS) {
      let productId = productCache.get(item.product);
      if (!productId) {
        const familyId = resolveProductFamily(item.product);
        const code = `RM-${String(skuCounter).padStart(4, '0')}`;
        skuCounter++;

        const prodRes = await client.query(`
          INSERT INTO products (
            id, family_id, code, name, uom, minimum_inventory, is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, 0, true, NOW(), NOW()
          ) RETURNING id
        `, [familyId, code, item.product, item.uom.toUpperCase()]);
        productId = prodRes.rows[0].id;
        productCache.set(item.product, productId);
      }

      const hierarchy = resolveStorageHierarchy(item.location);
      const binId = binCache.get(hierarchy.binCode);

      const key = `${productId}:${binId}`;
      if (balanceAggregator.has(key)) {
        const prev = balanceAggregator.get(key);
        prev.qty += Number(item.qty);
      } else {
        balanceAggregator.set(key, {
          productId,
          binId,
          qty: Number(item.qty),
          productName: item.product,
        });
      }
    }

    console.log(`[Import] ✓ Inserted ${productCache.size} unique products.`);

    // 8. Insert Stock Balances & Initial Transactions
    let txCount = 0;
    let balCount = 0;

    for (const entry of balanceAggregator.values()) {
      // Create initial stock in transaction
      const txRes = await client.query(`
        INSERT INTO stock_transactions (
          id, product_id, destination_bin_id, quantity, transaction_type, "referenceType", reason, remarks, created_by_id, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'STOCK_IN', 'INITIAL_SETUP', 'Real inventory opening balance', 'Physical stock import from count sheet', $4, NOW()
        ) RETURNING id
      `, [entry.productId, entry.binId, entry.qty, adminUserId]);
      const txId = txRes.rows[0].id;
      txCount++;

      // Create stock balance
      await client.query(`
        INSERT INTO stock_balances (
          id, product_id, bin_id, current_quantity, opening_balance, last_transaction_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $3, $4, NOW(), NOW()
        )
      `, [entry.productId, entry.binId, entry.qty, txId]);
      balCount++;
    }

    console.log(`[Import] ✓ Created ${txCount} stock transactions and ${balCount} stock balances.`);

    await client.query('COMMIT');
    console.log('\n[SUCCESS] Real inventory import completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ROLLBACK] Error during import:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
