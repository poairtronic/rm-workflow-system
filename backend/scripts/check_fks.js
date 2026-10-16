import 'dotenv/config';
import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const query = `
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('products', 'bins', 'racks', 'warehouse_locations', 'warehouses', 'product_families');
  `;
  const res = await client.query(query);
  console.log('Foreign keys:');
  for (const r of res.rows) {
    console.log(`  ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
  }

  await client.end();
}

main().catch(console.error);
