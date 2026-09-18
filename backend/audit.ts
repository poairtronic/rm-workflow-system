import { ALL_ENTITIES } from './src/config/data-source.js';
import { DataSource } from 'typeorm';

async function runAudit() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';
  console.log('Connecting to', dbUrl);
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: ALL_ENTITIES,
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected successfully.');

    // Table Counts
    const inventoryItemsCount = await dataSource.query(`SELECT COUNT(*) FROM inventory_items`);
    const productsCount = await dataSource.query(`SELECT COUNT(*) FROM products`);
    const stockBalancesCount = await dataSource.query(`SELECT COUNT(*) FROM stock_balances`);
    const stockTransactionsCount = await dataSource.query(`SELECT COUNT(*) FROM stock_transactions`);
    
    // Deeper InventoryItem check
    const mappedItems = await dataSource.query(`SELECT COUNT(*) FROM stock_balances WHERE inventory_item_id IS NOT NULL AND product_id IS NOT NULL`);
    const legacyOnlyItems = await dataSource.query(`SELECT COUNT(*) FROM stock_balances WHERE inventory_item_id IS NOT NULL AND product_id IS NULL`);
    const productOnlyBalances = await dataSource.query(`SELECT COUNT(*) FROM stock_balances WHERE inventory_item_id IS NULL AND product_id IS NOT NULL`);
    
    const legacyTxCount = await dataSource.query(`SELECT COUNT(*) FROM stock_transactions WHERE inventory_item_id IS NOT NULL`);
    const productTxCount = await dataSource.query(`SELECT COUNT(*) FROM stock_transactions WHERE product_id IS NOT NULL`);

    console.log({
      inventoryItemsCount: parseInt(inventoryItemsCount[0].count),
      productsCount: parseInt(productsCount[0].count),
      stockBalancesCount: parseInt(stockBalancesCount[0].count),
      stockTransactionsCount: parseInt(stockTransactionsCount[0].count),
      mappedItems: parseInt(mappedItems[0].count),
      legacyOnlyItems: parseInt(legacyOnlyItems[0].count),
      productOnlyBalances: parseInt(productOnlyBalances[0].count),
      legacyTxCount: parseInt(legacyTxCount[0].count),
      productTxCount: parseInt(productTxCount[0].count),
    });

  } catch (error) {
    console.error('DATABASE RUNTIME VALIDATION BLOCKED:', error.message);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runAudit();
