require('dotenv').config();
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

  // check if balances match ledger
  let fixNeeded = false;
  for (const bal of bals.rows) {
    const tx = txs.rows.filter(t => t.product === bal.product && t.bin === bal.bin);
    let expected = 0;
    tx.forEach(t => {
      if (t.transaction_type === 'STOCK_IN' || t.transaction_type === 'ADJUSTMENT_ADD' || t.transaction_type === 'RETURN') {
        expected += parseFloat(t.quantity);
      } else if (t.transaction_type === 'STOCK_OUT' || t.transaction_type === 'ADJUSTMENT_SUBTRACT' || t.transaction_type === 'ISSUE') {
        expected -= parseFloat(t.quantity);
      }
    });
    if (parseFloat(bal.current_quantity) !== expected) {
      console.log(`Mismatch for ${bal.product} in ${bal.bin}: balance=${bal.current_quantity}, expected=${expected}`);
      fixNeeded = true;
      console.log(`BEGIN;`);
      console.log(`UPDATE stock_balances SET current_quantity = ${expected} WHERE product_id = '${bal.product_id}' AND bin_id = '${bal.bin_id}';`);
      console.log(`COMMIT;`);
    }
  }

  await client.end();
}
run().catch(console.error);
