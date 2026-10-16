import pg from 'pg';
import 'dotenv/config';

async function inspect() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('--- WAREHOUSES ---');
  const wh = await client.query('SELECT id, code, name FROM warehouses');
  console.log(wh.rows);

  console.log('--- WAREHOUSE LOCATIONS ---');
  const locs = await client.query('SELECT id, warehouse_id, code, name FROM warehouse_locations');
  console.log(locs.rows);

  console.log('--- RACKS COUNT BY LOCATION ---');
  const racks = await client.query(`
    SELECT l.name as loc_name, COUNT(r.id) as rack_count
    FROM warehouse_locations l
    LEFT JOIN racks r ON r.location_id = l.id
    GROUP BY l.name
  `);
  console.log(racks.rows);

  console.log('--- BINS COUNT ---');
  const binsCount = await client.query('SELECT COUNT(*) FROM bins');
  console.log('Total bins:', binsCount.rows[0].count);

  console.log('--- STOCK BALANCES COUNT & TOTAL QUANTITY ---');
  const sb = await client.query('SELECT COUNT(*) as count, SUM(current_quantity) as total_qty FROM stock_balances');
  console.log(sb.rows[0]);

  console.log('--- SAMPLE BINS (first 10) ---');
  const sampleBins = await client.query('SELECT id, rack_id, code, name FROM bins LIMIT 10');
  console.log(sampleBins.rows);

  await client.end();
}

inspect().catch(console.error);
