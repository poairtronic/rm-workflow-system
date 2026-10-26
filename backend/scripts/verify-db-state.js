import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/.env' });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function verify() {
  await client.connect();

  const totalScs = await client.query('SELECT count(*) FROM sales_order_components');
  console.log('Total sales_order_components:', totalScs.rows[0].count);

  const longNames = await client.query("SELECT sc_number, product_name FROM sales_order_components WHERE length(product_name) > 50 OR product_name ILIKE '%RACK%' OR product_name ILIKE '%NO EN%'");
  console.log('Long / corrupted names count:', longNames.rows.length);
  if (longNames.rows.length > 0) {
    console.log(longNames.rows);
  }

  const stockBal = await client.query('SELECT count(*) FROM stock_balances');
  console.log('Total stock_balances:', stockBal.rows[0].count);

  const dcRes = await client.query('SELECT count(*) FROM delivery_challan_items');
  console.log('Total DC items:', dcRes.rows[0].count);

  const sampleUpdated = await client.query("SELECT sc_number, product_name FROM sales_order_components WHERE sc_number IN ('2405-1', '2405-2', '2405-3', '2410-1', '2410-2', '2410-3', '2423-1', '2423-2', '2423-3', '2434-1', '2442-1', '2445-1', '2446-1', '2446-2', '2446-3', '2448-1', '2448-2', '2456-1') ORDER BY sc_number");
  console.log('Sample verified SCs:');
  console.table(sampleUpdated.rows);

  await client.end();
}

verify().catch(console.error);
