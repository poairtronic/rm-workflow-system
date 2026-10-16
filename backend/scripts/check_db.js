import 'dotenv/config';
import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('Tables:', tables.rows.map((r) => r.table_name));

  const warehouses = await client.query('SELECT * FROM warehouses');
  console.log('Warehouses:', warehouses.rows);

  const locations = await client.query('SELECT * FROM warehouse_locations');
  console.log('Locations count:', locations.rows.length, locations.rows);

  const racks = await client.query('SELECT * FROM racks');
  console.log('Racks count:', racks.rows.length);

  const bins = await client.query('SELECT * FROM bins');
  console.log('Bins count:', bins.rows.length);

  const families = await client.query('SELECT * FROM product_families');
  console.log('Product Families count:', families.rows.length, families.rows.map(f => f.name));

  const products = await client.query('SELECT count(*) FROM products');
  console.log('Products count:', products.rows[0].count);

  const stockBalances = await client.query('SELECT count(*) FROM stock_balances');
  console.log('Stock balances count:', stockBalances.rows[0].count);

  await client.end();
}

main().catch(console.error);
