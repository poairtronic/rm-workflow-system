import pg from 'pg';
import 'dotenv/config';

async function run() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const txRes = await client.query(`
    SELECT id, transaction_type, product_id, source_bin_id, destination_bin_id, quantity 
    FROM stock_transactions 
    WHERE reference_id IN ('1bd8503d-4eeb-4f2d-ac0b-2208e1887ab3', '859215d2-8e45-499c-b65f-62b5879e74b7')
  `);
  console.log("Stock Transactions:", txRes.rows);

  const prodRes = await client.query(`
    SELECT product_id, bin_id, current_quantity 
    FROM stock_balances 
    WHERE product_id IN ('01c7f65b-f6fc-4a60-93ac-491fb39b9852', 'dbfab27a-22ab-409a-9724-8596567608cb')
  `);
  console.log("Current Balances:", prodRes.rows);

  await client.end();
}
run();
