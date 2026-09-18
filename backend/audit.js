import pkg from 'pg';
const { Client } = pkg;

async function runAudit() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';
  console.log('Connecting to', dbUrl);
  
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('Database connected successfully.');

    // Table Counts
    const inventoryItemsCount = await client.query(`SELECT COUNT(*) FROM inventory_items`);
    const productsCount = await client.query(`SELECT COUNT(*) FROM products`);
    const stockBalancesCount = await client.query(`SELECT COUNT(*) FROM stock_balances`);
    const stockTransactionsCount = await client.query(`SELECT COUNT(*) FROM stock_transactions`);
    
    // Deeper InventoryItem check
    const mappedItems = await client.query(`SELECT COUNT(*) FROM stock_balances WHERE inventory_item_id IS NOT NULL AND product_id IS NOT NULL`);
    const legacyOnlyItems = await client.query(`SELECT COUNT(*) FROM stock_balances WHERE inventory_item_id IS NOT NULL AND product_id IS NULL`);
    const productOnlyBalances = await client.query(`SELECT COUNT(*) FROM stock_balances WHERE inventory_item_id IS NULL AND product_id IS NOT NULL`);
    
    const legacyTxCount = await client.query(`SELECT COUNT(*) FROM stock_transactions WHERE inventory_item_id IS NOT NULL`);
    const productTxCount = await client.query(`SELECT COUNT(*) FROM stock_transactions WHERE product_id IS NOT NULL`);

    console.log({
      inventoryItemsCount: parseInt(inventoryItemsCount.rows[0].count),
      productsCount: parseInt(productsCount.rows[0].count),
      stockBalancesCount: parseInt(stockBalancesCount.rows[0].count),
      stockTransactionsCount: parseInt(stockTransactionsCount.rows[0].count),
      mappedItems: parseInt(mappedItems.rows[0].count),
      legacyOnlyItems: parseInt(legacyOnlyItems.rows[0].count),
      productOnlyBalances: parseInt(productOnlyBalances.rows[0].count),
      legacyTxCount: parseInt(legacyTxCount.rows[0].count),
      productTxCount: parseInt(productTxCount.rows[0].count),
    });

  } catch (error) {
    console.error('DATABASE RUNTIME VALIDATION BLOCKED:', error.message);
  } finally {
    await client.end();
  }
}

runAudit();
