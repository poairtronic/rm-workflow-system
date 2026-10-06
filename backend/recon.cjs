const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres' });

async function run() {
  await client.connect();
  console.log("=== STOCK TRANSACTIONS ===");
  const txs = await client.query(`
    SELECT t.transaction_type, p.code as product, b.code as bin, t.quantity, t.reference_type, t.remarks
    FROM stock_transactions t
    JOIN products p ON t.product_id = p.id
    JOIN bins b ON t.bin_id = b.id
    ORDER BY t.created_at ASC
  `);
  console.table(txs.rows);

  console.log("=== STOCK BALANCES ===");
  const bals = await client.query(`
    SELECT p.code as product, b.code as bin, sb.current_quantity, p.id as product_id, b.id as bin_id
    FROM stock_balances sb
    JOIN products p ON sb.product_id = p.id
    JOIN bins b ON sb.bin_id = b.id
    ORDER BY p.code ASC
  `);
  console.table(bals.rows);

  console.log("=== COUNTS ===");
  const dcs = await client.query('SELECT COUNT(*) as count FROM delivery_challans');
  const dci = await client.query('SELECT COUNT(*) as count FROM delivery_challan_items');
  const txC = await client.query('SELECT COUNT(*) as count FROM stock_transactions');
  console.log(`delivery_challans: ${dcs.rows[0].count}, delivery_challan_items: ${dci.rows[0].count}, stock_transactions: ${txC.rows[0].count}`);

  await client.end();
}
run().catch(console.error);
