const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });
  await client.connect();
  const tables = [
    'purchase_orders',
    'sales_order_components',
    'rm_requests',
    'rm_items',
    'material_issues',
    'material_receipts',
    'additional_requests',
    'material_consumptions',
    'material_returns',
    'notifications'
  ];
  for (const t of tables) {
    const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', [t]);
    console.log(`[${t}]: ${res.rows.map(r => r.column_name).join(', ')}`);
  }
  await client.end();
}

main().catch(console.error);
