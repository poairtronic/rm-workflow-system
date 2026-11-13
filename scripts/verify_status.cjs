const fs = require('fs');
const { Client } = require('pg');

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

async function run() {
  await client.connect();
  try {
    const scRes = await client.query(`
      SELECT 
        COUNT(*) as total_scs,
        COUNT(CASE WHEN sc_number LIKE '%-%' THEN 1 END) as hyphenated_scs,
        COUNT(DISTINCT po_id) as distinct_pos
      FROM sales_order_components
    `);
    console.log('Sales Orders:', scRes.rows[0]);

    const prodRes = await client.query('SELECT COUNT(*) as total_products FROM products');
    console.log('Catalog Products:', prodRes.rows[0]);

    const uomRes = await client.query(`
      SELECT weight_unit, COUNT(*) as count 
      FROM rm_items 
      GROUP BY weight_unit
    `);
    console.log('BOM Items UOM breakdown:', uomRes.rows);

    const whRes = await client.query(`
      SELECT 
        w.code as wh_code,
        w.name as wh_name,
        wl.code as loc_code,
        wl.name as loc_name,
        COUNT(r.id) as rack_count,
        SUM((SELECT COUNT(*) FROM bins b WHERE b.rack_id = r.id)) as total_bins
      FROM warehouses w
      JOIN warehouse_locations wl ON wl.warehouse_id = w.id
      LEFT JOIN racks r ON r.location_id = wl.id
      GROUP BY w.code, w.name, wl.code, wl.name, wl.id
      ORDER BY wl.code
    `);
    console.log('Warehouse Hierarchy:');
    console.table(whRes.rows);

    const stockRes = await client.query('SELECT COUNT(*) as balance_rows, SUM(current_balance) as total_qty FROM stock_balances');
    console.log('Stock Balances:', stockRes.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
